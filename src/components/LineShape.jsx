import React, { useEffect, useRef, useState } from 'react';
import { Line, Arrow, Group, Transformer, Rect, Circle } from 'react-konva';
import { findSnapTarget, getPortCoords, SNAP_DISTANCE, PORTS } from '../utils/connectorUtils.js';

const PORT_RADIUS = 5;

function LineShapeInner({ id, type = 'line', x, y, points = [0, 0, 200, 0], color = '#3b82f6', strokeWidth = 3, rotation = 0, isSelected, isMultiSelected, onSelect, onDragEnd, onTransformEnd, onDelete, onDragMove, snapToGrid = false, gridSize = 50, dragState, dragLayerRef, mainLayerRef, dragPos, canEdit = true, objects, onUpdate, startConnectedId, startConnectedPort, endConnectedId, endConnectedPort }) {
  const lineRef = useRef();
  const groupRef = useRef();
  const trRef = useRef();
  const [draggingEndpoint, setDraggingEndpoint] = useState(null);
  const pointsRef = useRef(points);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    if (isSelected && trRef.current && lineRef.current) {
      trRef.current.nodes([lineRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && isSelected && onDelete) {
        onDelete(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, onDelete, id]);

  const snap = (v) => snapToGrid ? Math.round(v / gridSize) * gridSize : v;

  const isArrow = type === 'arrow';
  const ShapeComponent = isArrow ? Arrow : Line;
  const arrowProps = isArrow ? { pointerLength: 12, pointerWidth: 10, fill: isMultiSelected ? '#6366f1' : color } : {};

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

  return (
    <>
      <Group
        ref={groupRef}
        name={id}
        x={dragPos?.id === id ? dragPos.x : x}
        y={dragPos?.id === id ? dragPos.y : y}
        rotation={rotation}
        draggable={canEdit}
        dragDistance={3}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onDragStart={() => {
          if (dragLayerRef?.current && groupRef.current) {
            groupRef.current.moveTo(dragLayerRef.current);
          }
        }}
        onDragMove={(e) => {
          if (onDragMove) onDragMove(id, { x: e.target.x(), y: e.target.y() });
        }}
        onDragEnd={(e) => {
          const rawX = e.target.x();
          const rawY = e.target.y();
          const pos = { x: snap(rawX), y: snap(rawY) };
          if (mainLayerRef?.current && groupRef.current) {
            groupRef.current.moveTo(mainLayerRef.current);
            mainLayerRef.current.batchDraw();
          }
          onDragEnd(id, pos);
        }}
        onTransformEnd={(e) => {
          const node = lineRef.current;
          const group = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          const scaledPoints = [];
          const pts = node.points();
          for (let i = 0; i < pts.length; i += 2) {
            scaledPoints.push(pts[i] * scaleX);
            scaledPoints.push(pts[i + 1] * scaleY);
          }

          node.scaleX(1);
          node.scaleY(1);

          onTransformEnd(id, {
            x: group.x(),
            y: group.y(),
            rotation: group.rotation(),
            points: scaledPoints,
          });
        }}
      >
        <ShapeComponent
          ref={lineRef}
          points={points}
          stroke={isMultiSelected ? '#6366f1' : color}
          strokeWidth={isMultiSelected ? strokeWidth + 2 : strokeWidth}
          hitStrokeWidth={20}
          lineCap="round"
          lineJoin="round"
          perfectDrawEnabled={false}
          {...arrowProps}
        />
        {isSelected && canEdit && (() => {
          const pts = points || [0, 0, 200, 0];
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
                    onUpdate(id, { points: newPts, startConnectedId: connId, startConnectedPort: connPort });
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
                    onUpdate(id, { points: newPts, endConnectedId: connId, endConnectedPort: connPort });
                  }
                }}
              />
            </>
          );
        })()}
        {dragState?.draggingId === id && dragState?.illegalDrag && (() => {
          const pts = points || [0, 0, 200, 0];
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
      {isSelected && canEdit && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          rotationSnaps={snapToGrid ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          enabledAnchors={['middle-left', 'middle-right']}
          anchorSize={10}
          anchorStrokeWidth={2}
          anchorCornerRadius={2}
          anchorHitStrokeWidth={12}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 5 && Math.abs(newBox.height) < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}

export const LineShape = React.memo(LineShapeInner);
