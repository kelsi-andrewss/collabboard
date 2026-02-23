import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, AppWindow, ChevronDown, Grid3x3, Undo2, Home, Search, MousePointer2, Shield, Type, Minus, MoveRight, Pencil } from 'lucide-react';
import { ColorPickerMenu } from './ColorPickerMenu.jsx';
import { ShapeIcon } from './ShapeIcon.jsx';
import { darkenHex } from '../utils/colorUtils.js';
import './BoardSwitcher.css';
import { buildSlugChain } from '../utils/slugUtils.js';
import { useDraggableFloat } from '../hooks/useDraggableFloat';

const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200];

function HeaderLeftInner({ state, handlers }) {
  const { boardName, boardId, boards, currentUserId, groups: groupsList = [], shapeColors, showColorPicker, snapToGrid, canUndo, activeShapeType, colorHistory, showToolbar, pendingTool, activeTool, canEdit, isAdmin, adminViewActive, stageScale } = state;
  const {
    setBoardId, setBoardName, onSwitchBoard, setShowColorPicker, setSnapToGrid, undo,
    handleAddSticky, handleAddShape, handleAddLine, handleAddArrow, handleAddFrame, handleAddText, updateActiveColor, setActiveShapeType, setPendingTool, setActiveTool,
    setStageScale, setStagePos,
  } = handlers;

  const [showBoardSwitcher, setShowBoardSwitcher] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const switcherRef = useRef(null);
  const [activeConnectorType, setActiveConnectorType] = useState('line');
  const connectorRef = useRef(null);
  const [zoomEditing, setZoomEditing] = useState(false);
  const [zoomInputVal, setZoomInputVal] = useState('');
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState(false);

  const { pos: posTools, dragHandleProps: dragTools, orientation: orientTools } = useDraggableFloat('toolbar-left-tools', { x: 16, y: 72 });

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

  const ownBoards = boards?.filter(b =>
    currentUserId && (b.ownerId === currentUserId || b.userId === currentUserId)
  ) ?? [];

  const filteredGroups = (() => {
    if (!ownBoards.length) return [];
    const allBoards = ownBoards;
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

  const applyZoom = (newScale) => {
    if (!setStageScale || !setStagePos) return;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const stage = document.querySelector('.konvajs-content canvas')?.parentElement;
    if (!stage) return;
    const oldScale = stageScale || 1;
    setStageScale(newScale);
    setStagePos(prev => ({
      x: centerX - ((centerX - prev.x) / oldScale) * newScale,
      y: centerY - ((centerY - prev.y) / oldScale) * newScale,
    }));
  };

  const commitZoomInput = () => {
    const parsed = parseInt(zoomInputVal, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(500, Math.max(10, parsed));
      applyZoom(clamped / 100);
    }
    setZoomEditing(false);
  };

  return (
    <>
      <div
        className="floating-toolbar-chip"
        style={{ left: 16, top: 16 }}
      >
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
      </div>

      {showToolbar && (
        <div
          className="floating-toolbar-chip"
          ref={dragTools.ref}
          data-orient={orientTools === 'vertical' ? 'vertical' : undefined}
          data-bottom={posTools.y != null && posTools.y > window.innerHeight / 2 ? 'true' : undefined}
          style={{ left: posTools.x, top: posTools.y }}
        >
          <span className="chip-grip" onMouseDown={dragTools.onMouseDown} onDoubleClick={dragTools.onDoubleClick}>⠿</span>
          <div className="toolbar">
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
                  <button
                    data-toolbar-item="frame"
                    className={pendingTool === 'frame' ? 'tool-active' : ''}
                    onClick={() => setPendingTool(pendingTool === 'frame' ? null : 'frame')}
                    title="Add Frame (click to place)"
                  >
                    <AppWindow size={18} stroke={shapeColors.frame?.active} />
                  </button>
                  <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'frame' ? null : 'frame')}>
                    <ChevronDown size={14} />
                  </button>
                  {showColorPicker === 'frame' && (
                    <ColorPickerMenu
                      type="frame"
                      data={shapeColors.frame}
                      history={colorHistory}
                      onSelect={updateActiveColor}
                    />
                  )}
                </div>

                <div className="tool-split-button no-outline">
                  <button
                    data-toolbar-item="text"
                    className={pendingTool === 'text' ? 'tool-active' : ''}
                    onClick={() => setPendingTool(pendingTool === 'text' ? null : 'text')}
                    title="Add Text (click to place)"
                  >
                    <Type size={18} stroke={shapeColors.text?.active} />
                  </button>
                  <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}>
                    <ChevronDown size={14} />
                  </button>
                  {showColorPicker === 'text' && (
                    <ColorPickerMenu
                      type="text"
                      data={shapeColors.text}
                      history={colorHistory}
                      onSelect={updateActiveColor}
                    />
                  )}
                </div>

                <button
                  data-toolbar-item="scribble"
                  className={`snap-toggle ${pendingTool === 'scribble' ? 'active' : ''}`}
                  onClick={() => setPendingTool(pendingTool === 'scribble' ? null : 'scribble')}
                  title="Free-draw Scribble (drag to draw)"
                >
                  <Pencil size={18} />
                </button>

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

            {stageScale != null && (
              <>
                <span className="header-divider" />
                <div className="zoom-indicator">
                  <button
                    className="zoom-btn"
                    onClick={() => applyZoom(Math.max(0.1, (stageScale || 1) / 1.15))}
                    title="Zoom Out (Ctrl+-)"
                  >
                    &minus;
                  </button>
                  <div className="zoom-control">
                    {zoomEditing ? (
                      <input
                        className="zoom-pct-input"
                        type="text"
                        value={zoomInputVal}
                        onChange={e => setZoomInputVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitZoomInput();
                          if (e.key === 'Escape') setZoomEditing(false);
                        }}
                        onBlur={commitZoomInput}
                        autoFocus
                      />
                    ) : (
                      <button className="zoom-pct" onClick={() => {
                        setZoomInputVal(String(Math.round((stageScale || 1) * 100)));
                        setZoomEditing(true);
                        setZoomDropdownOpen(false);
                      }} title="Click to set zoom level">
                        {Math.round((stageScale || 1) * 100)}%
                      </button>
                    )}
                    <div
                      className="zoom-dropdown-container"
                      onBlur={e => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          setZoomDropdownOpen(false);
                        }
                      }}
                      tabIndex={-1}
                    >
                      <button
                        className="zoom-dropdown-btn"
                        onClick={() => setZoomDropdownOpen(v => !v)}
                        title="Zoom presets"
                      >&#9662;</button>
                      {zoomDropdownOpen && (
                        <ul className="zoom-dropdown">
                          {ZOOM_PRESETS.map(pct => (
                            <li key={pct}>
                              <button onClick={() => { applyZoom(pct / 100); setZoomDropdownOpen(false); }}>
                                {pct}%{pct === Math.round((stageScale || 1) * 100) ? ' \u2713' : ''}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <button
                    className="zoom-btn"
                    onClick={() => applyZoom(Math.min(5, (stageScale || 1) * 1.15))}
                    title="Zoom In (Ctrl++)"
                  >
                    +
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.boardName === ns.boardName &&
    ps.boardId === ns.boardId &&
    ps.boards === ns.boards &&
    ps.currentUserId === ns.currentUserId &&
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
    ps.adminViewActive === ns.adminViewActive &&
    ps.stageScale === ns.stageScale
  );
}

export const HeaderLeft = React.memo(HeaderLeftInner, areEqual);
