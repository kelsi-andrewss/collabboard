import React, { useState, useEffect, useRef } from 'react';
import { Rect, Circle, Group, Transformer, Text, Line } from 'react-konva';
import { Html } from 'react-konva-utils';

export const Shape = ({ id, type, x, y, width = 100, height = 100, text = '', color = '#3b82f6', rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, onUpdate, onDelete, onDragMove, snapToGrid = false, gridSize = 50 }) => {
  const shapeRef = useRef();
  const textRef = useRef();
  const groupRef = useRef();
  const trRef = useRef();
  const sizeRef = useRef({ w: width, h: height });
  const [isEditing, setIsEditing] = useState(false);

  // Keep size ref in sync with props
  useEffect(() => {
    sizeRef.current = { w: width, h: height };
  }, [width, height]);

  useEffect(() => {
    if (isSelected && !isEditing) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, isEditing, width, height]);

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

  const updateShapeSize = (w, h) => {
    const shape = shapeRef.current;
    if (shape) {
      if (type === 'circle') {
        shape.radius(Math.min(w, h) / 2);
        shape.x(w / 2);
        shape.y(h / 2);
      } else if (type === 'triangle') {
        shape.points([w / 2, 0, 0, h, w, h]);
      } else {
        shape.width(w);
        shape.height(h);
      }
    }
    if (textRef.current) {
      textRef.current.width(w);
      textRef.current.height(h);
    }
  };

  return (
    <>
      <Group
        ref={groupRef}
        name={id}
        x={x}
        y={y}
        rotation={rotation}
        draggable={!isEditing}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onDblClick={(e) => {
          e.cancelBubble = true;
          setIsEditing(true);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onDragMove={(e) => {
          if (onDragMove) onDragMove(id, { x: e.target.x(), y: e.target.y() });
        }}
        onDragEnd={(e) => {
          onDragEnd(id, { x: e.target.x(), y: e.target.y() });
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
            ref={textRef}
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
              if (text) setIsEditing(true);
              else onSelect(id);
            }}
            onDblClick={(e) => {
              e.cancelBubble = true;
              setIsEditing(true);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              if (text) setIsEditing(true);
              else onSelect(id);
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
          keepRatio={type === 'circle'}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const group = groupRef.current;
            const scaleX = group.scaleX();
            const scaleY = group.scaleY();
            const rawX = group.x();
            const rawY = group.y();
            // Use sizeRef (not React props) to handle rapid consecutive resizes
            const rawW = Math.max(5, sizeRef.current.w * scaleX);
            const rawH = Math.max(5, sizeRef.current.h * scaleY);
            let finalX, finalY, finalW, finalH;
            if (snapToGrid) {
              const s = (v) => Math.round(v / gridSize) * gridSize;
              finalX = s(rawX);
              finalY = s(rawY);
              if (type === 'circle') {
                const size = Math.max(gridSize, s(Math.max(rawW, rawH)));
                finalW = size;
                finalH = size;
              } else {
                finalW = Math.max(gridSize, s(rawX + rawW) - finalX);
                finalH = Math.max(gridSize, s(rawY + rawH) - finalY);
              }
            } else {
              finalX = rawX;
              finalY = rawY;
              finalW = rawW;
              finalH = rawH;
            }
            // Update committed size ref immediately
            sizeRef.current = { w: finalW, h: finalH };
            // Reset group scale and set final position
            group.scaleX(1);
            group.scaleY(1);
            group.position({ x: finalX, y: finalY });
            // Imperatively update ALL children to final size (prevents flash before React re-render)
            updateShapeSize(finalW, finalH);
            // Force Transformer to re-read the group's updated bounds
            trRef.current?.nodes([group]);
            group.getLayer()?.batchDraw();
            onTransformEnd(id, {
              x: finalX,
              y: finalY,
              rotation: group.rotation(),
              width: finalW,
              height: finalH,
            });
          }}
        />
      )}
    </>
  );
};
