import {
  findOverlappingFrame,
  findFrameAtPoint,
  computeAncestorExpansions,
  hasDisallowedSiblingOverlap,
  rectsOverlap,
  getDescendantIds,
  findObjectsToAbsorb,
  FRAME_MARGIN,
} from '../utils/frameUtils.js';
import { showErrorTooltip } from '../utils/tooltipUtils.js';
import { getConnectedEndpointUpdates } from '../utils/connectorUtils.js';

export function makeFrameDragHandlers({
  board, stageRef, snap, frameDragRef, setDragState, handleDragMove, stagePos, stageScale,
  setResizeTooltip, resizeTooltipTimer, setDragPos,
}) {
  const handleFrameDragMove = (id, pos) => {
    const frame = board.objects[id];
    if (!frame) return;
    const dx = pos.x - frame.x;
    const dy = pos.y - frame.y;
    const isNewDrag = frameDragRef.current.frameId !== id;
    frameDragRef.current = {
      frameId: id, dx, dy,
      startX: isNewDrag ? frame.x : frameDragRef.current.startX,
      startY: isNewDrag ? frame.y : frameDragRef.current.startY,
    };
    const stage = stageRef.current;
    if (!stage) return;
    // Recursively move all descendants
    const descendants = getDescendantIds(id, board.objects);
    for (const childId of descendants) {
      const child = board.objects[childId];
      if (!child) continue;
      const node = stage.findOne('.' + childId);
      if (node) {
        node.x(child.x + dx);
        node.y(child.y + dy);
      }
    }
    stage.getLayers()[0]?.batchDraw();
    // Show drag indicator for frame-in-frame (cursor-based)
    const pointer = stage.getPointerPosition();
    const cursorCanvas = pointer
      ? { x: (pointer.x - stagePos.x) / stageScale, y: (pointer.y - stagePos.y) / stageScale }
      : null;
    const currentFrameId = frame.frameId || null;
    const excluded = getDescendantIds(id, board.objects);
    excluded.add(id);
    const candidates = Object.fromEntries(
      Object.entries(board.objects).filter(([k]) => !excluded.has(k))
    );
    const overFrame = cursorCanvas
      ? findFrameAtPoint(cursorCanvas.x, cursorCanvas.y, candidates)
      : null;
    const overFrameId = overFrame ? overFrame.id : null;
    let action = null;
    let dragOverFrameId = overFrameId;
    if (overFrame && currentFrameId !== overFrame.id) action = 'add';
    else if (!overFrame && currentFrameId) {
      action = 'remove';
      dragOverFrameId = currentFrameId;  // Point to parent so highlight renders
    }
    const droppedRect = { x: pos.x, y: pos.y, width: frame.width || 400, height: frame.height || 300 };
    const illegalDrag = hasDisallowedSiblingOverlap(id, 'frame', droppedRect, overFrameId || null, candidates, FRAME_MARGIN);
    setDragState({ draggingId: id, overFrameId: dragOverFrameId, action, illegalDrag });
  };

  const handleFrameDragEnd = (id, updates) => {
    const frame = board.objects[id];
    if (!frame) return;
    let snapped = { ...updates, x: snap(updates.x), y: snap(updates.y) };

    // Check if this frame is being dropped inside another frame (excluding self & descendants)
    const excluded = getDescendantIds(id, board.objects);
    excluded.add(id);
    const candidates = Object.fromEntries(Object.entries(board.objects).filter(([k]) => !excluded.has(k)));
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    const cursorCanvas = pointer
      ? { x: (pointer.x - stagePos.x) / stageScale, y: (pointer.y - stagePos.y) / stageScale }
      : null;
    const overFrame = cursorCanvas
      ? findFrameAtPoint(cursorCanvas.x, cursorCanvas.y, candidates)
      : findOverlappingFrame({ ...frame, ...snapped }, candidates);
    let newFrameId = overFrame ? overFrame.id : null;

    // Snap outside parent when a child frame is removed from its parent
    const wasRemoved = frame.frameId && !newFrameId;
    if (wasRemoved) {
      const oldParent = board.objects[frame.frameId];
      if (oldParent) {
        const childW = frame.width || 400;
        const childH = frame.height || 300;
        const stillOverlaps = rectsOverlap(
          { x: snapped.x, y: snapped.y, width: childW, height: childH },
          { x: oldParent.x, y: oldParent.y, width: oldParent.width, height: oldParent.height }
        );
        if (stillOverlaps) {
          const objRight  = snapped.x + childW;
          const objBottom = snapped.y + childH;
          const overlapL = objRight  - oldParent.x;
          const overlapR = (oldParent.x + oldParent.width)  - snapped.x;
          const overlapT = objBottom - oldParent.y;
          const overlapB = (oldParent.y + oldParent.height) - snapped.y;
          const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
          if (minOverlap === overlapL) snapped.x = snap(oldParent.x - childW - FRAME_MARGIN);
          else if (minOverlap === overlapR) snapped.x = snap(oldParent.x + oldParent.width + FRAME_MARGIN);
          else if (minOverlap === overlapT) snapped.y = snap(oldParent.y - childH - FRAME_MARGIN);
          else snapped.y = snap(oldParent.y + oldParent.height + FRAME_MARGIN);
          // Sibling overlap check below will reject and revert if the snapped position conflicts
        }
        // If !stillOverlaps: leave snapped.x/y as-is, sibling overlap check runs below
      }
    }

    // When dropping inside a parent frame: clamp top-left edge (below title bar),
    // then recursively expand all ancestor frames that need to grow to fit.
    let ancestorExpansions = [];
    const ow = frame.width || 400;
    const oh = frame.height || 300;
    if (overFrame) {
      const isNewParent = frame.frameId !== overFrame.id;
      if (isNewParent) {
        const titleBar = Math.max(32, Math.min(52, overFrame.height * 0.12));
        const minX = overFrame.x + FRAME_MARGIN;
        const minY = overFrame.y + titleBar + FRAME_MARGIN;
        snapped.x = Math.max(minX, snapped.x);
        snapped.y = Math.max(minY, snapped.y);
      }

      ancestorExpansions = computeAncestorExpansions(
        snapped.x, snapped.y, ow, oh, overFrame.id, board.objects, FRAME_MARGIN
      );
    }

    // Find top-level stickies/shapes whose center falls inside the dropped frame — they will be absorbed
    const droppedRect = { x: snapped.x, y: snapped.y, width: ow, height: oh };
    const absorbIds = new Set(findObjectsToAbsorb(id, droppedRect, board.objects));

    // Sibling overlap check: reject only if frame overlaps non-absorbable siblings (other frames)
    // Build a temporary objects map with absorbed objects removed so the check ignores them
    const objectsWithoutAbsorbed = Object.fromEntries(
      Object.entries(board.objects).filter(([k]) => !absorbIds.has(k))
    );
    if (hasDisallowedSiblingOverlap(id, 'frame', droppedRect, newFrameId || null, objectsWithoutAbsorbed, FRAME_MARGIN)) {
      // Abort: reset Konva nodes to pre-drag positions
      const stage = stageRef.current;
      const node = stage?.findOne('.' + id);
      if (node) { node.x(frame.x); node.y(frame.y); }
      const descIds = getDescendantIds(id, board.objects);
      for (const cid of descIds) {
        const c = board.objects[cid];
        const cn = stage?.findOne('.' + cid);
        if (c && cn) { cn.x(c.x); cn.y(c.y); }
      }
      stage?.batchDraw();
      frameDragRef.current = { frameId: null, dx: 0, dy: 0, startX: 0, startY: 0 };
      setDragState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
      if (setResizeTooltip && resizeTooltipTimer) {
        showErrorTooltip(
          "Can't place here — overlaps another frame.",
          {
            screenX: frame.x * stageScale + stagePos.x,
            screenY: frame.y * stageScale + stagePos.y,
            objW: (frame.width || 400) * stageScale,
            objH: (frame.height || 300) * stageScale,
          },
          setResizeTooltip,
          resizeTooltipTimer,
        );
      }
      return;
    }

    const dx = snapped.x - frame.x;
    const dy = snapped.y - frame.y;
    // Recursively move all descendants
    const descendants = getDescendantIds(id, board.objects);
    const allUpdates = [];
    // Include the primary frame update in the batch
    allUpdates.push({ id, data: { ...snapped, frameId: newFrameId || null } });
    for (const childId of descendants) {
      const child = board.objects[childId];
      if (child) {
        allUpdates.push({ id: childId, data: { x: child.x + dx, y: child.y + dy } });
      }
    }
    // Adopt absorbed objects as children of this frame (positions unchanged)
    for (const absorbId of absorbIds) {
      allUpdates.push({ id: absorbId, data: { frameId: id } });
    }
    for (const exp of ancestorExpansions) allUpdates.push(exp);

    // Update connected line/arrow endpoints for the frame and all descendants
    const tempObjects = { ...board.objects };
    tempObjects[id] = { ...frame, ...snapped, frameId: newFrameId || null };
    for (const childId of descendants) {
      const child = board.objects[childId];
      if (child) tempObjects[childId] = { ...child, x: child.x + dx, y: child.y + dy };
    }
    const movedIds = new Set([id, ...descendants]);
    const connUpdateIds = new Set();
    for (const movedId of movedIds) {
      const connUpdates = getConnectedEndpointUpdates(movedId, tempObjects);
      for (const cu of connUpdates) {
        if (!connUpdateIds.has(cu.id)) {
          connUpdateIds.add(cu.id);
          allUpdates.push(cu);
        }
      }
    }

    // Set dragPos override so the frame holds its drop position while Firestore catches up
    if (setDragPos) setDragPos({ id, x: snapped.x, y: snapped.y });
    // Single batch write for all changes
    board.batchUpdateObjects(allUpdates);
    frameDragRef.current = { frameId: null, dx: 0, dy: 0, startX: 0, startY: 0 };
    setDragState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
  };

  return { handleFrameDragMove, handleFrameDragEnd };
}
