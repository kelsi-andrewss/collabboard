import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Folder, Trash2, ArrowUp, ArrowDown, Globe, Lock, UserPlus } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useBoardsList } from '../hooks/useBoardsList';
import { useGlobalPresence } from '../hooks/useGlobalPresence';
import { GroupCard } from './GroupCard.jsx';
import { groupToSlug } from '../utils/slugUtils.js';
import './BoardSelector.css';

function formatDate(ts) {
  if (!ts) return '';
  const ms = ts.toMillis?.() ?? (ts.seconds ? ts.seconds * 1000 : null);
  if (!ms) return '';
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60 * 1000) return 'just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const BOARD_CARD_HEIGHT = 116;
const BOARD_CARD_GAP = 8;
const BOARD_CARDS_PADDING = 16;
const GROUP_HEADER_HEIGHT = 44;
const SEE_ALL_HEIGHT = 36;
const COLUMN_ITEM_GAP = 16;

function estimateItemHeight(item) {
  if (item.type === 'board') return BOARD_CARD_HEIGHT;
  const shown = Math.min(item.boards.length, 3);
  const boardsH = shown * BOARD_CARD_HEIGHT + Math.max(0, shown - 1) * BOARD_CARD_GAP;
  return GROUP_HEADER_HEIGHT + BOARD_CARDS_PADDING + boardsH + (item.boards.length > 3 ? SEE_ALL_HEIGHT : 0);
}

function distributeToColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));
  for (const item of items) {
    const shortest = columns.reduce((min, col) => col.height < min.height ? col : min, columns[0]);
    shortest.items.push(item);
    shortest.height += estimateItemHeight(item) + COLUMN_ITEM_GAP;
  }
  return columns.map(c => c.items);
}

const SORT_KEY = 'collaboard_group_sort';

const loadGroupSort = () => {
  try { return JSON.parse(localStorage.getItem(SORT_KEY)) || {}; } catch { return {}; }
};
const saveGroupSort = (mode, order, asc, view) =>
  localStorage.setItem(SORT_KEY, JSON.stringify({ mode, order, asc, view }));

