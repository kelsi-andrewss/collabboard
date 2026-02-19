import React, { useState } from 'react';
import { Folder, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { groupToSlug } from '../utils/slugUtils.js';
import './GroupCard.css';

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

export function GroupCard({ group, boards, onNavigateToGroup, onNavigateToBoard, globalPresence, onDeleteBoard, onDeleteGroup,
  draggable, onDragStart, onDragOver, onDrop, onDragLeave, onDragEnd, isDragOver }) {
  const slug = groupToSlug(group);
  const [expanded, setExpanded] = useState(true);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);

  return (
    <div
      className={`group-card${isDragOver ? ' drag-over' : ''}`}
      draggable={draggable || false}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd}
    >
      <div className="group-card-header" onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={16} className="group-card-chevron" /> : <ChevronRight size={16} className="group-card-chevron" />}
        <Folder size={16} className="group-card-icon" />
        <span className="group-card-name">{group || 'Ungrouped'}</span>
        <span className="group-card-count">{boards.length} board{boards.length !== 1 ? 's' : ''}</span>
        {group && onDeleteGroup && (
          <button
            className="group-card-delete-btn"
            title="Delete group"
            onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroup(true); }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {expanded && (
        <div
          className="board-cards-grid"
          style={{ gridTemplateColumns: `repeat(${Math.min(boards.length, 3)}, 1fr)` }}
        >
          {boards.slice(0, 3).map(b => {
            const onlineUsers = globalPresence?.[b.id] || [];
            const visibleOnline = onlineUsers.slice(0, 3);
            const extraOnline = onlineUsers.length - 3;
            return (
              <div
                key={b.id}
                className="board-card"
                onClick={() => onNavigateToBoard(slug, b.id, b.name)}
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
                    {onDeleteBoard && (
                      <button
                        className="board-card-delete-btn"
                        title="Delete board"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteBoard(b);
                        }}
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
                          <div
                            key={i}
                            className="board-card-avatar"
                            style={{ backgroundColor: u.color }}
                            title={u.name}
                          >
                            {u.photoURL
                              ? <img src={u.photoURL} alt="" referrerPolicy="no-referrer" />
                              : u.name?.charAt(0).toUpperCase()
                            }
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
          {boards.length > 3 && (
            <button
              className="board-cards-see-all"
              onClick={() => onNavigateToGroup(slug)}
            >
              See all {boards.length} boards →
            </button>
          )}
        </div>
      )}

      {confirmDeleteBoard && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteBoard(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>Delete Board</h2>
            <p>Delete &ldquo;{confirmDeleteBoard.name}&rdquo;? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setConfirmDeleteBoard(null)}>Cancel</button>
              <button className="danger-btn" onClick={() => { onDeleteBoard(confirmDeleteBoard.id); setConfirmDeleteBoard(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteGroup && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteGroup(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>Delete Group</h2>
            <p>Delete group &ldquo;{group}&rdquo; and all {boards.length} board{boards.length !== 1 ? 's' : ''} in it? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setConfirmDeleteGroup(false)}>Cancel</button>
              <button className="danger-btn" onClick={() => { onDeleteGroup(group); setConfirmDeleteGroup(false); }}>Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
