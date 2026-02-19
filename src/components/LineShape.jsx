import React, { useEffect, useRef } from 'react';
import { Line, Group, Transformer, Rect } from 'react-konva';

function LineShapeInner({ id, x, y, points = [0, 0, 200, 0], color = '#3b82f6', strokeWidth = 3, rotation = 0, isSelected, isMultiSelected, onSelect, onDragEnd, onTransformEnd, onDelete, onDragMove, snapToGrid = false, gridSize = 50, dragState, dragLayerRef, mainLayerRef, dragPos, canEdit = true }) {
  const lineRef = useRef();
  const groupRef = useRef();
  const trRef = useRef();

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
        <Line
          ref={lineRef}
          points={points}
          stroke={isMultiSelected ? '#6366f1' : color}
          strokeWidth={isMultiSelected ? strokeWidth + 2 : strokeWidth}
          hitStrokeWidth={20}
          lineCap="round"
          lineJoin="round"
          perfectDrawEnabled={false}
        />
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
