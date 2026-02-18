import React, { useState } from 'react';

function PresenceAvatarsInner({ presentUsers, currentUserId, currentUserPhotoURL }) {
  const [showModal, setShowModal] = useState(false);

  if (!presentUsers) return null;

  const users = Object.entries(presentUsers).map(([id, data]) => ({ id, ...data }));

  if (users.length === 0) return null;

  // Sort users so current user is last or first for consistency
  const sortedUsers = [...users].sort((a, b) => (a.id === currentUserId ? -1 : 1));

  const visibleUsers = sortedUsers.slice(0, 3);
  const remainingCount = sortedUsers.length - 3;

  return (
    <div className="presence-avatars">
      <div className="avatar-stack" onClick={() => setShowModal(true)}>
        {visibleUsers.map((u, i) => {
          const photo = u.id === currentUserId ? currentUserPhotoURL : u.photoURL;
          const isCurrentUser = u.id === currentUserId;
          const avatarCircle = (
            <div
              className="avatar-circle"
              style={{ backgroundColor: u.color, zIndex: 10 - i }}
              title={u.name}
            >
              {photo
                ? <img src={photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                : u.name.charAt(0).toUpperCase()
              }
            </div>
          );
          if (isCurrentUser) {
            return (
              <div key={i} className="avatar-you-wrapper">
                {avatarCircle}
                <span className="avatar-you-badge">You</span>
              </div>
            );
          }
          return <React.Fragment key={i}>{avatarCircle}</React.Fragment>;
        })}
        {remainingCount > 0 && (
          <div className="avatar-chip">
            +{remainingCount}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card presence-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Users Online</h2>
              <p>{users.length} active on this board</p>
            </div>
            <div className="user-list-detailed">
              {users.map((u, i) => {
                const photo = u.id === currentUserId ? currentUserPhotoURL : u.photoURL;
                return (
                  <div key={i} className="user-detail-row">
                    <div className="avatar-circle large" style={{ backgroundColor: u.color }}>
                      {photo
                        ? <img src={photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : u.name.charAt(0).toUpperCase()
                      }
                    </div>
                    <div className="user-detail-info">
                      <span className="user-detail-name">{u.name} {u.id === currentUserId && '(You)'}</span>
                      <span className="user-detail-status">Currently editing</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="primary-btn" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Update this comparator if new state props are added
function presenceAvatarsEqual(prev, next) {
  if (prev.currentUserId !== next.currentUserId) return false;
  if (prev.currentUserPhotoURL !== next.currentUserPhotoURL) return false;
  const pu = prev.presentUsers, nu = next.presentUsers;
  const pk = Object.keys(pu), nk = Object.keys(nu);
  if (pk.length !== nk.length) return false;
  for (const k of pk) {
    if (!nu[k] || pu[k].name !== nu[k].name || pu[k].color !== nu[k].color || pu[k].photoURL !== nu[k].photoURL) return false;
  }
  return true;
}

export const PresenceAvatars = React.memo(PresenceAvatarsInner, presenceAvatarsEqual);
