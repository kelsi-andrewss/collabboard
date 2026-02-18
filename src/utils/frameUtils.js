export const FRAME_MARGIN = 20;

// Returns { minX, minY, maxX, maxY } for all objects on the board, or null if empty.
export function getContentBounds(objects) {
  const items = Object.values(objects);
  if (!items.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of items) {
    if (o.type === 'line') {
      const pts = o.points;
      if (!pts || pts.length < 2) continue;
      for (let i = 0; i < pts.length - 1; i += 2) {
        const ax = o.x + pts[i], ay = o.y + pts[i + 1];
        if (ax < minX) minX = ax; if (ax > maxX) maxX = ax;
        if (ay < minY) minY = ay; if (ay > maxY) maxY = ay;
      }
    } else {
      const ox = o.x ?? 0, oy = o.y ?? 0;
      const ow = o.width ?? 150, oh = o.height ?? 150;
      if (ox < minX) minX = ox; if (ox + ow > maxX) maxX = ox + ow;
      if (oy < minY) minY = oy; if (oy + oh > maxY) maxY = oy + oh;
    }
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
  return { minX, minY, maxX, maxY };
}

// Returns a {x, y, width, height} bounding box for a line object (uses points array).
export function getLineBounds(obj) {
  const pts = obj.points || [0, 0, 200, 0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    minX = Math.min(minX, pts[i]);
    maxX = Math.max(maxX, pts[i]);
    minY = Math.min(minY, pts[i + 1]);
    maxY = Math.max(maxY, pts[i + 1]);
  }
  const sw = obj.strokeWidth || 3;
  return {
    x: obj.x + minX,
    y: obj.y + minY,
    width: Math.max(maxX - minX, sw),
    height: Math.max(maxY - minY, sw),
  };
}

export function isInsideFrame(obj, frame) {
  const cx = obj.x + (obj.width || 0) / 2;
  const cy = obj.y + (obj.height || 0) / 2;
  return cx >= frame.x && cx <= frame.x + frame.width &&
         cy >= frame.y && cy <= frame.y + frame.height;
}

export function findOverlappingFrame(obj, allObjects) {
  const frames = Object.values(allObjects).filter(o => o.type === 'frame' && o.id !== obj.id);
  let best = null;
  let bestArea = Infinity;
  for (const frame of frames) {
    if (isInsideFrame(obj, frame)) {
      const area = frame.width * frame.height;
      if (area < bestArea) {
        best = frame;
        bestArea = area;
      }
    }
  }
  return best;
}

export function computeAncestorExpansions(childX, childY, childW, childH, parentFrameId, allObjects, margin) {
  const expansions = [];
  const working = { ...allObjects };
  let cx = childX, cy = childY, cw = childW, ch = childH;
  let currentParent = working[parentFrameId];
  while (currentParent) {
    const titleBarHeight = Math.max(32, Math.min(52, currentParent.height * 0.12));

    // Envelope: start from trigger child's full bounding box
    let minLeft   = cx;
    let minTop    = cy;
    let maxRight  = cx + cw;
    let maxBottom = cy + ch;

    // Expand envelope to include all siblings
    for (const siblingId of (currentParent.childIds || [])) {
      const sib = working[siblingId];
      if (!sib) continue;
      const sb = sib.type === 'line' ? getLineBounds(sib) : sib;
      minLeft   = Math.min(minLeft,   sb.x);
      minTop    = Math.min(minTop,    sb.y);
      maxRight  = Math.max(maxRight,  sb.x + (sb.width || 150));
      maxBottom = Math.max(maxBottom, sb.y + (sb.height || 150));
    }

    // New origin: only shift left/up when children exceed current edge
    const newX = Math.min(currentParent.x, minLeft - margin);
    const newY = Math.min(currentParent.y, minTop - titleBarHeight - margin);

    // New dimensions must span from newX/newY to maxRight/maxBottom
    const neededW = maxRight  - newX + margin;
    const neededH = maxBottom - newY + margin;
    const newW = Math.max(currentParent.width  + (currentParent.x - newX), neededW);
    const newH = Math.max(currentParent.height + (currentParent.y - newY), neededH);

    if (newW > currentParent.width || newH > currentParent.height ||
        newX < currentParent.x    || newY < currentParent.y) {
      expansions.push({ id: currentParent.id, data: { x: newX, y: newY, width: newW, height: newH } });
      working[currentParent.id] = { ...currentParent, x: newX, y: newY, width: newW, height: newH };
    }

    // Walk up to grandparent using updated bounds
    cx = newX; cy = newY; cw = newW; ch = newH;
    currentParent = currentParent.frameId ? working[currentParent.frameId] : null;
  }
  return expansions;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + (b.width || 0) && a.x + a.width > b.x &&
         a.y < b.y + (b.height || 0) && a.y + a.height > b.y;
}

export function rectsOverlapWithMargin(a, b, margin) {
  return !(a.x + a.width + margin <= b.x ||
           b.x + (b.width || 0) + margin <= a.x ||
           a.y + a.height + margin <= b.y ||
           b.y + (b.height || 0) + margin <= a.y);
}

export function hasDisallowedSiblingOverlap(objectId, objectType, proposedBounds, parentId, allObjects, margin) {
  let siblingIds;
  if (parentId) {
    const parent = allObjects[parentId];
    siblingIds = (parent?.childIds || []).filter(sid => sid !== objectId);
  } else {
    siblingIds = Object.keys(allObjects).filter(
      sid => sid !== objectId &&
             !allObjects[sid].frameId &&
             (objectType !== 'frame' || allObjects[sid].type === 'frame')
    );
  }
  for (const sibId of siblingIds) {
    const sib = allObjects[sibId];
    if (!sib) continue;
    const sibBounds = sib.type === 'line'
      ? getLineBounds(sib)
      : { x: sib.x, y: sib.y, width: sib.width || (sib.type === 'frame' ? 400 : 150), height: sib.height || (sib.type === 'frame' ? 300 : 150) };
    if (objectType === 'frame') {
      // Frame cannot overlap ANY sibling
      if (rectsOverlapWithMargin(proposedBounds, sibBounds, margin)) return true;
    } else {
      // Sticky/shape cannot overlap sibling frames only
      if (sib.type !== 'frame') continue;
      if (rectsOverlapWithMargin(proposedBounds, sibBounds, margin)) return true;
    }
  }
  return false;
}

export function findFrameAtPoint(cursorX, cursorY, allObjects, excludeId = null) {
  const frames = Object.values(allObjects).filter(o =>
    o.type === 'frame' && o.id !== excludeId
  );
  let best = null;
  let bestArea = Infinity;
  for (const frame of frames) {
    if (cursorX >= frame.x && cursorX <= frame.x + frame.width &&
        cursorY >= frame.y && cursorY <= frame.y + frame.height) {
      const area = frame.width * frame.height;
      if (area < bestArea) { best = frame; bestArea = area; }
    }
  }
  return best;
}

export function findObjectsToAbsorb(frameId, frameRect, allObjects) {
  return Object.values(allObjects)
    .filter(o =>
      o.id !== frameId &&
      !o.frameId &&
      o.type !== 'frame' &&
      isInsideFrame(o, frameRect)
    )
    .map(o => o.id);
}

export function getDescendantIds(frameId, objects) {
  const ids = new Set();
  const collect = (fid) => {
    for (const o of Object.values(objects)) {
      if (o.frameId === fid && !ids.has(o.id)) {
        ids.add(o.id);
        if (o.type === 'frame') collect(o.id);
      }
    }
  };
  collect(frameId);
  return ids;
}
