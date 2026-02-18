import React from 'react';
import { Square, AppWindow, ChevronDown, Grid3x3, Undo2 } from 'lucide-react';
import { ColorPickerMenu } from './ColorPickerMenu.jsx';
import { ShapeIcon } from './ShapeIcon.jsx';
import { darkenHex } from '../utils/colorUtils.js';

function HeaderLeftInner({ state, handlers }) {
  const { boardName, shapeColors, showColorPicker, snapToGrid, canUndo, activeShapeType, colorHistory } = state;
  const {
    setBoardId, setBoardName, setShowColorPicker, setSnapToGrid, undo,
    handleAddSticky, handleAddShape, handleAddLine, handleAddFrame, updateActiveColor, setActiveShapeType,
  } = handlers;

  const handleShapeAdd = (type) => {
    setActiveShapeType(type);
    if (type === 'line') handleAddLine();
    else handleAddShape(type);
    setShowColorPicker(null);
  };

  const handleActiveShapeAdd = () => {
    if (activeShapeType === 'line') handleAddLine();
    else handleAddShape(activeShapeType);
  };

  return (
    <div className="header-left">
      <span
        className="logo-text"
        onClick={() => { setBoardId(null); setBoardName(''); }}
        style={{ cursor: 'pointer' }}
      >
        CollabBoard
      </span>
      <span className="board-badge">/ {boardName}</span>
      <div className="toolbar">
        <div className="tool-split-button no-outline">
          <button onClick={handleAddSticky} title="Add Sticky Note">
            <Square size={18} fill={shapeColors.sticky.active} stroke={darkenHex(shapeColors.sticky.active, 0.2)} />
          </button>
          <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'sticky' ? null : 'sticky')}>
            <ChevronDown size={14} />
          </button>
          {showColorPicker === 'sticky' && (
            <ColorPickerMenu
              type="sticky"
              data={shapeColors.sticky}
              history={colorHistory}
              onSelect={updateActiveColor}
            />
          )}
        </div>

        <div className="tool-split-button no-outline">
          <button onClick={handleActiveShapeAdd} title={`Add ${activeShapeType}`}>
            <ShapeIcon type={activeShapeType} color={shapeColors.shapes.active} />
          </button>
          <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'shapes' ? null : 'shapes')}>
            <ChevronDown size={14} />
          </button>
          {showColorPicker === 'shapes' && (
            <ColorPickerMenu
              type={activeShapeType}
              data={shapeColors.shapes}
              history={colorHistory}
              onSelect={updateActiveColor}
              shapeSelector={{
                types: ['rectangle', 'circle', 'triangle', 'line'],
                activeType: activeShapeType,
                onSelect: handleShapeAdd,
              }}
            />
          )}
        </div>

        <div className="tool-split-button no-outline">
          <button onClick={handleAddFrame} title="Add Frame">
            <AppWindow size={18} />
          </button>
        </div>

        <button
          className={`snap-toggle ${snapToGrid ? 'active' : ''}`}
          onClick={() => { const next = !snapToGrid; setSnapToGrid(next); localStorage.setItem('snapToGrid', next); }}
          title={snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}
        >
          <Grid3x3 size={18} />
        </button>

        <button
          className={`snap-toggle ${canUndo ? '' : 'disabled'}`}
          onClick={() => canUndo && undo()}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
        >
          <Undo2 size={18} />
        </button>
      </div>
    </div>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.boardName === ns.boardName &&
    ps.shapeColors === ns.shapeColors &&
    ps.showColorPicker === ns.showColorPicker &&
    ps.snapToGrid === ns.snapToGrid &&
    ps.canUndo === ns.canUndo &&
    ps.activeShapeType === ns.activeShapeType &&
    ps.colorHistory === ns.colorHistory
  );
}

export const HeaderLeft = React.memo(HeaderLeftInner, areEqual);
