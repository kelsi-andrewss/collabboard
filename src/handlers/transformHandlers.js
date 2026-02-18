import {
  hasDisallowedSiblingOverlap,
  computeAncestorExpansions,
  FRAME_MARGIN,
} from '../utils/frameUtils.js';

export function makeTransformHandlers({
  board, stageRef, stageScale, stagePos, setResizeTooltip, resizeTooltipTimer,
}) {
  const handleTransformEnd = (id, updates) => {
    const obj = board.objects[id];
    if (!obj) { board.updateObject(id, updates); return; }

    let u = { ...updates };

    // Overlap check for all types except lines
    if (obj.type !== 'line') {
      const proposedBounds = {
        x: u.x ?? obj.x,
        y: u.y ?? obj.y,
        width: u.width ?? obj.width ?? (obj.type === 'frame' ? 400 : 150),
        height: u.height ?? obj.height ?? (obj.type === 'frame' ? 300 : 150),
      };
      if (hasDisallowedSiblingOverlap(id, obj.type, proposedBounds, obj.frameId || null, board.objects, FRAME_MARGIN)) {
        // Reject: write old dimensions to force re-render
        const revert = { x: obj.x, y: obj.y };
        if (obj.width != null) revert.width = obj.width;
        if (obj.height != null) revert.height = obj.height;
        if (obj.rotation != null) revert.rotation = obj.rotation;
        board.updateObject(id, revert);
        return;
      }
    }

    // Clamp child objects to stay within their parent frame
    if (obj.frameId && obj.type !== 'line') {
      const parent = board.objects[obj.frameId];
      if (parent) {
        const titleBarH = Math.max(32, Math.min(52, parent.height * 0.12));
        const minX = parent.x + FRAME_MARGIN;
        const minY = parent.y + titleBarH + FRAME_MARGIN;
        const maxRight  = parent.x + parent.width  - FRAME_MARGIN;
        const maxBottom = parent.y + parent.height - FRAME_MARGIN;

        // Clamp position
        u.x = Math.max(minX, u.x ?? obj.x);
        u.y = Math.max(minY, u.y ?? obj.y);

        // Clamp size so right/bottom edges don't exceed parent bounds
        const maxW = maxRight  - u.x;
        const maxH = maxBottom - u.y;
        u.width  = Math.min(u.width  ?? obj.width  ?? 150, maxW);
        u.height = Math.min(u.height ?? obj.height ?? 150, maxH);

        // Enforce a minimum size so clamping doesn't collapse the object
        u.width  = Math.max(u.width,  40);
        u.height = Math.max(u.height, 40);
      }
    }

    // Clamp frame edges so they never cross children's bounding box
    if (obj.type === 'frame') {
      const children = Object.values(board.objects).filter(o => o.frameId === id);
      if (children.length > 0) {
        let minChildX = Infinity, minChildY = Infinity;
        let maxChildX = -Infinity, maxChildY = -Infinity;
        for (const child of children) {
          const cw = child.width ?? 150;
          const ch = child.height ?? 150;
          minChildX = Math.min(minChildX, child.x);
          minChildY = Math.min(minChildY, child.y);
          maxChildX = Math.max(maxChildX, child.x + cw);
          maxChildY = Math.max(maxChildY, child.y + ch);
        }

        const draggingTop  = u.y !== obj.y;
        const draggingLeft = u.x !== obj.x;

        let left = u.x;
        let top  = u.y;

        // Clamp dragged edges inward only
        top  = Math.min(top,  minChildY - FRAME_MARGIN);
        left = Math.min(left, minChildX - FRAME_MARGIN);

        // Anchor only the edge the user is NOT dragging from committed state
        let right  = draggingLeft ? obj.x + obj.width  : u.x + u.width;
        let bottom = draggingTop  ? obj.y + obj.height : u.y + u.height;

        // Expand only if children extend beyond committed opposite edges
        right  = Math.max(right,  maxChildX + FRAME_MARGIN);
        bottom = Math.max(bottom, maxChildY + FRAME_MARGIN);

        // Ensure top edge is far enough above children that the title bar doesn't overlap them
        const clampedHeight = bottom - top;
        const titleBarH = Math.max(32, Math.min(52, clampedHeight * 0.12));
        const minTopForTitleBar = minChildY - FRAME_MARGIN - titleBarH;
        if (top > minTopForTitleBar) {
          top = minTopForTitleBar;
          // Re-anchor bottom after top shifts further up
          bottom = Math.max(top + obj.height, maxChildY + FRAME_MARGIN);
        }

        u = { ...u, x: left, y: top, width: right - left, height: bottom - top };
      }
    }

    board.updateObject(id, u);

    if (!obj.frameId) return { x: u.x, y: u.y, width: u.width, height: u.height };
    const childX = u.x ?? obj.x;
    const childY = u.y ?? obj.y;
    const childW = u.width ?? obj.width ?? 150;
    const childH = u.height ?? obj.height ?? 150;
    const expansions = computeAncestorExpansions(
      childX, childY, childW, childH, obj.frameId, board.objects, FRAME_MARGIN
    );
    if (expansions.length > 0) {
      board.batchUpdateObjects(expansions);
    }
    return { x: u.x, y: u.y, width: u.width, height: u.height };
  };

  const handleResizeClamped = (id) => {
    const obj = board.objects[id];
    if (!obj) return;
    const stage = stageRef.current;
    if (stage) {
      const frameScreenX = obj.x * stageScale + stagePos.x;
      const frameScreenY = obj.y * stageScale + stagePos.y;
      const frameScreenW = (obj.width || 400) * stageScale;
      clearTimeout(resizeTooltipTimer.current);
      setResizeTooltip({
        x: frameScreenX + frameScreenW / 2,
        y: frameScreenY - 12,
        msg: 'Parent cannot be smaller than child. Remove child first.',
      });
      resizeTooltipTimer.current = setTimeout(() => setResizeTooltip(null), 2500);
    }
  };

  return { handleTransformEnd, handleResizeClamped };
}
