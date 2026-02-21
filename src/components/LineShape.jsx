import React, { useEffect, useRef, useState } from 'react';
import { Line, Arrow, Group, Rect, Circle } from 'react-konva';
import { findSnapTarget, getPortCoords, SNAP_DISTANCE, PORTS } from '../utils/connectorUtils.js';

const PORT_RADIUS = 5;

function LineShapeInner({ id, type = 'line', x, y, points = [0, 0, 200, 0], color = '#3b82f6', strokeWidth = 3, rotation = 0, isSelected, isMultiSelected, onSelect, onDragEnd, onTransformEnd, onDelete, onDragMove, snapToGrid = false, gridSize = 50, dragState, dragLayerRef, mainLayerRef, dragPos, canEdit = true, objects, onUpdate, startConnectedId, startConnectedPort, endConnectedId, endConnectedPort }) {
  const lineRef = useRef();
  const groupRef = useRef();
  const [draggingEndpoint, setDraggingEndpoint] = useState(null);
  const pointsRef = useRef(points);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && isSelected && onDelete) {
        onDelete(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, onDelete, id]);

  const isArrow = type === 'arrow';
  const ShapeComponent = isArrow ? Arrow : Line;
  const arrowProps = isArrow ? { pointerLength: 12, pointerWidth: 10, fill: isMultiSelected ? '#6366f1' : color } : {};

  // Compute effectivePts: if dragPos matches a connected endpoint's object,
  // override that endpoint's position using getPortCoords with the live drag position.
  let effectivePts = points;
  if (dragPos && objects) {
    const pts = [...points];
    let modified = false;
    if (startConnectedId && startConnectedPort && dragPos.id === startConnectedId) {
      const target = objects[startConnectedId];
      if (target) {
        const p = getPortCoords({ ...target, x: dragPos.x, y: dragPos.y }, startConnectedPort);
        pts[0] = p.x - x;
        pts[1] = p.y - y;
        modified = true;
      }
    }
    if (endConnectedId && endConnectedPort && dragPos.id === endConnectedId) {
      const target = objects[endConnectedId];
      if (target) {
        const p = getPortCoords({ ...target, x: dragPos.x, y: dragPos.y }, endConnectedPort);
        pts[pts.length - 2] = p.x - x;
        pts[pts.length - 1] = p.y - y;
        modified = true;
      }
    }
    if (modified) effectivePts = pts;
  }

  const nearbyPorts = [];
  if (draggingEndpoint && objects) {
    const excludeIds = new Set([id]);
    for (const obj of Object.values(objects)) {
      if (excludeIds.has(obj.id)) continue;
      if (obj.type === 'line' || obj.type === 'arrow') continue;
      for (const port of PORTS) {
        const p = getPortCoords(obj, port);
        const epIdx = draggingEndpoint === 'start' ? 0 : pointsRef.current.length - 2;
        const epX = x + pointsRef.current[epIdx];
        const epY = y + pointsRef.current[epIdx + 1];
        const dx = epX - p.x;
        const dy = epY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < SNAP_DISTANCE * 2) {
          nearbyPorts.push({ x: p.x, y: p.y, isSnapped: dist < SNAP_DISTANCE });
        }
      }
    }
  }

  function recalcBounds(pts, groupX, groupY) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i] < minX) minX = pts[i];
      if (pts[i] > maxX) maxX = pts[i];
      if (pts[i + 1] < minY) minY = pts[i + 1];
      if (pts[i + 1] > maxY) maxY = pts[i + 1];
    }
    const newX = groupX + minX;
    const newY = groupY + minY;
    const newWidth = maxX - minX;
    const newHeight = maxY - minY;
    const relativePts = [];
    for (let i = 0; i < pts.length; i += 2) {
      relativePts.push(pts[i] - minX);
      relativePts.push(pts[i + 1] - minY);
    }
    return { x: newX, y: newY, width: newWidth, height: newHeight, points: relativePts };
  }

  return (
    <>
      <Group
        ref={groupRef}
        name={id}
        x={x}
        y={y}
        rotation={rotation}
        draggable={false}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
      >
        <ShapeComponent
          ref={lineRef}
          points={effectivePts}
          stroke={isMultiSelected ? '#6366f1' : color}
          strokeWidth={isMultiSelected ? strokeWidth + 2 : strokeWidth}
          hitStrokeWidth={20}
          lineCap="round"
          lineJoin="round"
          perfectDrawEnabled={false}
          {...arrowProps}
        />
        {isSelected && canEdit && (() => {
          const pts = effectivePts || [0, 0, 200, 0];
          const startX = pts[0];
          const startY = pts[1];
          const endX = pts[pts.length - 2];
          const endY = pts[pts.length - 1];
          return (
            <>
              <Circle
                x={startX}
                y={startY}
                radius={6}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={2}
                draggable
                onDragStart={() => { setDraggingEndpoint('start'); }}
                onDragMove={(e) => {
                  const node = e.target;
                  const newPts = [...pointsRef.current];
                  newPts[0] = node.x();
                  newPts[1] = node.y();
                  if (lineRef.current) lineRef.current.points(newPts);
                  const layer = node.getLayer();
                  if (layer) layer.batchDraw();
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  let newX = node.x();
                  let newY = node.y();
                  const groupNode = groupRef.current;
                  const absX = (groupNode ? groupNode.x() : x) + newX;
                  const absY = (groupNode ? groupNode.y() : y) + newY;
                  let connId = null;
                  let connPort = null;
                  if (objects) {
                    const snapTarget = findSnapTarget(absX, absY, objects, new Set([id]));
                    if (snapTarget) {
                      newX = snapTarget.x - (groupNode ? groupNode.x() : x);
                      newY = snapTarget.y - (groupNode ? groupNode.y() : y);
                      connId = snapTarget.objectId;
                      connPort = snapTarget.port;
                    }
                  }
                  const newPts = [...pointsRef.current];
                  newPts[0] = newX;
                  newPts[1] = newY;
                  node.x(newX);
                  node.y(newY);
                  setDraggingEndpoint(null);
                  if (onUpdate) {
                    const groupX = groupNode ? groupNode.x() : x;
                    const groupY = groupNode ? groupNode.y() : y;
                    const bounds = recalcBounds(newPts, groupX, groupY);
                    onUpdate(id, { ...bounds, startConnectedId: connId, startConnectedPort: connPort });
                  }
                }}
              />
              <Circle
                x={endX}
                y={endY}
                radius={6}
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth={2}
                draggable
                onDragStart={() => { setDraggingEndpoint('end'); }}
                onDragMove={(e) => {
                  const node = e.target;
                  const newPts = [...pointsRef.current];
                  newPts[newPts.length - 2] = node.x();
                  newPts[newPts.length - 1] = node.y();
                  if (lineRef.current) lineRef.current.points(newPts);
                  const layer = node.getLayer();
                  if (layer) layer.batchDraw();
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  let newX = node.x();
                  let newY = node.y();
                  const groupNode = groupRef.current;
                  const absX = (groupNode ? groupNode.x() : x) + newX;
                  const absY = (groupNode ? groupNode.y() : y) + newY;
                  let connId = null;
                  let connPort = null;
                  if (objects) {
                    const snapTarget = findSnapTarget(absX, absY, objects, new Set([id]));
                    if (snapTarget) {
                      newX = snapTarget.x - (groupNode ? groupNode.x() : x);
                      newY = snapTarget.y - (groupNode ? groupNode.y() : y);
                      connId = snapTarget.objectId;
                      connPort = snapTarget.port;
                    }
                  }
                  const newPts = [...pointsRef.current];
                  newPts[newPts.length - 2] = newX;
                  newPts[newPts.length - 1] = newY;
                  node.x(newX);
                  node.y(newY);
                  setDraggingEndpoint(null);
                  if (onUpdate) {
                    const groupX = groupNode ? groupNode.x() : x;
                    const groupY = groupNode ? groupNode.y() : y;
                    const bounds = recalcBounds(newPts, groupX, groupY);
                    onUpdate(id, { ...bounds, endConnectedId: connId, endConnectedPort: connPort });
                  }
                }}
              />
            </>
          );
        })()}
        {dragState?.draggingId === id && dragState?.illegalDrag && (() => {
          const pts = effectivePts || [0, 0, 200, 0];
          let minPx = Infinity, minPy = Infinity, maxPx = -Infinity, maxPy = -Infinity;
          for (let i = 0; i < pts.length; i += 2) {
            minPx = Math.min(minPx, pts[i]); maxPx = Math.max(maxPx, pts[i]);
            minPy = Math.min(minPy, pts[i + 1]); maxPy = Math.max(maxPy, pts[i + 1]);
          }
          return (
            <Rect x={minPx} y={minPy}
              width={Math.max(maxPx - minPx, strokeWidth || 3)}
              height={Math.max(maxPy - minPy, strokeWidth || 3)}
              fill="#ef4444" opacity={0.35}
              listening={false} perfectDrawEnabled={false} />
          );
        })()}
      </Group>
      {nearbyPorts.map((p, i) => (
        <Circle
          key={i}
          x={p.x}
          y={p.y}
          radius={PORT_RADIUS}
          fill={p.isSnapped ? '#3b82f6' : 'transparent'}
          stroke={p.isSnapped ? '#3b82f6' : '#64748b'}
          strokeWidth={1.5}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
}

export const LineShape = React.memo(LineShapeInner);
