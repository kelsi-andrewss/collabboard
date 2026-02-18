export const FRAME_MARGIN = 20;

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
    // Start envelope from trigger child
    let maxRight  = cx + cw;
    let maxBottom = cy + ch;
    // Expand envelope to include all siblings
    for (const siblingId of (currentParent.childIds || [])) {
      const sib = working[siblingId];
      if (!sib) continue;
      maxRight  = Math.max(maxRight,  sib.x + (sib.width || 150));
      maxBottom = Math.max(maxBottom, sib.y + (sib.height || 150));
    }
    const neededW = maxRight  - currentParent.x + margin;
    const neededH = maxBottom - currentParent.y + margin;
    const newW = Math.max(currentParent.width, neededW);
    const newH = Math.max(currentParent.height, neededH);
    if (newW > currentParent.width || newH > currentParent.height) {
      expansions.push({ id: currentParent.id, data: { width: newW, height: newH } });
      working[currentParent.id] = { ...currentParent, width: newW, height: newH };
    }
    cx = currentParent.x; cy = currentParent.y;
    cw = newW; ch = newH;
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
    if (!sib || sib.type === 'line') continue;
    const sibBounds = {
      x: sib.x, y: sib.y,
      width: sib.width || (sib.type === 'frame' ? 400 : 150),
      height: sib.height || (sib.type === 'frame' ? 300 : 150),
    };
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
      o.type !== 'line' &&
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
