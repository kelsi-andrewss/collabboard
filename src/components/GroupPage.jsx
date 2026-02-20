import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Search, LayoutGrid, Lock, Folder, ChevronRight, Trash2 } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import { findGroupBySlug, groupToSlug } from '../utils/slugUtils.js';
import { useBoardsList } from '../hooks/useBoardsList.js';
import { useGlobalPresence } from '../hooks/useGlobalPresence.js';
import './GroupPage.css';

export function formatDate(ts) {
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

const SUBGROUP_CARD_HEIGHT = 48;
const BOARD_CARD_HEIGHT = 116;
const COLUMN_ITEM_GAP = 16;

export function estimateItemHeight(item) {
  if (item.type === 'subgroup') return SUBGROUP_CARD_HEIGHT;
  return BOARD_CARD_HEIGHT;
}

export function distributeToColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));
  for (const item of items) {
    const shortest = columns.reduce((min, col) => col.height < min.height ? col : min, columns[0]);
    shortest.items.push(item);
    shortest.height += estimateItemHeight(item) + COLUMN_ITEM_GAP;
  }
  return columns.map(c => c.items);
}

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

export function GroupPage({ groupSlug, groups = [], onBack, onOpenBoard, onNavigateToGroup, user, isAdmin, adminViewActive }) {
  const effectiveAdminView = isAdmin && adminViewActive;
  const { boards, deleteBoard } = useBoardsList(user, { isAdminView: effectiveAdminView, groups });
  const globalPresence = useGlobalPresence();
  const [searchQuery, setSearchQuery] = useState('');
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

  const groupObj = findGroupBySlug(groups, groupSlug);
  const groupName = groupObj?.name || null;
  const groupId = groupObj?.id || null;

  const ancestors = groupObj ? buildAncestorChain(groupObj, groups) : [];
  const childGroups = groups.filter(g => g.parentGroupId === groupId);

  // Check if user is a member of this group (for private groups)
  const isMember = groupObj && user && (
    groupObj.ownerId === user.uid ||
    (groupObj.members && groupObj.members[user.uid])
  );
  const isPrivateAndNotMember = groupObj?.visibility === 'private' && !isMember && !effectiveAdminView;

  const groupBoards = boards.filter(b => {
    if (groupSlug === '__ungrouped__') return !b.groupId && !b.group;
    return b.groupId === groupId;
  });

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? groupBoards.filter(b => b.name.toLowerCase().includes(q))
    : groupBoards;

  const sorted = [...filtered].sort((a, b) => {
    const aTime = a.updatedAt?.toMillis?.() ?? (a.updatedAt?.seconds ?? 0) * 1000;
    const bTime = b.updatedAt?.toMillis?.() ?? (b.updatedAt?.seconds ?? 0) * 1000;
    return bTime - aTime;
  });

  const handleBack = () => {
    if (groupObj?.parentGroupId) {
      const parent = groups.find(g => g.id === groupObj.parentGroupId);
      if (parent && onNavigateToGroup) {
        onNavigateToGroup(groupToSlug(parent));
        return;
      }
    }
    onBack();
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
                <button className="group-page-breadcrumb-item" onClick={() => onNavigateToGroup?.(groupToSlug(a))}>
                  {a.name}
                </button>
              </React.Fragment>
            ))}
            <ChevronRight size={12} className="group-page-breadcrumb-sep" />
            <span className="group-page-breadcrumb-current">{groupName}</span>
          </div>
        )}
        <h1 className="group-page-title">
          {groupName || 'Ungrouped'}
          <span className="group-page-count">{groupBoards.length} board{groupBoards.length !== 1 ? 's' : ''}</span>
        </h1>
        <div className="dashboard-search" style={{ marginTop: 0 }}>
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
      </div>

      <div className="group-page-masonry-wrapper">
        {(() => {
          const masonryItems = [
            ...childGroups.map(sub => ({ type: 'subgroup', key: sub.id, sub })),
            ...sorted.map(board => ({ type: 'board', key: board.id, board })),
          ];

          return (
            <div className="masonry-columns-container" ref={masonryContainerRef}>
              {masonryItems.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon"><LayoutGrid size={40} strokeWidth={1.5} /></div>
                  <p className="empty-state-title">
                    {q ? `No boards match "${q}"` : 'No boards in this group'}
                  </p>
                  {!q && <p className="empty-state-hint">Create a new board and assign it to this group</p>}
                </div>
              )}
              {distributeToColumns(masonryItems, columnCount).map((colItems, colIdx) => (
                <div key={colIdx} className="masonry-column">
                  {colItems.map(item => {
                    if (item.type === 'subgroup') {
                      const sub = item.sub;
                      return (
                        <button
                          key={sub.id}
                          className="group-page-subgroup-card"
                          onClick={() => onNavigateToGroup?.(groupToSlug(sub))}
                        >
                          <Folder size={16} className="group-card-icon" />
                          <span>{sub.name}</span>
                          <ChevronRight size={14} className="group-page-subgroup-arrow" />
                        </button>
                      );
                    }
                    const b = item.board;
                    const onlineUsers = globalPresence?.[b.id] || [];
                    const visibleOnline = onlineUsers.slice(0, 3);
                    const extraOnline = onlineUsers.length - 3;
                    const isOwner = b.ownerId === user?.uid;
                    return (
                      <div
                        key={b.id}
                        className="board-card standalone-board-card"
                        onClick={() => onOpenBoard(groupSlug, b.id, b.name)}
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
          );
        })()}
      </div>
    </div>
  );
}
