import React, { useState, useEffect } from 'react';
import { LogOut, Shield, Palette } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import './UserAvatarMenu.css';

export function UserAvatarMenu({ user, logout, isAdmin, adminViewActive, onToggleAdminView, onOpenAdminPanel, onOpenAppearance }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest('.user-avatar-menu')) setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    const timer = setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('keydown', esc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();

  return (
    <div className="user-avatar-menu">
      <Avatar
        photoURL={user.photoURL}
        name={user.displayName || user.email}
        size="md"
        className="user-avatar-circle"
        onClick={() => setOpen(!open)}
        tabIndex={-1}
      />
      {open && (
        <div className="user-avatar-dropdown">
          <div className="dropdown-user-info">
            <span className="dropdown-user-name">{user.displayName}</span>
            <span className="dropdown-user-email">{user.email}</span>
          </div>
          {isAdmin && (
            <>
              <div className="dropdown-divider" />
              <button className="dropdown-item" onClick={() => { setOpen(false); onOpenAdminPanel?.(); }}>
                <Shield size={16} />
                Admin Panel
              </button>
              <button className="dropdown-item" onClick={onToggleAdminView}>
                <Shield size={16} />
                {adminViewActive ? 'Switch to User View' : 'Switch to Admin View'}
              </button>
            </>
          )}
          <div className="dropdown-divider" />
          <button className="dropdown-item" onClick={() => { setOpen(false); onOpenAppearance?.(); }}>
            <Palette size={16} />
            Appearance
          </button>
          <button className="dropdown-item" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
