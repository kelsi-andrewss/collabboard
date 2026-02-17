import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';

export const Frame = ({ id, x, y, width = 400, height = 300, title = 'Frame', color = '#6366f1', rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, onUpdate, onDelete }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isSelected && !isEditing && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, isEditing]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && isSelected && !isEditing && onDelete) {
        onDelete(id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, onDelete, id]);

  const titleBarHeight = 32;

  return (
    <>
      <Group
        x={x}
        y={y}
        rotation={rotation}
        draggable={!isEditing}
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
          const node = shapeRef.current;
          const group = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          if (onTransformEnd) {
            onTransformEnd(id, {
              x: group.x(),
              y: group.y(),
              rotation: group.rotation(),
              width: Math.max(100, node.width() * scaleX),
              height: Math.max(80, node.height() * scaleY),
            });
          }
        }}
      >
        {/* Frame body - dashed border */}
        <Rect
          ref={shapeRef}
          width={width}
          height={height}
          fill="transparent"
          stroke={color}
          strokeWidth={2}
          dash={[8, 4]}
          cornerRadius={4}
        />
        {/* Title bar */}
        <Rect
          width={width}
          height={titleBarHeight}
          fill={color}
          opacity={0.25}
          cornerRadius={[4, 4, 0, 0]}
        />
        {/* Title text */}
        {!isEditing ? (
          <Text
            text={title}
            x={8}
            y={0}
            width={width - 16}
            height={titleBarHeight}
            fontSize={13}
            fontStyle="bold"
            fill={color}
            verticalAlign="middle"
            fontFamily="sans-serif"
            ellipsis={true}
            wrap="none"
            onDblClick={(e) => {
              e.cancelBubble = true;
              setIsEditing(true);
            }}
            onDblTap={(e) => {
              e.cancelBubble = true;
              setIsEditing(true);
            }}
          />
        ) : (
          <Html divProps={{ style: { pointerEvents: 'none' } }}>
            <div style={{
              width: `${width}px`,
              height: `${titleBarHeight}px`,
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              padding: '0 8px',
              boxSizing: 'border-box'
            }}>
              <input
                type="text"
                value={title}
                onChange={(e) => onUpdate(id, { title: e.target.value })}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => { if (e.key === 'Enter') setIsEditing(false); }}
                autoFocus
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  fontFamily: 'sans-serif',
                  color: color,
                  padding: '0',
                  margin: '0',
                  pointerEvents: 'auto',
                }}
              />
            </div>
          </Html>
        )}
      </Group>
      {isSelected && !isEditing && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 100 || newBox.height < 80) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};
