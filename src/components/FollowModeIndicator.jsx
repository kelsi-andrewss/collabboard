import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './FollowModeIndicator.css';

export function FollowModeIndicator({ name, onExit }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  return (
    <div className="follow-mode-indicator">
      <span className="follow-mode-indicator__label">Following {name}</span>
      <button
        className="follow-mode-indicator__exit"
        onClick={onExit}
        aria-label="Stop following"
      >
        <X size={14} />
      </button>
    </div>
  );
}
