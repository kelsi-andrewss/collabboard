import React, { useState } from 'react';
import { HelpCircle, Link, Check } from 'lucide-react';
import { PresenceAvatars } from './PresenceAvatars.jsx';
import { UserAvatarMenu } from './UserAvatarMenu.jsx';

function HeaderRightInner({ state, handlers }) {
  const { presentUsers, currentUserId, user } = state;
  const { setShowTutorial, logout } = handlers;
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="header-right">
      <PresenceAvatars presentUsers={presentUsers} currentUserId={currentUserId} currentUserPhotoURL={user?.photoURL || null} />
      <div className="header-icon-group">
        <button
          className="help-btn"
          onClick={handleCopyLink}
          title="Copy board link"
        >
          {copied ? <Check size={18} /> : <Link size={18} />}
        </button>
        <button
          className="help-btn"
          onClick={() => setShowTutorial(true)}
          title="Show Tutorial"
        >
          <HelpCircle size={18} />
        </button>
      </div>
      <span className="header-divider" />
      <UserAvatarMenu user={user} logout={logout} />
    </div>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  if (ps.currentUserId !== ns.currentUserId) return false;
  if (prev.state.user !== next.state.user) return false;
  const pu = ps.presentUsers, nu = ns.presentUsers;
  const pk = Object.keys(pu), nk = Object.keys(nu);
  if (pk.length !== nk.length) return false;
  for (const k of pk) {
    if (!nu[k] || pu[k].name !== nu[k].name || pu[k].color !== nu[k].color) return false;
  }
  return true;
}

export const HeaderRight = React.memo(HeaderRightInner, areEqual);
