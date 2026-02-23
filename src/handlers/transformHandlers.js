import {
  hasDisallowedSiblingOverlap,
  computeAncestorExpansions,
  getLineBounds,
  FRAME_MARGIN,
} from '../utils/frameUtils.js';
import { showErrorTooltip } from '../utils/tooltipUtils.js';
import { getConnectedEndpointUpdates } from '../utils/connectorUtils.js';

export function makeTransformHandlers({
  board, stageRef, stageScale, stagePos, setResizeTooltip, resizeTooltipTimer,
}) {
  const handleTransformEnd = (id, updates) => {
    const obj = board.objects[id];
    if (!obj) { board.updateObject(id, updates); return; }

    let u = { ...updates };

    // Overlap check for all types
    {
      const proposedBounds = (obj.type === 'line' || obj.type === 'arrow')
        ? getLineBounds({ ...obj, x: u.x ?? obj.x, y: u.y ?? obj.y, points: u.points ?? obj.points })
        : {
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
        if (obj.points != null) revert.points = obj.points;
        if (obj.rotation != null) revert.rotation = obj.rotation;
        board.updateObject(id, revert);
        return;
      }
    }

    // Clamp frame edges so they never cross children's bounding box
    if (obj.type === 'frame') {
      const children = Object.values(board.objects).filter(o => o.frameId === id);
      if (children.length > 0) {
        let minChildX = Infinity, minChildY = Infinity;
        let maxChildX = -Infinity, maxChildY = -Infinity;
        for (const child of children) {
          const cw = child.width ?? (child.type === 'sticky' ? 200 : 150);
          const ch = child.height ?? (child.type === 'sticky' ? 200 : 150);
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
        const titleBarH = 48;
        const minTopForTitleBar = minChildY - FRAME_MARGIN - titleBarH;
        if (top > minTopForTitleBar) {
          top = minTopForTitleBar;
          // Re-anchor bottom after top shifts further up
          bottom = Math.max(top + obj.height, maxChildY + FRAME_MARGIN);
        }

        u = { ...u, x: left, y: top, width: right - left, height: bottom - top };
      }
    }

    const updatedObj = { ...obj, ...u };
    const tempObjects = { ...board.objects, [id]: updatedObj };
    const connUpdates = getConnectedEndpointUpdates(id, tempObjects);

    if (!obj.frameId) {
      if (connUpdates.length > 0) {
        board.batchUpdateObjects([{ id, data: u }, ...connUpdates]);
      } else {
        board.updateObject(id, u);
      }
      return { x: u.x, y: u.y, width: u.width, height: u.height };
    }
    const childX = u.x ?? obj.x;
    const childY = u.y ?? obj.y;
    const childW = u.width ?? obj.width ?? (obj.type === 'sticky' ? 200 : 150);
    const childH = u.height ?? obj.height ?? (obj.type === 'sticky' ? 200 : 150);
    const expansions = computeAncestorExpansions(
      childX, childY, childW, childH, obj.frameId, board.objects, FRAME_MARGIN
    );
    const allUpdates = [{ id, data: u }, ...expansions, ...connUpdates];
    if (allUpdates.length > 1) {
      board.batchUpdateObjects(allUpdates);
    } else {
      board.updateObject(id, u);
    }
    return { x: u.x, y: u.y, width: u.width, height: u.height };
  };

  const handleResizeClamped = (id) => {
    const obj = board.objects[id];
    if (!obj) return;
    if (stageRef.current) {
      const node = stageRef.current.findOne('.' + id);
      const liveX = node ? node.x() : obj.x;
      const liveY = node ? node.y() : obj.y;
      const liveW = node ? node.getClientRect({ skipTransform: true }).width : (obj.width || 400);
      showErrorTooltip(
        'Parent cannot be smaller than child. Remove child first.',
        {
          screenX: liveX * stageScale + stagePos.x,
          screenY: (liveY * stageScale + stagePos.y) - 12,
          objW: liveW * stageScale,
          objH: 0,
        },
        setResizeTooltip,
        resizeTooltipTimer,
      );
    }
  };

  return { handleTransformEnd, handleResizeClamped };
}
