import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useUserPreferences } from './hooks/useUserPreferences';
import { usePresence } from './hooks/usePresence';
import { useReactions } from './hooks/useReactions';
import { useFollowMode } from './hooks/useFollowMode';
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
import { FollowModeIndicator } from './components/FollowModeIndicator.jsx';
import { buildSlugChain } from './utils/slugUtils.js';
import { Tutorial, HOME_STEPS } from './components/Tutorial';
import { BoardSelector } from './components/BoardSelector.jsx';
import { makeObjectHandlers } from './handlers/objectHandlers.js';
import { makeObjectCreationHandlers } from './handlers/objectCreationHandlers.js';
import { makeFrameDragHandlers } from './handlers/frameDragHandlers.js';
import { makeTransformHandlers } from './handlers/transformHandlers.js';
import { makeStageHandlers, MIN_SCALE, MAX_SCALE } from './handlers/stageHandlers.js';
import { getContentBounds, findOverlappingFrame, computeAncestorExpansions, FRAME_MARGIN } from './utils/frameUtils.js';
import { Confetti } from './components/Confetti.jsx';
import { AIPanel } from './components/AIPanel.jsx';
import { FABButtons } from './components/FABButtons.jsx';
import { ResizeTooltip } from './components/ResizeTooltip.jsx';
import { HeaderRight } from './components/HeaderRight.jsx';
import { SelectedActionBar } from './components/SelectedActionBar.jsx';
import { HeaderLeft } from './components/HeaderLeft.jsx';
import { BoardCanvas } from './components/BoardCanvas.jsx';
import { EmptyStateOverlay } from './components/EmptyStateOverlay.jsx';
import { ReactionPicker } from './components/ReactionPicker.jsx';
import { ReactionOverlay } from './components/ReactionOverlay.jsx';
import { UserAvatarMenu } from './components/UserAvatarMenu.jsx';
import { ContextMenu } from './components/ContextMenu.jsx';
import { BoardSettings } from './components/BoardSettings.jsx';
import { AdminPanel } from './components/AdminPanel.jsx';
import { AppearanceSettings } from './components/AppearanceSettings.jsx';
import { PerformanceOverlay } from './components/PerformanceOverlay.jsx';
import { AchievementsPanel } from './components/AchievementsPanel.jsx';
import { useAchievements } from './hooks/useAchievements.js';
import './App.css';

