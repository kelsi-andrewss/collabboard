import React, { useState } from 'react';
import { Folder, ChevronDown, ChevronRight, Trash2, FolderOutput, GripVertical, Shield } from 'lucide-react';
import { buildSlugChain } from '../utils/slugUtils.js';
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

export function GroupCard({ group, boards, allBoards = [], onNavigateToGroup, onNavigateToBoard, globalPresence, onDeleteBoard, onDeleteGroup,
  onGroupDragOver, onGroupDrop, onGroupDragLeave, isDragOver, onMoveBoard, existingGroups,
  user, draggingBoard, onBoardDragStart, onBoardDragEnd,
  subgroups = [], depth = 0, onCreateSubgroup, onSetGroupProtected, onSetBoardProtected, allGroups = [],
  onGroupDragStart, onGroupDragEnd, draggingGroup, dragOverTargetId,
  onGroupDragOverUnbound, onGroupDropUnbound, onGroupDragLeaveUnbound }) {
  const groupName = group?.name || (typeof group === 'string' ? group : null);
  const groupId = group?.id || null;
  const isCompact = depth >= 2;
  const [expanded, setExpanded] = useState(true);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(null);
  const [movingBoardId, setMovingBoardId] = useState(null);
  const [addingSubgroup, setAddingSubgroup] = useState(false);
  const [subgroupName, setSubgroupName] = useState('');

  return (
    <div
      className={`group-card${isDragOver ? ' drag-over' : ''}${depth > 0 ? ' group-card--nested' : ''}`}
      data-group-id={groupId}
      style={{ '--depth': depth }}
      onDragOver={onGroupDragOver}
      onDrop={onGroupDrop}
      onDragLeave={onGroupDragLeave}
      onClick={groupId ? () => onNavigateToGroup(buildSlugChain(group, allGroups)) : undefined}
    >
      <div
        className="group-card-header"
      >
        {!isCompact && (
          <button
            className="group-card-chevron-btn"
            onClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
          >
            {expanded ? <ChevronDown size={16} className="group-card-chevron" /> : <ChevronRight size={16} className="group-card-chevron" />}
          </button>
        )}
        <Folder size={16} className="group-card-icon" />
        <span
          className={`group-card-name${groupId ? ' group-card-name--link' : ''}`}
        >{groupName || 'Ungrouped'}</span>
        {group?.protected && <span className="shield-badge"><Shield size={12} /></span>}
        {onGroupDragStart && group && (
          <span
            className="group-card-drag-handle"
            draggable
            onDragStart={(e) => { e.stopPropagation(); onGroupDragStart(e, group); }}
            onDragEnd={(e) => { e.stopPropagation(); onGroupDragEnd && onGroupDragEnd(e); }}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={12} />
          </span>
        )}
      </div>

      {isCompact && (
        <div className="group-card-counts-section">
          <span className="group-card-count">{boards.length} board{boards.length !== 1 ? 's' : ''}</span>
          <span className="group-card-count">{subgroups.length} subgroup{subgroups.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {!isCompact && expanded && (
        <>
          {(subgroups.length > 0 || addingSubgroup || (onCreateSubgroup && depth < 3)) && (
            <div className="group-card-subgroup-section">
              {subgroups.map(sub => (
                <GroupCard
                  key={sub.id}
                  group={sub}
                  boards={allBoards.filter(b => b.groupId === sub.id)}
                  allBoards={allBoards}
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
                  onGroupDragStart={onGroupDragStart}
                  onGroupDragEnd={onGroupDragEnd}
                  draggingGroup={draggingGroup}
                  onGroupDragOver={onGroupDragOverUnbound ? (e) => onGroupDragOverUnbound(e, sub.id) : undefined}
                  onGroupDrop={onGroupDropUnbound ? (e) => onGroupDropUnbound(e, sub.id) : undefined}
                  onGroupDragLeave={onGroupDragLeaveUnbound ? (e) => onGroupDragLeaveUnbound(e, sub.id) : undefined}
                  isDragOver={dragOverTargetId === sub.id}
                  dragOverTargetId={dragOverTargetId}
                  onGroupDragOverUnbound={onGroupDragOverUnbound}
                  onGroupDropUnbound={onGroupDropUnbound}
                  onGroupDragLeaveUnbound={onGroupDragLeaveUnbound}
                  allBoards={allBoards}
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
              {onCreateSubgroup && depth < 3 && !addingSubgroup && (
                <button
                  className="group-card-add-subgroup-btn"
                  onClick={e => { e.stopPropagation(); setAddingSubgroup(true); }}
                >
                  + Add subgroup
                </button>
              )}
            </div>
          )}
          {(boards.length > 0 || (isDragOver && draggingBoard && draggingBoard.sourceGroupId !== groupId)) && (() => {
            const ghostBoard = (isDragOver && draggingBoard && draggingBoard.sourceGroupId !== group?.id)
              ? allBoards?.find(b => b.id === draggingBoard.boardId)
              : null;
            const visibleBoards = boards.slice(0, ghostBoard ? 2 : 3);
            return (
            <div className="board-cards-grid">
              {visibleBoards.map(b => {
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
                    onClick={(e) => { e.stopPropagation(); onNavigateToBoard(group ? buildSlugChain(group, allGroups) : [], b.id, b.name); }}
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
              {ghostBoard && (
                <div className="board-card board-card--ghost">
                  <div className="board-card-thumbnail">
                    {ghostBoard.thumbnail
                      ? <img src={ghostBoard.thumbnail} alt="" className="board-card-thumbnail-img" />
                      : <div className="board-card-thumbnail-placeholder" />}
                  </div>
                  <div className="board-card-info">
                    <div className="board-card-row">
                      <span className="board-card-name">{ghostBoard.name}</span>
                    </div>
                    <div className="board-card-preview-label">Preview</div>
                  </div>
                </div>
              )}
            </div>
            );
          })()}
          {group && (
            <button
              className="board-cards-see-all"
              onClick={(e) => { e.stopPropagation(); onNavigateToGroup(buildSlugChain(group, allGroups)); }}
            >
              {boards.length > 3 ? `See all ${boards.length} boards →` : 'Open group →'}
            </button>
          )}
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

    </div>
  );
}
