import React, { useRef } from 'react';
import { Palette, Trash2 } from 'lucide-react';
import { getContrastColor } from '../utils/colorUtils.js';
import { ColorPickerMenu } from './ColorPickerMenu.jsx';
import './SelectedActionBar.css';

function SelectedActionBarInner({ state, handlers }) {
  const { selectedId, objects, showSelectedColorPicker, stagePos, stageScale, dragPos, shapeColors, colorHistory, canEdit } = state;
  const { setShowSelectedColorPicker, updateObject, updateObjectDirect, handleDeleteWithCleanup, updateActiveColor } = handlers;

  const toolbarRef = useRef();

  if (!selectedId || !objects[selectedId] || !canEdit) return null;

  const MARGIN = 12;
  const obj = objects[selectedId];
  const posX = (dragPos?.id === selectedId ? dragPos.x : obj.x);
  const posY = (dragPos?.id === selectedId ? dragPos.y : obj.y);
  const screenX = posX * stageScale + stagePos.x;
  const HEADER_HEIGHT = 60;
  const screenY = posY * stageScale + stagePos.y + HEADER_HEIGHT;
  const screenW = (obj.width ?? 150) * stageScale;
  const screenH = (obj.height ?? 150) * stageScale;

  const toolbarRect = toolbarRef.current?.getBoundingClientRect();
  const toolbarW = toolbarRect?.width ?? 44;
  const toolbarH = toolbarRect?.height ?? 200;

  // Default: left of object, top-aligned
  let top = screenY;
  let left = screenX - toolbarW - MARGIN;

  // Fallback: right side if too close to left edge
  if (left < MARGIN) left = screenX + screenW + MARGIN;

  // Clamp vertically so it stays on screen
  top = Math.max(MARGIN, Math.min(top, window.innerHeight - toolbarH - MARGIN));

  return (
    <div
      ref={toolbarRef}
      className="selected-actions"
      style={{ top, left }}
    >
      <div className="selected-color-picker-wrapper">
        <button
          className="action-fab"
          style={{ background: objects[selectedId].color || '#3b82f6' }}
          onClick={() => setShowSelectedColorPicker(!showSelectedColorPicker)}
          title="Change Color"
        >
          <Palette size={16} color={getContrastColor(objects[selectedId].color || '#3b82f6')} />
        </button>
        {showSelectedColorPicker && (
          <div className="selected-color-dropdown">
            <ColorPickerMenu
              type={obj.type}
              data={shapeColors[obj.type] ?? { active: obj.color || '#3b82f6' }}
              history={colorHistory}
              onSelect={(type, color) => {
                updateObjectDirect(selectedId, { color });
                updateActiveColor(type, color);
              }}
              onCommit={(type, color) => {
                updateObject(selectedId, { color });
                updateActiveColor(type, color);
              }}
            />
          </div>
        )}
      </div>
      <button
        className="action-fab delete-action"
        onClick={() => handleDeleteWithCleanup(selectedId)}
        title="Delete Selected"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.selectedId === ns.selectedId &&
    ps.objects === ns.objects &&
    ps.showSelectedColorPicker === ns.showSelectedColorPicker &&
    ps.stagePos?.x === ns.stagePos?.x &&
    ps.stagePos?.y === ns.stagePos?.y &&
    ps.stageScale === ns.stageScale &&
    ps.dragPos?.id === ns.dragPos?.id &&
    ps.dragPos?.x === ns.dragPos?.x &&
    ps.dragPos?.y === ns.dragPos?.y &&
    ps.shapeColors === ns.shapeColors &&
    ps.colorHistory === ns.colorHistory &&
    ps.canEdit === ns.canEdit
  );
}

export const SelectedActionBar = React.memo(SelectedActionBarInner, areEqual);
