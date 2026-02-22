import React, { useState, useRef, useEffect } from 'react';
import { X, Globe, Lock, Trash2, Users, AlertTriangle } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, limit, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Avatar } from './Avatar.jsx';
import './BoardSettings.css';

function formatTemplateDate(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BoardSettings({ board, currentUserId, currentUser, onUpdateSettings, onInviteMember, onRemoveMember, onTransferOwner, onClose, isGroupAdmin: isGroupAdminProp = false, publishTemplate, updateTemplate, unpublishTemplate }) {
  const [inviteRole, setInviteRole] = useState('editor');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [localVisibility, setLocalVisibility] = useState(board?.visibility || 'public');
  const [openAcknowledged, setOpenAcknowledged] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(
    () => localStorage.getItem('templateUpdateWarningDismissed') === 'true'
  );
  const [memberProfiles, setMemberProfiles] = useState({});
  const userSearchTimerRef = useRef(null);

  useEffect(() => {
    const members = board?.members || {};
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
  }, [JSON.stringify(Object.keys(board?.members || {}))]);

  if (!board) return null;

  const isOwner = board.ownerId === currentUserId;
  const canManage = isOwner || isGroupAdminProp || (board.members?.[currentUserId] === 'editor');
  const canManageMembers = isOwner || isGroupAdminProp;
  const members = board.members || {};
  const savedVisibility = board.visibility || 'public';
  const visibilityDirty = localVisibility !== savedVisibility;

  const handleVisibilityChange = (newVisibility) => {
    if (!canManage) return;
    setLocalVisibility(newVisibility);
    if (newVisibility !== 'open') {
      setOpenAcknowledged(false);
    }
  };

  const handleSaveVisibility = () => {
    onUpdateSettings({ visibility: localVisibility });
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
            u.uid !== board.ownerId &&
            !existingMemberUids.includes(u.uid)
          );
        setUserSearchResults(results);
        setUserSearchOpen(results.length > 0);
      } catch (err) {
        console.error('[user search]', err);
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

  const memberEntries = Object.entries(members).filter(([uid]) => uid !== board.ownerId);

  function handleConvertToTemplate() {
    publishTemplate(board.id);
  }
  function handleUpdateTemplate() {
    if (dontShowAgain) {
      updateTemplate(board.id);
    } else {
      setShowUpdateConfirm(true);
    }
  }
  function handleConfirmUpdate() {
    if (dontShowAgain) {
      localStorage.setItem('templateUpdateWarningDismissed', 'true');
    }
    updateTemplate(board.id);
    setShowUpdateConfirm(false);
  }
  function handleRemoveFromBrowse() {
    unpublishTemplate(board.id);
  }

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
                {localVisibility === 'private' && 'Only the owner and invited members can access this board.'}
                {localVisibility === 'public' && 'Anyone with the link can view this board. Only the owner and editors can make changes.'}
                {localVisibility === 'open' && 'Anyone with the link can view and edit this board.'}
              </p>
              {localVisibility === 'open' && (
                <div className="visibility-open-warning">
                  <AlertTriangle size={16} />
                  <span>Anyone with the link can view and edit this board. Objects may be added, changed, or deleted by anyone.</span>
                  <label className="visibility-open-ack">
                    <input
                      type="checkbox"
                      checked={openAcknowledged}
                      onChange={e => setOpenAcknowledged(e.target.checked)}
                    />
                    I understand — anyone can view and edit this board
                  </label>
                </div>
              )}
              <button
                type="button"
                className="settings-save-btn"
                disabled={!visibilityDirty || (localVisibility === 'open' && !openAcknowledged)}
                onClick={handleSaveVisibility}
              >
                Save
              </button>
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
          <h3>Template</h3>
          {canManage ? (
            <div className="template-section">
              {!board.template ? (
                <>
                  <button className="btn-convert-template" onClick={handleConvertToTemplate}>
                    Convert to Template
                  </button>
                  <p className="template-description">
                    Make this board available in the Browse gallery. Others can use it as a starting point — they get their own copy; your board is unchanged.
                  </p>
                </>
              ) : (
                <>
                  <p className="template-published-label">
                    Template — published {formatTemplateDate(board.templateSnapshotAt)}
                  </p>
                  <div className="template-actions">
                    <button className="btn-update-template" onClick={handleUpdateTemplate}>
                      Update Template
                    </button>
                    <button className="btn-remove-template" onClick={handleRemoveFromBrowse}>
                      Remove from Browse
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="template-readonly-text">
              {board.template ? 'This board is a template.' : 'This board is not a template.'}
            </p>
          )}
        </div>

        <div className="board-settings-section">
          <h3>Members</h3>
          <div className="member-list">
            {board.ownerId && (
              <div className="member-row">
                {board.ownerId === currentUserId && currentUser && (
                  <Avatar photoURL={currentUser.photoURL} name={currentUser.displayName || 'You'} size="sm" />
                )}
                {board.ownerId !== currentUserId && memberProfiles[board.ownerId] && (
                  <Avatar photoURL={memberProfiles[board.ownerId]?.photoURL} name={memberProfiles[board.ownerId]?.displayName || board.ownerId} size="sm" />
                )}
                <span className="member-uid">{board.ownerId === currentUserId ? (currentUser?.displayName || 'You') + ' (owner)' : memberProfiles[board.ownerId]?.displayName || board.ownerId}</span>
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
                {canManageMembers ? (
                  <select
                    className="member-role-select"
                    value={role}
                    onChange={(e) => {
                      if (e.target.value === 'owner') {
                        onTransferOwner(uid);
                      } else {
                        onInviteMember(uid, e.target.value);
                      }
                    }}
                  >
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                    {isOwner && <option value="owner">owner</option>}
                  </select>
                ) : (
                  <span className="member-role">{role}</span>
                )}
                {canManageMembers && uid !== currentUserId && (
                  <button className="member-remove-btn" onClick={() => onRemoveMember(uid)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {canManageMembers && (
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
              {searchError && <p className="member-search-error">{searchError}</p>}
            </div>
          )}
        </div>
      </div>
      {showUpdateConfirm && (
        <div className="template-confirm-overlay">
          <div className="template-confirm-dialog">
            <h3>Update template?</h3>
            <p>This will replace the published version with your board's current state. Anyone who uses this template after this point will get the new version. Boards already created from this template are not affected.</p>
            <label className="template-dont-show">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={e => setDontShowAgain(e.target.checked)}
              />
              Don't show again
            </label>
            <div className="template-confirm-buttons">
              <button onClick={() => setShowUpdateConfirm(false)}>Cancel</button>
              <button className="btn-confirm-update" onClick={handleConfirmUpdate}>Update Template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