export function App() {
  const { user, loading, login, logout, isAdmin } = useAuth();
  const { achievements, unlockAchievementRef } = useAchievements(user);
  const { preferences, updatePreference } = useUserPreferences(user);
  const [adminViewActive, setAdminViewActive] = useState(true);
  const { groupSlugs, setGroupSlugs, boardId, setBoardId, boardName, setBoardName,
          navigateHome, navigateToGroup, navigateToBoard } = useRouting();
  const stageRef = useRef(null);
  const frameDragRef = useRef({ frameId: null, dx: 0, dy: 0, startX: 0, startY: 0 });
  const handleRecenterRef = useRef(null);
  const konamiSequenceRef = useRef([]);
  const canvasWrapperRef = useRef(null);

  const captureThumbnail = (bId) => {
    if (document.visibilityState !== 'visible') return;
    const stage = stageRef.current;
    if (!stage || !bId) return;
    const bgRect = stage.findOne('.bg-rect');
    const originalFill = bgRect ? bgRect.fill() : null;
    const html = document.documentElement;
    const origTheme = html.getAttribute('data-theme');
    try {
      const captureOpts = { pixelRatio: Math.min(window.devicePixelRatio || 1, 2), mimeType: 'image/jpeg', quality: 0.7 };

      // Light capture with actual theme surface color
      html.setAttribute('data-theme', 'light');
      const lightSurface = getComputedStyle(html).getPropertyValue('--md-sys-color-surface').trim();
      if (bgRect) bgRect.fill(lightSurface);
      const lightUrl = stage.toDataURL(captureOpts);

      // Dark capture with actual theme surface color
      html.setAttribute('data-theme', 'dark');
      const darkSurface = getComputedStyle(html).getPropertyValue('--md-sys-color-surface').trim();
      if (bgRect) bgRect.fill(darkSurface);
      const darkUrl = stage.toDataURL(captureOpts);

      saveThumbnail(bId, lightUrl, darkUrl).catch(() => {});
    } catch {
    } finally {
      if (bgRect) bgRect.fill(originalFill);
      html.setAttribute('data-theme', origTheme);
    }
  };

  const prevUserRef = useRef(null);
  useEffect(() => {
    const wasNull = prevUserRef.current === null;
    prevUserRef.current = user;
    if (user && wasNull && !boardId) {
      const hash = window.location.hash.slice(1);
      const tokens = hash.split('/');
      if (tokens[0] === 'board' && tokens[1]) {
        setBoardId(tokens[1]);
        return;
      }
      const savedId = localStorage.getItem('collaboard_boardId');
      const savedName = localStorage.getItem('collaboard_boardName');
      if (savedId) {
        setBoardId(savedId);
        if (savedName) setBoardName(savedName);
      }
    }
  }, [user]);

  const { stagePos, setStagePos, stageScale, setStageScale } = useCanvasViewport(boardId, handleRecenterRef, user?.uid);
  const { shapeColors, setShapeColors, colorHistory, updateColorHistory } = useShapeColors(boardId);

  // Conditionally call hooks only when boardId is present
  const presence = usePresence(boardId, user);
  const { cursorSyncLatencyRef } = presence;
  const { reactions, sendReaction } = useReactions(boardId, user);
  const { followUserId, setFollowUserId, followedUserPresence, isFollowing } = useFollowMode(presence.presentUsers);
  const isFollowingRef = useRef(false);
  isFollowingRef.current = isFollowing;
  const rawBoard = useBoard(boardId, user);
  const { lastObjectSyncLatencyRef } = rawBoard;
  const board = useUndoStack(rawBoard);
  const effectiveAdminView = isAdmin && adminViewActive;
  const { groups, loading: groupsLoading, createGroup, updateGroup, deleteGroup: deleteGroupDoc, inviteGroupMember, removeGroupMember, migrateGroupStrings, createSubgroup, deleteGroupCascade, setGroupProtected, moveGroup } = useGroupsList(user, effectiveAdminView);
  const { boards: allBoards, createBoard: createNewBoard, saveThumbnail, deleteBoard, deleteGroup, updateBoardSettings, inviteMember, removeMember, moveBoard, publishTemplate, updateTemplate, unpublishTemplate, createBoardFromTemplate } = useBoardsList(user, { isAdminView: effectiveAdminView, groups });

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

  // Broadcast viewport to RTDB so others can follow this user
  useEffect(() => {
    if (!boardId) return;
    presence.updateViewport(stagePos.x, stagePos.y, stageScale);
  }, [stagePos.x, stagePos.y, stageScale, boardId]);

  // Sync viewport to followed user's presence
  const preSyncViewportRef = useRef(null);
  useEffect(() => {
    if (!isFollowing || !followedUserPresence) return;
    const { stageX, stageY, stageScale: fScale } = followedUserPresence;
    if (stageX == null || stageY == null || fScale == null) return;
    setStagePos({ x: stageX, y: stageY });
    setStageScale(fScale);
  }, [followedUserPresence?.stageX, followedUserPresence?.stageY, followedUserPresence?.stageScale, isFollowing]);

  // Save viewport before entering follow mode; restore on exit
  useEffect(() => {
    if (isFollowing) {
      preSyncViewportRef.current = { pos: stagePos, scale: stageScale };
    }
  }, [isFollowing]);

  // Auto-exit follow mode when followed user leaves presence
  useEffect(() => {
    if (followUserId && !presence.presentUsers[followUserId]) {
      setFollowUserId(null);
    }
  }, [presence.presentUsers, followUserId]);

  const handleFollowUser = useCallback((uid) => {
    setFollowUserId(uid);
  }, [setFollowUserId]);

  const handleExitFollow = useCallback(() => {
    setFollowUserId(null);
    if (preSyncViewportRef.current) {
      setStagePos(preSyncViewportRef.current.pos);
      setStageScale(preSyncViewportRef.current.scale);
      preSyncViewportRef.current = null;
    }
  }, [setFollowUserId, setStagePos, setStageScale]);

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

  // Thumbnail: re-capture when theme or dark mode preference changes
  useEffect(() => {
    if (!boardId) return;
    captureThumbnail(boardId);
  }, [preferences.themeColor, preferences.darkMode, boardId]);

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

  const selectedColorRef = useRef(null);

  const ai = useAI(boardId, {
    addObject: rawBoard?.addObject,
    updateObject: rawBoard?.updateObject,
    deleteObject: rawBoard?.deleteObject,
    pushCompoundEntry: board.pushCompoundEntry,
    onAIToolSuccess: () => onAIToolSuccessRef.current?.(),
    createBoard: aiCreateBoard,
    getBoards: () => allBoards,
    createGroup,
    deleteBoard,
    getSelectedColor: () => selectedColorRef.current,
  }, board?.objects, user, isAdmin, stagePos, stageScale, setStagePos, setStageScale, preferences.aiResponseMode);

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

  // Reset activeTool to the preferred default whenever a board is loaded
  const dragModeRef = useRef(preferences.dragMode);
  dragModeRef.current = preferences.dragMode;
  useEffect(() => {
    if (boardId) {
      setActiveTool(dragModeRef.current || 'pan');
    }
  }, [boardId]);

  const [confettiPos, setConfettiPos] = useState(null);
  const objectCountRef = useRef(0);
  const onAIToolSuccessRef = useRef(null);
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
  const [showHomeTutorial, setShowHomeTutorial] = useState(() => Tutorial.shouldShowHome());
  const [resizeTooltip, setResizeTooltip] = useState(null); // { x, y, msg }
  const [dragPos, setDragPos] = useState(null); // { id, x, y } while dragging, null otherwise
  const resizeTooltipTimer = useRef(null);
  const [contextMenu, setContextMenu] = useState(null); // { screenX, screenY, canvasX, canvasY, targetId }
  const [reactionPicker, setReactionPicker] = useState(null); // { screenX, screenY, canvasX, canvasY }
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [activeTool, setActiveTool] = useState(() => preferences.dragMode || 'pan');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectedIdsRef = useRef(new Set());
  selectedIdsRef.current = selectedIds;
  const firstSelectedId = selectedIds.size > 0 ? selectedIds.values().next().value : null;
  selectedColorRef.current = firstSelectedId ? (board.objects[firstSelectedId]?.color ?? null) : null;
  const [pendingTool, setPendingTool] = useState(null);
  const [pendingToolCount, setPendingToolCount] = useState(0);
  const pendingToolRef = useRef(null);
  const pendingToolCountRef = useRef(0);
  pendingToolRef.current = pendingTool;
  pendingToolCountRef.current = pendingToolCount;
  const [connectorFirstPoint, setConnectorFirstPoint] = useState(null);
  const connectorFirstPointRef = useRef(null);
  connectorFirstPointRef.current = connectorFirstPoint;
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
  const handleDeleteMultipleRef = useRef(null);
  const handleDuplicateRef = useRef(null);
  const handleDuplicateMultipleRef = useRef(null);
  const clipboardRef = useRef([]);

  const handleExitFollowRef = useRef(handleExitFollow);
  handleExitFollowRef.current = handleExitFollow;

  // Keyboard shortcuts — registered once; reads via refs
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
      const seq = konamiSequenceRef.current;
      seq.push(e.key);
      if (seq.length > 10) seq.splice(0, seq.length - 10);
      if (seq.length === 10 && seq.every((k, i) => k === KONAMI[i])) {
        konamiSequenceRef.current = [];
        const wrapper = canvasWrapperRef.current;
        if (wrapper) {
          wrapper.classList.add('konami-spin');
          setTimeout(() => wrapper.classList.remove('konami-spin'), 700);
        }
      }

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
          handleDeleteMultipleRef.current?.(ids);
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
        if (isFollowingRef.current) {
          e.preventDefault();
          handleExitFollowRef.current();
          return;
        }
        if (connectorFirstPointRef.current !== null) {
          e.preventDefault();
          setConnectorFirstPoint(null);
          return;
        }
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
        if (snapshots.length > 0 && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
        }
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
          if (snapshots.length > 0 && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
          }
          handleDeleteMultipleRef.current?.(ids);
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
            if (snapshots.length > 0 && navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
            }
            handleDeleteRef.current?.(id);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const doPaste = async () => {
          let items = clipboardRef.current;
          if (navigator.clipboard?.readText) {
            try {
              const text = await navigator.clipboard.readText();
              const parsed = JSON.parse(text);
              if (parsed?.collabboard === true && Array.isArray(parsed.objects) && parsed.objects.length > 0) {
                items = parsed.objects;
                clipboardRef.current = items;
              }
            } catch {
              // not valid board JSON — fall back to in-memory clipboard
            }
          }
          if (items.length === 0) return;
          const OFFSET = 20;
          const refs = await Promise.all(
            items.map((snapshot, i) =>
              trackedAddObjectRef.current({ ...snapshot, x: snapshot.x + (i + 1) * OFFSET, y: snapshot.y + (i + 1) * OFFSET })
            )
          );
          const newIds = refs.map(r => r.id);
          setSelectedIds(new Set(newIds));
        };
        doPaste();
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

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const newScale = Math.min(MAX_SCALE, oldScale * 1.15);
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pointX = (centerX - stage.x()) / oldScale;
        const pointY = (centerY - stage.y()) / oldScale;
        setStageScale(newScale);
        setStagePos({ x: centerX - pointX * newScale, y: centerY - pointY * newScale });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const newScale = Math.max(MIN_SCALE, oldScale / 1.15);
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pointX = (centerX - stage.x()) / oldScale;
        const pointY = (centerY - stage.y()) / oldScale;
        setStageScale(newScale);
        setStagePos({ x: centerX - pointX * newScale, y: centerY - pointY * newScale });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const newScale = 1;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pointX = (centerX - stage.x()) / oldScale;
        const pointY = (centerY - stage.y()) / oldScale;
        setStageScale(newScale);
        setStagePos({ x: centerX - pointX * newScale, y: centerY - pointY * newScale });
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
    handleDeleteMultiple,
    handleSelectAndRaise,
    handleDuplicate,
    handleDuplicateMultiple,
    handleFrameAutoFit,
  } = makeObjectHandlers({
    board, stageRef, snap, setDragState: updateDragState, setSelectedId, setSelectedIds,
    stagePos, stageScale, setShapeColors,
    setDragPos, updateColorHistory,
    setResizeTooltip, resizeTooltipTimer,
  });
  handleDeleteRef.current = handleDeleteWithCleanup;
  handleDeleteMultipleRef.current = handleDeleteMultiple;
  handleDuplicateRef.current = handleDuplicate;
  handleDuplicateMultipleRef.current = handleDuplicateMultiple;

  const {
    handleAddSticky,
    handleAddShape,
    handleAddFrame,
    handleAddLine,
    handleAddArrow,
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

  const triggerConfettiAtCenter = () => {
    setConfettiPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    unlockAchievementRef.current?.('confetti_collector', {
      title: 'Confetti Collector',
      description: 'Triggered a confetti celebration on the board!',
    });
  };
  onAIToolSuccessRef.current = triggerConfettiAtCenter;

  const trackedAddObjectRef = useRef(null);
  const trackedAddObject = async (...args) => {
    const ref = await board.addObject(...args);
    if (ref) {
      const next = objectCountRef.current + 1;
      objectCountRef.current = next;
      if (next > 0 && next % 10 === 0) {
        triggerConfettiAtCenter();
      }
    }
    return ref;
  };
  trackedAddObjectRef.current = trackedAddObject;

  const onPendingToolPlace = async (toolType, canvasX, canvasY) => {
    if (!canEditRef.current) return;
    const defaults = { userId: user.uid };
    if (toolType === 'line') {
      const len = Math.round(200 / stageScale);
      trackedAddObject({ type: 'line', x: canvasX, y: canvasY, points: [0, 0, len, 0], color: shapeColors.shapes.active, strokeWidth: 3, ...defaults });
    } else if (toolType === 'arrow') {
      const len = Math.round(200 / stageScale);
      trackedAddObject({ type: 'arrow', x: canvasX, y: canvasY, points: [0, 0, len, 0], color: shapeColors.shapes.active, strokeWidth: 3, ...defaults });
    } else if (toolType === 'text') {
      const textFontSize = Math.round(16 / stageScale);
      const textWidth = Math.round(200 / stageScale);
      trackedAddObject({ type: 'text', text: '', x: canvasX, y: canvasY, width: textWidth, fontSize: textFontSize, color: shapeColors.text.active, rotation: 0, frameId: null, childIds: [], ...defaults });
    } else if (toolType === 'frame') {
      const fw = Math.round(window.innerWidth * 0.55 / stageScale);
      const fh = Math.round(window.innerHeight * 0.55 / stageScale);
      trackedAddObject({ type: 'frame', x: canvasX - fw / 2, y: canvasY - fh / 2, width: fw, height: fh, title: 'Frame', color: shapeColors.frame.active, ...defaults });
    } else {
      let objData;
      if (toolType === 'sticky') {
        const sz = Math.round(200 / stageScale);
        objData = { type: 'sticky', text: 'New Sticky Note', x: canvasX - sz / 2, y: canvasY - sz / 2, width: sz, height: sz, color: shapeColors.sticky.active, ...defaults };
      } else if (toolType === 'text') {
        objData = { type: 'text', text: '', x: canvasX, y: canvasY, width: 200, fontSize: 16, color: shapeColors.text.active, rotation: 0, frameId: null, childIds: [], ...defaults };
      } else {
        objData = { type: toolType, x: canvasX - 50, y: canvasY - 50, width: 100, height: 100, color: shapeColors.shapes.active, ...defaults };
      }
      const ref = await trackedAddObject(objData);
      const objId = ref.id;
      const overFrame = findOverlappingFrame(
        { id: objId, x: objData.x, y: objData.y, width: objData.width || 100, height: objData.height || 100 },
        board.objects
      );
      if (overFrame) {
        const expansions = computeAncestorExpansions(
          objData.x, objData.y, objData.width || 100, objData.height || 100,
          overFrame.id,
          board.objects,
          FRAME_MARGIN
        );
        const allUpdates = [
          { id: objId, data: { frameId: overFrame.id } },
          ...expansions,
        ];
        await board.batchUpdateObjects(allUpdates);
      }
    }
    setPendingToolCount(c => c + 1);
  };

  const currentColorRef = useRef(shapeColors.shapes.active);
  currentColorRef.current = shapeColors.shapes.active;
  const currentStrokeWidthRef = useRef(3);
  const userIdRef = useRef(user?.uid);
  userIdRef.current = user?.uid;

  const dragDrawStateRef = useRef({ start: null, justSetFirst: false, suppressClick: false });

  const isScribblingRef = useRef(false);
  const scribblePointsRef = useRef([]);
  const [scribblePreview, setScribblePreview] = useState([]);

  const onScribbleUpdate = (points) => {
    setScribblePreview([...points]);
  };

  const onScribbleCommit = (points) => {
    setScribblePreview([]);
    if (points.length < 4) return;
    const color = currentColorRef.current || '#333333';
    board.addObject({
      type: 'line',
      points,
      strokeWidth: 2,
      color,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      userId: user?.uid || null,
    });
    setPendingTool(null);
    setPendingToolCount(0);
  };

  const { handleMouseMove, handleWheel, handleStageClick, handleRecenter, handleStageMouseDown, handleStageMouseUp } = makeStageHandlers({
    setSelectedId, setSelectedIds, setStagePos, setStageScale, presence, objectsRef,
    pendingToolRef, pendingToolCountRef, onPendingToolPlace,
    connectorFirstPointRef, setConnectorFirstPoint,
    addObject: board.addObject, currentColorRef, currentStrokeWidthRef, userIdRef,
    dragDrawStateRef,
    isScribblingRef, scribblePointsRef, onScribbleUpdate, onScribbleCommit,
  });
  handleRecenterRef.current = handleRecenter;

  const stageMouseDownHandlerRef = useRef(handleStageMouseDown);
  stageMouseDownHandlerRef.current = handleStageMouseDown;
  const stageMouseUpHandlerRef = useRef(handleStageMouseUp);
  stageMouseUpHandlerRef.current = handleStageMouseUp;

  useEffect(() => {
    if (!boardId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const onMouseDown = (e) => stageMouseDownHandlerRef.current(e);
    const onMouseUp = (e) => stageMouseUpHandlerRef.current(e);
    stage.on('mousedown.dragdraw', onMouseDown);
    stage.on('mouseup.dragdraw', onMouseUp);
    return () => {
      stage.off('mousedown.dragdraw');
      stage.off('mouseup.dragdraw');
    };
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    const stage = stageRef.current;
    if (!stage) return;
    const onDblClick = (e) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const screenX = pointer.x;
      const screenY = pointer.y + 60;
      const canvasX = (pointer.x - stage.x()) / stage.scaleX();
      const canvasY = (pointer.y - stage.y()) / stage.scaleY();
      setReactionPicker({ screenX, screenY, canvasX, canvasY });
    };
    stage.on('dblclick.reactions', onDblClick);
    return () => {
      stage.off('dblclick.reactions');
    };
  }, [boardId]);

  const isOffCenter = (() => {
    if (stagePos.x !== 0 || stagePos.y !== 0 || stageScale !== 1) return true;
    const bounds = getContentBounds(board.objects);
    if (!bounds) return false;
    const { minX, minY, maxX, maxY } = bounds;
    const PADDING = 60;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
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
      {user && (
        <div className="header">
          <HeaderLeft
            state={{ boardName, boardId, boards: allBoards, groups, shapeColors, showColorPicker, snapToGrid, canUndo: board.canUndo, activeShapeType, colorHistory, showToolbar: !!boardId, pendingTool, activeTool, canEdit, isAdmin, adminViewActive, stageScale, dragMode: preferences.dragMode }}
            handlers={{ setBoardId: (id) => { if (!id) navigateHome(); else setBoardId(id); }, setBoardName, onSwitchBoard: navigateToBoard, setShowColorPicker, setSnapToGrid, undo: board.undo, handleAddSticky, handleAddShape, handleAddLine, handleAddArrow, handleAddFrame, handleAddText, updateActiveColor, setActiveShapeType, setPendingTool: (tool) => { setPendingTool(tool); setPendingToolCount(0); }, setActiveTool, setStageScale, setStagePos }}
          />
          <div className="header-right">
            {user && boardId && (
              <HeaderRight
                state={{ presentUsers: presence.presentUsers, currentUserId: user?.uid, user, objects: board.objects }}
                handlers={{ setShowTutorial, logout, setShowBoardSettings, onOpenAppearance: () => setShowAppearanceSettings(true) }}
              />
            )}
            {(!boardId) && user && (
              <UserAvatarMenu user={user} logout={logout} isAdmin={isAdmin} adminViewActive={adminViewActive} onToggleAdminView={() => setAdminViewActive(v => !v)} onOpenAdminPanel={() => setShowAdminPanel(true)} onOpenAppearance={() => setShowAppearanceSettings(true)} achievements={achievements} onOpenAchievements={() => setShowAchievements(true)} />
            )}
          </div>
        </div>
      )}
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
                onInviteGroupMember={(groupId, uid, role) => inviteGroupMember(groupId, uid, role, allBoards, groups)}
                onRemoveGroupMember={(groupId, uid) => removeGroupMember(groupId, uid, allBoards, groups)}
                onSetGroupProtected={setGroupProtected}
                onDeleteGroupCascade={(id, gs, bs) => deleteGroupCascade(id, gs, bs)}
                allBoards={allBoards}
                moveBoard={moveBoard}
                moveGroup={moveGroup}
                createSubgroup={createSubgroup}
                darkMode={preferences.darkMode}
              />
            ) : (
              <BoardSelector
                onSelectBoard={(id, name) => navigateToBoard([], id, name)}
                onNavigateToGroup={navigateToGroup}
                onNavigateToBoard={navigateToBoard}
                darkMode={preferences.darkMode}
                setDarkMode={(val) => updatePreference('darkMode', val)}
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
                createBoardFromTemplate={createBoardFromTemplate}
              />
            )}
            <FABButtons
              state={{ showAI: showHomeAI, darkMode: preferences.darkMode, isOffCenter: false }}
              handlers={{ setShowAI: setShowHomeAI, setDarkMode: (val) => updatePreference('darkMode', val), handleRecenter: () => {} }}
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
              createBoard={createNewBoard}
              deleteBoard={deleteBoard}
            />
            {showHomeTutorial && (
              <Tutorial
                steps={HOME_STEPS}
                storageKey="collaboard_home_tutorial_done"
                onComplete={() => setShowHomeTutorial(false)}
              />
            )}
          </div>
        )}
        {user && boardId && !board.loading && !currentBoard && (
          <div className="board-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px' }}>
              <button
                onClick={navigateHome}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem', padding: '6px 0' }}
              >
                <ArrowLeft size={16} />
                All Boards
              </button>
            </div>
            <div className="empty-state">
              <Lock size={32} />
              <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>You don't have permission to view this board</p>
              <p>Ask the board owner to invite you</p>
            </div>
          </div>
        )}
        {user && boardId && (board.loading || currentBoard) && (
          <div ref={canvasWrapperRef} className={`board-wrapper${pendingTool ? ' cursor-crosshair' : ''}`}>
            {board.loading && (
              <div className="board-loading">
                <div className="board-loading-spinner" />
              </div>
            )}
            <BoardCanvas
              stageRef={stageRef}
              state={{ selectedId, stagePos, stageScale, darkMode: preferences.darkMode, snapToGrid, objects: board.objects, dragState, dragStateRef, presentUsers: presence.presentUsers, currentUserId: user.uid, dragPos, activeTool, selectedIds, canEdit, pendingTool, connectorFirstPoint, onFollowUser: handleFollowUser }}
              handlers={{ handleMouseMove, handleStageClick, setStagePos, handleWheel, handleFrameDragEnd, handleFrameDragMove, handleTransformEnd, updateObject: board.updateObject, handleDeleteWithCleanup, handleContainedDragEnd, handleDragMove, handleResizeClamped, setSelectedId: handleSelectAndRaise, onContextMenu: setContextMenu, onTypingChange: presence.setTyping, setSelectedIds, handleFrameAutoFit }}
            />
            {scribblePreview.length >= 4 && (() => {
              const pts = scribblePreview;
              const pairs = [];
              for (let i = 0; i + 3 < pts.length; i += 2) {
                const sx = pts[i] * stageScale + stagePos.x;
                const sy = pts[i + 1] * stageScale + stagePos.y;
                const ex = pts[i + 2] * stageScale + stagePos.x;
                const ey = pts[i + 3] * stageScale + stagePos.y;
                pairs.push(`M${sx},${sy} L${ex},${ey}`);
              }
              return (
                <svg
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
                >
                  <path
                    d={pairs.join(' ')}
                    stroke={currentColorRef.current || '#333333'}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              );
            })()}
            <FABButtons
              state={{ showAI, darkMode: preferences.darkMode, isOffCenter, canEdit }}
              handlers={{ setShowAI, setDarkMode: (val) => updatePreference('darkMode', val), handleRecenter }}
            />
            <ResizeTooltip state={{ resizeTooltip }} />
            {isFollowing && followedUserPresence && (
              <FollowModeIndicator
                name={followedUserPresence.name}
                onExit={handleExitFollow}
              />
            )}
            <SelectedActionBar
              state={{ selectedId, objects: board.objects, showSelectedColorPicker, stagePos, stageScale, dragPos, shapeColors, colorHistory, canEdit }}
              handlers={{ setShowSelectedColorPicker, updateObject: board.updateObject, updateObjectDirect: rawBoard.updateObject, handleDeleteWithCleanup, updateActiveColor }}
            />
            {canEdit && (
              <AIPanel
                state={{ showAI, aiPrompt, isTyping: ai.isTyping, error: ai.error, chatHistory: ai.chatHistory, isHistoryLoading: ai.isHistoryLoading, pendingDeletions: ai.pendingDeletions, pendingBoardDeletion: ai.pendingBoardDeletion }}
                handlers={{ handleAISubmit, setAiPrompt, clearError: ai.clearError, confirmDeletions: ai.confirmDeletions, cancelDeletions: ai.cancelDeletions, confirmBoardDeletion: ai.confirmBoardDeletion, cancelBoardDeletion: ai.cancelBoardDeletion }}
              />
            )}
            <EmptyStateOverlay isEmpty={Object.keys(board.objects).length === 0} darkMode={preferences.darkMode} canEdit={canEdit} />
            {confettiPos && (
              <Confetti x={confettiPos.x} y={confettiPos.y} onDone={() => setConfettiPos(null)} />
            )}
            <ReactionOverlay reactions={reactions} />
            {reactionPicker && (
              <ReactionPicker
                x={reactionPicker.screenX}
                y={reactionPicker.screenY}
                onSelect={(emoji) => {
                  const screenX = reactionPicker.canvasX * stageScale + stagePos.x;
                  const screenY = reactionPicker.canvasY * stageScale + stagePos.y + 60;
                  sendReaction(emoji, screenX, screenY);
                  setReactionPicker(null);
                }}
                onClose={() => setReactionPicker(null)}
              />
            )}
            {!canEdit && (
              <div className="view-only-banner"><Eye size={14} /> View only</div>
            )}
            {showTutorial && <Tutorial onComplete={() => setShowTutorial(false)} />}
            {showBoardSettings && (
              <BoardSettings
                board={currentBoard}
                currentUserId={user?.uid}
                currentUser={user}
                onUpdateSettings={(patches) => updateBoardSettings(boardId, patches)}
                onInviteMember={(uid, role) => inviteMember(boardId, uid, role)}
                onRemoveMember={(uid) => removeMember(boardId, uid)}
                onClose={() => setShowBoardSettings(false)}
                isGroupAdmin={isGroupAdmin}
                publishTemplate={publishTemplate}
                updateTemplate={updateTemplate}
                unpublishTemplate={unpublishTemplate}
                preferences={preferences}
                onUpdatePreference={updatePreference}
              />
            )}
            {preferences.showPerfOverlay && boardId && (
              <PerformanceOverlay
                objects={Object.values(board.objects)}
                lastObjectSyncLatencyRef={lastObjectSyncLatencyRef}
                cursorSyncLatencyRef={cursorSyncLatencyRef}
              />
            )}
            {contextMenu && canEdit && (() => {
              const obj = contextMenu.targetId ? board.objects[contextMenu.targetId] : null;
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
                        if (snapshots.length > 0 && navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
                        }
                        handleDeleteMultiple(selectedIds);
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
                        if (snapshots.length > 0 && navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
                        }
                      }},
                    ] : [
                      { label: 'Cut', shortcut: '⌘X', action: () => {
                        const { id: _id, createdAt, updatedAt, ...rest } = obj;
                        clipboardRef.current = [rest];
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: [rest] })).catch(() => {});
                        }
                        handleDeleteWithCleanup(obj.id);
                      }},
                      { label: 'Copy', shortcut: '⌘C', action: () => {
                        const { id: _id, createdAt, updatedAt, ...rest } = obj;
                        clipboardRef.current = [rest];
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: [rest] })).catch(() => {});
                        }
                      }},
                    ]),
                    ...(multiSelected
                      ? [{ label: 'Duplicate Selection', shortcut: '⌘D', action: () => handleDuplicateMultiple(selectedIds) }]
                      : [{ label: 'Duplicate', shortcut: '⌘D', action: () => handleDuplicate(obj.id) }]
                    ),
                    { label: 'Delete', shortcut: '⌫', danger: true, action: () => {
                      if (multiSelected) {
                        handleDeleteMultiple(selectedIds);
                        setSelectedIds(new Set());
                      } else {
                        handleDeleteWithCleanup(obj.id);
                      }
                    }},
                    { separator: true },
                    { label: 'Undo', shortcut: '⌘Z', action: () => { if (board.canUndo) board.undo(); } },
                  ]
                : [
                    { label: 'Paste', shortcut: '⌘V', action: async () => {
                      const canvasX = contextMenu.canvasX;
                      const canvasY = contextMenu.canvasY;
                      let items = clipboardRef.current;
                      if (navigator.clipboard?.readText) {
                        try {
                          const text = await navigator.clipboard.readText();
                          const parsed = JSON.parse(text);
                          if (parsed?.collabboard === true && Array.isArray(parsed.objects) && parsed.objects.length > 0) {
                            items = parsed.objects;
                            clipboardRef.current = items;
                          }
                        } catch {
                          // not valid board JSON — fall back to in-memory clipboard
                        }
                      }
                      if (items.length === 0) return;
                      const OFFSET = 20;
                      const firstX = items[0].x + OFFSET;
                      const firstY = items[0].y + OFFSET;
                      const dx = canvasX - firstX;
                      const dy = canvasY - firstY;
                      const pasteRefs = await Promise.all(
                        items.map((snapshot, i) => {
                          const x = (i === 0 ? canvasX : snapshot.x + OFFSET + dx) + i * OFFSET;
                          const y = (i === 0 ? canvasY : snapshot.y + OFFSET + dy) + i * OFFSET;
                          return trackedAddObject({ ...snapshot, x, y });
                        })
                      );
                      const pasteIds = pasteRefs.map(r => r.id);
                      setSelectedIds(new Set(pasteIds));
                    }},
                    { label: 'Select All', shortcut: '⌘A', action: () => {
                      const allIds = new Set(Object.keys(board.objects));
                      setSelectedIds(allIds);
                    }},
                    { label: 'Add Sticky here', action: () => {
                      trackedAddObject({ type: 'sticky', text: 'New Sticky Note', x: contextMenu.canvasX - 75, y: contextMenu.canvasY - 75, color: shapeColors.sticky.active, userId: user.uid });
                    }},
                    { label: 'Add Shape here', action: () => {
                      trackedAddObject({ type: 'rectangle', x: contextMenu.canvasX - 50, y: contextMenu.canvasY - 50, width: 100, height: 100, color: shapeColors.shapes.active, userId: user.uid });
                    }},
                    { label: 'Add Frame here', action: () => {
                      const fw = Math.round(window.innerWidth * 0.55 / stageScale);
                      const fh = Math.round(window.innerHeight * 0.55 / stageScale);
                      trackedAddObject({ type: 'frame', x: contextMenu.canvasX - fw / 2, y: contextMenu.canvasY - fh / 2, width: fw, height: fh, title: 'Frame', color: shapeColors.frame.active, userId: user.uid });
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
      {showAppearanceSettings && (
        <AppearanceSettings
          preferences={preferences}
          updatePreference={updatePreference}
          onClose={() => setShowAppearanceSettings(false)}
        />
      )}
      {showAchievements && (
        <AchievementsPanel
          achievements={achievements}
          onClose={() => setShowAchievements(false)}
        />
      )}
    </div>
  );
}

