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
    // toolbar items
    for (const key of ['sticky', 'shape', 'frame', 'select', 'snap', 'undo']) {
      const el = document.querySelector(`[data-toolbar-item="${key}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        map[key] = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    // FAB items
    for (const key of ['ai', 'theme']) {
      const el = document.querySelector(`[data-fab-item="${key}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        map[key] = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    // ghost recenter FAB (always known position)
    map['recenter'] = { x: 40 + 28, y: window.innerHeight - 110 - 28 };
    setPositions(map);
  }, [isEmpty]);

  if (!isEmpty || !canEdit) return null;

  const arrowColor = darkMode ? '#c4b5fd' : '#6366f1';
  const labelColor = darkMode ? 'rgba(196, 181, 253, 0.6)' : 'rgba(99, 102, 241, 0.5)';

  const GROUPS = [
    { key: 'addContent', labelText: 'Add stickies, shapes & frames', targetKey: 'sticky' },
    { key: 'select',     labelText: 'Select & move objects',          targetKey: 'select' },
    { key: 'snap',       labelText: 'Snap objects to grid',           targetKey: 'snap' },
    { key: 'undo',       labelText: 'Undo last action',               targetKey: 'undo' },
    { key: 'ai',         labelText: 'Ask the AI assistant',           targetKey: 'ai' },
    { key: 'theme',      labelText: 'Toggle dark mode',               targetKey: 'theme' },
    { key: 'recenter',   labelText: 'Fit board to screen',            targetKey: 'recenter' },
  ];

  const groups = GROUPS.map(({ key, labelText, targetKey }) => {
    const target = positions[targetKey];
    if (!target) return null;

    let lx, ly, ax1, ay1, ax2, ay2;

    if (key === 'ai') {
      lx = target.x - 180;
      ly = target.y - 50;
      ax1 = lx + 90;
      ay1 = ly + 20;
      ax2 = target.x - 16;
      ay2 = target.y - 16;
    } else if (key === 'theme') {
      lx = target.x + 20;
      ly = target.y - 12;
      ax1 = lx + 120;
      ay1 = ly + 8;
      ax2 = target.x;
      ay2 = target.y;
    } else if (key === 'recenter') {
      lx = target.x + 16;
      ly = target.y - 30;
      ax1 = lx + 50;
      ay1 = ly + 8;
      ax2 = target.x;
      ay2 = target.y;
    } else {
      // toolbar items — label below, arrow from label center up to button bottom edge
      if (key === 'addContent') {
        lx = target.x - 100;
        ly = target.y + 40;
        ax1 = lx + 100;
      } else if (key === 'select') {
        lx = target.x - 70;
        ly = target.y + 40;
        ax1 = lx + 70;
      } else if (key === 'snap') {
        lx = target.x - 45;
        ly = target.y + 68;
        ax1 = lx + 45;
      } else {
        // undo
        lx = target.x - 55;
        ly = target.y + 40;
        ax1 = lx + 55;
      }
      ay1 = ly + 8;
      ax2 = target.x;
      ay2 = target.y + 16;
    }

    return { key, labelText, lx, ly, ax1, ay1, ax2, ay2 };
  }).filter(Boolean);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 500 }}>
      {/* Ghost recenter FAB */}
      <div style={GHOST_FAB_STYLE}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </div>

      {/* SVG layer for arrows */}
      {groups.map(({ key, ax1, ay1, ax2, ay2 }) => (
        <HandDrawnArrow key={key} x1={ax1} y1={ay1} x2={ax2} y2={ay2} color={arrowColor} />
      ))}

      {/* Labels */}
      {groups.map(({ key, labelText, lx, ly }) => (
        <div
          key={key}
          style={{
            position: 'fixed',
            left: lx,
            top: ly,
            color: labelColor,
            fontSize: '0.75rem',
            fontWeight: 400,
            fontStyle: 'italic',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {labelText}
        </div>
      ))}
    </div>
  );
}
