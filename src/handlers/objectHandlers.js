import {
  findOverlappingFrame,
  findFrameAtPoint,
  computeAncestorExpansions,
  computeAutoFitBounds,
  getDescendantIds,
  rectsOverlap,
  getLineBounds,
  FRAME_MARGIN,
} from '../utils/frameUtils.js';
import { getConnectedEndpointUpdates } from '../utils/connectorUtils.js';

export function makeObjectHandlers({
  board, stageRef, snap, setDragState, setSelectedId, setSelectedIds,
  stagePos, stageScale, setShapeColors,
  setDragPos, updateColorHistory,
  setResizeTooltip, resizeTooltipTimer,
  dragStateRef, dragFrameRef, descendantCacheRef,
  selectedIdsRef, batchUpdateObjects,
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
    setDragPos({ id, x: pos.x, y: pos.y });
    if (dragFrameRef && dragFrameRef.current !== null) return;
    if (dragFrameRef) {
      dragFrameRef.current = requestAnimationFrame(() => {
        const objInner = board.objects[id];
        if (!objInner) { dragFrameRef.current = null; return; }
        const tempObj = { ...objInner, x: pos.x, y: pos.y };
        if (!descendantCacheRef.current || descendantCacheRef.current.id !== id) {
          descendantCacheRef.current = { id, descendants: getDescendantIds(id, board.objects) };
        }
        const descendants = descendantCacheRef.current.descendants;
        let candidates = board.objects;
        if (objInner.type === 'frame') {
          const excluded = new Set(descendants);
          excluded.add(id);
          candidates = Object.fromEntries(Object.entries(board.objects).filter(([k]) => !excluded.has(k)));
        }
        const stage = stageRef.current;
        const pointer = stage?.getPointerPosition();
        const cursorCanvas = pointer
          ? { x: (pointer.x - stagePos.x) / stageScale, y: (pointer.y - stagePos.y) / stageScale }
          : null;
        const overFrame = (cursorCanvas && objInner.type !== 'frame')
          ? findFrameAtPoint(cursorCanvas.x, cursorCanvas.y, board.objects)
          : findOverlappingFrame(tempObj, candidates);
        const currentFrameId = objInner.frameId || null;
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
        const next = { draggingId: id, overFrameId, action, illegalDrag: false };
        const cur = dragStateRef.current;
        if (cur.draggingId !== next.draggingId || cur.overFrameId !== next.overFrameId || cur.action !== next.action) {
          setDragState(next);
        }
        dragFrameRef.current = null;
      });
    }
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
    const ow = lineBounds ? lineBounds.width : (obj.width || (obj.type === 'sticky' ? 200 : 150));
    const oh = lineBounds ? lineBounds.height : (obj.height || (obj.type === 'sticky' ? 200 : 150));

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

    // Set final snapped position BEFORE Firestore write
    setDragPos({ id, x: snapped.x, y: snapped.y });

    // Imperatively position Konva node at snapped coords — prevents flash if
    // dragPos clears before Firestore confirms the new position.
    const node = stageRef.current?.findOne('.' + id);
    if (node) {
      node.x(snapped.x);
      node.y(snapped.y);
      node.getLayer()?.batchDraw();
    }

    // Atomic write
    if (allUpdates.length === 1) {
      board.updateObject(id, { ...snapped, frameId: newFrameId || null });
    } else {
      board.batchUpdateObjects(allUpdates);
    }
    if (dragFrameRef && dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    if (descendantCacheRef) descendantCacheRef.current = null;
    setDragState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
    // Do NOT call setDragPos(null) here. The auto-clear useEffect in App.jsx clears it
    // once Firestore confirms the new position. Clearing here prematurely causes a
    // visual flash back to the old position while the write is in-flight (~50-200ms).
  };

  const handleDeleteWithCleanup = (id) => {
    stageRef.current?.findOne('Transformer')?.nodes([]);
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
    setSelectedIds(new Set());
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
    stageRef.current?.findOne('Transformer')?.nodes([]);
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

  // Snapshot positions for all selected objects at the moment drag begins.
  // Returns a Map<id, {x, y}> or null if not a group drag situation.
  const snapshotGroupPositions = (draggingId) => {
    const ids = selectedIdsRef ? selectedIdsRef.current : null;
    if (!ids || ids.size <= 1) return null;
    if (!ids.has(draggingId)) return null;
    const snapshot = new Map();
    for (const id of ids) {
      const obj = board.objects[id];
      if (obj) snapshot.set(id, { x: obj.x, y: obj.y });
    }
    return snapshot;
  };

  // Reposition all objects in the group except the dragging node (which Konva moves natively).
  // Also moves any frame descendants that aren't themselves in the snapshot.
  // Called on onDragMove — cheap, no Firestore writes.
  const repositionGroupNodes = (draggingId, currentX, currentY, startSnapshot) => {
    if (!startSnapshot) return;
    const stage = stageRef.current;
    if (!stage) return;
    const origin = startSnapshot.get(draggingId);
    if (!origin) return;
    const dx = currentX - origin.x;
    const dy = currentY - origin.y;
    // Track IDs we've already repositioned to avoid double-moving
    const moved = new Set([draggingId]);

    // If the dragging node is a frame, move its descendants too (Konva doesn't group them)
    const draggingObj = board.objects[draggingId];
    if (draggingObj && draggingObj.type === 'frame') {
      const descendants = getDescendantIds(draggingId, board.objects);
      for (const descId of descendants) {
        if (moved.has(descId)) continue;
        moved.add(descId);
        const descObj = board.objects[descId];
        const descNode = stage.findOne('.' + descId);
        if (descObj && descNode) {
          descNode.x(descObj.x + dx);
          descNode.y(descObj.y + dy);
        }
      }
    }

    for (const [id, pos] of startSnapshot) {
      if (id === draggingId) continue;
      const node = stage.findOne('.' + id);
      if (node) {
        node.x(pos.x + dx);
        node.y(pos.y + dy);
      }
      moved.add(id);
      // Also move frame descendants that aren't in the snapshot
      const obj = board.objects[id];
      if (obj && obj.type === 'frame') {
        const descendants = getDescendantIds(id, board.objects);
        for (const descId of descendants) {
          if (moved.has(descId)) continue;
          moved.add(descId);
          const descObj = board.objects[descId];
          const descNode = stage.findOne('.' + descId);
          if (descObj && descNode) {
            descNode.x(descObj.x + dx);
            descNode.y(descObj.y + dy);
          }
        }
      }
    }
    stage.getLayers()[0]?.batchDraw();
  };

  // On dragEnd: snap all positions and write as a single batch.
  // Frame descendants (not in the snapshot) are included in the write.
  // Returns the snapped dx/dy so the caller can snap the dragging node too.
  const commitGroupDrag = (draggingId, rawX, rawY, startSnapshot) => {
    if (!startSnapshot) return null;
    const origin = startSnapshot.get(draggingId);
    if (!origin) return null;
    const snappedX = snap(rawX);
    const snappedY = snap(rawY);
    const dx = snappedX - origin.x;
    const dy = snappedY - origin.y;
    const updates = [];
    const written = new Set();
    for (const [id, pos] of startSnapshot) {
      updates.push({ id, data: { x: pos.x + dx, y: pos.y + dy } });
      written.add(id);
      // Include frame descendants that aren't separately in the selection
      const obj = board.objects[id];
      if (obj && obj.type === 'frame') {
        const descendants = getDescendantIds(id, board.objects);
        for (const descId of descendants) {
          if (written.has(descId)) continue;
          written.add(descId);
          const descObj = board.objects[descId];
          if (descObj) {
            updates.push({ id: descId, data: { x: descObj.x + dx, y: descObj.y + dy } });
          }
        }
      }
    }
    // Imperatively position all Konva nodes at their snapped coords to prevent flash
    const stage = stageRef.current;
    if (stage) {
      for (const { id, data } of updates) {
        const node = stage.findOne('.' + id);
        if (node) {
          node.x(data.x);
          node.y(data.y);
        }
      }
      stage.getLayers()[0]?.batchDraw();
    }
    if (batchUpdateObjects) {
      batchUpdateObjects(updates);
    } else {
      board.batchUpdateObjects(updates);
    }
    setDragState({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
    if (dragFrameRef && dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    return { dx, dy, snappedX, snappedY };
  };

  const handleFrameAutoFit = (frameId) => {
    const frame = board.objects[frameId];
    if (!frame) return;
    const fitBounds = computeAutoFitBounds(frame, board.objects);
    if (!fitBounds) return;
    const allUpdates = [{ id: frameId, data: fitBounds }];
    if (frame.frameId) {
      const expansions = computeAncestorExpansions(
        fitBounds.x, fitBounds.y, fitBounds.width, fitBounds.height,
        frame.frameId, board.objects, FRAME_MARGIN
      );
      for (const exp of expansions) allUpdates.push(exp);
    }
    if (allUpdates.length === 1) {
      board.updateObject(frameId, fitBounds);
    } else {
      board.batchUpdateObjects(allUpdates);
    }
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
    handleFrameAutoFit,
    snapshotGroupPositions,
    repositionGroupNodes,
    commitGroupDrag,
  };
}
