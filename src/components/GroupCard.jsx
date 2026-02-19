import React, { useState } from 'react';
import { Folder, ChevronDown, ChevronRight, Trash2, FolderOutput, GripVertical } from 'lucide-react';
import { groupToSlug } from '../utils/slugUtils.js';
import { Avatar } from './Avatar.jsx';
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
  onGroupDragOver, onGroupDrop, onGroupDragLeave, isDragOver, onMoveBoard, existingGroups,
  user, draggingBoard, onBoardDragStart, onBoardDragEnd }) {
  const slug = groupToSlug(group);
  const groupName = group?.name || (typeof group === 'string' ? group : null);
  const groupId = group?.id || null;
  const [expanded, setExpanded] = useState(true);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [movingBoardId, setMovingBoardId] = useState(null);

  return (
    <div
      className={`group-card${isDragOver ? ' drag-over' : ''}`}
      onDragOver={onGroupDragOver}
      onDrop={onGroupDrop}
      onDragLeave={onGroupDragLeave}
    >
      <div className="group-card-header" onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={16} className="group-card-chevron" /> : <ChevronRight size={16} className="group-card-chevron" />}
        <Folder size={16} className="group-card-icon" />
        <span className="group-card-name">{groupName || 'Ungrouped'}</span>
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
        <div className="board-cards-grid">
          {boards.slice(0, 3).map(b => {
            const onlineUsers = globalPresence?.[b.id] || [];
            const visibleOnline = onlineUsers.slice(0, 3);
            const extraOnline = onlineUsers.length - 3;
            const isOwner = b.ownerId === user?.uid;
            const isDragging = draggingBoard?.boardId === b.id;
            let cardRef = null;
            return (
              <div
                key={b.id}
                className={`board-card${isDragging ? ' board-card--dragging' : ''}`}
                ref={el => { cardRef = el; }}
                onClick={() => onNavigateToBoard(group ? slug : null, b.id, b.name)}
              >
                <div className="board-card-thumbnail">
                  {b.thumbnail
                    ? <img src={b.thumbnail} alt="" className="board-card-thumbnail-img" />
                    : <div className="board-card-thumbnail-placeholder" />
                  }
                  {isOwner && onBoardDragStart && (
                    <span
                      className="board-card-drag-handle"
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        if (cardRef) {
                          const rect = cardRef.getBoundingClientRect();
                          e.dataTransfer.setDragImage(cardRef, rect.width - 8, 8);
                        }
                        onBoardDragStart(e, b.id, groupId);
                      }}
                      onDragEnd={onBoardDragEnd}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical size={12} />
                    </span>
                  )}
                </div>
                <div className="board-card-info">
                  <div className="board-card-row">
                    <span className="board-card-name">{b.name}</span>
                    {onMoveBoard && (
                      <button
                        className="board-card-move-btn"
                        title="Move to group"
                        onClick={(e) => { e.stopPropagation(); setMovingBoardId(movingBoardId === b.id ? null : b.id); }}
                      >
                        <FolderOutput size={12} />
                      </button>
                    )}
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
                {movingBoardId === b.id && onMoveBoard && (
                  <div className="move-group-picker" onClick={e => e.stopPropagation()}>
                    {(existingGroups || []).filter(g => {
                      const gId = g?.id || g;
                      return gId !== groupId;
                    }).map(g => {
                      const gObj = typeof g === 'object' ? g : null;
                      return (
                        <button key={gObj?.id || g} className="move-group-option" onClick={() => { onMoveBoard(b.id, gObj?.id || null); setMovingBoardId(null); }}>
                          <Folder size={12} /> {gObj?.name || g}
                        </button>
                      );
                    })}
                    {group && (
                      <button className="move-group-option" onClick={() => { onMoveBoard(b.id, null); setMovingBoardId(null); }}>
                        Ungrouped
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {group && (
            <button
              className="board-cards-see-all"
              onClick={() => onNavigateToGroup(slug)}
            >
              {boards.length > 3 ? `See all ${boards.length} boards →` : 'Open group →'}
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
            <p>Delete group &ldquo;{groupName}&rdquo; and all {boards.length} board{boards.length !== 1 ? 's' : ''} in it? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setConfirmDeleteGroup(false)}>Cancel</button>
              <button className="danger-btn" onClick={() => { onDeleteGroup(groupId); setConfirmDeleteGroup(false); }}>Delete All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
