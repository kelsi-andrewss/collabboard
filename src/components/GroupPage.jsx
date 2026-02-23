import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Search, LayoutGrid, Lock, ChevronRight, Trash2, Settings, Folder, ArrowUp, ArrowDown, GripVertical, RefreshCw } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import { buildSlugChain, resolveSlugChain } from '../utils/slugUtils.js';
import { useBoardsList } from '../hooks/useBoardsList.js';
import { useGlobalPresence } from '../hooks/useGlobalPresence.js';
import { GroupSettings } from './GroupSettings.jsx';
import { GroupCard } from './GroupCard.jsx';
import './GroupPage.css';
import { formatDate, estimateItemHeight, distributeToColumns } from '../utils/groupUtils.js';
export { formatDate, estimateItemHeight, distributeToColumns };

function buildAncestorChain(groupObj, groups) {
  const chain = [];
  let current = groupObj;
  while (current?.parentGroupId) {
    const parent = groups.find(g => g.id === current.parentGroupId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

const SORT_KEY = 'collaboard_group_sort';

const loadGroupSort = () => {
  try { return JSON.parse(localStorage.getItem(SORT_KEY)) || {}; } catch { return {}; }
};
const saveGroupSort = (mode, asc, view) =>
  localStorage.setItem(SORT_KEY, JSON.stringify({ mode, asc, view }));

const getGroupDepth = (groupId, allGroups) => {
  let depth = 0;
  let current = allGroups.find(g => g.id === groupId);
  while (current?.parentGroupId) {
    depth++;
    current = allGroups.find(g => g.id === current.parentGroupId);
  }
  return depth;
};

export { isAncestor } from '../utils/groupUtils.js';

export function GroupPage({
  groupSlugs, groups = [], onBack, onOpenBoard, onNavigateToGroup,
  user, isAdmin, adminViewActive, onUpdateGroup, onInviteGroupMember,
  onRemoveGroupMember, onSetGroupProtected, onDeleteGroupCascade,
  allBoards = [], moveBoard, moveGroup, createSubgroup, darkMode = false,
}) {
  const effectiveAdminView = isAdmin && adminViewActive;
  const { boards, deleteBoard } = useBoardsList(user, { isAdminView: effectiveAdminView, groups });
  const globalPresence = useGlobalPresence();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const masonryContainerRef = useRef(null);
  const [columnCount, setColumnCount] = useState(5);

  const [sortMode, setSortMode] = useState(() => {
    const m = loadGroupSort().mode;
    return ['recent', 'name', 'count'].includes(m) ? m : 'recent';
  });
  const [sortAsc, setSortAsc] = useState(() => loadGroupSort().asc ?? false);
  const [boardView, setBoardView] = useState(() => {
    const v = loadGroupSort().view;
    const allowed = isAdmin ? ['my', 'public', 'all'] : ['my', 'public'];
    return allowed.includes(v) ? v : 'my';
  });

  const [draggingBoard, setDraggingBoard] = useState(null);
  const [draggingGroup, setDraggingGroup] = useState(null);
  const [dragOverTargetId, setDragOverTargetId] = useState(null);
  const [rootDropActive, setRootDropActive] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const frozenItemsRef = useRef(null);

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

  const groupObj = resolveSlugChain(groupSlugs, groups);
  const groupName = groupObj?.name || null;
  const groupId = groupObj?.id || null;

  const ancestors = groupObj ? buildAncestorChain(groupObj, groups) : [];
  const childGroups = groups.filter(g =>
    g.parentGroupId === groupId && (
      effectiveAdminView ||
      g.visibility !== 'private' ||
      g.ownerId === user?.uid ||
      (g.members && g.members[user?.uid])
    )
  );

  const isMember = groupObj && user && (
    groupObj.ownerId === user.uid ||
    (groupObj.members && groupObj.members[user.uid])
  );
  const isPrivateAndNotMember = groupObj?.visibility === 'private' && !isMember && !effectiveAdminView;

  const groupBoards = boards.filter(b => b.groupId === groupId);

  const visibleBoards = groupBoards.filter(b => {
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

  const q = searchQuery.trim().toLowerCase();
  const filteredBoards = q
    ? visibleBoards.filter(b => b.name.toLowerCase().includes(q))
    : visibleBoards;

  const filteredSubgroups = q
    ? childGroups.filter(g => g.name.toLowerCase().includes(q))
    : childGroups;

  const applySort = (items) => {
    return [...items].sort((a, b) => {
      if (sortMode === 'name') {
        const aName = a.type === 'subgroup' ? (a.sub?.name || '') : (a.board?.name || '');
        const bName = b.type === 'subgroup' ? (b.sub?.name || '') : (b.board?.name || '');
        const cmp = aName.localeCompare(bName);
        return sortAsc ? cmp : -cmp;
      }
      if (sortMode === 'count') {
        const aCount = a.type === 'subgroup'
          ? boards.filter(brd => brd.groupId === a.sub?.id).length
          : 1;
        const bCount = b.type === 'subgroup'
          ? boards.filter(brd => brd.groupId === b.sub?.id).length
          : 1;
        const cmp = bCount - aCount;
        return sortAsc ? -cmp : cmp;
      }
      const aTime = a.type === 'subgroup'
        ? (boards.filter(brd => brd.groupId === a.sub?.id)[0]?.updatedAt?.toMillis?.() ?? 0)
        : (a.board?.updatedAt?.toMillis?.() ?? (a.board?.updatedAt?.seconds ?? 0) * 1000);
      const bTime = b.type === 'subgroup'
        ? (boards.filter(brd => brd.groupId === b.sub?.id)[0]?.updatedAt?.toMillis?.() ?? 0)
        : (b.board?.updatedAt?.toMillis?.() ?? (b.board?.updatedAt?.seconds ?? 0) * 1000);
      const cmp = bTime - aTime;
      return sortAsc ? -cmp : cmp;
    });
  };

  const rawMasonryItems = [
    ...filteredSubgroups.map(sub => ({ type: 'subgroup', key: sub.id, sub })),
    ...filteredBoards.map(board => ({ type: 'board', key: board.id, board })),
  ];
  const masonryItems = applySort(rawMasonryItems);

  useEffect(() => {
    frozenItemsRef.current = masonryItems;
  }, [searchQuery, boardView, sortMode, sortAsc, groupId, refreshKey]);

  const displayItems = frozenItemsRef.current ?? masonryItems;

  const handleSortModeChange = (mode) => {
    setSortMode(mode);
    saveGroupSort(mode, sortAsc, boardView);
  };

  const handleSortDirectionToggle = () => {
    const newAsc = !sortAsc;
    setSortAsc(newAsc);
    saveGroupSort(sortMode, newAsc, boardView);
  };

  const handleBoardViewChange = (view) => {
    setBoardView(view);
    saveGroupSort(sortMode, sortAsc, view);
  };

  const handleBack = () => {
    if (groupObj?.parentGroupId) {
      const parent = groups.find(g => g.id === groupObj.parentGroupId);
      if (parent && onNavigateToGroup) {
        onNavigateToGroup(buildSlugChain(parent, groups));
        return;
      }
    }
    onBack();
  };

  const handleGroupDragStart = (e, group) => {
    e.dataTransfer.setData('application/x-group-json', JSON.stringify({ id: group.id }));
    e.dataTransfer.effectAllowed = 'move';
    const cardEl = e.currentTarget.closest('.group-card');
    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      e.dataTransfer.setDragImage(cardEl, e.clientX - rect.left, e.clientY - rect.top);
    }
    setDraggingGroup({ id: group.id });
  };

  const handleGroupDragEnd = () => {
    setDraggingGroup(null);
    setDragOverTargetId(null);
  };

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
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTargetId(targetGroupId);
  };

  const handleGroupDragLeave = (e, targetGroupId) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverTargetId(prev => prev === targetGroupId ? null : prev);
    }
  };

  const handleGroupDrop = (e, targetGroupId) => {
    const closestGroupEl = e.target.closest('[data-group-id]');
    const closestGroupId = closestGroupEl ? closestGroupEl.dataset.groupId : null;
    if (closestGroupId !== (targetGroupId ?? null)) return;
    e.stopPropagation();
    e.preventDefault();
    const groupPayload = e.dataTransfer.getData('application/x-group-json');
    if (groupPayload) {
      try {
        const { id: draggedGroupId } = JSON.parse(groupPayload);
        const normalizedTarget = targetGroupId || null;
        if (normalizedTarget === draggedGroupId) {
          setDraggingGroup(null);
          setDragOverTargetId(null);
          setRootDropActive(false);
          return;
        }
        if (normalizedTarget !== null) {
          if (draggedGroupId === normalizedTarget || isAncestor(draggedGroupId, normalizedTarget, groups)) {
            setDraggingGroup(null);
            setDragOverTargetId(null);
            setRootDropActive(false);
            return;
          }
          const targetDepth = getGroupDepth(normalizedTarget, groups);
          if (targetDepth >= 2) {
            setDraggingGroup(null);
            setDragOverTargetId(null);
            setRootDropActive(false);
            return;
          }
        }
        moveGroup && moveGroup(draggedGroupId, normalizedTarget);
      } catch { /* ignore malformed drag data */ }
      setDraggingGroup(null);
      setDragOverTargetId(null);
      setRootDropActive(false);
      return;
    }
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const { boardId: draggedBoardId, sourceGroupId } = data;
      const normalizedSource = sourceGroupId || null;
      const normalizedTarget = targetGroupId || null;
      if (normalizedSource === normalizedTarget) {
        setDraggingBoard(null);
        setDragOverTargetId(null);
        setRootDropActive(false);
        return;
      }
      moveBoard && moveBoard(draggedBoardId, normalizedTarget);
    } catch { /* ignore malformed drag data */ }
    setDraggingBoard(null);
    setDragOverTargetId(null);
    setRootDropActive(false);
  };

  if (isPrivateAndNotMember) {
    return (
      <div className="group-page">
        <div className="group-page-header">
          <button className="group-page-back" onClick={handleBack}>
            <ArrowLeft size={16} />
            {groupObj?.parentGroupId ? 'Parent Group' : 'All Groups'}
          </button>
          <h1 className="group-page-title">
            <Lock size={20} />
            Private Group
          </h1>
        </div>
        <div className="empty-state" style={{ padding: '60px 40px' }}>
          <p className="empty-state-title">You don't have access to this group</p>
          <p className="empty-state-hint">Ask the group owner to invite you</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group-page">
      <div className="group-page-header">
        <button className="group-page-back" onClick={handleBack}>
          <ArrowLeft size={16} />
          {groupObj?.parentGroupId ? 'Parent Group' : 'All Groups'}
        </button>
        {ancestors.length > 0 && (
          <div className="group-page-breadcrumb">
            <button className="group-page-breadcrumb-item" onClick={onBack}>
              All Groups
            </button>
            {ancestors.map(a => (
              <React.Fragment key={a.id}>
                <ChevronRight size={12} className="group-page-breadcrumb-sep" />
                <button className="group-page-breadcrumb-item" onClick={() => onNavigateToGroup?.(buildSlugChain(a, groups))}>
                  {a.name}
                </button>
              </React.Fragment>
            ))}
            <ChevronRight size={12} className="group-page-breadcrumb-sep" />
            <span className="group-page-breadcrumb-current">{groupName}</span>
          </div>
        )}
        <div className="group-page-title-row">
          <h1 className="group-page-title">
            {groupName || 'Ungrouped'}
            <span className="group-page-count">{groupBoards.length} board{groupBoards.length !== 1 ? 's' : ''}</span>
          </h1>
          {groupId && onUpdateGroup && (
            <button className="group-page-settings-btn" title="Group settings" onClick={() => setShowSettings(true)}>
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="group-page-masonry-wrapper">
        <div className="controls-bar">
          <div className="dashboard-search">
            <Search size={16} className="dashboard-search-icon" />
            <input
              type="text"
              placeholder="Search boards..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="dashboard-search-input"
            />
            {searchQuery && (
              <button className="dashboard-search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
          <div className="controls-bar-center">
            {user && (
              <div className="filter-pill-group">
                {['my', 'public', ...(isAdmin ? ['all'] : [])].map(view => (
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
            {createSubgroup && groupId && (
              <button
                className="new-group-btn"
                onClick={() => {
                  const name = window.prompt('Subgroup name');
                  if (name?.trim()) createSubgroup(groupId, name.trim());
                }}
              >
                <Folder size={15} />
                New Subgroup
              </button>
            )}
            <button
              className="new-group-btn"
              title="Refresh board list"
              onClick={() => setRefreshKey(k => k + 1)}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        </div>

        <div
          className={`masonry-columns-container${rootDropActive ? ' masonry-drop-target--active' : ''}`}
          ref={masonryContainerRef}
          data-group-id={groupId}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setRootDropActive(true); }}
          onDrop={(e) => { setRootDropActive(false); handleGroupDrop(e, groupId); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setRootDropActive(false); }}
        >
          {displayItems.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon"><LayoutGrid size={40} strokeWidth={1.5} /></div>
              <p className="empty-state-title">
                {q ? `No boards match "${q}"` : 'No boards in this group'}
              </p>
              {!q && <p className="empty-state-hint">Create a new board and assign it to this group</p>}
            </div>
          )}
          {distributeToColumns(displayItems, columnCount).map((colItems, colIdx) => (
            <div key={colIdx} className="masonry-column">
              {colItems.map(item => {
                if (item.type === 'subgroup') {
                  const sub = item.sub;
                  const subBoards = boards.filter(b => b.groupId === sub.id);
                  const subSubgroups = groups.filter(g => g.parentGroupId === sub.id);
                  return (
                    <GroupCard
                      key={sub.id}
                      group={sub}
                      boards={subBoards}
                      allBoards={allBoards}
                      subgroups={subSubgroups}
                      allGroups={groups}
                      onNavigateToGroup={onNavigateToGroup || (() => {})}
                      onNavigateToBoard={(slugChain, id, name) => onOpenBoard(slugChain, id, name)}
                      globalPresence={globalPresence}
                      onDeleteBoard={deleteBoard}
                      onDeleteGroup={(id) => onDeleteGroupCascade && onDeleteGroupCascade(id, groups, allBoards)}
                      onCreateSubgroup={createSubgroup}
                      onSetGroupProtected={onSetGroupProtected}
                      onGroupDragOver={(e) => handleGroupDragOver(e, sub.id)}
                      onGroupDrop={(e) => handleGroupDrop(e, sub.id)}
                      onGroupDragLeave={(e) => handleGroupDragLeave(e, sub.id)}
                      isDragOver={dragOverTargetId === sub.id}
                      onMoveBoard={moveBoard}
                      existingGroups={groups}
                      user={user}
                      draggingBoard={draggingBoard}
                      onBoardDragStart={handleBoardDragStart}
                      onBoardDragEnd={handleBoardDragEnd}
                      onGroupDragStart={handleGroupDragStart}
                      onGroupDragEnd={handleGroupDragEnd}
                      draggingGroup={draggingGroup}
                      dragOverTargetId={dragOverTargetId}
                      onGroupDragOverUnbound={handleGroupDragOver}
                      onGroupDropUnbound={handleGroupDrop}
                      onGroupDragLeaveUnbound={handleGroupDragLeave}
                      darkMode={darkMode}
                    />
                  );
                }
                const b = item.board;
                const onlineUsers = globalPresence?.[b.id] || [];
                const visibleOnline = onlineUsers.slice(0, 3);
                const extraOnline = onlineUsers.length - 3;
                const isOwner = b.ownerId === user?.uid;
                const thumb = darkMode
                  ? (b.thumbnailDark || b.thumbnailLight || b.thumbnail)
                  : (b.thumbnailLight || b.thumbnailDark || b.thumbnail);
                let standaloneCardRef = null;
                return (
                  <div
                    key={b.id}
                    className="board-card standalone-board-card"
                    ref={el => { standaloneCardRef = el; }}
                    onClick={() => onOpenBoard(groupSlugs, b.id, b.name)}
                  >
                    <div className="board-card-thumbnail">
                      {thumb
                        ? <img src={thumb} alt="" className="board-card-thumbnail-img" />
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
                            handleBoardDragStart(e, b.id, groupId);
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
                        {isOwner && deleteBoard && (
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
      </div>

      {showSettings && groupObj && (
        <GroupSettings
          group={groupObj}
          currentUserId={user?.uid}
          currentUser={user}
          onUpdateGroup={(patches) => onUpdateGroup && onUpdateGroup(groupId, patches)}
          onInviteMember={(uid, role) => onInviteGroupMember && onInviteGroupMember(groupId, uid, role)}
          onRemoveMember={(uid) => onRemoveGroupMember && onRemoveGroupMember(groupId, uid)}
          onSetProtected={(bool) => onSetGroupProtected && onSetGroupProtected(groupId, bool)}
          onDeleteGroup={() => { onDeleteGroupCascade && onDeleteGroupCascade(groupId, groups, allBoards); onBack(); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
