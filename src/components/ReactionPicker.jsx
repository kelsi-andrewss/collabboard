import React, { useEffect, useRef } from 'react';

const EMOJIS = ['👍', '🔥', '👀', '❤️', '✨'];

export function ReactionPicker({ x, y, onSelect, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onClose]);

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="reaction-picker"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -110%)',
        zIndex: 1000,
        display: 'flex',
        gap: 'var(--md-sys-spacing-1)',
        background: 'var(--md-sys-color-surface-container-high)',
        borderRadius: 'var(--md-sys-shape-corner-full)',
        padding: 'var(--md-sys-spacing-1) var(--md-sys-spacing-2)',
        boxShadow: 'var(--md-sys-elevation-2)',
        border: '1px solid var(--md-sys-color-outline-variant)',
      }}
    >
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          className="reaction-picker-btn"
          onClick={() => onSelect(emoji)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.5rem',
            lineHeight: 1,
            padding: 'var(--md-sys-spacing-1)',
            borderRadius: 'var(--md-sys-shape-corner-small)',
            transition: 'transform var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
