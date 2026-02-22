import React, { useState } from 'react';
import { HelpCircle, Link, Check, Settings } from 'lucide-react';
import { PresenceAvatars } from './PresenceAvatars.jsx';
import { UserAvatarMenu } from './UserAvatarMenu.jsx';
import { useDraggableFloat } from '../hooks/useDraggableFloat';

function HeaderRightInner({ state, handlers }) {
  const { presentUsers, currentUserId, user } = state;
  const { setShowTutorial, logout, setShowBoardSettings, onOpenAppearance } = handlers;
  const [copied, setCopied] = useState(false);
  const { pos, dragHandleProps } = useDraggableFloat('toolbar-right', null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="floating-toolbar-chip"
      ref={dragHandleProps.ref}
      onMouseDown={dragHandleProps.onMouseDown}
      style={pos ? { left: pos.x, top: pos.y } : { right: 16, top: 16 }}
    >
      <PresenceAvatars presentUsers={presentUsers} currentUserId={currentUserId} currentUserPhotoURL={user?.photoURL || null} />
      <span className="header-divider" />
      <div className="header-icon-group">
        <button
          className="help-btn"
          onClick={handleCopyLink}
          title="Copy board link"
        >
          {copied ? <Check size={18} /> : <Link size={18} />}
        </button>
        {setShowBoardSettings && (
          <button
            className="help-btn"
            onClick={() => setShowBoardSettings(true)}
            title="Board settings & sharing"
          >
            <Settings size={18} />
          </button>
        )}
        <button
          className="help-btn"
          onClick={() => setShowTutorial(true)}
          title="Show Tutorial"
        >
          <HelpCircle size={18} />
        </button>
      </div>
      <span className="header-divider" />
      <UserAvatarMenu user={user} logout={logout} onOpenAppearance={onOpenAppearance} />
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
