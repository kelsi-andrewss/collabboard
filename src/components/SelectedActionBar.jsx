import React, { useRef, useState, useEffect } from 'react';
import { Palette, Trash2 } from 'lucide-react';
import { getContrastColor } from '../utils/colorUtils.js';
import { ColorPickerMenu } from './ColorPickerMenu.jsx';
import './SelectedActionBar.css';

function SelectedActionBarInner({ state, handlers }) {
  const { selectedId, objects, showSelectedColorPicker, stagePos, stageScale, dragPos, shapeColors, colorHistory, canEdit } = state;
  const { setShowSelectedColorPicker, updateObject, updateObjectDirect, handleDeleteWithCleanup, updateActiveColor } = handlers;

  const toolbarRef = useRef();
  const [isExiting, setIsExiting] = useState(false);
  const prevVisibleRef = useRef(false);
  const lastStateRef = useRef({ selectedId, stagePos, stageScale, dragPos, objects });

  const isVisible = !!(selectedId && objects[selectedId] && canEdit);

  useEffect(() => {
    if (isVisible) {
      lastStateRef.current = { selectedId, stagePos, stageScale, dragPos, objects };
    }
    if (prevVisibleRef.current && !isVisible && !isExiting) {
      setIsExiting(true);
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible, isExiting, selectedId, stagePos, stageScale, dragPos, objects]);

  if (!isVisible && !isExiting) return null;

  const snapshot = isVisible
    ? { selectedId, stagePos, stageScale, dragPos, objects }
    : lastStateRef.current;

  const MARGIN = 12;
  const sObj = snapshot.objects[snapshot.selectedId];
  const obj = isVisible ? objects[selectedId] : sObj;
  const sId = isVisible ? selectedId : snapshot.selectedId;
  const sDragPos = isVisible ? dragPos : snapshot.dragPos;
  const sStagePos = isVisible ? stagePos : snapshot.stagePos;
  const sStageScale = isVisible ? stageScale : snapshot.stageScale;
  const posX = (sDragPos?.id === sId ? sDragPos.x : obj.x);
  const posY = (sDragPos?.id === sId ? sDragPos.y : obj.y);
  const screenX = posX * sStageScale + sStagePos.x;
  const HEADER_HEIGHT = 60;
  const screenY = posY * sStageScale + sStagePos.y + HEADER_HEIGHT;
  const screenW = (obj.width ?? 150) * sStageScale;
  const screenH = (obj.height ?? 150) * sStageScale;

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
      className={`selected-actions${isExiting ? ' is-exiting' : ''}`}
      style={{ top, left }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && isExiting) {
          setIsExiting(false);
        }
      }}
    >
      <div className="selected-color-picker-wrapper">
        <button
          className="action-fab"
          style={{ background: obj.color || '#3b82f6' }}
          onClick={() => isVisible && setShowSelectedColorPicker(!showSelectedColorPicker)}
          title="Change Color"
        >
          <Palette size={16} color={getContrastColor(obj.color || '#3b82f6')} />
        </button>
        {showSelectedColorPicker && isVisible && (
          <div className="selected-color-dropdown">
            <ColorPickerMenu
              type={obj.type}
              data={shapeColors[obj.type] ?? { active: obj.color || '#3b82f6' }}
              history={colorHistory}
              onSelect={(type, color) => {
                updateObjectDirect(sId, { color });
                updateActiveColor(type, color);
              }}
              onCommit={(type, color) => {
                updateObject(sId, { color });
                updateActiveColor(type, color);
              }}
            />
          </div>
        )}
      </div>
      <button
        className="action-fab delete-action"
        onClick={() => isVisible && handleDeleteWithCleanup(sId)}
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
