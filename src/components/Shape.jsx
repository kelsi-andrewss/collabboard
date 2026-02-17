import React, { useState, useEffect, useRef } from 'react';
import { Rect, Circle, Group, Transformer, Text, Line } from 'react-konva';
import { Html } from 'react-konva-utils';

export const Shape = ({ id, type, x, y, width = 100, height = 100, text = '', color = '#3b82f6', rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, onUpdate, onDelete }) => {
  const shapeRef = useRef();
  const trRef = useRef();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isSelected && !isEditing) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, isEditing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (isSelected && !isEditing && onDelete) {
        onDelete(id);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditing, onDelete]);

  const handleTextChange = (e) => {
    onUpdate(id, { text: e.target.value });
  };

  const getTrianglePoints = (w, h) => {
    return [w / 2, 0, 0, h, w, h];
  };

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

          onTransformEnd(id, {
            x: group.x(),
            y: group.y(),
            rotation: group.rotation(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
          });
        }}
      >
        {type === 'rectangle' && (
          <Rect
            ref={shapeRef}
            width={width}
            height={height}
            fill={color}
            stroke={isSelected ? '#2563eb' : 'transparent'}
            strokeWidth={2}
          />
        )}
        {type === 'circle' && (
          <Circle
            ref={shapeRef}
            width={width}
            height={height}
            x={width/2}
            y={height/2}
            radius={Math.min(width, height) / 2}
            fill={color}
            stroke={isSelected ? '#2563eb' : 'transparent'}
            strokeWidth={2}
          />
        )}
        {type === 'triangle' && (
          <Line
            ref={shapeRef}
            points={getTrianglePoints(width, height)}
            closed
            fill={color}
            stroke={isSelected ? '#2563eb' : 'transparent'}
            strokeWidth={2}
          />
        )}
        
        {!isEditing ? (
          <Text
            text={text}
            width={width}
            height={height}
            padding={10}
            fontSize={14}
            fill="#ffffff"
            verticalAlign="middle"
            align="center"
            fontFamily="sans-serif"
            lineHeight={1.2}
            onClick={(e) => {
              e.cancelBubble = true;
              setIsEditing(true);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              setIsEditing(true);
            }}
          />
        ) : (
          <Html divProps={{ style: { pointerEvents: 'none' } }}>
            <div style={{
              width: `${width}px`,
              height: `${height}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              padding: '10px',
              boxSizing: 'border-box'
            }}>
              <textarea
                value={text}
                onChange={handleTextChange}
                onBlur={() => setIsEditing(false)}
                autoFocus
                rows={1}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  textAlign: 'center',
                  fontSize: '14px',
                  fontFamily: 'sans-serif',
                  color: '#ffffff',
                  lineHeight: '1.2',
                  padding: '0',
                  margin: '0',
                  pointerEvents: 'auto',
                  overflow: 'hidden',
                  display: 'block'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onFocus={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                  const val = e.target.value;
                  e.target.value = '';
                  e.target.value = val;
                }}
              />
            </div>
          </Html>
        )}
      </Group>
      {isSelected && !isEditing && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};
