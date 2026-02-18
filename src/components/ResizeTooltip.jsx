import React from 'react';

function ResizeTooltipInner({ state }) {
  const { resizeTooltip } = state;

  if (!resizeTooltip) return null;

  return (
    <div
      className="resize-tooltip"
      style={{
        position: 'fixed',
        left: resizeTooltip.x,
        top: resizeTooltip.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 2000,
      }}
    >
      {resizeTooltip.msg}
    </div>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  return prev.state.resizeTooltip === next.state.resizeTooltip;
}

export const ResizeTooltip = React.memo(ResizeTooltipInner, areEqual);