export function BoardSelector({ onSelectBoard, onNavigateToGroup, onNavigateToBoard, darkMode, setDarkMode, user, logout }) {
  const { boards, loading, createBoard, deleteBoard, deleteGroup, inviteMember } = useBoardsList(user);
  const globalPresence = useGlobalPresence();
  const [showModal, setShowModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [newBoardVisibility, setNewBoardVisibility] = useState('private');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteError, setInviteError] = useState(null);
  const [inviteLooking, setInviteLooking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState(() => {
    const m = loadGroupSort().mode;
    return ['recent', 'name', 'count'].includes(m) ? m : 'recent';
  });
  const [sortAsc, setSortAsc] = useState(() => loadGroupSort().asc ?? false);
  const [boardView, setBoardView] = useState(() => {
    const v = loadGroupSort().view;
    return ['my', 'public', 'all'].includes(v) ? v : 'my';
  });
  const groupDropdownRef = useRef(null);
  const groupInputRef = useRef(null);
  const boardNameInputRef = useRef(null);
  const masonryContainerRef = useRef(null);
  const [columnCount, setColumnCount] = useState(5);

  useEffect(() => {
    const el = masonryContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setColumnCount(Math.max(1, Math.min(5, Math.floor(w / 280))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const existingGroups = [...new Set(boards.map(b => b.group).filter(Boolean))];
  const filteredGroups = newGroupName
    ? existingGroups.filter(g => g.toLowerCase().includes(newGroupName.toLowerCase()))
    : existingGroups;
  const isNewGroup = newGroupName.trim() && !existingGroups.some(g => g.toLowerCase() === newGroupName.trim().toLowerCase());

  const handleInviteLookup = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLooking(true);
    setInviteError(null);
    try {
      const email = inviteEmail.trim().toLowerCase();
      if (user && email === user.email?.toLowerCase()) {
        setInviteError('You are already the owner.');
        setInviteLooking(false);
        return;
      }
      if (pendingInvites.some(i => i.email === email)) {
        setInviteError('Already added.');
        setInviteLooking(false);
        return;
      }
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const snap = await getDocs(q);
      if (snap.empty) {
        setInviteError('No user found with that email.');
        setInviteLooking(false);
        return;
      }
      const userData = snap.docs[0].data();
      setPendingInvites(prev => [...prev, {
        uid: snap.docs[0].id,
        email,
        displayName: userData.displayName || email,
        photoURL: userData.photoURL || null,
        role: inviteRole,
      }]);
      setInviteEmail('');
    } catch {
      setInviteError('Failed to look up user.');
    }
    setInviteLooking(false);
  };

  const removeInvite = (uid) => setPendingInvites(prev => prev.filter(i => i.uid !== uid));
  const updateInviteRole = (uid, role) => setPendingInvites(prev => prev.map(i => i.uid === uid ? { ...i, role } : i));

  const resetModalState = () => {
    setNewBoardName('');
    setNewGroupName('');
    setGroupDropdownOpen(false);
    setNewBoardVisibility('private');
    setPendingInvites([]);
    setInviteEmail('');
    setInviteRole('editor');
    setInviteError(null);
    setShowModal(false);
  };

  const submitCreate = async (name, group) => {
    const ref = await createBoard(name, group || null, newBoardVisibility);
    for (const inv of pendingInvites) {
      inviteMember(ref.id, inv.uid, inv.role).catch(() => {});
    }
    resetModalState();
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

  const visibleBoards = boards.filter(b => {
    if (boardView === 'my') {
      if (!user) return true;
      if (!b.ownerId && !b.visibility) return true;
      return b.ownerId === user.uid || (b.members && b.members[user.uid]);
    }
    if (boardView === 'public') {
      return b.visibility === 'public';
    }
    return true;
  });

  const groups = visibleBoards.reduce((acc, board) => {
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

  const applySort = (entries) => {
    let sorted;
    if (sortMode === 'recent') {
      sorted = [...entries].sort(([a, aBoards], [b, bBoards]) => {
        const aNull = a === null || a === 'null';
        const bNull = b === null || b === 'null';
        if (aNull) return -1;
        if (bNull) return 1;
        const aTime = aBoards[0]?.updatedAt?.toMillis?.() ?? aBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
        const bTime = bBoards[0]?.updatedAt?.toMillis?.() ?? bBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
        return bTime - aTime;
      });
    } else if (sortMode === 'name') {
      sorted = [...entries].sort(([a], [b]) => {
        const aNull = a === null || a === 'null';
        const bNull = b === null || b === 'null';
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        return String(a).localeCompare(String(b));
      });
    } else if (sortMode === 'count') {
      sorted = [...entries].sort(([, aBoards], [, bBoards]) => bBoards.length - aBoards.length);
    } else {
      sorted = entries;
    }
    if (sortAsc) {
      sorted = [...sorted].reverse();
    }
    return sorted;
  };

  const sortedGroupEntries = applySort(Object.entries(searchedGroups));

  const handleSortModeChange = (mode) => {
    setSortMode(mode);
    saveGroupSort(mode, [], sortAsc, boardView);
  };

  const handleSortDirectionToggle = () => {
    const newAsc = !sortAsc;
    setSortAsc(newAsc);
    saveGroupSort(sortMode, [], newAsc, boardView);
  };

  const handleBoardViewChange = (view) => {
    setBoardView(view);
    saveGroupSort(sortMode, [], sortAsc, view);
  };

  return (
    <div className="board-selector-container">
      <div className="board-selector-inner">
      <div className="controls-bar">
        <div className="dashboard-search">
          <Search size={16} className="dashboard-search-icon" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dashboard-search-input"
          />
          {searchQuery && (
            <button className="dashboard-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
        <div className="controls-bar-center">
          {user && (
            <div className="filter-pill-group">
              {['my', 'public', 'all'].map(view => (
                <button
                  key={view}
                  className={`sort-btn${boardView === view ? ' sort-btn--active' : ''}`}
                  onClick={() => handleBoardViewChange(view)}
                >
                  {view === 'my' ? 'My Boards' : view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          )}
          <div className="sort-pill-group">
            {['recent', 'name', 'count'].map(mode => (
              <button
                key={mode}
                className={`sort-btn${sortMode === mode ? ' sort-btn--active' : ''}`}
                onClick={() => handleSortModeChange(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          <button
            className="sort-direction-btn"
            onClick={handleSortDirectionToggle}
            title={sortAsc ? 'Ascending' : 'Descending'}
          >
            {sortAsc ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>
        </div>
        <button className="new-board-btn" onClick={() => setShowModal(true)}>
          <Plus size={15} />
          New Board
        </button>
      </div>

      {(() => {
        const ungroupedEntry = sortedGroupEntries.find(([k]) => k === null || k === 'null');
        const groupedEntries = sortedGroupEntries.filter(([k]) => k !== null && k !== 'null');
        const ungroupedBoards = ungroupedEntry ? ungroupedEntry[1] : [];

        const allItems = [
          ...groupedEntries.map(([groupKey, groupBoards]) => ({
            type: 'group',
            key: groupKey,
            boards: groupBoards,
            sortTime: groupBoards[0]?.updatedAt?.toMillis?.() ?? (groupBoards[0]?.updatedAt?.seconds ?? 0) * 1000,
            sortName: groupKey,
          })),
          ...ungroupedBoards.map(board => ({
            type: 'board',
            key: board.id,
            board,
            sortTime: board.updatedAt?.toMillis?.() ?? (board.updatedAt?.seconds ?? 0) * 1000,
            sortName: board.name,
          })),
        ];

        allItems.sort((a, b) => {
          let cmp = 0;
          if (sortMode === 'name') {
            cmp = (a.sortName ?? '').localeCompare(b.sortName ?? '');
          } else if (sortMode === 'count') {
            const aCount = a.type === 'group' ? a.boards.length : 1;
            const bCount = b.type === 'group' ? b.boards.length : 1;
            cmp = bCount - aCount;
          } else {
            cmp = b.sortTime - a.sortTime;
          }
          return sortAsc ? -cmp : cmp;
        });

        const masonryItems = allItems;

        const onlineForBoard = (boardId) => globalPresence?.[boardId] || [];

        return (
          <div className="masonry-columns-container" ref={masonryContainerRef}>
          {masonryItems.length === 0 && (
            <div className="empty-state">
              <p>{visibleBoards.length === 0 ? 'No boards yet. Hit the + button to create your first one!' : `No boards match "${searchQuery}"`}</p>
            </div>
          )}
            {distributeToColumns(masonryItems, columnCount).map((colItems, colIdx) => (
              <div key={colIdx} className="masonry-column">
                {colItems.map(item => {
                  if (item.type === 'group') {
                    return (
                      <GroupCard
                        key={item.key}
                        group={item.key === 'null' ? null : item.key}
                        boards={item.boards}
                        onNavigateToGroup={onNavigateToGroup || (() => {})}
                        onNavigateToBoard={onNavigateToBoard || ((slug, id, name) => onSelectBoard(id, name))}
                        globalPresence={globalPresence}
                        onDeleteBoard={deleteBoard}
                        onDeleteGroup={deleteGroup}
                        draggable={false}
                      />
                    );
                  }
                  const b = item.board;
                  const onlineUsers = onlineForBoard(b.id);
                  const visibleOnline = onlineUsers.slice(0, 3);
                  const extraOnline = onlineUsers.length - 3;
                  return (
                    <div
                      key={b.id}
                      className="board-card standalone-board-card"
                      onClick={() => onNavigateToBoard ? onNavigateToBoard(null, b.id, b.name) : onSelectBoard(b.id, b.name)}
                    >
                      <div className="board-card-thumbnail">
                        {b.thumbnail
                          ? <img src={b.thumbnail} alt="" className="board-card-thumbnail-img" />
                          : <div className="board-card-thumbnail-placeholder" />
                        }
                      </div>
                      <div className="board-card-info">
                        <div className="board-card-row">
                          <span className="board-card-name">{b.name}</span>
                          {deleteBoard && (
                            <button
                              className="board-card-delete-btn"
                              title="Delete board"
                              onClick={(e) => { e.stopPropagation(); deleteBoard(b.id); }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="board-card-meta">
                          <span className="board-card-date">{formatDate(b.updatedAt)}</span>
                          {onlineUsers.length > 0 && (
                            <div className="board-card-online">
                              {visibleOnline.map((u, i) => (
                                <div key={i} className="board-card-avatar" style={{ backgroundColor: u.color }} title={u.name}>
                                  {u.photoURL ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" /> : u.name?.charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {extraOnline > 0 && <div className="board-card-avatar board-card-avatar-extra">+{extraOnline}</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={resetModalState}>
          <div className="modal-card modal-card--create" onClick={e => e.stopPropagation()}>
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
              <div className="form-group">
                <label>Visibility</label>
                <div className="visibility-pill-group">
                  <button
                    type="button"
                    className={`visibility-pill${newBoardVisibility === 'private' ? ' visibility-pill--active' : ''}`}
                    onClick={() => setNewBoardVisibility('private')}
                  >
                    <Lock size={14} /> Private
                  </button>
                  <button
                    type="button"
                    className={`visibility-pill${newBoardVisibility === 'public' ? ' visibility-pill--active' : ''}`}
                    onClick={() => setNewBoardVisibility('public')}
                  >
                    <Globe size={14} /> Public
                  </button>
                </div>
              </div>
              {newBoardVisibility === 'private' && (
                <div className="form-group">
                  <label>Invite Members <span className="label-optional">(optional)</span></label>
                  {pendingInvites.length > 0 && (
                    <div className="pending-invites">
                      {pendingInvites.map(inv => (
                        <div key={inv.uid} className="pending-invite-row">
                          <div className="pending-invite-info">
                            {inv.photoURL && <img src={inv.photoURL} alt="" className="pending-invite-avatar" referrerPolicy="no-referrer" />}
                            <span className="pending-invite-name">{inv.displayName || inv.email}</span>
                          </div>
                          <select
                            className="member-role-select"
                            value={inv.role}
                            onChange={(e) => updateInviteRole(inv.uid, e.target.value)}
                          >
                            <option value="editor">editor</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <button type="button" className="member-remove-btn" onClick={() => removeInvite(inv.uid)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="invite-form">
                    <input
                      type="email"
                      placeholder="Invite by email..."
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="invite-input"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInviteLookup(e); } }}
                    />
                    <select
                      className="invite-role-select"
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                    >
                      <option value="editor">editor</option>
                      <option value="viewer">viewer</option>
                    </select>
                    <button type="button" className="invite-btn" onClick={handleInviteLookup} disabled={inviteLooking}>
                      <UserPlus size={15} />
                    </button>
                  </div>
                  {inviteError && <p className="invite-error">{inviteError}</p>}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={resetModalState}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={!newBoardName.trim()}>Create Board</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
