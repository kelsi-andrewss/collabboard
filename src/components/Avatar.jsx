import React from 'react';
import './Avatar.css';

export function Avatar({ photoURL, name, color, size = 'md', className = '', ...rest }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  const sizeClass = `avatar--${size}`;

  return (
    <div
      className={`avatar ${sizeClass} ${className}`.trim()}
      style={{ backgroundColor: color || 'var(--bg-tertiary)' }}
      title={name}
      {...rest}
    >
      {photoURL
        ? <img src={photoURL} alt="" referrerPolicy="no-referrer" />
        : initial
      }
    </div>
  );
}
