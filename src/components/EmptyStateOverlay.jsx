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

function HandDrawnArrow({ x1, y1, x2, y2, color }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  // Seed wobble from coordinates for deterministic curves
  const seed = Math.abs(Math.sin(x1 * 73 + y1 * 37 + x2 * 17 + y2 * 53)) * 0.5 + 0.3;
  const perpX = -dy / len;
  const perpY = dx / len;
  const offset = len * 0.2 * seed;

  // Control points for cubic bezier
  const cp1x = x1 + dx * 0.25 + perpX * offset * 1.2;
  const cp1y = y1 + dy * 0.25 + perpY * offset * 1.2;
  const cp2x = x1 + dx * 0.75 + perpX * offset * 0.8;
  const cp2y = y1 + dy * 0.75 + perpY * offset * 0.8;

  // Arrowhead at end — two short lines
  const endAngle = Math.atan2(y2 - cp2y, x2 - cp2x);
  const headLen = 10;
  const headAngle = 0.45;
  const ah1x = x2 - headLen * Math.cos(endAngle - headAngle);
  const ah1y = y2 - headLen * Math.sin(endAngle - headAngle);
  const ah2x = x2 - headLen * Math.cos(endAngle + headAngle);
  const ah2y = y2 - headLen * Math.sin(endAngle + headAngle);

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.4"
        strokeLinecap="round"
      />
      <path
        d={`M ${ah1x} ${ah1y} L ${x2} ${y2} L ${ah2x} ${ah2y}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyStateOverlay({ isEmpty, darkMode, canEdit = true }) {
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

  if (!isEmpty || !canEdit) return null;

  const arrowColor = darkMode ? '#c4b5fd' : '#6366f1';
  const labelColor = darkMode ? 'rgba(196, 181, 253, 0.6)' : 'rgba(99, 102, 241, 0.5)';

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
      {[...TOOLS, { key: 'recenter', label: 'Fit board to screen' }].map(({ key }) => {
        const target = positions[key];
        const off = labelOffsets[key];
        if (!target || !off) return null;
        const lx = off.lx + 60;
        const ly = off.ly + 10;
        return <HandDrawnArrow key={key} x1={lx} y1={ly} x2={target.x} y2={target.y} color={arrowColor} />;
      })}

      {/* Labels — plain italic text, no chip/background */}
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
              color: labelColor,
              fontSize: '0.75rem',
              fontWeight: 400,
              fontStyle: 'italic',
              whiteSpace: 'nowrap',
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
