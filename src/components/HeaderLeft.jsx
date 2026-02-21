import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, AppWindow, ChevronDown, Grid3x3, Undo2, Home, Search, MousePointer2, Shield, Type, Minus, MoveRight } from 'lucide-react';
import { ColorPickerMenu } from './ColorPickerMenu.jsx';
import { ShapeIcon } from './ShapeIcon.jsx';
import { darkenHex } from '../utils/colorUtils.js';
import './BoardSwitcher.css';
import { buildSlugChain } from '../utils/slugUtils.js';

function HeaderLeftInner({ state, handlers }) {
  const { boardName, boardId, boards, groups: groupsList = [], shapeColors, showColorPicker, snapToGrid, canUndo, activeShapeType, colorHistory, showToolbar, pendingTool, activeTool, canEdit, isAdmin, adminViewActive } = state;
  const {
    setBoardId, setBoardName, onSwitchBoard, setShowColorPicker, setSnapToGrid, undo,
    handleAddSticky, handleAddShape, handleAddLine, handleAddArrow, handleAddFrame, handleAddText, updateActiveColor, setActiveShapeType, setPendingTool, setActiveTool,
  } = handlers;

  const [showBoardSwitcher, setShowBoardSwitcher] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const switcherRef = useRef(null);
  const [activeConnectorType, setActiveConnectorType] = useState('line');
  const connectorRef = useRef(null);

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

  useEffect(() => {
    if (showColorPicker !== 'connector') return;
    const handleClick = (e) => {
      if (!connectorRef.current?.contains(e.target)) {
        setShowColorPicker(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowColorPicker(null);
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showColorPicker, setShowColorPicker]);

  const q = boardSearch.trim().toLowerCase();
  const getGroupName = (b) => {
    if (b.groupId) {
      const g = groupsList.find(gr => gr.id === b.groupId);
      return g?.name || null;
    }
    return b.group || null;
  };

  const filteredGroups = (() => {
    if (!boards?.length) return [];
    const allBoards = boards;
    let filtered;
    if (!q) {
      filtered = allBoards;
    } else {
      const matchedGroupNames = new Set(
        allBoards.map(b => getGroupName(b)).filter(n => n && n.toLowerCase().includes(q))
      );
      filtered = allBoards.filter(b =>
        b.name.toLowerCase().includes(q) || matchedGroupNames.has(getGroupName(b))
      );
    }
    const groupMap = {};
    for (const b of filtered) {
      const g = getGroupName(b);
      if (!groupMap[g]) groupMap[g] = [];
      groupMap[g].push(b);
    }
    const entries = Object.entries(groupMap).sort(([a], [b]) => {
      if (a === 'null' || a === null) return -1;
      if (b === 'null' || b === null) return 1;
      return a.localeCompare(b);
    });
    return entries.map(([group, items]) => ({ group: group === 'null' ? null : group, items }));
  })();

  const handleShapeAdd = (type) => {
    setActiveShapeType(type);
    if (setPendingTool) {
      setPendingTool(type);
    } else {
      handleAddShape(type);
    }
    setShowColorPicker(null);
  };

  const handleActiveShapeAdd = () => {
    if (activeShapeType === 'line') handleAddLine();
    else if (activeShapeType === 'arrow') handleAddArrow();
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

      {isAdmin && adminViewActive && (
        <span className="admin-mode-badge">
          <Shield size={12} />
          Admin
        </span>
      )}

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
                        const bGroup = b.groupId ? groupsList.find(g => g.id === b.groupId) : null;
                        if (onSwitchBoard) onSwitchBoard(bGroup ? buildSlugChain(bGroup, groupsList) : [], b.id, b.name);
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
        {canEdit && (
          <>
            <div className="tool-split-button no-outline">
              <button data-toolbar-item="sticky" className={pendingTool === 'sticky' ? 'tool-active' : ''} onClick={() => setPendingTool ? setPendingTool(pendingTool === 'sticky' ? null : 'sticky') : handleAddSticky()} title="Add Sticky Note (click to place)">
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
              <button data-toolbar-item="shape" className={pendingTool === activeShapeType ? 'tool-active' : ''} onClick={() => setPendingTool ? setPendingTool(pendingTool === activeShapeType ? null : activeShapeType) : handleActiveShapeAdd()} title={`Add ${activeShapeType} (click to place)`}>
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
                    types: ['rectangle', 'circle', 'triangle'],
                    activeType: activeShapeType,
                    onSelect: handleShapeAdd,
                  }}
                />
              )}
            </div>

            <div className="tool-split-button no-outline" ref={connectorRef}>
              <button
                data-toolbar-item={activeConnectorType}
                className={(pendingTool === 'line' || pendingTool === 'arrow') ? 'tool-active' : ''}
                onClick={() => {
                  if (setPendingTool) {
                    setPendingTool(pendingTool === activeConnectorType ? null : activeConnectorType);
                  } else if (activeConnectorType === 'arrow') {
                    handleAddArrow();
                  } else {
                    handleAddLine();
                  }
                }}
                title={activeConnectorType === 'arrow' ? 'Add Arrow (click to place)' : 'Add Line (click to place)'}
              >
                {activeConnectorType === 'arrow'
                  ? <MoveRight size={18} stroke={shapeColors.line.active} strokeWidth={2} />
                  : <Minus size={18} stroke={shapeColors.line.active} strokeWidth={2} />
                }
              </button>
              <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'connector' ? null : 'connector')}>
                <ChevronDown size={14} />
              </button>
              {showColorPicker === 'connector' && (
                <ColorPickerMenu
                  type={activeConnectorType}
                  data={shapeColors.line}
                  history={colorHistory}
                  onSelect={updateActiveColor}
                  shapeSelector={{
                    types: ['line', 'arrow'],
                    activeType: activeConnectorType,
                    onSelect: (type) => {
                      setActiveConnectorType(type);
                      setShowColorPicker(null);
                      if (pendingTool === 'line' || pendingTool === 'arrow') {
                        if (setPendingTool) setPendingTool(type);
                      }
                    },
                  }}
                />
              )}
            </div>

            <div className="tool-split-button no-outline">
              <button data-toolbar-item="frame" className={pendingTool === 'frame' ? 'tool-active' : ''} onClick={() => setPendingTool ? setPendingTool(pendingTool === 'frame' ? null : 'frame') : handleAddFrame()} title="Add Frame (click to place)">
                <AppWindow size={18} />
              </button>
            </div>

            <div className="tool-split-button no-outline">
              <button data-toolbar-item="text" onClick={() => { handleAddText(); }} title="Add Text">
                <Type size={18} />
              </button>
            </div>

            <span className="header-divider" />
          </>
        )}

        {setActiveTool && (
          <button
            data-toolbar-item="select"
            className={`snap-toggle ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'select' ? 'pan' : 'select')}
            title={activeTool === 'select' ? 'Switch to Pan' : 'Switch to Select'}
          >
            <MousePointer2 size={18} />
          </button>
        )}

        <button
          data-toolbar-item="snap"
          className={`snap-toggle ${snapToGrid ? 'active' : ''}`}
          onClick={() => { const next = !snapToGrid; setSnapToGrid(next); localStorage.setItem('snapToGrid', next); }}
          title={snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}
        >
          <Grid3x3 size={18} />
        </button>

        {canEdit && (
          <button
            data-toolbar-item="undo"
            className={`snap-toggle ${canUndo ? '' : 'disabled'}`}
            onClick={() => canUndo && undo()}
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
          >
            <Undo2 size={18} />
          </button>
        )}
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
    ps.colorHistory === ns.colorHistory &&
    ps.pendingTool === ns.pendingTool &&
    ps.activeTool === ns.activeTool &&
    ps.canEdit === ns.canEdit &&
    ps.isAdmin === ns.isAdmin &&
    ps.adminViewActive === ns.adminViewActive
  );
}

export const HeaderLeft = React.memo(HeaderLeftInner, areEqual);
