import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, Folder, Trash2, ArrowUp, ArrowDown, Globe, Lock, UserPlus, LayoutGrid, Users, GripVertical } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
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
  if (shown === 0) return GROUP_HEADER_HEIGHT + BOARD_CARDS_PADDING + SEE_ALL_HEIGHT;
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

export function BoardSelector({ onSelectBoard, onNavigateToGroup, onNavigateToBoard, darkMode, setDarkMode, user, logout, groups: groupsProp = [], createGroup, deleteGroupDoc, isAdmin, adminViewActive, migrateGroupStrings }) {
  const effectiveAdminView = isAdmin && adminViewActive;
  const { boards, loading, createBoard, deleteBoard, deleteGroup, inviteMember, moveBoard } = useBoardsList(user, { isAdminView: effectiveAdminView, groups: groupsProp });
  const globalPresence = useGlobalPresence();
  const [showModal, setShowModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalData, setGroupModalData] = useState({ name: '', visibility: 'private' });
  const [boardRows, setBoardRows] = useState([{ name: '' }]);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupSearchText, setGroupSearchText] = useState('');
  const [newBoardVisibility, setNewBoardVisibility] = useState('private');
  const [pendingInvites, setPendingInvites] = useState([]);
  const pendingInvitesRef = useRef([]);
  const [inviteRole, setInviteRole] = useState('editor');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const userSearchTimerRef = useRef(null);
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
  const [draggingBoard, setDraggingBoard] = useState(null);
  const [dragOverTargetId, setDragOverTargetId] = useState(null);

  const handleBoardDragStart = (e, boardId, sourceGroupId) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ boardId, sourceGroupId }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingBoard({ boardId, sourceGroupId });
  };

  const handleBoardDragEnd = () => {
    setDraggingBoard(null);
    setDragOverTargetId(null);
  };

  const handleGroupDragOver = (e, targetGroupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTargetId(targetGroupId);
  };

  const handleGroupDragLeave = (e, targetGroupId) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTargetId(prev => prev === targetGroupId ? null : prev);
    }
  };

  const handleGroupDrop = (e, targetGroupId) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { boardId, sourceGroupId } = data;
      const normalizedSource = sourceGroupId || null;
      const normalizedTarget = targetGroupId === '__ungrouped__' ? null : (targetGroupId || null);
      if (normalizedSource === normalizedTarget) {
        setDraggingBoard(null);
        setDragOverTargetId(null);
        return;
      }
      moveBoard(boardId, normalizedTarget);
    } catch { /* ignore malformed drag data */ }
    setDraggingBoard(null);
    setDragOverTargetId(null);
  };

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

  const filteredGroupsList = groupSearchText
    ? groupsProp.filter(g => g.name.toLowerCase().includes(groupSearchText.toLowerCase()))
    : groupsProp;

  const selectedGroup = selectedGroupId ? groupsProp.find(g => g.id === selectedGroupId) : null;

  const handleUserSearch = (term) => {
    setUserSearchQuery(term);
    clearTimeout(userSearchTimerRef.current);
    if (!term.trim()) {
      setUserSearchResults([]);
      setUserSearchOpen(false);
      return;
    }
    userSearchTimerRef.current = setTimeout(async () => {
      try {
        const usersRef = collection(db, 'users');
        const lower = term.trim().toLowerCase();
        const q = query(usersRef,
          where('displayNameLower', '>=', lower),
          where('displayNameLower', '<=', lower + '\uf8ff'),
          limit(8)
        );
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u =>
            u.uid !== user?.uid &&
            !pendingInvitesRef.current.some(i => i.uid === u.uid)
          );
        setUserSearchResults(results);
        setUserSearchOpen(results.length > 0);
      } catch (err) {
        console.error('[user search]', err);
        setUserSearchResults([]);
      }
    }, 200);
  };

  const handleUserSelect = (u) => {
    const entry = { uid: u.uid, displayName: u.displayName || u.uid, photoURL: u.photoURL || null, role: inviteRole };
    pendingInvitesRef.current = [...pendingInvitesRef.current, entry];
    setPendingInvites(prev => [...prev, entry]);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setUserSearchOpen(false);
  };

  const removeInvite = (uid) => {
    const next = pendingInvites.filter(i => i.uid !== uid);
    pendingInvitesRef.current = next;
    setPendingInvites(next);
  };
  const updateInviteRole = (uid, role) => {
    const next = pendingInvites.map(i => i.uid === uid ? { ...i, role } : i);
    pendingInvitesRef.current = next;
    setPendingInvites(next);
  };

  const resetModalState = () => {
    setNewBoardName('');
    setSelectedGroupId(null);
    setGroupSearchText('');
    setGroupDropdownOpen(false);
    setNewBoardVisibility('private');
    pendingInvitesRef.current = [];
    setPendingInvites([]);
    setInviteRole('editor');
    setUserSearchQuery('');
    setUserSearchResults([]);
    setUserSearchOpen(false);
    setShowModal(false);
  };

  const resetGroupModalState = () => {
    setGroupModalData({ name: '', visibility: 'private' });
    setBoardRows([{ name: '' }]);
    setShowGroupModal(false);
  };

  const submitCreate = async (name, groupId) => {
    const ref = await createBoard(name, groupId || null, newBoardVisibility);
    for (const inv of pendingInvites) {
      inviteMember(ref.id, inv.uid, inv.role).catch(() => {});
    }
    resetModalState();
    onSelectBoard(ref.id, name);
  };

  const handleAddBoard = (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    submitCreate(newBoardName.trim(), selectedGroupId);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupModalData.name.trim()) return;
    const groupRef = await createGroup(groupModalData.name.trim(), groupModalData.visibility);
    const validRows = boardRows.filter(r => r.name.trim());
    for (const row of validRows) {
      await createBoard(row.name.trim(), groupRef.id, groupModalData.visibility);
    }
    resetGroupModalState();
  };

  const handleGroupKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!newBoardName.trim()) {
        boardNameInputRef.current?.focus();
        return;
      }
      submitCreate(newBoardName.trim(), selectedGroupId);
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
      return b.visibility === 'public' || b.visibility === 'open';
    }
    return true;
  });

  // Group boards by groupId
  const boardsByGroup = {};
  for (const board of visibleBoards) {
    const gId = board.groupId || null;
    if (!boardsByGroup[gId]) boardsByGroup[gId] = [];
    boardsByGroup[gId].push(board);
  }

  // Sort boards within each group by updatedAt
  for (const key of Object.keys(boardsByGroup)) {
    boardsByGroup[key].sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? a.updatedAt?.seconds * 1000 ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? b.updatedAt?.seconds * 1000 ?? 0;
      return bTime - aTime;
    });
  }

  const q = searchQuery.trim().toLowerCase();
  const searchedGroups = {};

  // Groups that have boards
  for (const [gId, groupBoards] of Object.entries(boardsByGroup)) {
    const groupObj = gId && gId !== 'null' ? groupsProp.find(g => g.id === gId) : null;
    const groupName = groupObj?.name || '';
    const matchedBoards = q
      ? groupBoards.filter(b =>
          b.name.toLowerCase().includes(q) ||
          (groupName && groupName.toLowerCase().includes(q))
        )
      : groupBoards;
    if (!q || matchedBoards.length > 0 || groupName.toLowerCase().includes(q)) {
      searchedGroups[gId] = matchedBoards;
    }
  }

  // Groups with zero boards (not in boardsByGroup at all)
  for (const g of groupsProp) {
    if (searchedGroups[g.id] !== undefined) continue;
    if (q && !g.name.toLowerCase().includes(q)) continue;
    searchedGroups[g.id] = [];
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
        const aGroup = groupsProp.find(g => g.id === a);
        const bGroup = groupsProp.find(g => g.id === b);
        return (aGroup?.name || '').localeCompare(bGroup?.name || '');
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
                  {view === 'my' ? 'My Boards' : view === 'public' ? 'Browse' : 'All'}
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
        <div className="new-buttons-group">
          {isAdmin && migrateGroupStrings && (
            <button className="migrate-btn" onClick={async () => {
              await migrateGroupStrings();
              alert('Migration complete');
            }}>
              Migrate Groups
            </button>
          )}
          <button className="new-group-btn" onClick={() => setShowGroupModal(true)}>
            <Folder size={15} />
            New Group
          </button>
          <button className="new-board-btn" onClick={() => setShowModal(true)}>
            <Plus size={15} />
            New Board
          </button>
        </div>
      </div>

      {(() => {
        const ungroupedEntry = sortedGroupEntries.find(([k]) => k === null || k === 'null');
        const groupedEntries = sortedGroupEntries.filter(([k]) => k !== null && k !== 'null');
        const ungroupedBoards = ungroupedEntry ? ungroupedEntry[1] : [];

        const allItems = [
          ...groupedEntries.map(([groupId, groupBoards]) => {
            const groupObj = groupsProp.find(g => g.id === groupId) || null;
            return {
              type: 'group',
              key: groupId,
              groupObj,
              boards: groupBoards,
              sortTime: groupBoards[0]?.updatedAt?.toMillis?.() ?? (groupBoards[0]?.updatedAt?.seconds ?? 0) * 1000,
              sortName: groupObj?.name || groupId,
            };
          }),
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
          <>
          <div className="masonry-columns-container" ref={masonryContainerRef}>
          {masonryItems.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><LayoutGrid size={40} strokeWidth={1.5} /></div>
              <p className="empty-state-title">
                {visibleBoards.length === 0 ? 'No boards yet' : `No boards match "${searchQuery}"`}
              </p>
              {visibleBoards.length === 0 && (
                <p className="empty-state-hint">Hit the + button to create your first one</p>
              )}
            </div>
          )}
            {distributeToColumns(masonryItems, columnCount).map((colItems, colIdx) => (
              <div key={colIdx} className="masonry-column">
                {colItems.map(item => {
                  if (item.type === 'group') {
                    return (
                      <GroupCard
                        key={item.key}
                        group={item.groupObj}
                        boards={item.boards}
                        onNavigateToGroup={onNavigateToGroup || (() => {})}
                        onNavigateToBoard={onNavigateToBoard || ((slug, id, name) => onSelectBoard(id, name))}
                        globalPresence={globalPresence}
                        onDeleteBoard={deleteBoard}
                        onDeleteGroup={deleteGroup}
                        onGroupDragOver={(e) => handleGroupDragOver(e, item.groupObj?.id)}
                        onGroupDrop={(e) => handleGroupDrop(e, item.groupObj?.id)}
                        onGroupDragLeave={(e) => handleGroupDragLeave(e, item.groupObj?.id)}
                        isDragOver={dragOverTargetId === item.groupObj?.id}
                        onMoveBoard={moveBoard}
                        existingGroups={groupsProp}
                        user={user}
                        draggingBoard={draggingBoard}
                        onBoardDragStart={handleBoardDragStart}
                        onBoardDragEnd={handleBoardDragEnd}
                      />
                    );
                  }
                  const b = item.board;
                  const onlineUsers = onlineForBoard(b.id);
                  const visibleOnline = onlineUsers.slice(0, 3);
                  const extraOnline = onlineUsers.length - 3;
                  const isOwner = b.ownerId === user?.uid;
                  const isDragging = draggingBoard?.boardId === b.id;
                  let standaloneCardRef = null;
                  return (
                    <div
                      key={b.id}
                      className={`board-card standalone-board-card${isDragging ? ' board-card--dragging' : ''}`}
                      ref={el => { standaloneCardRef = el; }}
                      onClick={() => onNavigateToBoard ? onNavigateToBoard(null, b.id, b.name) : onSelectBoard(b.id, b.name)}
                    >
                      <div className="board-card-thumbnail">
                        {b.thumbnail
                          ? <img src={b.thumbnail} alt="" className="board-card-thumbnail-img" />
                          : <div className="board-card-thumbnail-placeholder" />
                        }
                        {isOwner && (
                          <span
                            className="board-card-drag-handle"
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              if (standaloneCardRef) {
                                const rect = standaloneCardRef.getBoundingClientRect();
                                e.dataTransfer.setDragImage(standaloneCardRef, rect.width - 8, 8);
                              }
                              handleBoardDragStart(e, b.id, null);
                            }}
                            onDragEnd={handleBoardDragEnd}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical size={12} />
                          </span>
                        )}
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
                                <Avatar
                                  key={i}
                                  photoURL={u.photoURL}
                                  name={u.name}
                                  color={u.color}
                                  size="xs"
                                  className="board-card-avatar"
                                />
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
          {draggingBoard && (
            <div
              className={`ungrouped-drop-zone${dragOverTargetId === '__ungrouped__' ? ' ungrouped-drop-zone--active' : ''}`}
              onDragOver={(e) => handleGroupDragOver(e, '__ungrouped__')}
              onDrop={(e) => handleGroupDrop(e, '__ungrouped__')}
              onDragLeave={(e) => handleGroupDragLeave(e, '__ungrouped__')}
            >
              {draggingBoard?.sourceGroupId ? 'Remove from group' : 'Ungrouped'}
            </div>
          )}
          </>
        );
      })()}
      </div>

      {showGroupModal && (
        <div className="modal-overlay" onClick={resetGroupModalState}>
          <div className="modal-card modal-card--group" onClick={e => e.stopPropagation()}>
            <h2>Create New Group</h2>
            <form onSubmit={handleGroupSubmit}>
              <div className="form-group">
                <label>Group Name</label>
                <input
                  type="text"
                  value={groupModalData.name}
                  onChange={e => setGroupModalData(d => ({ ...d, name: e.target.value }))}
                  placeholder="My Team"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Visibility</label>
                <div className="visibility-pill-group">
                  <button
                    type="button"
                    className={`visibility-pill${groupModalData.visibility === 'private' ? ' visibility-pill--active' : ''}`}
                    onClick={() => setGroupModalData(d => ({ ...d, visibility: 'private' }))}
                  >
                    <Lock size={14} /> Private
                  </button>
                  <button
                    type="button"
                    className={`visibility-pill${groupModalData.visibility === 'public' ? ' visibility-pill--active' : ''}`}
                    onClick={() => setGroupModalData(d => ({ ...d, visibility: 'public' }))}
                  >
                    <Globe size={14} /> Public
                  </button>
                  <button
                    type="button"
                    className={`visibility-pill${groupModalData.visibility === 'open' ? ' visibility-pill--active' : ''}`}
                    onClick={() => setGroupModalData(d => ({ ...d, visibility: 'open' }))}
                  >
                    <Users size={14} /> Open
                  </button>
                </div>
                <p className="visibility-description">
                  {groupModalData.visibility === 'private' && 'Only you and invited members can see this.'}
                  {groupModalData.visibility === 'public' && 'Anyone can find and view this, but only members can edit.'}
                  {groupModalData.visibility === 'open' && 'Anyone can find, view, and edit this.'}
                </p>
              </div>
              <div className="form-group">
                <label>Boards <span className="label-optional">(optional)</span></label>
                <div className="board-row-list">
                  {boardRows.map((row, i) => (
                    <div key={i} className="board-row">
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => {
                          const next = [...boardRows];
                          next[i] = { name: e.target.value };
                          setBoardRows(next);
                        }}
                        placeholder={`Board ${i + 1}`}
                      />
                      <button
                        type="button"
                        className="board-row-remove-btn"
                        onClick={() => setBoardRows(rows => rows.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="board-row-add-btn"
                    onClick={() => setBoardRows(rows => [...rows, { name: '' }])}
                  >
                    <Plus size={14} /> Add board
                  </button>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={resetGroupModalState}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={!groupModalData.name.trim()}>Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <Search size={14} className="group-search-icon" />
                    <input
                      ref={groupInputRef}
                      type="text"
                      value={selectedGroup ? selectedGroup.name : groupSearchText}
                      onChange={(e) => {
                        setGroupSearchText(e.target.value);
                        setSelectedGroupId(null);
                        setGroupDropdownOpen(true);
                      }}
                      onFocus={() => setGroupDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setGroupDropdownOpen(false), 150)}
                      onKeyDown={handleGroupKeyDown}
                      placeholder="Search groups..."
                    />
                    {(selectedGroupId || groupSearchText) && (
                      <button
                        type="button"
                        className="group-clear-btn"
                        onClick={() => {
                          setSelectedGroupId(null);
                          setGroupSearchText('');
                          setGroupDropdownOpen(false);
                          groupInputRef.current?.focus();
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {groupDropdownOpen && filteredGroupsList.length > 0 && (
                    <div className="group-dropdown-list">
                      {filteredGroupsList.map(g => (
                        <div
                          key={g.id}
                          className="group-dropdown-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedGroupId(g.id);
                            setGroupSearchText('');
                            setGroupDropdownOpen(false);
                          }}
                        >
                          <Folder size={14} /> {g.name}
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
                  <button
                    type="button"
                    className={`visibility-pill${newBoardVisibility === 'open' ? ' visibility-pill--active' : ''}`}
                    onClick={() => setNewBoardVisibility('open')}
                  >
                    <Users size={14} /> Open
                  </button>
                </div>
                <p className="visibility-description">
                  {newBoardVisibility === 'private' && 'Only you and invited members can see this.'}
                  {newBoardVisibility === 'public' && 'Anyone can find and view this, but only members can edit.'}
                  {newBoardVisibility === 'open' && 'Anyone can find, view, and edit this.'}
                </p>
              </div>
              {newBoardVisibility === 'private' && (
                <div className="form-group">
                  <label>Invite Members <span className="label-optional">(optional)</span></label>
                  {pendingInvites.length === 0 && (
                    <div className="member-empty">No members invited yet</div>
                  )}
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
                  <div className="invite-search-wrapper">
                    <div className="invite-search-row">
                      <input
                        type="text"
                        placeholder="Search by name..."
                        value={userSearchQuery}
                        onChange={e => handleUserSearch(e.target.value)}
                        onFocus={() => userSearchResults.length > 0 && setUserSearchOpen(true)}
                        onBlur={() => setTimeout(() => setUserSearchOpen(false), 150)}
                        className="invite-input"
                      />
                      <select
                        className="invite-role-select"
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                      >
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>
                    </div>
                    {userSearchOpen && (
                      <div className="invite-dropdown-list">
                        {userSearchResults.map(u => (
                          <div
                            key={u.uid}
                            className="invite-dropdown-item"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleUserSelect(u)}
                          >
                            {u.photoURL && <img src={u.photoURL} alt="" className="pending-invite-avatar" referrerPolicy="no-referrer" />}
                            <span>{u.displayName || u.uid}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
