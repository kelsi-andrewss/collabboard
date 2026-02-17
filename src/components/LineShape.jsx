import React, { useEffect, useRef } from 'react';
import { Line, Group, Transformer } from 'react-konva';

export const LineShape = ({ id, x, y, points = [0, 0, 200, 0], color = '#3b82f6', strokeWidth = 3, rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, onDelete }) => {
  const lineRef = useRef();
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

  return (
    <>
      <Group
        x={x}
        y={y}
        rotation={rotation}
        draggable
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onDragEnd={(e) => {
          onDragEnd(id, { x: e.target.x(), y: e.target.y() });
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
          stroke={color}
          strokeWidth={strokeWidth}
          hitStrokeWidth={20}
          lineCap="round"
          lineJoin="round"
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
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
};
