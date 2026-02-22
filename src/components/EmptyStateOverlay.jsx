import React from 'react';
import { Maximize } from 'lucide-react';

const GHOST_OPACITY = 0.18;

const containerStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  zIndex: 500,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const ghostBoardStyle = {
  position: 'relative',
  width: 560,
  height: 360,
  pointerEvents: 'none',
};

const labelStyle = {
  position: 'absolute',
  fontSize: 'var(--md-sys-typescale-label-small-size, 11px)',
  fontWeight: 'var(--md-sys-typescale-label-small-weight, 500)',
  color: 'var(--md-sys-color-outline)',
  opacity: 0.7,
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

// Ghost FAB mirrors .recenter-fab exactly: bottom: 40px, left: 40px
const ghostFabStyle = {
  position: 'fixed',
  bottom: 40,
  left: 40,
  width: 56,
  height: 56,
  borderRadius: 'var(--md-sys-shape-corner-large)',
  background: 'var(--md-sys-color-primary)',
  color: 'var(--md-sys-color-on-primary)',
  border: 'none',
  boxShadow: 'var(--md-sys-elevation-1)',
  opacity: 0.35,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
};

function GhostStickyNote({ x, y }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 120,
        height: 110,
        borderRadius: 'var(--md-sys-shape-corner-medium)',
        background: 'var(--md-sys-color-tertiary)',
        opacity: GHOST_OPACITY,
        boxShadow: 'var(--md-sys-elevation-1)',
      }}
    />
  );
}

function GhostRectangle({ x, y }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 110,
        height: 80,
        borderRadius: 'var(--md-sys-shape-corner-small)',
        background: 'transparent',
        border: `2.5px solid var(--md-sys-color-primary)`,
        opacity: GHOST_OPACITY,
      }}
    />
  );
}

function GhostFrame({ x, y, width, height }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: 'var(--md-sys-shape-corner-medium)',
        background: 'transparent',
        border: `2px dashed var(--md-sys-color-outline)`,
        opacity: GHOST_OPACITY,
      }}
    >
      {/* Frame title bar */}
      <div
        style={{
          position: 'absolute',
          top: -24,
          left: 0,
          height: 22,
          width: 80,
          borderRadius: 'var(--md-sys-shape-corner-extra-small) var(--md-sys-shape-corner-extra-small) 0 0',
          background: 'var(--md-sys-color-outline)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}

function GhostConnector({ x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;

  // Midpoint control for a gentle curve
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - 20;

  // Arrowhead
  const endAngle = Math.atan2(y2 - my, x2 - mx);
  const headLen = 9;
  const headAngle = 0.4;
  const ah1x = x2 - headLen * Math.cos(endAngle - headAngle);
  const ah1y = y2 - headLen * Math.sin(endAngle - headAngle);
  const ah2x = x2 - headLen * Math.cos(endAngle + headAngle);
  const ah2y = y2 - headLen * Math.sin(endAngle + headAngle);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
        fill="none"
        stroke="var(--md-sys-color-secondary)"
        strokeWidth="2"
        strokeOpacity={GHOST_OPACITY * 3}
        strokeLinecap="round"
      />
      <path
        d={`M ${ah1x} ${ah1y} L ${x2} ${y2} L ${ah2x} ${ah2y}`}
        fill="none"
        stroke="var(--md-sys-color-secondary)"
        strokeWidth="2"
        strokeOpacity={GHOST_OPACITY * 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EmptyStateOverlay({ isEmpty, canEdit = true }) {
  if (!isEmpty || !canEdit) return null;

  // Positions within the 560x360 ghost board
  // Frame: top-right area
  const frameX = 300, frameY = 40, frameW = 220, frameH = 200;
  // Sticky: top-left
  const stickyX = 40, stickyY = 50;
  // Rectangle: mid-left
  const rectX = 50, rectY = 210;
  // Connector: from sticky to rectangle
  const connX1 = stickyX + 60, connY1 = stickyY + 110;
  const connX2 = rectX + 55, connY2 = rectY;

  return (
    <div style={containerStyle}>
      {/* Ghost example board */}
      <div style={ghostBoardStyle}>
        {/* Frame */}
        <GhostFrame x={frameX} y={frameY} width={frameW} height={frameH} />
        <div
          style={{
            ...labelStyle,
            left: frameX,
            top: frameY - 42,
          }}
        >
          Frame — group related items
        </div>

        {/* Sticky note */}
        <GhostStickyNote x={stickyX} y={stickyY} />
        <div
          style={{
            ...labelStyle,
            left: stickyX,
            top: stickyY + 118,
          }}
        >
          Sticky note
        </div>

        {/* Rectangle shape */}
        <GhostRectangle x={rectX} y={rectY} />
        <div
          style={{
            ...labelStyle,
            left: rectX,
            top: rectY + 88,
          }}
        >
          Shape
        </div>

        {/* Connector line */}
        <GhostConnector x1={connX1} y1={connY1} x2={connX2} y2={connY2} />
        <div
          style={{
            ...labelStyle,
            left: connX1 - 20,
            top: (connY1 + connY2) / 2 - 28,
          }}
        >
          Connector
        </div>

        {/* Central call-to-action */}
        <div
          style={{
            position: 'absolute',
            bottom: -52,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: 'var(--md-sys-color-outline)',
            fontSize: 'var(--md-sys-typescale-body-medium-size, 14px)',
            fontWeight: 'var(--md-sys-typescale-body-medium-weight, 400)',
            opacity: 0.65,
            letterSpacing: '0.01em',
            pointerEvents: 'none',
          }}
        >
          Click a tool in the toolbar above to start building
        </div>
      </div>

      {/* Ghost recenter FAB — mirrors .recenter-fab position exactly */}
      <div style={ghostFabStyle} title="Fit board to screen">
        <Maximize size={24} />
      </div>
    </div>
  );
}
