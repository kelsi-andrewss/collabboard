import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Eye } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { usePresence } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { useUndoStack } from './hooks/useUndoStack';
import { useBoardsList } from './hooks/useBoardsList';
import { useGroupsList } from './hooks/useGroupsList';
import { useAI } from './hooks/useAI';
import { useHomeAI } from './hooks/useHomeAI';
import { useRouting } from './hooks/useRouting';
import { useCanvasViewport } from './hooks/useCanvasViewport';
import { useShapeColors } from './hooks/useShapeColors';
import { GroupPage } from './components/GroupPage.jsx';
import { buildSlugChain } from './utils/slugUtils.js';
import { Tutorial } from './components/Tutorial';
import { BoardSelector } from './components/BoardSelector.jsx';
import { makeObjectHandlers } from './handlers/objectHandlers.js';
import { makeObjectCreationHandlers } from './handlers/objectCreationHandlers.js';
import { makeFrameDragHandlers } from './handlers/frameDragHandlers.js';
import { makeTransformHandlers } from './handlers/transformHandlers.js';
import { makeStageHandlers } from './handlers/stageHandlers.js';
import { getContentBounds } from './utils/frameUtils.js';
import { AIPanel } from './components/AIPanel.jsx';
import { FABButtons } from './components/FABButtons.jsx';
import { ResizeTooltip } from './components/ResizeTooltip.jsx';
import { HeaderRight } from './components/HeaderRight.jsx';
import { SelectedActionBar } from './components/SelectedActionBar.jsx';
import { HeaderLeft } from './components/HeaderLeft.jsx';
import { BoardCanvas } from './components/BoardCanvas.jsx';
import { EmptyStateOverlay } from './components/EmptyStateOverlay.jsx';
import { UserAvatarMenu } from './components/UserAvatarMenu.jsx';
import { ContextMenu } from './components/ContextMenu.jsx';
import { BoardSettings } from './components/BoardSettings.jsx';
import { AdminPanel } from './components/AdminPanel.jsx';
import './App.css';

