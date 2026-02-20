import React, { useState, useRef } from 'react';
import { X, Globe, Lock, Trash2, Users, AlertTriangle } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase/config';
import './BoardSettings.css';

export function BoardSettings({ board, currentUserId, onUpdateSettings, onInviteMember, onRemoveMember, onClose, isGroupAdmin: isGroupAdminProp = false }) {
  const [inviteRole, setInviteRole] = useState('editor');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const userSearchTimerRef = useRef(null);

  if (!board) return null;

  const isOwner = board.ownerId === currentUserId;
  const canManage = isOwner || isGroupAdminProp;
  const members = board.members || {};
  const visibility = board.visibility || 'public';

  const handleVisibilityChange = (newVisibility) => {
    if (!canManage) return;
    onUpdateSettings({ visibility: newVisibility });
  };

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
          orderBy('displayNameLower'),
          limit(8)
        );
        const snap = await getDocs(q);
        const existingMemberUids = Object.keys(members);
        const results = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u =>
            u.uid !== currentUserId &&
            u.uid !== board.ownerId &&
            !existingMemberUids.includes(u.uid)
          );
        setUserSearchResults(results);
        setUserSearchOpen(results.length > 0);
      } catch (err) {
        console.error('[user search]', err);
        setUserSearchResults([]);
      }
    }, 200);
  };

  const handleUserSelect = async (u) => {
    setUserSearchQuery('');
    setUserSearchResults([]);
    setUserSearchOpen(false);
    await onInviteMember(u.uid, inviteRole);
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
          {canManage ? (
            <>
              <div className="visibility-pill-group">
                <button
                  type="button"
                  className={`visibility-pill${visibility === 'private' ? ' visibility-pill--active' : ''}`}
                  onClick={() => handleVisibilityChange('private')}
                >
                  <Lock size={14} /> Private
                </button>
                <button
                  type="button"
                  className={`visibility-pill${visibility === 'public' ? ' visibility-pill--active' : ''}`}
                  onClick={() => handleVisibilityChange('public')}
                >
                  <Globe size={14} /> Public
                </button>
                <button
                  type="button"
                  className={`visibility-pill${visibility === 'open' ? ' visibility-pill--active' : ''}`}
                  onClick={() => handleVisibilityChange('open')}
                >
                  <Users size={14} /> Open
                </button>
              </div>
              <p className="visibility-description">
                {visibility === 'private' && 'Only the owner and invited members can access this board.'}
                {visibility === 'public' && 'Anyone with the link can view this board. Only the owner and editors can make changes.'}
                {visibility === 'open' && 'Anyone with the link can view and edit this board.'}
              </p>
              {visibility === 'open' && (
                <div className="visibility-open-warning">
                  <AlertTriangle size={16} />
                  <span>Anyone with the link can view and edit this board. Objects may be added, changed, or deleted by anyone.</span>
                </div>
              )}
            </>
          ) : (
            <div className="visibility-toggle disabled">
              {visibility === 'private' && <><Lock size={16} /> Private</>}
              {visibility === 'public' && <><Globe size={16} /> Public</>}
              {visibility === 'open' && <><Users size={16} /> Open</>}
            </div>
          )}
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
            {memberEntries.length === 0 && (
              <div className="member-empty">
                <Users size={14} />
                No additional members
              </div>
            )}
            {memberEntries.map(([uid, role]) => (
              <div key={uid} className="member-row">
                <span className="member-uid">{uid === currentUserId ? 'You' : uid}</span>
                {canManage ? (
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
                {canManage && uid !== currentUserId && (
                  <button className="member-remove-btn" onClick={() => onRemoveMember(uid)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {canManage && (
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
          )}
        </div>
      </div>
    </div>
  );
}
