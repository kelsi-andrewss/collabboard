import React, { useState } from 'react';
import { ArrowLeft, Layout, Search } from 'lucide-react';
import { findGroupBySlug } from '../utils/slugUtils.js';
import { useBoardsList } from '../hooks/useBoardsList.js';
import { useGlobalPresence } from '../hooks/useGlobalPresence.js';

export function GroupPage({ groupSlug, onBack, onOpenBoard }) {
  const { boards } = useBoardsList();
  const globalPresence = useGlobalPresence();
  const [searchQuery, setSearchQuery] = useState('');

  const groupName = findGroupBySlug(boards, groupSlug);

  const groupBoards = boards.filter(b => {
    if (groupSlug === '__ungrouped__') return !b.group;
    return b.group && b.group === groupName;
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

  return (
    <div className="group-page">
      <div className="group-page-header">
        <button className="group-page-back" onClick={onBack}>
          <ArrowLeft size={16} />
          All Groups
        </button>
        <h1 className="group-page-title">{groupName || 'Ungrouped'}</h1>
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
                      <div
                        key={i}
                        className="mini-avatar"
                        style={{ backgroundColor: u.color }}
                        title={u.name}
                      >
                        {u.photoURL
                          ? <img src={u.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                          : u.name.charAt(0).toUpperCase()}
                      </div>
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
            <p>{q ? `No boards match "${q}"` : 'No boards in this group.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
