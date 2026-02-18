import React, { useState, useRef } from 'react';
import { Plus, Search } from 'lucide-react';
import { useBoardsList } from '../hooks/useBoardsList';
import { GroupCard } from './GroupCard.jsx';
import { groupToSlug } from '../utils/slugUtils.js';
import './BoardSelector.css';

export function BoardSelector({ onSelectBoard, onNavigateToGroup, onNavigateToBoard, darkMode, setDarkMode, user, logout }) {
  const { boards, loading, createBoard } = useBoardsList();
  const [showModal, setShowModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Group boards - null key for ungrouped boards
  const groups = boards.reduce((acc, board) => {
    const g = board.group || null;
    if (!acc[g]) acc[g] = [];
    acc[g].push(board);
    return acc;
  }, {});

  // Sort boards within each group by updatedAt descending
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? a.updatedAt?.seconds * 1000 ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? b.updatedAt?.seconds * 1000 ?? 0;
      return bTime - aTime;
    });
  }

  // Filter boards/groups by search query
  const q = searchQuery.trim().toLowerCase();
  const searchedGroups = {};
  for (const [key, groupBoards] of Object.entries(groups)) {
    const matchedBoards = q
      ? groupBoards.filter(b =>
          b.name.toLowerCase().includes(q) ||
          (key !== 'null' && key.toLowerCase().includes(q))
        )
      : groupBoards;
    if (matchedBoards.length > 0) searchedGroups[key] = matchedBoards;
  }

  // Sort groups: ungrouped (null) first, then named groups by most-recently-edited board desc
  const sortedGroupEntries = Object.entries(searchedGroups).sort(([a, aBoards], [b, bBoards]) => {
    if (a === 'null') return -1;
    if (b === 'null') return 1;
    const aTime = aBoards[0]?.updatedAt?.toMillis?.() ?? aBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
    const bTime = bBoards[0]?.updatedAt?.toMillis?.() ?? bBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
    return bTime - aTime;
  });

  return (
    <div className="board-selector-container">
      <div className="selector-header">
        <p>Everyone can see and edit all boards</p>
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
      </div>

      <div className="group-cards-grid">
        {sortedGroupEntries.map(([groupKey, groupBoards]) => (
          <GroupCard
            key={groupKey}
            group={groupKey === 'null' ? null : groupKey}
            boards={groupBoards}
            onNavigateToGroup={onNavigateToGroup || (() => {})}
            onNavigateToBoard={onNavigateToBoard || ((slug, id, name) => onSelectBoard(id, name))}
          />
        ))}
        {boards.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <p>No boards yet. Hit the + button to create your first one!</p>
          </div>
        )}
        {boards.length > 0 && sortedGroupEntries.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <p>No boards match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}
      </div>

      <button className="create-board-fab" onClick={() => setShowModal(true)} title="Create New Board">
        <Plus size={32} />
      </button>

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
