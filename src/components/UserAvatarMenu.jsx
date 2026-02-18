import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import './UserAvatarMenu.css';

export function UserAvatarMenu({ user, logout }) {
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
      <div
        className="user-avatar-circle"
        onClick={() => setOpen(!open)}
        title={user.displayName || user.email}
        tabIndex={-1}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="user-avatar-img" referrerPolicy="no-referrer" />
        ) : (
          initial
        )}
      </div>
      {open && (
        <div className="user-avatar-dropdown">
          <div className="dropdown-user-info">
            <span className="dropdown-user-name">{user.displayName}</span>
            <span className="dropdown-user-email">{user.email}</span>
          </div>
          <div className="dropdown-divider" />
          <button className="dropdown-item" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
