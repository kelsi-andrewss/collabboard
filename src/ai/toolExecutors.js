import { regularPolygonVertices, perpendicularBisector, angleBisector, tangentLines } from '../utils/geometryUtils.js';

// context shape:
// {
//   act,                   () => boardActionsRef.current
//   objs,                  () => objectsRef.current || {}
//   frameIndexMap,         { [fi]: { id, x, y, width, height } }
//   itemsByFrame,          { [fi]: call[] }
//   findNonOverlappingPos, (x, y, w, h, isFrame, extraObstacles) => { x, y }
//   findContainingFrame,   (x, y, w, h) => frameId | null
//   localFrames,           mutable array shared between passes
//   ITEM_W, ITEM_H, ITEM_GAP, FRAME_PAD, TITLE_H,
// }

function validateObjectExists(objectId, objs, toolName) {
  if (!objs[objectId]) {
    return { error: `${toolName}: object ${objectId} not found` };
  }
  return null;
}

export async function executeToolCall(toolName, toolArgs, context) {
  try {
    const {
      act, objs,
      frameIndexMap, itemsByFrame,
      findNonOverlappingPos, findContainingFrame,
      ITEM_W, ITEM_H, ITEM_GAP, FRAME_PAD, TITLE_H,
    } = context;

    if (toolName === "createStickyNote") {
      const w = 150, h = 150;
      const { frameIndex: fi, ...stickyArgs } = toolArgs;
      let frameId = null;
      let posX = stickyArgs.x, posY = stickyArgs.y;

      if (fi !== undefined && fi !== null && frameIndexMap[fi]) {
        const frame = frameIndexMap[fi];
        frameId = frame.id;
        const items = itemsByFrame[fi] || [];
        const idx = items.findIndex(c => c === context._call);
        const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)));
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        posX = frame.x + FRAME_PAD + col * (ITEM_W + ITEM_GAP);
        posY = frame.y + TITLE_H + FRAME_PAD + row * (ITEM_H + ITEM_GAP);
      } else {
        const pos = findNonOverlappingPos(posX, posY, w, h);
        posX = pos.x;
        posY = pos.y;
        frameId = findContainingFrame(posX, posY, w, h);
      }

      await act().addObject({
        type: 'sticky', ...stickyArgs, x: posX, y: posY,
        ...(frameId ? { frameId } : {})
      });
    } else if (toolName === "createShape") {
      const w = toolArgs.width || 100, h = toolArgs.height || 100;
      const { frameIndex: fi, ...shapeArgs } = toolArgs;
      let frameId = null;
      let posX = shapeArgs.x, posY = shapeArgs.y;

      if (fi !== undefined && fi !== null && frameIndexMap[fi]) {
        const frame = frameIndexMap[fi];
        frameId = frame.id;
        const items = itemsByFrame[fi] || [];
        const idx = items.findIndex(c => c === context._call);
        const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)));
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        posX = frame.x + FRAME_PAD + col * (w + ITEM_GAP);
        posY = frame.y + TITLE_H + FRAME_PAD + row * (h + ITEM_GAP);
      } else {
        const pos = findNonOverlappingPos(posX, posY, w, h);
        posX = pos.x;
        posY = pos.y;
        frameId = findContainingFrame(posX, posY, w, h);
      }

      await act().addObject({
        ...shapeArgs, x: posX, y: posY,
        ...(frameId ? { frameId } : {})
      });
    } else if (toolName === "moveObject") {
      const { objectId, ...updates } = toolArgs;
      const currentObjs = objs();
      const validationError = validateObjectExists(objectId, currentObjs, 'moveObject');
      if (validationError) return validationError;
      const target = currentObjs[objectId];
      // If moving a frame, move its children by the same delta
      if (target.type === 'frame') {
        const dx = (updates.x !== undefined ? updates.x - target.x : 0);
        const dy = (updates.y !== undefined ? updates.y - target.y : 0);
        if (dx !== 0 || dy !== 0) {
          const children = Object.values(currentObjs).filter(o => o.frameId === objectId);
          for (const child of children) {
            await act().updateObject(child.id, { x: child.x + dx, y: child.y + dy });
          }
        }
      }
      await act().updateObject(objectId, updates);
    } else if (toolName === "resizeObject") {
      const { objectId, ...updates } = toolArgs;
      const currentObjs = objs();
      const validationError = validateObjectExists(objectId, currentObjs, 'resizeObject');
      if (validationError) return validationError;
      await act().updateObject(objectId, updates);
    } else if (toolName === "changeObjectColor") {
      const { objectId, color } = toolArgs;
      const currentObjs = objs();
      const validationError = validateObjectExists(objectId, currentObjs, 'changeObjectColor');
      if (validationError) return validationError;
      await act().updateObject(objectId, { color });
    } else if (toolName === "createGrid") {
      const { objectType, rows, columns, startX = 100, startY = 100, cellWidth = 150, cellHeight = 150, gapX = 20, gapY = 20, color, labels } = toolArgs;
      if (rows * columns > 500) {
        return { error: `createGrid: rows * columns (${rows * columns}) exceeds maximum of 500` };
      }
      const gridObjects = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const idx = r * columns + c;
          const objData = {
            type: objectType === 'sticky' ? 'sticky' : objectType,
            x: startX + c * (cellWidth + gapX),
            y: startY + r * (cellHeight + gapY),
            width: cellWidth,
            height: cellHeight,
          };
          if (color) objData.color = color;
          else if (objectType === 'sticky') objData.color = '#fef08a';
          if (labels && labels[idx]) objData.text = labels[idx];
          gridObjects.push(objData);
        }
      }
      if (gridObjects.length > 100) {
        const chunkSize = 50;
        for (let i = 0; i < gridObjects.length; i += chunkSize) {
          const chunk = gridObjects.slice(i, i + chunkSize);
          await Promise.all(chunk.map(obj => act().addObject(obj)));
          if (i + chunkSize < gridObjects.length) {
            await new Promise(r => setTimeout(r, 50));
          }
        }
      } else {
        await Promise.all(gridObjects.map(obj => act().addObject(obj)));
      }
    } else if (toolName === "arrangeInGrid") {
      const { objectIds, columns: cols, startX = 100, startY = 100, gapX = 20, gapY = 20 } = toolArgs;
      const currentObjs = objs();
      const validIds = objectIds.filter(id => currentObjs[id]);
      if (validIds.length === 0) return { error: "no valid objects found" };
      const numCols = cols || Math.ceil(Math.sqrt(validIds.length));
      for (let i = 0; i < validIds.length; i++) {
        const obj = currentObjs[validIds[i]];
        const ow = obj.width || 150;
        const oh = obj.height || 150;
        const r = Math.floor(i / numCols);
        const c = i % numCols;
        const newX = startX + c * (ow + gapX);
        const newY = startY + r * (oh + gapY);
        if (obj.type === 'frame') {
          const dx = newX - obj.x;
          const dy = newY - obj.y;
          if (dx !== 0 || dy !== 0) {
            const children = Object.values(currentObjs).filter(o => o.frameId === obj.id);
            for (const child of children) {
              await act().updateObject(child.id, { x: child.x + dx, y: child.y + dy });
            }
          }
        }
        await act().updateObject(validIds[i], { x: newX, y: newY });
      }
    } else if (toolName === "spaceEvenly") {
      const { objectIds, direction = "horizontal" } = toolArgs;
      const currentObjs = objs();
      const items = objectIds.map(oid => currentObjs[oid]).filter(Boolean);
      if (items.length === 0) return { error: "no valid objects found" };
      if (items.length < 2) return;

      // Helper: move a frame and all its children by a delta
      const moveWithChildren = async (obj, dx, dy) => {
        const updates = {};
        if (dx !== 0) updates.x = obj.x + dx;
        if (dy !== 0) updates.y = obj.y + dy;
        if (Object.keys(updates).length > 0) {
          await act().updateObject(obj.id, updates);
        }
        if (obj.type === 'frame') {
          const children = Object.values(currentObjs).filter(o => o.frameId === obj.id);
          for (const child of children) {
            const childUpdates = {};
            if (dx !== 0) childUpdates.x = child.x + dx;
            if (dy !== 0) childUpdates.y = child.y + dy;
            if (Object.keys(childUpdates).length > 0) {
              await act().updateObject(child.id, childUpdates);
            }
          }
        }
      };

      if (direction === "horizontal") {
        items.sort((a, b) => a.x - b.x);
        const first = items[0].x;
        const lastObj = items[items.length - 1];
        const last = lastObj.x + (lastObj.width || 150);
        const totalObjWidth = items.reduce((s, o) => s + (o.width || 150), 0);
        const totalGap = (last - first - totalObjWidth) > 0
          ? last - first - totalObjWidth
          : (items.length - 1) * 30;
        const gap = totalGap / (items.length - 1);
        let curX = first;
        for (const o of items) {
          const dx = curX - o.x;
          await moveWithChildren(o, dx, 0);
          curX += (o.width || 150) + gap;
        }
      } else {
        items.sort((a, b) => a.y - b.y);
        const first = items[0].y;
        const lastObj = items[items.length - 1];
        const last = lastObj.y + (lastObj.height || 150);
        const totalObjHeight = items.reduce((s, o) => s + (o.height || 150), 0);
        const totalGap = (last - first - totalObjHeight) > 0
          ? last - first - totalObjHeight
          : (items.length - 1) * 30;
        const gap = totalGap / (items.length - 1);
        let curY = first;
        for (const o of items) {
          const dy = curY - o.y;
          await moveWithChildren(o, 0, dy);
          curY += (o.height || 150) + gap;
        }
      }
    } else if (toolName === "deleteObject") {
      const { objectId } = toolArgs;
      const currentObjs = objs();
      const validationError = validateObjectExists(objectId, currentObjs, 'deleteObject');
      if (validationError) return validationError;
      if (act().deleteObject) {
        await act().deleteObject(objectId);
      }
    } else if (toolName === "resolveOverlaps") {
      const currentObjs = objs();
      const rawIds = toolArgs.objectIds && toolArgs.objectIds.length > 0
        ? toolArgs.objectIds
        : Object.values(currentObjs).filter(o => o.type !== 'frame' && !o.frameId).map(o => o.id);
      const items = rawIds.map(id => {
        const o = currentObjs[id];
        if (!o) return null;
        return { id: o.id, x: o.x, y: o.y, w: o.width || 150, h: o.height || 150 };
      }).filter(Boolean);
      if (toolArgs.objectIds && toolArgs.objectIds.length > 0 && items.length === 0) {
        return { error: "no valid objects found" };
      }
      const GAP = 15;
      for (let iter = 0; iter < 30; iter++) {
        let moved = false;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i], b = items[j];
            if (a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x &&
                a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y) {
              const overlapX = Math.min(a.x + a.w + GAP - b.x, b.x + b.w + GAP - a.x);
              const overlapY = Math.min(a.y + a.h + GAP - b.y, b.y + b.h + GAP - a.y);
              if (overlapX < overlapY) {
                const push = overlapX / 2;
                if (a.x < b.x) { a.x -= push; b.x += push; }
                else { b.x -= push; a.x += push; }
              } else {
                const push = overlapY / 2;
                if (a.y < b.y) { a.y -= push; b.y += push; }
                else { b.y -= push; a.y += push; }
              }
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
      for (const item of items) {
        const orig = currentObjs[item.id];
        if (orig && (Math.abs(orig.x - item.x) > 1 || Math.abs(orig.y - item.y) > 1)) {
          await act().updateObject(item.id, { x: Math.round(item.x), y: Math.round(item.y) });
        }
      }
    } else if (toolName === "arrangeByType") {
      const gap = toolArgs.gap || 15;
      const groupGap = toolArgs.groupGap || 60;
      const currentObjs = objs();
      // Only arrange top-level objects; objects inside frames stay with their frame
      const allItems = Object.values(currentObjs).filter(o => !o.frameId);
      const groups = {};
      for (const o of allItems) {
        const t = o.type || 'other';
        if (!groups[t]) groups[t] = [];
        groups[t].push(o);
      }
      const typeOrder = ['frame', 'sticky', 'rectangle', 'circle', 'triangle', 'line', 'arrow', 'other'];
      const sortedTypes = Object.keys(groups).sort((a, b) =>
        (typeOrder.indexOf(a) === -1 ? 99 : typeOrder.indexOf(a)) -
        (typeOrder.indexOf(b) === -1 ? 99 : typeOrder.indexOf(b))
      );
      const uniformSizes = { sticky: { w: 150, h: 150 }, rectangle: { w: 120, h: 120 }, circle: { w: 120, h: 120 }, triangle: { w: 120, h: 120 }, frame: null, line: null, arrow: null };
      let groupX = 50;
      for (const type of sortedTypes) {
        const typeItems = groups[type];
        const cols = Math.ceil(Math.sqrt(typeItems.length));
        const uniSize = uniformSizes[type];
        let cellW, cellH;
        if (uniSize) {
          cellW = uniSize.w;
          cellH = uniSize.h;
        } else {
          cellW = null;
          cellH = null;
        }
        let maxGroupW = 0;
        for (let i = 0; i < typeItems.length; i++) {
          const o = typeItems[i];
          const w = cellW || o.width || 150;
          const h = cellH || o.height || 150;
          const r = Math.floor(i / cols);
          const c = i % cols;
          const nx = groupX + c * (w + gap);
          const ny = 50 + r * (h + gap);
          const updates = { x: Math.round(nx), y: Math.round(ny) };
          if (o.rotation) updates.rotation = 0;
          if (cellW && (o.width !== cellW || o.height !== cellH)) {
            updates.width = cellW;
            updates.height = cellH;
          }
          // If moving a frame, move its children by the same delta
          if (o.type === 'frame') {
            const dx = Math.round(nx) - o.x;
            const dy = Math.round(ny) - o.y;
            if (dx !== 0 || dy !== 0) {
              const children = Object.values(currentObjs).filter(ch => ch.frameId === o.id);
              for (const child of children) {
                await act().updateObject(child.id, { x: child.x + dx, y: child.y + dy });
              }
            }
          }
          await act().updateObject(o.id, updates);
          maxGroupW = Math.max(maxGroupW, nx + w - groupX);
        }
        groupX += maxGroupW + groupGap;
      }
    } else if (toolName === "fitFrameToContents") {
      const { frameId, padding = 30 } = toolArgs;
      const currentObjs = objs();
      const validationError = validateObjectExists(frameId, currentObjs, 'fitFrameToContents');
      if (validationError) return validationError;
      const frame = currentObjs[frameId];
      const children = Object.values(currentObjs).filter(o => {
        if (o.id === frameId) return false;
        if (o.frameId === frameId) return true;
        const cx = (o.x || 0) + (o.width || 150) / 2;
        const cy = (o.y || 0) + (o.height || 150) / 2;
        return cx >= frame.x && cx <= frame.x + frame.width &&
               cy >= frame.y && cy <= frame.y + frame.height;
      });
      if (children.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of children) {
          const cx = c.x || 0;
          const cy = c.y || 0;
          const cw = c.width || 150;
          const ch = c.height || 150;
          minX = Math.min(minX, cx);
          minY = Math.min(minY, cy);
          maxX = Math.max(maxX, cx + cw);
          maxY = Math.max(maxY, cy + ch);
        }
        const titleBarH = 40;
        const newX = minX - padding;
        const newY = minY - padding - titleBarH;
        const newW = maxX - minX + padding * 2;
        const newH = maxY - minY + padding * 2 + titleBarH;
        await act().updateObject(frameId, {
          x: Math.round(newX),
          y: Math.round(newY),
          width: Math.round(Math.max(100, newW)),
          height: Math.round(Math.max(80, newH))
        });
      }
    } else if (toolName === "createTextElement") {
      const { x, y, text, width = 200, fontSize = 16, color = '#1a1a1a' } = toolArgs;
      const w = width, h = 600;
      const pos = findNonOverlappingPos(x, y, w, h);
      const frameId = findContainingFrame(pos.x, pos.y, w, h);
      await act().addObject({
        type: 'text',
        x: pos.x,
        y: pos.y,
        text,
        width,
        fontSize,
        color,
        ...(frameId ? { frameId } : {})
      });
    } else if (toolName === "createBoard") {
      const { name, group } = toolArgs;
      if (act().createBoard) {
        let finalName = name;
        const existingBoards = act().getBoards ? act().getBoards() : [];
        const existingNames = new Set(existingBoards.map(b => b.name));
        if (existingNames.has(finalName)) {
          let counter = 2;
          while (existingNames.has(`${name} ${counter}`)) counter++;
          finalName = `${name} ${counter}`;
        }
        await act().createBoard(finalName, group || null);
      }
    } else if (toolName === "drawCircle") {
      const { cx, cy, radius, color = '#3b82f6' } = toolArgs;
      await act().addObject({
        type: 'circle',
        x: cx - radius,
        y: cy - radius,
        width: radius * 2,
        height: radius * 2,
        color,
        strokeWidth: 2,
      });
    } else if (toolName === "drawRegularPolygon") {
      const { cx, cy, radius, color = '#333333' } = toolArgs;
      const sides = Math.min(12, Math.max(3, Math.round(toolArgs.sides)));
      const pts = regularPolygonVertices(cx, cy, radius, sides);
      const lineObjects = pts.map((a, i) => {
        const b = pts[(i + 1) % pts.length];
        const ox = Math.min(a.x, b.x);
        const oy = Math.min(a.y, b.y);
        return {
          type: 'line',
          x: ox,
          y: oy,
          width: Math.abs(b.x - a.x) || 1,
          height: Math.abs(b.y - a.y) || 1,
          points: [a.x - ox, a.y - oy, b.x - ox, b.y - oy],
          color,
          strokeWidth: 2,
        };
      });
      await Promise.all(lineObjects.map(obj => act().addObject(obj)));
    } else if (toolName === "drawPerpendicularBisector") {
      const { x1, y1, x2, y2, length, color = '#333333' } = toolArgs;
      const seg = perpendicularBisector(x1, y1, x2, y2, length);
      const ox = Math.min(seg.x1, seg.x2);
      const oy = Math.min(seg.y1, seg.y2);
      await act().addObject({
        type: 'line',
        x: ox,
        y: oy,
        width: Math.abs(seg.x2 - seg.x1) || 1,
        height: Math.abs(seg.y2 - seg.y1) || 1,
        points: [seg.x1 - ox, seg.y1 - oy, seg.x2 - ox, seg.y2 - oy],
        color,
        strokeWidth: 2,
      });
    } else if (toolName === "drawAngleBisector") {
      const { vx, vy, ax, ay, bx, by, length, color = '#333333' } = toolArgs;
      const seg = angleBisector(vx, vy, ax, ay, bx, by, length);
      const ox = Math.min(seg.x1, seg.x2);
      const oy = Math.min(seg.y1, seg.y2);
      await act().addObject({
        type: 'line',
        x: ox,
        y: oy,
        width: Math.abs(seg.x2 - seg.x1) || 1,
        height: Math.abs(seg.y2 - seg.y1) || 1,
        points: [seg.x1 - ox, seg.y1 - oy, seg.x2 - ox, seg.y2 - oy],
        color,
        strokeWidth: 2,
      });
    } else if (toolName === "drawTangentLine") {
      const { cx, cy, radius, px, py, color = '#333333' } = toolArgs;
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < radius) {
        return { error: "drawTangentLine: external point is inside the circle" };
      }
      const lines = tangentLines(cx, cy, radius, px, py);
      await Promise.all(lines.map(seg => {
        const ox = Math.min(seg.x1, seg.x2);
        const oy = Math.min(seg.y1, seg.y2);
        return act().addObject({
          type: 'line',
          x: ox,
          y: oy,
          width: Math.abs(seg.x2 - seg.x1) || 1,
          height: Math.abs(seg.y2 - seg.y1) || 1,
          points: [seg.x1 - ox, seg.y1 - oy, seg.x2 - ox, seg.y2 - oy],
          color,
          strokeWidth: 2,
        });
      }));
    } else if (toolName === "drawDistanceLabel") {
      const { x1, y1, x2, y2, label } = toolArgs;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const text = label !== undefined ? label : String(Math.round(Math.hypot(x2 - x1, y2 - y1)));
      await act().addObject({
        type: 'text',
        x: mx,
        y: my,
        text,
        width: 200,
        fontSize: 16,
        color: '#1a1a1a',
      });
    } else if (toolName === "editText") {
      const { objectId, text } = toolArgs;
      const currentObjs = objs();
      const validationError = validateObjectExists(objectId, currentObjs, 'editText');
      if (validationError) return validationError;
      const obj = currentObjs[objectId];
      const field = obj.type === 'frame' ? 'title' : 'text';
      await act().updateObject(objectId, { [field]: text });
      return { success: true, updatedField: field };
    } else if (toolName === "duplicateObject") {
      const { objectId, offsetX = 20, offsetY = 20 } = toolArgs;
      const currentObjs = objs();
      const validationError = validateObjectExists(objectId, currentObjs, 'duplicateObject');
      if (validationError) return validationError;
      const obj = currentObjs[objectId];
      const { id, createdAt, updatedAt, childIds, frameId, ...cloneData } = obj;
      const clone = {
        ...cloneData,
        x: (cloneData.x || 0) + offsetX,
        y: (cloneData.y || 0) + offsetY,
        frameId: null,
        childIds: [],
      };
      const newId = await act().addObject(clone);
      return { success: true, newObjectId: newId };
    } else if (toolName === "changeMultipleColors") {
      const { objectIds, color } = toolArgs;
      if (objectIds.length > 100) {
        return { error: `changeMultipleColors: too many objects (${objectIds.length}), max is 100` };
      }
      const currentObjs = objs();
      const validIds = objectIds.filter(id => currentObjs[id]);
      if (validIds.length === 0) return { error: "changeMultipleColors: no valid objects found" };
      await Promise.all(validIds.map(id => act().updateObject(id, { color })));
      return { success: true, updatedCount: validIds.length };
    }
  } catch (error) {
    return { error: error.message };
  }
}
