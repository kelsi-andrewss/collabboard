import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { usePresence } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { useUndoStack } from './hooks/useUndoStack';
import { useBoardsList } from './hooks/useBoardsList';
import { useAI } from './hooks/useAI';
import { Tutorial } from './components/Tutorial';
import { BoardSelector } from './components/BoardSelector.jsx';
import { makeObjectHandlers } from './handlers/objectHandlers.js';
import { makeFrameDragHandlers } from './handlers/frameDragHandlers.js';
import { makeTransformHandlers } from './handlers/transformHandlers.js';
import { makeStageHandlers } from './handlers/stageHandlers.js';
import { getContentBounds } from './utils/frameUtils.js';
import { AIPanel } from './components/AIPanel.jsx';
import { FABButtons } from './components/FABButtons.jsx';
import { ResizeTooltip } from './components/ResizeTooltip.jsx';
import { HeaderRight } from './components/HeaderRight.jsx';
import { FramePropsPanel } from './components/FramePropsPanel.jsx';
import { SelectedActionBar } from './components/SelectedActionBar.jsx';
import { HeaderLeft } from './components/HeaderLeft.jsx';
import { BoardCanvas } from './components/BoardCanvas.jsx';
import './App.css';

export function App() {
  const { user, loading, login, logout } = useAuth();
  const [boardId, setBoardId] = useState(() => {
    // URL hash takes priority (for shareable links), then localStorage
    const hash = window.location.hash.slice(1);
    return hash || localStorage.getItem('collaboard_boardId') || null;
  });
  const [boardName, setBoardName] = useState(() => localStorage.getItem('collaboard_boardName') || '');
  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const stageRef = useRef(null);
  const frameDragRef = useRef({ frameId: null, dx: 0, dy: 0, startX: 0, startY: 0 });

  useEffect(() => {
    if (boardId) {
      localStorage.setItem('collaboard_boardId', boardId);
      localStorage.setItem('collaboard_boardName', boardName);
      window.location.hash = boardId;
    } else {
      localStorage.removeItem('collaboard_boardId');
      localStorage.removeItem('collaboard_boardName');
      history.pushState('', document.title, window.location.pathname);
    }
  }, [boardId, boardName]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Conditionally call hooks only when boardId is present
  const presence = usePresence(boardId, user);
  const rawBoard = useBoard(boardId, user);
  const board = useUndoStack(rawBoard);
  const { boards: allBoards, createBoard: createNewBoard } = useBoardsList();

  // When loading from a shared URL hash, look up the board name from the boards list
  useEffect(() => {
    if (boardId && !boardName && allBoards.length > 0) {
      const found = allBoards.find(b => b.id === boardId);
      if (found) setBoardName(found.name);
    }
  }, [boardId, boardName, allBoards]);

  const aiCreateBoard = async (name, group) => {
    const ref = await createNewBoard(name, group);
    setBoardId(ref.id);
    setBoardName(name);
    // Small delay to let board subscription initialize
    await new Promise(r => setTimeout(r, 500));
  };

  const ai = useAI(boardId, {
    addObject: rawBoard?.addObject,
    updateObject: rawBoard?.updateObject,
    deleteObject: rawBoard?.deleteObject,
    createBoard: aiCreateBoard,
    getBoards: () => allBoards
  }, board?.objects);

  const [selectedId, setSelectedId] = useState(null);

  // Deselect object when clicking outside canvas or action toolbar
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (!selectedId) return;
      if (e.target.closest('.board-wrapper')) return;
      if (e.target.closest('.selected-actions')) return;
      setSelectedId(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [selectedId]);

  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [stagePos, setStagePos] = useState(() => {
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) { const v = JSON.parse(saved); return { x: v.x ?? 0, y: v.y ?? 0 }; }
    } catch {}
    return { x: 0, y: 0 };
  });
  const [stageScale, setStageScale] = useState(() => {
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) { const v = JSON.parse(saved); return v.scale ?? 1; }
    } catch {}
    return 1;
  });
  const [shapeColors, setShapeColors] = useState(() => {
    const saved = localStorage.getItem(`shapeColors_${boardId}`);
    const defaults = {
      sticky: { active: '#fef08a' },
      shapes: { active: '#bfdbfe' },
      rectangle: { active: '#bfdbfe' },
      circle: { active: '#fbcfe8' },
      triangle: { active: '#e9d5ff' },
      line: { active: '#3b82f6' }
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
    return defaults;
  });
  const [colorHistory, setColorHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('collaboard_colorHistory') || '[]'); } catch { return []; }
  });
  const updateColorHistory = (color) => {
    setColorHistory(prev => {
      const next = [color, ...prev.filter(c => c !== color)].slice(0, 10);
      localStorage.setItem('collaboard_colorHistory', JSON.stringify(next));
      return next;
    });
  };
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showSelectedColorPicker, setShowSelectedColorPicker] = useState(false);
  const [activeShapeType, setActiveShapeType] = useState('rectangle');
  const [dragState, setDragState] = useState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
  const dragStateRef = useRef({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
  const updateDragState = (next) => { dragStateRef.current = next; setDragState(next); };
  const [snapToGrid, setSnapToGrid] = useState(() => localStorage.getItem('snapToGrid') === 'true');
  const [showTutorial, setShowTutorial] = useState(() => Tutorial.shouldShow());
  const [resizeTooltip, setResizeTooltip] = useState(null); // { x, y, msg }
  const [dragPos, setDragPos] = useState(null); // { id, x, y } while dragging, null otherwise
  const resizeTooltipTimer = useRef(null);
  const GRID_SIZE = 50;
  const snap = (val) => snapToGrid ? Math.round(val / GRID_SIZE) * GRID_SIZE : val;
  const snapSize = (val, min) => snapToGrid ? Math.max(min, Math.round(val / GRID_SIZE) * GRID_SIZE) : val;

  useEffect(() => {
    if (!showColorPicker) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tool-split-button')) {
        setShowColorPicker(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowColorPicker(null);
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showColorPicker]);

  // Reset selected-object color picker when selection changes
  useEffect(() => {
    setShowSelectedColorPicker(false);
  }, [selectedId]);

  useEffect(() => {
    if (!showSelectedColorPicker) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.selected-color-picker-wrapper')) {
        setShowSelectedColorPicker(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowSelectedColorPicker(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSelectedColorPicker]);

  // Ctrl/Cmd+Z undo shortcut
  useEffect(() => {
    const handleUndo = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (board.canUndo) board.undo();
      }
    };
    window.addEventListener('keydown', handleUndo);
    return () => window.removeEventListener('keydown', handleUndo);
  }, [board.canUndo, board.undo]);

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`shapeColors_${boardId}`, JSON.stringify(shapeColors));
    }
  }, [shapeColors, boardId]);

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`collaboard_view_${boardId}`, JSON.stringify({ x: stagePos.x, y: stagePos.y, scale: stageScale }));
    }
  }, [stagePos, stageScale, boardId]);

  useEffect(() => {
    if (!boardId) return;
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) {
        const v = JSON.parse(saved);
        setStagePos({ x: v.x ?? 0, y: v.y ?? 0 });
        setStageScale(v.scale ?? 1);
        return;
      }
    } catch {}
    setStagePos({ x: 0, y: 0 });
    setStageScale(1);
  }, [boardId]);

  const {
    updateActiveColor,
    handleDragMove,
    handleContainedDragEnd,
    handleDeleteWithCleanup,
    handleBringToFront,
    handleSendToBack,
    handleAddSticky,
    handleAddShape,
    handleAddFrame,
    handleAddLine,
    handleAISubmit,
  } = makeObjectHandlers({
    board, stageRef, snap, setDragState: updateDragState, setSelectedId,
    stagePos, stageScale, shapeColors, user, setShapeColors,
    ai, aiPrompt, setAiPrompt, setDragPos, updateColorHistory,
    setResizeTooltip, resizeTooltipTimer,
  });

  const { handleFrameDragMove, handleFrameDragEnd } = makeFrameDragHandlers({
    board, stageRef, snap, frameDragRef, setDragState: updateDragState, handleDragMove, stagePos, stageScale,
    setResizeTooltip, resizeTooltipTimer,
  });

  const { handleTransformEnd, handleTransformMove, handleResizeClamped } = makeTransformHandlers({
    board, stageRef, stageScale, stagePos, setResizeTooltip, resizeTooltipTimer,
  });

  const { handleMouseMove, handleWheel, handleStageClick, handleRecenter } = makeStageHandlers({
    setSelectedId, setStagePos, setStageScale, presence, objects: board.objects,
  });

  const isOffCenter = (() => {
    if (stagePos.x !== 0 || stagePos.y !== 0 || stageScale !== 1) return true;
    const bounds = getContentBounds(board.objects);
    if (!bounds) return false;
    const { minX, minY, maxX, maxY } = bounds;
    const HEADER_HEIGHT = 50;
    const PADDING = 60;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight - HEADER_HEIGHT;
    const screenLeft   = minX * stageScale + stagePos.x;
    const screenTop    = minY * stageScale + stagePos.y;
    const screenRight  = maxX * stageScale + stagePos.x;
    const screenBottom = maxY * stageScale + stagePos.y;
    return (
      screenLeft   < PADDING ||
      screenTop    < PADDING ||
      screenRight  > viewW - PADDING ||
      screenBottom > viewH - PADDING
    );
  })();

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <div className="login-container">
        <h1>CollabBoard</h1>
        <p>Real-time collaborative whiteboard with AI agent</p>
        <button onClick={() => login()}>Sign in with Google</button>
      </div>
    );
  }

  if (!boardId) {
    return <BoardSelector onSelectBoard={(id, name) => { setBoardId(id); setBoardName(name || id); }} darkMode={darkMode} setDarkMode={setDarkMode} user={user} logout={logout} />;
  }

  return (
    <div className="app-container">
      <div className="header">
        <HeaderLeft
          state={{ boardName, shapeColors, showColorPicker, snapToGrid, canUndo: board.canUndo, activeShapeType, colorHistory }}
          handlers={{ setBoardId, setBoardName, setShowColorPicker, setSnapToGrid, undo: board.undo, handleAddSticky, handleAddShape, handleAddLine, handleAddFrame, updateActiveColor, setActiveShapeType }}
        />
        <HeaderRight
          state={{ presentUsers: presence.presentUsers, currentUserId: user.uid, user }}
          handlers={{ setShowTutorial, logout }}
        />
      </div>
  <div className="board-wrapper">
        {board.loading && (
          <div className="board-loading">
            <div className="board-loading-spinner" />
          </div>
        )}
        <BoardCanvas
          stageRef={stageRef}
          state={{ selectedId, stagePos, stageScale, darkMode, snapToGrid, objects: board.objects, dragState, dragStateRef, presentUsers: presence.presentUsers, currentUserId: user.uid }}
          handlers={{ handleMouseMove, handleStageClick, setStagePos, handleWheel, handleFrameDragEnd, handleFrameDragMove, handleTransformEnd, handleTransformMove, updateObject: board.updateObject, handleDeleteWithCleanup, handleContainedDragEnd, handleDragMove, handleResizeClamped, setSelectedId }}
        />
        <FABButtons
          state={{ showAI, darkMode, isOffCenter }}
          handlers={{ setShowAI, setDarkMode, handleRecenter }}
        />
        <ResizeTooltip state={{ resizeTooltip }} />
        <SelectedActionBar
          state={{ selectedId, objects: board.objects, showSelectedColorPicker, stagePos, stageScale, dragPos, shapeColors, colorHistory }}
          handlers={{ setShowSelectedColorPicker, updateObject: board.updateObject, handleBringToFront, handleSendToBack, handleDeleteWithCleanup, updateActiveColor }}
        />
        <FramePropsPanel
          state={{ selectedId, objects: board.objects }}
          handlers={{ updateObject: board.updateObject }}
        />
        <AIPanel
          state={{ showAI, aiPrompt, isTyping: ai.isTyping, error: ai.error }}
          handlers={{ handleAISubmit, setAiPrompt, clearError: ai.clearError }}
        />
        {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
      </div>
    </div>
  );
}
