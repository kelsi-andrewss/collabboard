import React, { useState } from 'react';
import { HelpCircle, Link, Check, Settings } from 'lucide-react';
import { PresenceAvatars } from './PresenceAvatars.jsx';
import { UserAvatarMenu } from './UserAvatarMenu.jsx';
import { useDraggableFloat } from '../hooks/useDraggableFloat';

function HeaderRightInner({ state, handlers }) {
  const { presentUsers, currentUserId, user } = state;
  const { setShowTutorial, logout, setShowBoardSettings, onOpenAppearance } = handlers;
  const [copied, setCopied] = useState(false);
  const { dragHandleProps, orientation } = useDraggableFloat('toolbar-right', null);
  const toggleOrientation = dragHandleProps?.onDoubleClick;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const iconGroup = (
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
  );

  const userMenu = <UserAvatarMenu user={user} logout={logout} onOpenAppearance={onOpenAppearance} />;
  const presenceAvatars = <PresenceAvatars presentUsers={presentUsers} currentUserId={currentUserId} currentUserPhotoURL={user?.photoURL || null} />;

  return (
    <div
      className="floating-toolbar-chip"
      ref={dragHandleProps.ref}
      data-orient={orientation === 'vertical' ? 'vertical' : undefined}
      style={{ right: 16, top: 16 }}
    >
      <button className="chip-orient-btn" onClick={toggleOrientation} title="Toggle orientation">
        {orientation === 'vertical' ? '↔' : '↕'}
      </button>
      {orientation === 'vertical' ? (
        <>
          {userMenu}
          <span className="header-divider" />
          {iconGroup}
          <span className="header-divider" />
          {presenceAvatars}
        </>
      ) : (
        <>
          {presenceAvatars}
          <span className="header-divider" />
          {iconGroup}
          <span className="header-divider" />
          {userMenu}
        </>
      )}
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
