import React, { useState, useRef } from 'react';
import { Plus, Search, Folder, Globe } from 'lucide-react';
import { useBoardsList } from '../hooks/useBoardsList';
import { useGlobalPresence } from '../hooks/useGlobalPresence';
import { GroupCard } from './GroupCard.jsx';
import { groupToSlug } from '../utils/slugUtils.js';
import './BoardSelector.css';

const SORT_KEY = 'collaboard_group_sort';
const UNGROUPED_SENTINEL = '__ungrouped';

const loadGroupSort = () => {
  try { return JSON.parse(localStorage.getItem(SORT_KEY)) || {}; } catch { return {}; }
};
const saveGroupSort = (mode, order) =>
  localStorage.setItem(SORT_KEY, JSON.stringify({ mode, order }));

export function BoardSelector({ onSelectBoard, onNavigateToGroup, onNavigateToBoard, darkMode, setDarkMode, user, logout }) {
  const { boards, loading, createBoard, deleteBoard, deleteGroup } = useBoardsList(user);
  const globalPresence = useGlobalPresence();
  const [showModal, setShowModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState(() => loadGroupSort().mode || 'recent');
  const [manualOrder, setManualOrder] = useState(() => loadGroupSort().order || []);
  const [dragOverGroup, setDragOverGroup] = useState(null);
  const dragGroupRef = useRef(null);
  const groupDropdownRef = useRef(null);
  const groupInputRef = useRef(null);
  const boardNameInputRef = useRef(null);

  const existingGroups = [...new Set(boards.map(b => b.group).filter(Boolean))];
  const filteredGroups = newGroupName
    ? existingGroups.filter(g => g.toLowerCase().includes(newGroupName.toLowerCase()))
    : existingGroups;
  const isNewGroup = newGroupName.trim() && !existingGroups.some(g => g.toLowerCase() === newGroupName.trim().toLowerCase());

  const submitCreate = async (name, group) => {
    const ref = await createBoard(name, group || null);
    setNewBoardName('');
    setNewGroupName('');
    setGroupDropdownOpen(false);
    setShowModal(false);
    onSelectBoard(ref.id, name);
  };

  const handleAddBoard = (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    submitCreate(newBoardName.trim(), newGroupName.trim());
  };

  const handleGroupKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!newBoardName.trim()) {
        boardNameInputRef.current?.focus();
        return;
      }
      submitCreate(newBoardName.trim(), newGroupName.trim());
    } else if (e.key === 'Escape') {
      setGroupDropdownOpen(false);
      groupInputRef.current?.blur();
    }
  };

  if (loading) return <div className="loading">Loading boards...</div>;

  const myBoards = boards.filter(b => {
    if (!user) return true;
    if (!b.ownerId && !b.visibility) return true;
    return b.ownerId === user.uid || (b.members && b.members[user.uid]);
  });
  const publicOnlyBoards = boards.filter(b => {
    if (!user) return false;
    if (!b.ownerId && !b.visibility) return false;
    if (b.visibility !== 'public') return false;
    return b.ownerId !== user.uid && !(b.members && b.members[user.uid]);
  });

  const groups = myBoards.reduce((acc, board) => {
    const g = board.group || null;
    if (!acc[g]) acc[g] = [];
    acc[g].push(board);
    return acc;
  }, {});

  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? a.updatedAt?.seconds * 1000 ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? b.updatedAt?.seconds * 1000 ?? 0;
      return bTime - aTime;
    });
  }

  const q = searchQuery.trim().toLowerCase();
  const searchedGroups = {};
  for (const [key, groupBoards] of Object.entries(groups)) {
    const matchedBoards = q
      ? groupBoards.filter(b =>
          b.name.toLowerCase().includes(q) ||
          (key !== 'null' && key !== null && String(key).toLowerCase().includes(q))
        )
      : groupBoards;
    if (matchedBoards.length > 0) searchedGroups[key] = matchedBoards;
  }

  const toSentinel = (key) => (key === null || key === 'null') ? UNGROUPED_SENTINEL : key;
  const fromSentinel = (s) => s === UNGROUPED_SENTINEL ? null : s;

  const applySort = (entries) => {
    if (sortMode === 'recent') {
      return [...entries].sort(([a, aBoards], [b, bBoards]) => {
        const aNull = a === null || a === 'null';
        const bNull = b === null || b === 'null';
        if (aNull) return -1;
        if (bNull) return 1;
        const aTime = aBoards[0]?.updatedAt?.toMillis?.() ?? aBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
        const bTime = bBoards[0]?.updatedAt?.toMillis?.() ?? bBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
        return bTime - aTime;
      });
    }
    if (sortMode === 'name') {
      return [...entries].sort(([a], [b]) => {
        const aNull = a === null || a === 'null';
        const bNull = b === null || b === 'null';
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        return String(a).localeCompare(String(b));
      });
    }
    if (sortMode === 'count') {
      return [...entries].sort(([, aBoards], [, bBoards]) => bBoards.length - aBoards.length);
    }
    if (sortMode === 'manual') {
      return [...entries].sort(([a], [b]) => {
        const ai = manualOrder.indexOf(toSentinel(a));
        const bi = manualOrder.indexOf(toSentinel(b));
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    }
    return entries;
  };

  const sortedGroupEntries = applySort(Object.entries(searchedGroups));

  const handleSortModeChange = (mode) => {
    const currentOrder = sortedGroupEntries.map(([key]) => toSentinel(key));
    setManualOrder(currentOrder);
    setSortMode(mode);
    saveGroupSort(mode, currentOrder);
  };

  const handleDragStart = (groupKey) => {
    dragGroupRef.current = groupKey;
  };

  const handleDragOver = (groupKey, e) => {
    e.preventDefault();
    setDragOverGroup(groupKey);
  };

  const handleDrop = (targetKey) => {
    const sourceKey = dragGroupRef.current;
    if (sourceKey === null || sourceKey === targetKey) {
      setDragOverGroup(null);
      return;
    }
    const currentOrder = sortedGroupEntries.map(([key]) => toSentinel(key));
    const sourceIdx = currentOrder.indexOf(toSentinel(sourceKey));
    const targetIdx = currentOrder.indexOf(toSentinel(targetKey));
    if (sourceIdx === -1 || targetIdx === -1) {
      setDragOverGroup(null);
      return;
    }
    const newOrder = [...currentOrder];
    newOrder.splice(sourceIdx, 1);
    newOrder.splice(targetIdx, 0, toSentinel(sourceKey));
    setManualOrder(newOrder);
    saveGroupSort('manual', newOrder);
    dragGroupRef.current = null;
    setDragOverGroup(null);
  };

  const handleDragEnd = () => {
    dragGroupRef.current = null;
    setDragOverGroup(null);
  };

  const showSortControls = Object.keys(searchedGroups).length >= 2;

  return (
    <div className="board-selector-container">
      <div className="selector-header">
        <p>Your private and shared boards</p>
        <div className="selector-header-actions">
          <div className="dashboard-search">
            <Search size={16} className="dashboard-search-icon" />
            <input
              type="text"
              placeholder="Search boards and groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="dashboard-search-input"
            />
            {searchQuery && (
              <button className="dashboard-search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
          <button className="new-board-btn" onClick={() => setShowModal(true)}>
            <Plus size={15} />
            New Board
          </button>
        </div>
      </div>

      {showSortControls && (
        <div className="sort-controls">
          {['recent', 'name', 'count', 'manual'].map(mode => (
            <button
              key={mode}
              className={`sort-btn${sortMode === mode ? ' sort-btn--active' : ''}`}
              onClick={() => handleSortModeChange(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="group-cards-grid">
        {sortedGroupEntries.map(([groupKey, groupBoards]) => {
          const normalizedKey = groupKey === 'null' ? null : groupKey;
          const sentinelKey = toSentinel(groupKey);
          return (
            <GroupCard
              key={groupKey}
              group={normalizedKey}
              boards={groupBoards}
              onNavigateToGroup={onNavigateToGroup || (() => {})}
              onNavigateToBoard={onNavigateToBoard || ((slug, id, name) => onSelectBoard(id, name))}
              globalPresence={globalPresence}
              onDeleteBoard={deleteBoard}
              onDeleteGroup={deleteGroup}
              draggable={sortMode === 'manual'}
              onDragStart={() => handleDragStart(sentinelKey)}
              onDragOver={(e) => handleDragOver(sentinelKey, e)}
              onDrop={() => handleDrop(sentinelKey)}
              onDragLeave={() => setDragOverGroup(null)}
              onDragEnd={handleDragEnd}
              isDragOver={dragOverGroup === sentinelKey}
            />
          );
        })}
        {myBoards.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <p>No boards yet. Hit the + button to create your first one!</p>
          </div>
        )}
        {myBoards.length > 0 && sortedGroupEntries.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <p>No boards match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}
      </div>

      {publicOnlyBoards.length > 0 && (
        <div className="public-boards-section">
          <div className="public-boards-header">
            <Globe size={16} />
            <span>Public Boards</span>
          </div>
          <div className="group-cards-grid" style={{ padding: '12px 40px' }}>
            <GroupCard
              group={null}
              boards={publicOnlyBoards.filter(b => !q || b.name.toLowerCase().includes(q))}
              onNavigateToGroup={() => {}}
              onNavigateToBoard={onNavigateToBoard || ((slug, id, name) => onSelectBoard(id, name))}
              globalPresence={globalPresence}
            />
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Create New Board</h2>
            <form onSubmit={handleAddBoard}>
              <div className="form-group">
                <label>Board Name</label>
                <input
                  ref={boardNameInputRef}
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="My Creative Board"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Group <span className="label-optional">(optional)</span></label>
                <div className="group-search-wrapper" ref={groupDropdownRef}>
                  <div className="group-search-input-row">
                    {isNewGroup
                      ? <Plus size={14} className="group-search-icon group-search-icon--plus" />
                      : <Search size={14} className="group-search-icon" />
                    }
                    <input
                      ref={groupInputRef}
                      type="text"
                      value={newGroupName}
                      onChange={(e) => {
                        setNewGroupName(e.target.value);
                        setGroupDropdownOpen(true);
                      }}
                      onFocus={() => setGroupDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setGroupDropdownOpen(false), 150)}
                      onKeyDown={handleGroupKeyDown}
                      placeholder="Search or create a group..."
                    />
                    {newGroupName && (
                      <button
                        type="button"
                        className="group-clear-btn"
                        onClick={() => {
                          setNewGroupName('');
                          setGroupDropdownOpen(false);
                          groupInputRef.current?.focus();
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {isNewGroup && newGroupName && (
                    <div className="group-new-hint">
                      <Plus size={12} /> New group &ldquo;{newGroupName.trim()}&rdquo;
                      {newBoardName.trim() ? ' — press Enter to create' : ' — enter a board name first'}
                    </div>
                  )}
                  {groupDropdownOpen && filteredGroups.length > 0 && (
                    <div className="group-dropdown-list">
                      {filteredGroups.map(g => (
                        <div
                          key={g}
                          className="group-dropdown-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setNewGroupName(g);
                            setGroupDropdownOpen(false);
                          }}
                        >
                          <Folder size={14} /> {g}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => { setShowModal(false); setNewGroupName(''); setGroupDropdownOpen(false); }}>Cancel</button>
                <button type="submit" className="primary-btn">Create Board</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
