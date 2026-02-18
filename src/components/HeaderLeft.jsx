import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, AppWindow, ChevronDown, Grid3x3, Undo2, Home, Search } from 'lucide-react';
import { ColorPickerMenu } from './ColorPickerMenu.jsx';
import { ShapeIcon } from './ShapeIcon.jsx';
import { darkenHex } from '../utils/colorUtils.js';
import { groupToSlug } from '../utils/slugUtils.js';

function HeaderLeftInner({ state, handlers }) {
  const { boardName, boardId, boards, shapeColors, showColorPicker, snapToGrid, canUndo, activeShapeType, colorHistory, showToolbar } = state;
  const {
    setBoardId, setBoardName, onSwitchBoard, setShowColorPicker, setSnapToGrid, undo,
    handleAddSticky, handleAddShape, handleAddLine, handleAddFrame, updateActiveColor, setActiveShapeType,
  } = handlers;

  const [showBoardSwitcher, setShowBoardSwitcher] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const switcherRef = useRef(null);

  useEffect(() => {
    if (!showBoardSwitcher) return;
    const handleClick = (e) => {
      if (!switcherRef.current?.contains(e.target)) {
        setShowBoardSwitcher(false);
        setBoardSearch('');
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
  }, [showBoardSwitcher]);

  const q = boardSearch.trim().toLowerCase();
  const filteredGroups = (() => {
    if (!boards?.length) return [];
    const allBoards = boards;
    let filtered;
    if (!q) {
      filtered = allBoards;
    } else {
      const matchedGroupNames = new Set(
        allBoards.filter(b => b.group && b.group.toLowerCase().includes(q)).map(b => b.group)
      );
      filtered = allBoards.filter(b =>
        b.name.toLowerCase().includes(q) || (b.group && matchedGroupNames.has(b.group))
      );
    }
    const groups = {};
    for (const b of filtered) {
      const g = b.group || null;
      if (!groups[g]) groups[g] = [];
      groups[g].push(b);
    }
    const entries = Object.entries(groups).sort(([a], [b]) => {
      if (a === 'null' || a === null) return -1;
      if (b === 'null' || b === null) return 1;
      return a.localeCompare(b);
    });
    return entries.map(([group, items]) => ({ group: group === 'null' ? null : group, items }));
  })();

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
        className="logo-text home-link"
        onClick={() => { setBoardId(null); setBoardName(''); }}
      >
        <Home size={16} />
        CollabBoard
      </span>

      {showToolbar && <div className="board-switcher" ref={switcherRef}>
        <button
          className="board-switcher-btn"
          onClick={() => setShowBoardSwitcher(v => !v)}
        >
          {boardName || 'Board'}
          <ChevronDown size={12} />
        </button>
        {showBoardSwitcher && (
          <div className="board-switcher-dropdown">
            <div className="board-switcher-search">
              <Search size={13} />
              <input
                autoFocus
                placeholder="Search boards..."
                value={boardSearch}
                onChange={e => setBoardSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="board-switcher-list">
              {filteredGroups.length === 0 && (
                <span className="board-switcher-empty">No boards found</span>
              )}
              {filteredGroups.map(({ group, items }) => (
                <div key={group ?? '__ungrouped'} className="board-switcher-group">
                  {group && <span className="board-switcher-group-label">{group}</span>}
                  {items.map(b => (
                    <button
                      key={b.id}
                      className={`board-switcher-item ${b.id === boardId ? 'active' : ''}`}
                      onClick={() => {
                        const slug = groupToSlug(b.group || null);
                        if (onSwitchBoard) onSwitchBoard(slug, b.id, b.name);
                        else { setBoardId(b.id); setBoardName(b.name); }
                        setShowBoardSwitcher(false); setBoardSearch('');
                      }}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>}

      {showToolbar && <div className="toolbar">
        <div className="tool-split-button no-outline">
          <button data-toolbar-item="sticky" onClick={handleAddSticky} title="Add Sticky Note">
            <StickyNote size={18} fill={shapeColors.sticky.active} stroke={darkenHex(shapeColors.sticky.active, 0.2)} />
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
          <button data-toolbar-item="shape" onClick={handleActiveShapeAdd} title={`Add ${activeShapeType}`}>
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
          <button data-toolbar-item="frame" onClick={handleAddFrame} title="Add Frame">
            <AppWindow size={18} />
          </button>
        </div>

        <span className="header-divider" />

        <button
          data-toolbar-item="snap"
          className={`snap-toggle ${snapToGrid ? 'active' : ''}`}
          onClick={() => { const next = !snapToGrid; setSnapToGrid(next); localStorage.setItem('snapToGrid', next); }}
          title={snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}
        >
          <Grid3x3 size={18} />
        </button>

        <button
          data-toolbar-item="undo"
          className={`snap-toggle ${canUndo ? '' : 'disabled'}`}
          onClick={() => canUndo && undo()}
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
        >
          <Undo2 size={18} />
        </button>
      </div>}
    </div>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.boardName === ns.boardName &&
    ps.boardId === ns.boardId &&
    ps.boards === ns.boards &&
    ps.showToolbar === ns.showToolbar &&
    ps.shapeColors === ns.shapeColors &&
    ps.showColorPicker === ns.showColorPicker &&
    ps.snapToGrid === ns.snapToGrid &&
    ps.canUndo === ns.canUndo &&
    ps.activeShapeType === ns.activeShapeType &&
    ps.colorHistory === ns.colorHistory
  );
}

export const HeaderLeft = React.memo(HeaderLeftInner, areEqual);
