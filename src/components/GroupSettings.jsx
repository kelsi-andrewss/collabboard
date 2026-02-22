import React, { useState, useRef, useEffect } from 'react';
import { X, Globe, Lock, Trash2, Users, Shield, AlertTriangle } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Avatar } from './Avatar.jsx';
import './BoardSettings.css';
import './GroupSettings.css';

export function GroupSettings({ group, currentUserId, currentUser, isGlobalAdmin, onUpdateGroup, onInviteMember, onRemoveMember, onSetProtected, onDeleteGroup, onClose }) {
  const [inviteRole, setInviteRole] = useState('member');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localProtected, setLocalProtected] = useState(group?.protected || false);
  const [localVisibility, setLocalVisibility] = useState(group?.visibility || 'private');
  const [memberProfiles, setMemberProfiles] = useState({});
  const userSearchTimerRef = useRef(null);

  useEffect(() => {
    setLocalVisibility(group?.visibility || 'private');
  }, [group?.visibility]);

  useEffect(() => {
    setLocalProtected(group?.protected || false);
  }, [group?.protected]);

  useEffect(() => {
    const members = group?.members || {};
    const uids = Object.keys(members);
    if (!uids.length) {
      setMemberProfiles({});
      return;
    }
    Promise.all(
      uids.map(uid => getDoc(doc(db, 'users', uid)).then(snap => snap.exists() ? [uid, snap.data()] : [uid, null]))
    ).then(results => {
      const profiles = {};
      results.forEach(([uid, data]) => { if (data) profiles[uid] = data; });
      setMemberProfiles(profiles);
    });
  }, [JSON.stringify(Object.keys(group?.members || {}))]);

  if (!group) return null;

  const isOwner = group.ownerId === currentUserId;
  const members = group.members || {};
  const isAdmin = members[currentUserId] === 'admin';
  const canManage = isOwner || isAdmin;
  const protectedDirty = localProtected !== (group.protected || false);
  const visibilityDirty = localVisibility !== (group.visibility || 'private');

  const handleVisibilityChange = (newVisibility) => {
    if (!canManage) return;
    setLocalVisibility(newVisibility);
  };

  const handleUserSearch = (term) => {
    setUserSearchQuery(term);
    setSearchError(null);
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
            u.uid !== group.ownerId &&
            !existingMemberUids.includes(u.uid)
          );
        setUserSearchResults(results);
        setUserSearchOpen(results.length > 0);
      } catch (err) {
        console.error('[group user search]', err);
        setUserSearchResults([]);
        setSearchError('Search unavailable. Please try again.');
      }
    }, 200);
  };

  const handleUserSelect = async (u) => {
    setUserSearchQuery('');
    setUserSearchResults([]);
    setUserSearchOpen(false);
    await onInviteMember(u.uid, inviteRole);
  };

  const memberEntries = Object.entries(members).filter(([uid]) => uid !== group.ownerId);

  return (
    <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="modal-card board-settings-card" onClick={e => e.stopPropagation()}>
        <div className="board-settings-header">
          <h2>Group Settings</h2>
          <button className="board-settings-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="board-settings-section">
          <h3>Visibility</h3>
          {canManage ? (
            <>
              <div className="visibility-pill-group">
                <button
                  type="button"
                  className={`visibility-pill${localVisibility === 'private' ? ' visibility-pill--active' : ''}`}
                  onClick={() => handleVisibilityChange('private')}
                >
                  <Lock size={14} /> Private
                </button>
                <button
                  type="button"
                  className={`visibility-pill${localVisibility === 'public' ? ' visibility-pill--active' : ''}`}
                  onClick={() => handleVisibilityChange('public')}
                >
                  <Globe size={14} /> Public
                </button>
                <button
                  type="button"
                  className={`visibility-pill${localVisibility === 'open' ? ' visibility-pill--active' : ''}`}
                  onClick={() => handleVisibilityChange('open')}
                >
                  <Users size={14} /> Open
                </button>
              </div>
              <p className="visibility-description">
                {localVisibility === 'private' && 'Only the owner and invited members can access this group.'}
                {localVisibility === 'public' && 'Anyone can find and view this group. Only the owner and admins can make changes.'}
                {localVisibility === 'open' && 'Anyone can find, view, and join this group.'}
              </p>
              {localVisibility === 'open' && (
                <div className="visibility-open-warning">
                  <AlertTriangle size={16} />
                  <span>Anyone can find, view, and edit this group.</span>
                </div>
              )}
            </>
          ) : (
            <div className="visibility-toggle disabled">
              {localVisibility === 'private' && <><Lock size={16} /> Private</>}
              {localVisibility === 'public' && <><Globe size={16} /> Public</>}
              {localVisibility === 'open' && <><Users size={16} /> Open</>}
            </div>
          )}
        </div>

        <div className="board-settings-section">
          <h3>Members</h3>
          <div className="member-list">
            {group.ownerId && (
              <div className="member-row">
                {group.ownerId === currentUserId && currentUser && (
                  <Avatar photoURL={currentUser.photoURL} name={currentUser.displayName || 'You'} size="sm" />
                )}
                {group.ownerId !== currentUserId && memberProfiles[group.ownerId] && (
                  <Avatar photoURL={memberProfiles[group.ownerId]?.photoURL} name={memberProfiles[group.ownerId]?.displayName || group.ownerId} size="sm" />
                )}
                <span className="member-uid">{group.ownerId === currentUserId ? (currentUser?.displayName || 'You') + ' (owner)' : memberProfiles[group.ownerId]?.displayName || group.ownerId}</span>
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
                {uid === currentUserId && currentUser && (
                  <Avatar photoURL={currentUser.photoURL} name={currentUser.displayName || 'You'} size="sm" />
                )}
                {uid !== currentUserId && memberProfiles[uid] && (
                  <Avatar photoURL={memberProfiles[uid]?.photoURL} name={memberProfiles[uid]?.displayName || uid} size="sm" />
                )}
                <span className="member-uid">{uid === currentUserId ? 'You' : memberProfiles[uid]?.displayName || uid}</span>
                {canManage ? (
                  <select
                    className="member-role-select"
                    value={role}
                    onChange={(e) => onInviteMember(uid, e.target.value)}
                  >
                    {isGlobalAdmin && <option value="admin">admin</option>}
                    <option value="member">member</option>
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
                  placeholder="Add member..."
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
                  {isGlobalAdmin && <option value="admin">admin</option>}
                  <option value="member">member</option>
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
              {searchError && <p className="member-search-error">{searchError}</p>}
            </div>
          )}
        </div>

        {canManage && (
          <div className="board-settings-section">
            <h3>Delete Protection</h3>
            <div className="group-settings-toggle-row">
              <Shield size={15} />
              <span>Protect this group from deletion</span>
              <button
                type="button"
                className={`group-settings-toggle-btn${localProtected ? ' group-settings-toggle-btn--on' : ''}`}
                onClick={() => setLocalProtected(v => !v)}
              >
                {localProtected ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        )}

        {canManage && (
          <div className="board-settings-section">
            <button
              type="button"
              className="group-settings-save-btn"
              disabled={!protectedDirty && !visibilityDirty}
              onClick={() => {
                if (protectedDirty) onSetProtected(localProtected);
                if (visibilityDirty) onUpdateGroup({ visibility: localVisibility });
              }}
            >
              Save
            </button>
          </div>
        )}

        {canManage && (
          <div className="board-settings-section group-settings-danger">
            <h3>Danger Zone</h3>
            {!confirmDelete ? (
              <button
                type="button"
                className="danger-btn"
                disabled={!!group.protected}
                title={group.protected ? 'Remove protection first' : 'Delete this group and all its boards'}
                onClick={() => setConfirmDelete(true)}
              >
                Delete Group
              </button>
            ) : (
              <div className="group-settings-delete-confirm">
                <p>Delete &ldquo;{group.name}&rdquo; and all its boards? This cannot be undone.</p>
                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
                  <button className="danger-btn" onClick={() => { onDeleteGroup(); onClose(); }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
