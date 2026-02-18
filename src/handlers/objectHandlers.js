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

export function makeObjectHandlers({
  board, stageRef, snap, setDragState, setSelectedId,
  stagePos, stageScale, shapeColors, user, setShapeColors,
  ai, aiPrompt, setAiPrompt, setDragPos, updateColorHistory,
  setResizeTooltip, resizeTooltipTimer,
}) {
  const updateActiveColor = (type, color) => {
    setShapeColors(prev => {
      if (prev[type]?.active === color) return prev;
      const SHAPE_TYPES = ['rectangle', 'circle', 'triangle', 'line'];
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
    const bounds = obj.type === 'line'
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

    // Compute bounding box (lines use points array, others use width/height)
    const lineBounds = obj.type === 'line' ? getLineBounds({ ...obj, x: snapped.x, y: snapped.y }) : null;
    const ow = lineBounds ? lineBounds.width : (obj.width || 150);
    const oh = lineBounds ? lineBounds.height : (obj.height || 150);

    // Overlap check: objects cannot overlap sibling frames
    const objectsForOverlapCheck = (oldFrameId && !newFrameId)
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
        const screenX = obj.x * stageScale + stagePos.x;
        const screenY = obj.y * stageScale + stagePos.y;
        const objW = (obj.width || 100) * stageScale;
        const flipY = screenY < 40;
        clearTimeout(resizeTooltipTimer.current);
        setResizeTooltip({
          x: screenX + objW / 2,
          y: flipY ? screenY + (obj.height || 100) * stageScale : screenY,
          msg: "Can't place here — overlaps another frame.",
          flipY,
        });
        resizeTooltipTimer.current = setTimeout(() => setResizeTooltip(null), 2500);
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

    // Snap toolbar to clamped position before write to prevent snap-back glitch
    setDragPos({ id, x: snapped.x, y: snapped.y });

    // Atomic write
    if (allUpdates.length === 1) {
      board.updateObject(id, { ...snapped, frameId: newFrameId || null });
    } else {
      board.batchUpdateObjects(allUpdates);
    }
    setDragState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
    setDragPos(null);
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

  const handleSendToBack = (id) => {
    const minZ = Math.min(0, ...Object.values(board.objects).map(o => o.zIndex || 0));
    board.updateObject(id, { zIndex: minZ - 1 });
  };

  const findOpenSpot = (w, h, isFrame = false) => {
    const cx = (window.innerWidth / 2 - stagePos.x) / stageScale;
    const cy = ((window.innerHeight - 50) / 2 - stagePos.y) / stageScale;
    const allObjs = Object.values(board.objects);
    const objs = isFrame ? allObjs : allObjs.filter(o => o.type !== 'frame');
    const overlaps = (x, y) => objs.some(o => {
      const ow = o.width || 100;
      const oh = o.height || 100;
      return x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y;
    });
    if (!overlaps(cx - w / 2, cy - h / 2)) return { x: cx - w / 2, y: cy - h / 2 };
    const step = 50;
    for (let dist = step; dist < 2000; dist += step) {
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        const tx = cx - w / 2 + Math.cos(rad) * dist;
        const ty = cy - h / 2 + Math.sin(rad) * dist;
        if (!overlaps(tx, ty)) return { x: tx, y: ty };
      }
    }
    return { x: cx - w / 2, y: cy - h / 2 };
  };

  const handleAddSticky = () => {
    const pos = findOpenSpot(150, 150);
    board.addObject({
      type: 'sticky',
      text: 'New Sticky Note',
      x: pos.x,
      y: pos.y,
      color: shapeColors.sticky.active,
      userId: user.uid,
    });
  };

  const handleAddShape = (type) => {
    const pos = findOpenSpot(100, 100);
    board.addObject({
      type,
      x: pos.x,
      y: pos.y,
      width: 100,
      height: 100,
      color: shapeColors.shapes.active,
      userId: user.uid,
    });
  };

  const handleAddFrame = () => {
    const fw = Math.round(window.innerWidth * 0.55 / stageScale);
    const fh = Math.round((window.innerHeight - 50) * 0.55 / stageScale);
    const pos = findOpenSpot(fw, fh, true);
    board.addObject({
      type: 'frame',
      x: pos.x,
      y: pos.y,
      width: fw,
      height: fh,
      title: 'Frame',
      color: '#6366f1',
      userId: user.uid,
    });
  };

  const handleAddLine = () => {
    const pos = findOpenSpot(200, 3);
    board.addObject({
      type: 'line',
      x: pos.x,
      y: pos.y,
      points: [0, 0, 200, 0],
      color: shapeColors.shapes.active,
      strokeWidth: 3,
      userId: user.uid,
    });
  };

  const handleAISubmit = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    const prompt = aiPrompt;
    setAiPrompt('');
    await ai.sendCommand(prompt);
  };

  return {
    updateActiveColor,
    handleDragMove,
    handleContainedDragEnd,
    handleDeleteWithCleanup,
    handleBringToFront,
    handleSendToBack,
    findOpenSpot,
    handleAddSticky,
    handleAddShape,
    handleAddFrame,
    handleAddLine,
    handleAISubmit,
  };
}
