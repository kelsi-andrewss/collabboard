import React from 'react';

function FramePropsPanelInner({ state, handlers }) {
  const { selectedId, objects } = state;
  const { updateObject } = handlers;

  if (!selectedId || !objects[selectedId] || objects[selectedId].type !== 'frame') return null;

  return (
    <div className="frame-props-panel">
      <label>Frame Color</label>
      <div className="frame-props-row">
        <input
          type="color"
          value={objects[selectedId].color || '#6366f1'}
          onChange={(e) => updateObject(selectedId, { color: e.target.value })}
          className="native-picker"
        />
      </div>
      <div className="frame-color-swatches">
        {['#6366f1', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#ec4899', '#f97316', '#374151'].map(c => (
          <div
            key={c}
            className="color-swatch"
            style={{ background: c }}
            onClick={() => updateObject(selectedId, { color: c })}
          />
        ))}
      </div>
    </div>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.selectedId === ns.selectedId &&
    ps.objects === ns.objects
  );
}

export const FramePropsPanel = React.memo(FramePropsPanelInner, areEqual);
