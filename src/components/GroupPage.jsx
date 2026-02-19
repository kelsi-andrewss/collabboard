import React, { useState } from 'react';
import { ArrowLeft, Layout, Search, LayoutGrid, Lock } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import { findGroupBySlug } from '../utils/slugUtils.js';
import { useBoardsList } from '../hooks/useBoardsList.js';
import { useGlobalPresence } from '../hooks/useGlobalPresence.js';
import './GroupPage.css';

export function GroupPage({ groupSlug, groups = [], onBack, onOpenBoard, user, isAdmin, adminViewActive }) {
  const effectiveAdminView = isAdmin && adminViewActive;
  const { boards } = useBoardsList(user, { isAdminView: effectiveAdminView, groups });
  const globalPresence = useGlobalPresence();
  const [searchQuery, setSearchQuery] = useState('');

  const groupObj = findGroupBySlug(groups, groupSlug);
  const groupName = groupObj?.name || null;
  const groupId = groupObj?.id || null;

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

  if (isPrivateAndNotMember) {
    return (
      <div className="group-page">
        <div className="group-page-header">
          <button className="group-page-back" onClick={onBack}>
            <ArrowLeft size={16} />
            All Groups
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
        <button className="group-page-back" onClick={onBack}>
          <ArrowLeft size={16} />
          All Groups
        </button>
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

      <div className="boards-grid" style={{ padding: '0 40px 40px' }}>
        {sorted.map(board => (
          <div
            key={board.id}
            className="board-card"
            onClick={() => onOpenBoard(groupSlug, board.id, board.name)}
          >
            <div className="board-card-preview">
              <Layout size={40} />
            </div>
            <div className="board-card-info">
              <h3>{board.name}</h3>
              <div className="board-card-footer">
                <p>Updated {board.updatedAt ? new Date(board.updatedAt.toDate()).toLocaleDateString() : 'Just now'}</p>
                {globalPresence[board.id]?.length > 0 && (
                  <div className="card-avatars">
                    {globalPresence[board.id].slice(0, 3).map((u, i) => (
                      <Avatar
                        key={i}
                        photoURL={u.photoURL}
                        name={u.name}
                        color={u.color}
                        size="sm"
                        className="mini-avatar"
                      />
                    ))}
                    {globalPresence[board.id].length > 3 && (
                      <div className="mini-avatar mini-chip">+{globalPresence[board.id].length - 3}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><LayoutGrid size={40} strokeWidth={1.5} /></div>
            <p className="empty-state-title">
              {q ? `No boards match "${q}"` : 'No boards in this group'}
            </p>
            {!q && <p className="empty-state-hint">Create a new board and assign it to this group</p>}
          </div>
        )}
      </div>
    </div>
  );
}
