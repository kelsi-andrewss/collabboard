import React from 'react';

export function ReactionOverlay({ reactions }) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div
      className="reaction-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 900,
        overflow: 'hidden',
      }}
    >
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className="reaction-float"
          style={{
            position: 'absolute',
            left: reaction.x,
            top: reaction.y,
            fontSize: '2rem',
            lineHeight: 1,
            userSelect: 'none',
            animation: 'reaction-float-up 1.5s ease-out forwards',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {reaction.emoji}
        </div>
      ))}
    </div>
  );
}
