export const SNAP_DISTANCE = 20;

export function getPortCoords(obj, port) {
  const x = obj.x ?? 0;
  const y = obj.y ?? 0;
  const w = obj.width ?? 150;
  const h = obj.height ?? 150;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (port) {
    case 'top':          return { x: cx, y };
    case 'right':        return { x: x + w, y: cy };
    case 'bottom':       return { x: cx, y: y + h };
    case 'left':         return { x, y: cy };
    case 'top-left':     return { x, y };
    case 'top-right':    return { x: x + w, y };
    case 'bottom-left':  return { x, y: y + h };
    case 'bottom-right': return { x: x + w, y: y + h };
    default:             return { x: cx, y: cy };
  }
}

export const PORTS = ['top', 'right', 'bottom', 'left', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

export function findSnapTarget(canvasX, canvasY, objects, excludeIds) {
  let best = null;
  let bestDist = SNAP_DISTANCE;
  for (const obj of Object.values(objects)) {
    if (excludeIds && excludeIds.has(obj.id)) continue;
    if (obj.type === 'line' || obj.type === 'arrow') continue;
    for (const port of PORTS) {
      const p = getPortCoords(obj, port);
      const dx = canvasX - p.x;
      const dy = canvasY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { objectId: obj.id, port, x: p.x, y: p.y };
      }
    }
  }
  return best;
}

export function getConnectedEndpointUpdates(movedId, objects) {
  const updates = [];
  for (const obj of Object.values(objects)) {
    if (obj.type !== 'line' && obj.type !== 'arrow') continue;
    const rawPts = obj.points ? [...obj.points] : [0, 0, 200, 0];
    const objX = obj.x ?? 0;
    const objY = obj.y ?? 0;

    // Convert relative points to absolute coordinates so the result does not
    // depend on the connector's current x/y in board.objects.  This matters
    // when a recent endpoint-circle drag has updated the connector's bounds
    // (via LineShape onUpdate / recalcBounds) but the Firestore onSnapshot has
    // not yet propagated the new x/y back into board.objects.  Writing only
    // relative points against a stale x/y produces wrong positions.
    const absPts = [];
    for (let i = 0; i < rawPts.length; i += 2) {
      absPts.push(objX + rawPts[i], objY + rawPts[i + 1]);
    }

    let changed = false;

    if (obj.startConnectedId === movedId && obj.startConnectedPort) {
      const target = objects[obj.startConnectedId];
      if (target) {
        const p = getPortCoords(target, obj.startConnectedPort);
        absPts[0] = p.x;
        absPts[1] = p.y;
        changed = true;
      }
    }

    if (obj.endConnectedId === movedId && obj.endConnectedPort) {
      const target = objects[obj.endConnectedId];
      if (target) {
        const p = getPortCoords(target, obj.endConnectedPort);
        const lastIdx = absPts.length - 2;
        absPts[lastIdx] = p.x;
        absPts[lastIdx + 1] = p.y;
        changed = true;
      }
    }

    if (!changed) continue;

    // Recompute connector bounds from absolute points (mirrors LineShape
    // recalcBounds).  Writing x/y/width/height alongside points ensures the
    // write is self-consistent regardless of the connector's current position
    // in Firestore.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < absPts.length; i += 2) {
      if (absPts[i] < minX) minX = absPts[i];
      if (absPts[i] > maxX) maxX = absPts[i];
      if (absPts[i + 1] < minY) minY = absPts[i + 1];
      if (absPts[i + 1] > maxY) maxY = absPts[i + 1];
    }
    const newX = minX;
    const newY = minY;
    const newWidth = maxX - minX;
    const newHeight = maxY - minY;
    const relPts = [];
    for (let i = 0; i < absPts.length; i += 2) {
      relPts.push(absPts[i] - newX, absPts[i + 1] - newY);
    }

    updates.push({ id: obj.id, data: { x: newX, y: newY, width: newWidth, height: newHeight, points: relPts } });
  }
  return updates;
}
