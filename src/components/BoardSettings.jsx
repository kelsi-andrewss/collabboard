import React, { useState } from 'react';
import { X, Globe, Lock, UserPlus, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import './BoardSettings.css';

export function BoardSettings({ board, currentUserId, onUpdateSettings, onInviteMember, onRemoveMember, onClose }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviteError, setInviteError] = useState(null);
  const [inviting, setInviting] = useState(false);

  if (!board) return null;

  const isOwner = board.ownerId === currentUserId;
  const members = board.members || {};
  const visibility = board.visibility || 'public';

  const handleVisibilityToggle = () => {
    if (!isOwner) return;
    onUpdateSettings({ visibility: visibility === 'public' ? 'private' : 'public' });
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', inviteEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setInviteError('No user found with that email.');
        setInviting(false);
        return;
      }
      const uid = snap.docs[0].id;
      await onInviteMember(uid, inviteRole);
      setInviteEmail('');
    } catch {
      setInviteError('Failed to invite user.');
    }
    setInviting(false);
  };

  const memberEntries = Object.entries(members).filter(([uid]) => uid !== board.ownerId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card board-settings-card" onClick={e => e.stopPropagation()}>
        <div className="board-settings-header">
          <h2>Board Settings</h2>
          <button className="board-settings-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="board-settings-section">
          <h3>Visibility</h3>
          <button
            className={`visibility-toggle${!isOwner ? ' disabled' : ''}`}
            onClick={handleVisibilityToggle}
            disabled={!isOwner}
          >
            {visibility === 'public'
              ? <><Globe size={16} /> Public — anyone can view</>
              : <><Lock size={16} /> Private — only invited members</>
            }
            {isOwner && <span className="visibility-toggle-hint">Click to toggle</span>}
          </button>
        </div>

        <div className="board-settings-section">
          <h3>Members</h3>
          <div className="member-list">
            {board.ownerId && (
              <div className="member-row">
                <span className="member-uid">{board.ownerId === currentUserId ? 'You (owner)' : board.ownerId}</span>
                <span className="member-role owner">owner</span>
              </div>
            )}
            {memberEntries.map(([uid, role]) => (
              <div key={uid} className="member-row">
                <span className="member-uid">{uid === currentUserId ? 'You' : uid}</span>
                {isOwner ? (
                  <select
                    className="member-role-select"
                    value={role}
                    onChange={(e) => onInviteMember(uid, e.target.value)}
                  >
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                ) : (
                  <span className="member-role">{role}</span>
                )}
                {isOwner && uid !== currentUserId && (
                  <button className="member-remove-btn" onClick={() => onRemoveMember(uid)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <form className="invite-form" onSubmit={handleInvite}>
              <input
                type="email"
                placeholder="Invite by email..."
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
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
              <button type="submit" className="invite-btn" disabled={inviting}>
                <UserPlus size={15} />
              </button>
            </form>
          )}
          {inviteError && <p className="invite-error">{inviteError}</p>}
        </div>
      </div>
    </div>
  );
}
