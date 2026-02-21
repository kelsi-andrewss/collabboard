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
    const pts = obj.points ? [...obj.points] : [0, 0, 200, 0];
    let changed = false;

    if (obj.startConnectedId === movedId && obj.startConnectedPort) {
      const target = objects[obj.startConnectedId];
      if (target) {
        const p = getPortCoords(target, obj.startConnectedPort);
        pts[0] = p.x - obj.x;
        pts[1] = p.y - obj.y;
        changed = true;
      }
    }

    if (obj.endConnectedId === movedId && obj.endConnectedPort) {
      const target = objects[obj.endConnectedId];
      if (target) {
        const p = getPortCoords(target, obj.endConnectedPort);
        const lastIdx = pts.length - 2;
        pts[lastIdx] = p.x - obj.x;
        pts[lastIdx + 1] = p.y - obj.y;
        changed = true;
      }
    }

    if (changed) {
      updates.push({ id: obj.id, data: { points: pts } });
    }
  }
  return updates;
}