export function App() {
  const { user, loading, login, logout, isAdmin } = useAuth();
  const [adminViewActive, setAdminViewActive] = useState(true);
  const { groupSlugs, setGroupSlugs, boardId, setBoardId, boardName, setBoardName,
          navigateHome, navigateToGroup, navigateToBoard } = useRouting();

  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const stageRef = useRef(null);
  const frameDragRef = useRef({ frameId: null, dx: 0, dy: 0, startX: 0, startY: 0 });
  const handleRecenterRef = useRef(null);

  const captureThumbnail = (bId) => {
    if (document.visibilityState !== 'visible') return;
    const stage = stageRef.current;
    if (!stage || !bId) return;
    try {
      const dataUrl = stage.toDataURL({ pixelRatio: Math.min(window.devicePixelRatio || 1, 2), mimeType: 'image/jpeg', quality: 0.7 });
      saveThumbnail(bId, dataUrl).catch(() => {});
    } catch {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const { stagePos, setStagePos, stageScale, setStageScale } = useCanvasViewport(boardId, handleRecenterRef, user?.uid);
  const { shapeColors, setShapeColors, colorHistory, updateColorHistory } = useShapeColors(boardId);

  // Conditionally call hooks only when boardId is present
  const presence = usePresence(boardId, user);
  const rawBoard = useBoard(boardId, user);
  const board = useUndoStack(rawBoard);
  const effectiveAdminView = isAdmin && adminViewActive;
  const { groups, loading: groupsLoading, createGroup, updateGroup, deleteGroup: deleteGroupDoc, inviteGroupMember, removeGroupMember, migrateGroupStrings, createSubgroup, deleteGroupCascade, setGroupProtected, moveGroup } = useGroupsList(user, effectiveAdminView);
  const { boards: allBoards, createBoard: createNewBoard, saveThumbnail, deleteBoard, deleteGroup, updateBoardSettings, inviteMember, removeMember, moveBoard } = useBoardsList(user, { isAdminView: effectiveAdminView, groups });

  const currentBoard = boardId ? allBoards.find(b => b.id === boardId) || null : null;
  const boardGroup = currentBoard?.groupId ? groups.find(g => g.id === currentBoard.groupId) : null;
  const isGroupAdmin = boardGroup?.members?.[user?.uid] === 'admin';
  const canEdit = !boardId || currentBoard?.ownerId === user?.uid
    || currentBoard?.members?.[user?.uid] === 'editor'
    || currentBoard?.visibility === 'open'
    || isGroupAdmin
    || (isAdmin && adminViewActive);

  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  // Thumbnail: 5-minute interval capture while on a board
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;
  useEffect(() => {
    if (!boardId) return;
    const interval = setInterval(() => captureThumbnail(boardIdRef.current), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [boardId]);

  // Thumbnail: capture when navigating away from a board
  const prevBoardIdRef = useRef(null);
  useEffect(() => {
    const prev = prevBoardIdRef.current;
    if (prev && !boardId) {
      captureThumbnail(prev);
    }
    prevBoardIdRef.current = boardId;
  }, [boardId]);

  useEffect(() => {
    if (boardId && (!boardName || groupSlugs.length === 0) && allBoards.length > 0) {
      const found = allBoards.find(b => b.id === boardId);
      if (found) {
        if (!boardName) setBoardName(found.name);
        if (groupSlugs.length === 0 && found.groupId) {
          const boardGroup = groups.find(g => g.id === found.groupId);
          if (boardGroup) setGroupSlugs(buildSlugChain(boardGroup, groups));
        }
      }
    }
  }, [boardId, boardName, allBoards, groups]);

  const aiCreateBoard = async (name, groupId) => {
    const ref = await createNewBoard(name, groupId);
    const boardGroup = groupId ? groups.find(g => g.id === groupId) : null;
    setGroupSlugs(boardGroup ? buildSlugChain(boardGroup, groups) : []);
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
  }, board?.objects, user, isAdmin);

  const homeAI = useHomeAI({ allBoards, createNewBoard, setBoardId, setBoardName });
  const [showHomeAI, setShowHomeAI] = useState(false);
  const [homeAiPrompt, setHomeAiPrompt] = useState('');

  const handleHomeAISubmit = async (e) => {
    e.preventDefault();
    if (!homeAiPrompt.trim()) return;
    const prompt = homeAiPrompt;
    setHomeAiPrompt('');
    await homeAI.sendCommand(prompt);
  };

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

  useEffect(() => {
    if (!canEdit && selectedId) {
      setSelectedId(null);
      const tr = stageRef.current?.findOne('Transformer');
      if (tr) { tr.nodes([]); stageRef.current.batchDraw(); }
    }
  }, [canEdit]);

  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
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
  const [contextMenu, setContextMenu] = useState(null); // { screenX, screenY, canvasX, canvasY, targetId }
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [activeTool, setActiveTool] = useState('pan');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectedIdsRef = useRef(new Set());
  selectedIdsRef.current = selectedIds;
  const [pendingTool, setPendingTool] = useState(null);
  const [pendingToolCount, setPendingToolCount] = useState(0);
  const pendingToolRef = useRef(null);
  const pendingToolCountRef = useRef(0);
  pendingToolRef.current = pendingTool;
  pendingToolCountRef.current = pendingToolCount;
  const GRID_SIZE = 50;
  const snap = (val) => snapToGrid ? Math.round(val / GRID_SIZE) * GRID_SIZE : val;
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

  // Refs so keyboard handler always reads latest values without re-registering
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const boardRef = useRef(board);
  boardRef.current = board;
  const handleDeleteRef = useRef(null);
  const handleDuplicateRef = useRef(null);
  const handleDuplicateMultipleRef = useRef(null);
  const clipboardRef = useRef([]);

  // Keyboard shortcuts — registered once; reads via refs
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (!canEditRef.current) return;
        e.preventDefault();
        const b = boardRef.current;
        if (b.canUndo) b.undo();
        return;
      }

      if (isEditing) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!canEditRef.current) return;
        const ids = selectedIdsRef.current;
        if (ids.size > 0) {
          e.preventDefault();
          for (const id of ids) handleDeleteRef.current?.(id);
          setSelectedIds(new Set());
          return;
        }
        const id = selectedIdRef.current;
        if (id) {
          e.preventDefault();
          handleDeleteRef.current?.(id);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (pendingToolRef.current) {
          e.preventDefault();
          setPendingTool(null);
          setPendingToolCount(0);
          return;
        }
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          setSelectedIds(new Set());
          return;
        }
        const id = selectedIdRef.current;
        if (id) {
          e.preventDefault();
          setSelectedId(null);
          const stage = stageRef.current;
          stage?.findOne('Transformer')?.nodes([]);
          stage?.batchDraw();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const ids = selectedIdsRef.current;
        const snapshots = [];
        if (ids.size > 0) {
          for (const id of ids) {
            const obj = objectsRef.current[id];
            if (!obj) continue;
            const { id: _id, createdAt, updatedAt, ...rest } = obj;
            snapshots.push(rest);
          }
        } else {
          const id = selectedIdRef.current;
          if (id) {
            const obj = objectsRef.current[id];
            if (obj) {
              const { id: _id, createdAt, updatedAt, ...rest } = obj;
              snapshots.push(rest);
            }
          }
        }
        clipboardRef.current = snapshots;
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const ids = selectedIdsRef.current;
        const snapshots = [];
        if (ids.size > 0) {
          for (const id of ids) {
            const obj = objectsRef.current[id];
            if (!obj) continue;
            const { id: _id, createdAt, updatedAt, ...rest } = obj;
            snapshots.push(rest);
          }
          clipboardRef.current = snapshots;
          for (const id of ids) handleDeleteRef.current?.(id);
          setSelectedIds(new Set());
        } else {
          const id = selectedIdRef.current;
          if (id) {
            const obj = objectsRef.current[id];
            if (obj) {
              const { id: _id, createdAt, updatedAt, ...rest } = obj;
              snapshots.push(rest);
            }
            clipboardRef.current = snapshots;
            handleDeleteRef.current?.(id);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const items = clipboardRef.current;
        if (items.length === 0) return;
        const OFFSET = 20;
        for (const snapshot of items) {
          boardRef.current.addObject({ ...snapshot, x: snapshot.x + OFFSET, y: snapshot.y + OFFSET });
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const ids = selectedIdsRef.current;
        if (ids.size > 1) {
          handleDuplicateMultipleRef.current?.(ids);
        } else {
          const id = selectedIdRef.current;
          if (id) handleDuplicateRef.current?.(id);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = new Set(Object.keys(objectsRef.current));
        setSelectedIds(allIds);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-clear dragPos once Firestore confirms the new position.
  // IMPORTANT: Do NOT call setDragPos(null) in drag-end handlers (objectHandlers or
  // frameDragHandlers). This effect is the sole clearing mechanism. Manual clearing
  // before Firestore confirms causes a flash to the old position. To prevent phantom
  // onDragStart events on clicks from re-setting dragPos, all draggable Konva nodes
  // must use dragDistance={3} (see StickyNote, Shape, Frame, LineShape).
  useEffect(() => {
    if (!dragPos) return;
    const obj = board.objects[dragPos.id];
    if (obj && obj.x === dragPos.x && obj.y === dragPos.y) {
      setDragPos(null);
    }
  }, [board.objects, dragPos]);

  const {
    updateActiveColor,
    handleDragMove,
    handleContainedDragEnd,
    handleDeleteWithCleanup,
    handleSelectAndRaise,
    handleDuplicate,
    handleDuplicateMultiple,
  } = makeObjectHandlers({
    board, stageRef, snap, setDragState: updateDragState, setSelectedId,
    stagePos, stageScale, setShapeColors,
    setDragPos, updateColorHistory,
    setResizeTooltip, resizeTooltipTimer,
  });
  handleDeleteRef.current = handleDeleteWithCleanup;
  handleDuplicateRef.current = handleDuplicate;
  handleDuplicateMultipleRef.current = handleDuplicateMultiple;

  const {
    handleAddSticky,
    handleAddShape,
    handleAddFrame,
    handleAddLine,
    handleAddText,
    handleAISubmit,
  } = makeObjectCreationHandlers({
    board, stagePos, stageScale, shapeColors, user,
    ai, aiPrompt, setAiPrompt,
  });

  const { handleFrameDragMove, handleFrameDragEnd } = makeFrameDragHandlers({
    board, stageRef, snap, frameDragRef, setDragState: updateDragState, handleDragMove, stagePos, stageScale,
    setResizeTooltip, resizeTooltipTimer, setDragPos,
  });

  const { handleTransformEnd, handleResizeClamped } = makeTransformHandlers({
    board, stageRef, stageScale, stagePos, setResizeTooltip, resizeTooltipTimer,
  });

  const objectsRef = useRef(board.objects);
  objectsRef.current = board.objects;

  const onPendingToolPlace = (toolType, canvasX, canvasY) => {
    if (!canEditRef.current) return;
    const defaults = { userId: user.uid };
    if (toolType === 'sticky') {
      board.addObject({ type: 'sticky', text: 'New Sticky Note', x: canvasX - 75, y: canvasY - 75, color: shapeColors.sticky.active, ...defaults });
    } else if (toolType === 'line') {
      board.addObject({ type: 'line', x: canvasX, y: canvasY, points: [0, 0, 200, 0], color: shapeColors.shapes.active, strokeWidth: 3, ...defaults });
    } else if (toolType === 'frame') {
      const fw = Math.round(window.innerWidth * 0.55 / stageScale);
      const fh = Math.round((window.innerHeight - 60) * 0.55 / stageScale);
      board.addObject({ type: 'frame', x: canvasX - fw / 2, y: canvasY - fh / 2, width: fw, height: fh, title: 'Frame', color: '#6366f1', ...defaults });
    } else {
      board.addObject({ type: toolType, x: canvasX - 50, y: canvasY - 50, width: 100, height: 100, color: shapeColors.shapes.active, ...defaults });
    }
    setPendingToolCount(c => c + 1);
  };

  const { handleMouseMove, handleWheel, handleStageClick, handleRecenter } = makeStageHandlers({
    setSelectedId, setStagePos, setStageScale, presence, objectsRef,
    pendingToolRef, pendingToolCountRef, onPendingToolPlace,
  });
  handleRecenterRef.current = handleRecenter;

  const isOffCenter = (() => {
    if (stagePos.x !== 0 || stagePos.y !== 0 || stageScale !== 1) return true;
    const bounds = getContentBounds(board.objects);
    if (!bounds) return false;
    const { minX, minY, maxX, maxY } = bounds;
    const HEADER_HEIGHT = 60;
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

  return (
    <div className="app-container">
      <div className="header">
        <HeaderLeft
          state={{ boardName, boardId, boards: allBoards, groups, shapeColors, showColorPicker, snapToGrid, canUndo: board.canUndo, activeShapeType, colorHistory, showToolbar: !!boardId, pendingTool, activeTool, canEdit, isAdmin, adminViewActive }}
          handlers={{ setBoardId: (id) => { if (!id) navigateHome(); else setBoardId(id); }, setBoardName, onSwitchBoard: navigateToBoard, setShowColorPicker, setSnapToGrid, undo: board.undo, handleAddSticky, handleAddShape, handleAddLine, handleAddFrame, handleAddText, updateActiveColor, setActiveShapeType, setPendingTool: (tool) => { setPendingTool(tool); setPendingToolCount(0); }, setActiveTool }}
        />
        <div className="header-right">
          {user && boardId && (
            <HeaderRight
              state={{ presentUsers: presence.presentUsers, currentUserId: user?.uid, user }}
              handlers={{ setShowTutorial, logout, setShowBoardSettings }}
            />
          )}
          {(!boardId) && (
            <>
              <button className="help-btn" onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Light mode' : 'Dark mode'}>
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {user && (
                <>
                  <span className="header-divider" />
                  <UserAvatarMenu user={user} logout={logout} isAdmin={isAdmin} adminViewActive={adminViewActive} onToggleAdminView={() => setAdminViewActive(v => !v)} onOpenAdminPanel={() => setShowAdminPanel(true)} />
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="app-content">
        {!user && (
          <div className="login-content">
            <div className="login-card">
              <div className="login-card-banner" />
              <div className="login-card-body">
                <h2>Welcome to CollabBoard</h2>
                <p>Real-time collaborative whiteboard with AI</p>
                <button className="login-google-btn" onClick={() => login()}>
                  <img src="https://www.google.com/favicon.ico" width={18} height={18} alt="" />
                  Sign in with Google
                </button>
              </div>
            </div>
          </div>
        )}
        {user && !boardId && (
          <div className="home-content">
            {groupSlugs.length > 0 ? (
              <GroupPage
                groupSlugs={groupSlugs}
                groups={groups}
                onBack={navigateHome}
                onOpenBoard={navigateToBoard}
                onNavigateToGroup={navigateToGroup}
                user={user}
                isAdmin={isAdmin}
                adminViewActive={adminViewActive}
                onUpdateGroup={updateGroup}
                onInviteGroupMember={inviteGroupMember}
                onRemoveGroupMember={removeGroupMember}
                onSetGroupProtected={setGroupProtected}
                onDeleteGroupCascade={(id, gs, bs) => deleteGroupCascade(id, gs, bs)}
                allBoards={allBoards}
                moveBoard={moveBoard}
                moveGroup={moveGroup}
                createSubgroup={createSubgroup}
              />
            ) : (
              <BoardSelector
                onSelectBoard={(id, name) => navigateToBoard([], id, name)}
                onNavigateToGroup={navigateToGroup}
                onNavigateToBoard={navigateToBoard}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                user={user}
                logout={logout}
                groups={groups}
                createGroup={createGroup}
                deleteGroupDoc={deleteGroupDoc}
                isAdmin={isAdmin}
                adminViewActive={adminViewActive}
                createSubgroup={createSubgroup}
                deleteGroupCascade={deleteGroupCascade}
                setGroupProtected={setGroupProtected}
                moveGroup={moveGroup}
              />
            )}
            <FABButtons
              state={{ showAI: showHomeAI, darkMode, isOffCenter: false }}
              handlers={{ setShowAI: setShowHomeAI, setDarkMode, handleRecenter: () => {} }}
            />
            <AIPanel
              state={{ showAI: showHomeAI, aiPrompt: homeAiPrompt, isTyping: homeAI.isTyping, error: homeAI.error }}
              handlers={{ handleAISubmit: handleHomeAISubmit, setAiPrompt: setHomeAiPrompt, clearError: homeAI.clearError }}
            />
            <AdminPanel
              isOpen={showAdminPanel}
              onClose={() => setShowAdminPanel(false)}
              allBoards={allBoards}
              groups={groups}
              migrateGroupStrings={migrateGroupStrings}
            />
          </div>
        )}
        {user && boardId && (
          <div className={`board-wrapper${pendingTool ? ' cursor-crosshair' : ''}`}>
            {board.loading && (
              <div className="board-loading">
                <div className="board-loading-spinner" />
              </div>
            )}
            <BoardCanvas
              stageRef={stageRef}
              state={{ selectedId, stagePos, stageScale, darkMode, snapToGrid, objects: board.objects, dragState, dragStateRef, presentUsers: presence.presentUsers, currentUserId: user.uid, dragPos, activeTool, selectedIds, canEdit }}
              handlers={{ handleMouseMove, handleStageClick, setStagePos, handleWheel, handleFrameDragEnd, handleFrameDragMove, handleTransformEnd, updateObject: board.updateObject, handleDeleteWithCleanup, handleContainedDragEnd, handleDragMove, handleResizeClamped, setSelectedId: handleSelectAndRaise, onContextMenu: setContextMenu, onTypingChange: presence.setTyping, setSelectedIds }}
            />
            <FABButtons
              state={{ showAI, darkMode, isOffCenter, canEdit }}
              handlers={{ setShowAI, setDarkMode, handleRecenter }}
            />
            <ResizeTooltip state={{ resizeTooltip }} />
            <SelectedActionBar
              state={{ selectedId, objects: board.objects, showSelectedColorPicker, stagePos, stageScale, dragPos, shapeColors, colorHistory, canEdit }}
              handlers={{ setShowSelectedColorPicker, updateObject: board.updateObject, handleDeleteWithCleanup, updateActiveColor }}
            />
            {canEdit && (
              <AIPanel
                state={{ showAI, aiPrompt, isTyping: ai.isTyping, error: ai.error }}
                handlers={{ handleAISubmit, setAiPrompt, clearError: ai.clearError }}
              />
            )}
            <EmptyStateOverlay isEmpty={Object.keys(board.objects).length === 0} darkMode={darkMode} canEdit={canEdit} />
            {!canEdit && (
              <div className="view-only-banner"><Eye size={14} /> View only</div>
            )}
            {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
            {showBoardSettings && (
              <BoardSettings
                board={currentBoard}
                currentUserId={user?.uid}
                onUpdateSettings={(patches) => updateBoardSettings(boardId, patches)}
                onInviteMember={(uid, role) => inviteMember(boardId, uid, role)}
                onRemoveMember={(uid) => removeMember(boardId, uid)}
                onClose={() => setShowBoardSettings(false)}
                isGroupAdmin={isGroupAdmin}
              />
            )}
            {contextMenu && canEdit && (() => {
              const obj = contextMenu.targetId ? board.objects[contextMenu.targetId] : null;
              const hasClipboard = clipboardRef.current.length > 0;
              const multiSelected = selectedIds.size > 1 && contextMenu.targetId && selectedIds.has(contextMenu.targetId);
              const objItems = obj
                ? [
                    ...(multiSelected ? [
                      { label: 'Cut Selection', shortcut: '⌘X', action: () => {
                        const snapshots = [];
                        for (const id of selectedIds) {
                          const o = board.objects[id];
                          if (!o) continue;
                          const { id: _id, createdAt, updatedAt, ...rest } = o;
                          snapshots.push(rest);
                        }
                        clipboardRef.current = snapshots;
                        for (const id of selectedIds) handleDeleteWithCleanup(id);
                        setSelectedIds(new Set());
                      }},
                      { label: 'Copy Selection', shortcut: '⌘C', action: () => {
                        const snapshots = [];
                        for (const id of selectedIds) {
                          const o = board.objects[id];
                          if (!o) continue;
                          const { id: _id, createdAt, updatedAt, ...rest } = o;
                          snapshots.push(rest);
                        }
                        clipboardRef.current = snapshots;
                      }},
                    ] : [
                      { label: 'Cut', shortcut: '⌘X', action: () => {
                        const { id: _id, createdAt, updatedAt, ...rest } = obj;
                        clipboardRef.current = [rest];
                        handleDeleteWithCleanup(obj.id);
                      }},
                      { label: 'Copy', shortcut: '⌘C', action: () => {
                        const { id: _id, createdAt, updatedAt, ...rest } = obj;
                        clipboardRef.current = [rest];
                      }},
                    ]),
                    ...(multiSelected
                      ? [{ label: 'Duplicate Selection', shortcut: '⌘D', action: () => handleDuplicateMultiple(selectedIds) }]
                      : [{ label: 'Duplicate', shortcut: '⌘D', action: () => handleDuplicate(obj.id) }]
                    ),
                    { label: 'Delete', shortcut: '⌫', danger: true, action: () => {
                      if (multiSelected) {
                        for (const id of selectedIds) handleDeleteWithCleanup(id);
                        setSelectedIds(new Set());
                      } else {
                        handleDeleteWithCleanup(obj.id);
                      }
                    }},
                    { separator: true },
                    { label: 'Undo', shortcut: '⌘Z', action: () => { if (board.canUndo) board.undo(); } },
                  ]
                : [
                    ...(hasClipboard ? [
                      { label: 'Paste', shortcut: '⌘V', action: () => {
                        const items = clipboardRef.current;
                        if (items.length === 0) return;
                        const OFFSET = 20;
                        const firstX = items[0].x + OFFSET;
                        const firstY = items[0].y + OFFSET;
                        const dx = contextMenu.canvasX - firstX;
                        const dy = contextMenu.canvasY - firstY;
                        items.forEach((snapshot, i) => {
                          const x = i === 0 ? contextMenu.canvasX : snapshot.x + OFFSET + dx;
                          const y = i === 0 ? contextMenu.canvasY : snapshot.y + OFFSET + dy;
                          board.addObject({ ...snapshot, x, y });
                        });
                      }},
                    ] : []),
                    { label: 'Select All', shortcut: '⌘A', action: () => {
                      const allIds = new Set(Object.keys(board.objects));
                      setSelectedIds(allIds);
                    }},
                    { label: 'Add Sticky here', action: () => {
                      board.addObject({ type: 'sticky', text: 'New Sticky Note', x: contextMenu.canvasX - 75, y: contextMenu.canvasY - 75, color: shapeColors.sticky.active, userId: user.uid });
                    }},
                    { label: 'Add Shape here', action: () => {
                      board.addObject({ type: 'rectangle', x: contextMenu.canvasX - 50, y: contextMenu.canvasY - 50, width: 100, height: 100, color: shapeColors.shapes.active, userId: user.uid });
                    }},
                    { label: 'Add Frame here', action: () => {
                      const fw = Math.round(window.innerWidth * 0.55 / stageScale);
                      const fh = Math.round((window.innerHeight - 60) * 0.55 / stageScale);
                      board.addObject({ type: 'frame', x: contextMenu.canvasX - fw / 2, y: contextMenu.canvasY - fh / 2, width: fw, height: fh, title: 'Frame', color: '#6366f1', userId: user.uid });
                    }},
                    { separator: true },
                    { label: 'Undo', shortcut: '⌘Z', action: () => { if (board.canUndo) board.undo(); } },
                  ];
              return (
                <ContextMenu
                  x={contextMenu.screenX}
                  y={contextMenu.screenY}
                  items={objItems}
                  onClose={() => setContextMenu(null)}
                />
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

