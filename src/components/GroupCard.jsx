import React, { useState } from 'react';
import { Folder, ChevronDown, ChevronRight, Trash2, FolderOutput, GripVertical, Shield } from 'lucide-react';
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
  user, draggingBoard, onBoardDragStart, onBoardDragEnd,
  subgroups = [], depth = 0, onCreateSubgroup, onSetGroupProtected, onSetBoardProtected, allGroups = [] }) {
  const slug = groupToSlug(group);
  const groupName = group?.name || (typeof group === 'string' ? group : null);
  const groupId = group?.id || null;
  const [expanded, setExpanded] = useState(true);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [movingBoardId, setMovingBoardId] = useState(null);
  const [addingSubgroup, setAddingSubgroup] = useState(false);
  const [subgroupName, setSubgroupName] = useState('');
  const [blockedItems, setBlockedItems] = useState(null);

  const handleDeleteGroup = async () => {
    try {
      await onDeleteGroup(groupId);
      setConfirmDeleteGroup(false);
    } catch (err) {
      if (err?.blocked) {
        setConfirmDeleteGroup(false);
        setBlockedItems(err.items);
      }
    }
  };

  return (
    <div
      className={`group-card${isDragOver ? ' drag-over' : ''}${depth > 0 ? ' group-card--nested' : ''}`}
      style={{ '--depth': depth }}
      onDragOver={onGroupDragOver}
      onDrop={onGroupDrop}
      onDragLeave={onGroupDragLeave}
    >
      <div className="group-card-header" onClick={() => setExpanded(e => !e)}>
        {expanded ? <ChevronDown size={16} className="group-card-chevron" /> : <ChevronRight size={16} className="group-card-chevron" />}
        <Folder size={16} className="group-card-icon" />
        <span className="group-card-name">{groupName || 'Ungrouped'}</span>
        {group?.protected && <span className="shield-badge"><Shield size={12} /></span>}
        <span className="group-card-count">
          {boards.length} board{boards.length !== 1 ? 's' : ''}{subgroups.length > 0 ? `, ${subgroups.length} subgroup${subgroups.length !== 1 ? 's' : ''}` : ''}
        </span>
        {onSetGroupProtected && (
          <button
            className="group-card-protect-btn"
            title={group?.protected ? 'Remove protection' : 'Protect'}
            onClick={e => { e.stopPropagation(); onSetGroupProtected(groupId, !group?.protected); }}
          >
            <Shield size={13} />
          </button>
        )}
        {onCreateSubgroup && depth < 3 && (
          <button
            className="group-card-delete-btn"
            title="Add subgroup"
            onClick={e => { e.stopPropagation(); setAddingSubgroup(true); }}
          >
            +
          </button>
        )}
        {group && onDeleteGroup && (
          group?.protected ? (
            <button
              className="group-card-delete-btn group-card-delete-btn--disabled"
              title="Remove protection first"
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <button
              className="group-card-delete-btn"
              title="Delete group"
              onClick={(e) => { e.stopPropagation(); setConfirmDeleteGroup(true); }}
            >
              <Trash2 size={13} />
            </button>
          )
        )}
      </div>

      {expanded && (
        <>
          {(subgroups.length > 0 || addingSubgroup) && (
            <div className="group-card-subgroup-section">
              {subgroups.map(sub => (
                <GroupCard
                  key={sub.id}
                  group={sub}
                  boards={[]}
                  subgroups={allGroups.filter(g => g.parentGroupId === sub.id)}
                  depth={depth + 1}
                  allGroups={allGroups}
                  onCreateSubgroup={onCreateSubgroup}
                  onSetGroupProtected={onSetGroupProtected}
                  onSetBoardProtected={onSetBoardProtected}
                  onDeleteGroup={onDeleteGroup}
                  onNavigateToGroup={onNavigateToGroup}
                  onNavigateToBoard={onNavigateToBoard}
                  globalPresence={globalPresence}
                  onDeleteBoard={onDeleteBoard}
                  onMoveBoard={onMoveBoard}
                  existingGroups={existingGroups}
                  user={user}
                  draggingBoard={draggingBoard}
                  onBoardDragStart={onBoardDragStart}
                  onBoardDragEnd={onBoardDragEnd}
                />
              ))}
              {addingSubgroup && (
                <div className="group-card-add-subgroup">
                  <input
                    autoFocus
                    placeholder="Subgroup name"
                    value={subgroupName}
                    onChange={e => setSubgroupName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && subgroupName.trim()) {
                        onCreateSubgroup(groupId, subgroupName.trim());
                        setSubgroupName('');
                        setAddingSubgroup(false);
                      } else if (e.key === 'Escape') {
                        setSubgroupName('');
                        setAddingSubgroup(false);
                      }
                    }}
                    onBlur={() => {
                      if (subgroupName.trim()) onCreateSubgroup(groupId, subgroupName.trim());
                      setSubgroupName('');
                      setAddingSubgroup(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
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
                      <span className="board-card-name">
                        {b.name}
                        {b.protected && <span className="shield-badge"><Shield size={10} /></span>}
                      </span>
                      {onMoveBoard && (
                        <button
                          className="board-card-move-btn"
                          title="Move to group"
                          onClick={(e) => { e.stopPropagation(); setMovingBoardId(movingBoardId === b.id ? null : b.id); }}
                        >
                          <FolderOutput size={12} />
                        </button>
                      )}
                      {onSetBoardProtected && (
                        <button
                          className="board-card-protect-btn"
                          title={b.protected ? 'Remove protection' : 'Protect'}
                          onClick={(e) => { e.stopPropagation(); onSetBoardProtected(b.id, !b.protected); }}
                        >
                          <Shield size={11} />
                        </button>
                      )}
                      {onDeleteBoard && (
                        b.protected ? (
                          <button
                            className="board-card-delete-btn board-card-delete-btn--disabled"
                            title="Remove protection first"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : (
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
                        )
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
        </>
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
              <button className="danger-btn" onClick={handleDeleteGroup}>Delete All</button>
            </div>
          </div>
        </div>
      )}

      {blockedItems && (
        <div className="modal-overlay" onClick={() => setBlockedItems(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2>Cannot Delete</h2>
            <p>The following protected items must be unprotected first:</p>
            <ul>{blockedItems.map((item, i) => <li key={i}>{item.name} ({item.type})</li>)}</ul>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setBlockedItems(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
