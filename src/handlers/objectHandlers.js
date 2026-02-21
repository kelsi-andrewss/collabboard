import {
  findOverlappingFrame,
  findFrameAtPoint,
  hasDisallowedSiblingOverlap,
  computeAncestorExpansions,
  getDescendantIds,
  rectsOverlap,
  getLineBounds,
  FRAME_MARGIN,
} from '../utils/frameUtils.js';
import { showErrorTooltip } from '../utils/tooltipUtils.js';
import { getConnectedEndpointUpdates } from '../utils/connectorUtils.js';

export function makeObjectHandlers({
  board, stageRef, snap, setDragState, setSelectedId,
  stagePos, stageScale, setShapeColors,
  setDragPos, updateColorHistory,
  setResizeTooltip, resizeTooltipTimer,
}) {
  const updateActiveColor = (type, color) => {
    setShapeColors(prev => {
      if (prev[type]?.active === color) return prev;
      const SHAPE_TYPES = ['rectangle', 'circle', 'triangle', 'line', 'arrow'];
      const updates = { [type]: { ...prev[type], active: color } };
      // Sync all shape types to the same color
      if (SHAPE_TYPES.includes(type)) {
        for (const t of SHAPE_TYPES) {
          updates[t] = { ...prev[t], active: color };
        }
        updates.shapes = { ...prev.shapes, active: color };
      }
      return { ...prev, ...updates };
    });
    updateColorHistory(color);
  };

  const handleDragMove = (id, pos) => {
    const obj = board.objects[id];
    if (!obj) return;
    const tempObj = { ...obj, ...pos };
    // For frames, exclude self and descendants from candidate parent frames
    let candidates = board.objects;
    if (obj.type === 'frame') {
      const excluded = getDescendantIds(id, board.objects);
      excluded.add(id);
      candidates = Object.fromEntries(Object.entries(board.objects).filter(([k]) => !excluded.has(k)));
    }
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const cursorCanvas = pointer
      ? { x: (pointer.x - stagePos.x) / stageScale, y: (pointer.y - stagePos.y) / stageScale }
      : null;
    const overFrame = (cursorCanvas && obj.type !== 'frame')
      ? findFrameAtPoint(cursorCanvas.x, cursorCanvas.y, board.objects)
      : findOverlappingFrame(tempObj, candidates);
    const currentFrameId = obj.frameId || null;
    let action = null;
    let overFrameId = null;
    if (overFrame) {
      overFrameId = overFrame.id;
      if (currentFrameId !== overFrame.id) {
        action = 'add';
      }
    } else if (currentFrameId) {
      overFrameId = currentFrameId;
      action = 'remove';
    }
    let illegalDrag = false;
    const newFrameIdForCheck = overFrame ? overFrame.id : null;
    const bounds = (obj.type === 'line' || obj.type === 'arrow')
      ? getLineBounds({ ...obj, x: pos.x, y: pos.y })
      : { x: pos.x, y: pos.y, width: obj.width || 150, height: obj.height || 150 };
    illegalDrag = hasDisallowedSiblingOverlap(id, obj.type, bounds, newFrameIdForCheck, board.objects, FRAME_MARGIN);
    setDragState({ draggingId: id, overFrameId, action, illegalDrag });
    setDragPos({ id, x: pos.x, y: pos.y });
  };

  const handleContainedDragEnd = (id, updates) => {
    const obj = board.objects[id];
    if (!obj) return;
    let snapped = { ...updates, x: snap(updates.x), y: snap(updates.y) };
    const tempObj = { ...obj, ...snapped };
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const cursorCanvas = pointer
      ? { x: (pointer.x - stagePos.x) / stageScale, y: (pointer.y - stagePos.y) / stageScale }
      : null;
    const overFrame = (cursorCanvas && obj.type !== 'frame')
      ? findFrameAtPoint(cursorCanvas.x, cursorCanvas.y, board.objects)
      : findOverlappingFrame(tempObj, board.objects);
    const newFrameId = overFrame ? overFrame.id : null;
    const oldFrameId = obj.frameId || null;

    // Clamp minimum position only (below title bar, left edge)
    if (overFrame) {
      const titleBar = Math.max(32, Math.min(52, overFrame.height * 0.12));
      const minX = overFrame.x + FRAME_MARGIN;
      const minY = overFrame.y + titleBar + FRAME_MARGIN;
      snapped.x = Math.max(minX, snapped.x);
      snapped.y = Math.max(minY, snapped.y);
    }

    // Compute bounding box (lines/arrows use points array, others use width/height)
    const lineBounds = (obj.type === 'line' || obj.type === 'arrow') ? getLineBounds({ ...obj, x: snapped.x, y: snapped.y }) : null;
    const ow = lineBounds ? lineBounds.width : (obj.width || 150);
    const oh = lineBounds ? lineBounds.height : (obj.height || 150);

    // Overlap check: objects cannot overlap sibling frames
    // Exclude old parent frame when reparenting (to root or to an ancestor frame)
    const objectsForOverlapCheck = (oldFrameId && oldFrameId !== newFrameId)
      ? Object.fromEntries(Object.entries(board.objects).filter(([k]) => k !== oldFrameId))
      : board.objects;
    const proposedBounds = { x: snapped.x, y: snapped.y, width: ow, height: oh };
    if (hasDisallowedSiblingOverlap(id, obj.type, proposedBounds, newFrameId || null, objectsForOverlapCheck, FRAME_MARGIN)) {
      // Reject: snap back to pre-drag position
      const stage = stageRef.current;
      const node = stage?.findOne('.' + id);
      if (node) { node.x(obj.x); node.y(obj.y); }
      stage?.batchDraw();
      setDragState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
      if (setResizeTooltip && resizeTooltipTimer) {
        showErrorTooltip(
          "Can't place here — overlaps another frame.",
          {
            screenX: obj.x * stageScale + stagePos.x,
            screenY: obj.y * stageScale + stagePos.y,
            objW: (obj.width || 100) * stageScale,
            objH: (obj.height || 100) * stageScale,
          },
          setResizeTooltip,
          resizeTooltipTimer,
        );
      }
      return;
    }

    // Snap object fully outside frame when exiting
    if (oldFrameId && !newFrameId) {
      const oldFrame = board.objects[oldFrameId];
      if (oldFrame) {
        const droppedRect = { x: snapped.x, y: snapped.y, width: ow, height: oh };
        const stillOverlaps = rectsOverlap(droppedRect, oldFrame);
        // For frames: always snap; for shapes/stickies: only snap if drop position still overlaps old parent
        if (obj.type === 'frame' || stillOverlaps) {
          const objRight  = snapped.x + ow;
          const objBottom = snapped.y + oh;
          const overlapL = objRight  - oldFrame.x;
          const overlapR = (oldFrame.x + oldFrame.width)  - snapped.x;
          const overlapT = objBottom - oldFrame.y;
          const overlapB = (oldFrame.y + oldFrame.height) - snapped.y;
          const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
          if (minOverlap === overlapL) snapped.x = snap(oldFrame.x - ow - FRAME_MARGIN);
          else if (minOverlap === overlapR) snapped.x = snap(oldFrame.x + oldFrame.width + FRAME_MARGIN);
          else if (minOverlap === overlapT) snapped.y = snap(oldFrame.y - oh - FRAME_MARGIN);
          else snapped.y = snap(oldFrame.y + oldFrame.height + FRAME_MARGIN);
        }
      }
    }

    // Compute ancestor expansions if inside a frame
    const allUpdates = [{ id, data: { ...snapped, frameId: newFrameId || null } }];
    if (newFrameId) {
      const expansions = computeAncestorExpansions(
        snapped.x, snapped.y, ow, oh, newFrameId, board.objects, FRAME_MARGIN
      );
      for (const exp of expansions) allUpdates.push(exp);
    }

    // Update connected line/arrow endpoints when a connected object moves
    const tempObjects = { ...board.objects, [id]: { ...obj, ...snapped } };
    const connUpdates = getConnectedEndpointUpdates(id, tempObjects);
    for (const cu of connUpdates) allUpdates.push(cu);

    // Snap toolbar to clamped position before write to prevent snap-back glitch
    setDragPos({ id, x: snapped.x, y: snapped.y });

    // Atomic write
    if (allUpdates.length === 1) {
      board.updateObject(id, { ...snapped, frameId: newFrameId || null });
    } else {
      board.batchUpdateObjects(allUpdates);
    }
    setDragState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
    // Do NOT call setDragPos(null) here. The auto-clear useEffect in App.jsx clears it
    // once Firestore confirms the new position. Clearing here prematurely causes a
    // visual flash back to the old position while the write is in-flight (~50-200ms).
  };

  const handleDeleteWithCleanup = (id) => {
    const obj = board.objects[id];
    if (obj && obj.type === 'frame') {
      const children = Object.values(board.objects).filter(o => o.frameId === id);
      if (children.length > 0) {
        board.batchWriteAndDelete(
          children.map(c => ({ id: c.id, data: { frameId: null } })),
          [id]
        );
        setSelectedId(null);
        return;
      }
    }
    board.deleteObject(id);
    setSelectedId(null);
  };

  const handleBringToFront = (id) => {
    const maxZ = Math.max(0, ...Object.values(board.objects).map(o => o.zIndex || 0));
    board.updateObject(id, { zIndex: maxZ + 1 });
  };

  const handleSelectAndRaise = (id) => {
    const maxZ = Math.max(0, ...Object.values(board.objects).map(o => o.zIndex || 0));
    board.updateObject(id, { zIndex: maxZ + 1 });
    setSelectedId(id);
  };

  const handleSendToBack = (id) => {
    const minZ = Math.min(0, ...Object.values(board.objects).map(o => o.zIndex || 0));
    board.updateObject(id, { zIndex: minZ - 1 });
  };

  const handleDuplicate = (id) => {
    const obj = board.objects[id];
    if (!obj) return;
    const OFFSET = 20;
    const { id: _id, createdAt, updatedAt, ...rest } = obj;
    board.addObject({ ...rest, x: obj.x + OFFSET, y: obj.y + OFFSET });
  };

  const handleDuplicateMultiple = (selectedIds) => {
    const OFFSET = 20;
    for (const id of selectedIds) {
      const obj = board.objects[id];
      if (!obj) continue;
      const { id: _id, createdAt, updatedAt, ...rest } = obj;
      board.addObject({ ...rest, x: obj.x + OFFSET, y: obj.y + OFFSET });
    }
  };

  const handleDeleteMultiple = (ids) => {
    const idsSet = ids instanceof Set ? ids : new Set(ids);
    const allUpdates = [];
    const allDeleteIds = [];
    for (const id of idsSet) {
      const obj = board.objects[id];
      if (!obj) continue;
      if (obj.type === 'frame') {
        const children = Object.values(board.objects).filter(o => o.frameId === id);
        for (const c of children) {
          if (!idsSet.has(c.id)) {
            allUpdates.push({ id: c.id, data: { frameId: null } });
          }
        }
      }
      allDeleteIds.push(id);
    }
    board.batchWriteAndDelete(allUpdates, allDeleteIds);
    setSelectedId(null);
  };

  return {
    updateActiveColor,
    handleDragMove,
    handleContainedDragEnd,
    handleDeleteWithCleanup,
    handleDeleteMultiple,
    handleBringToFront,
    handleSendToBack,
    handleSelectAndRaise,
    handleDuplicate,
    handleDuplicateMultiple,
  };
}
