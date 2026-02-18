import React, { useLayoutEffect, useState } from 'react';

const GHOST_FAB_STYLE = {
  position: 'fixed',
  bottom: 110,
  left: 40,
  width: 56,
  height: 56,
  borderRadius: 28,
  background: 'var(--accent-primary)',
  opacity: 0.4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

const TOOLS = [
  { key: 'sticky', label: 'Add a sticky note' },
  { key: 'shape', label: 'Add shapes & lines' },
  { key: 'frame', label: 'Group things in a frame' },
  { key: 'snap', label: 'Snap objects to grid' },
  { key: 'undo', label: 'Undo last action' },
];

function Arrow({ x1, y1, x2, y2, color }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const id = `arrowhead-${Math.round(x1)}-${Math.round(y1)}`;
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id={id} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill={color} opacity="0.5" />
        </marker>
      </defs>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.5"
        strokeDasharray="5,4"
        markerEnd={`url(#${id})`}
      />
    </svg>
  );
}

export function EmptyStateOverlay({ isEmpty, darkMode }) {
  const [positions, setPositions] = useState({});

  useLayoutEffect(() => {
    if (!isEmpty) return;
    const map = {};
    for (const { key } of TOOLS) {
      const el = document.querySelector(`[data-toolbar-item="${key}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        map[key] = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    // ghost recenter FAB center
    map['recenter'] = { x: 40 + 28, y: window.innerHeight - 110 - 28 };
    setPositions(map);
  }, [isEmpty]);

  if (!isEmpty) return null;

  const arrowColor = darkMode ? '#c4b5fd' : '#6366f1';
  const labelBg = darkMode ? 'rgba(31,41,55,0.9)' : 'rgba(255,255,255,0.92)';
  const labelColor = darkMode ? '#e5e7eb' : '#374151';

  // Label positions: spread below toolbar (for toolbar items) or near ghost FAB
  const labelOffsets = {
    sticky: { lx: 80, ly: 120 },
    shape:  { lx: 160, ly: 160 },
    frame:  { lx: 260, ly: 120 },
    snap:   { lx: 360, ly: 160 },
    undo:   { lx: 460, ly: 120 },
    recenter: { lx: 40 + 56 + 16, ly: window.innerHeight - 110 - 28 - 6 },
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 500 }}>
      {/* Ghost recenter FAB */}
      <div style={GHOST_FAB_STYLE}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </div>

      {/* SVG layer for arrows */}
      {[...TOOLS, { key: 'recenter', label: 'Fit board to screen' }].map(({ key, label }) => {
        const target = positions[key];
        const off = labelOffsets[key];
        if (!target || !off) return null;
        // Arrow from label to target
        const lx = off.lx + 60;
        const ly = off.ly + 10;
        return <Arrow key={key} x1={lx} y1={ly} x2={target.x} y2={target.y} color={arrowColor} />;
      })}

      {/* Labels */}
      {[...TOOLS, { key: 'recenter', label: 'Fit board to screen' }].map(({ key, label }) => {
        const off = labelOffsets[key];
        if (!off) return null;
        return (
          <div
            key={key}
            style={{
              position: 'fixed',
              left: off.lx,
              top: off.ly,
              background: labelBg,
              color: labelColor,
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
