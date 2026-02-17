import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';

function getLuminance(hex) {
  if (!hex || !hex.startsWith('#')) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export const Frame = ({ id, x, y, width = 400, height = 300, title = 'Frame', color = '#6366f1', backgroundColor, rotation = 0, isSelected, onSelect, onDragEnd, onDragMove, onTransformEnd, onUpdate, onDelete, dragState, snapToGrid = false, gridSize = 50 }) => {
  const groupRef = useRef();
  const trRef = useRef();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isSelected && !isEditing && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
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
  const titleColor = backgroundColor
    ? (getLuminance(backgroundColor) > 0.5 ? '#1f2937' : '#ffffff')
    : color;

  return (
    <>
      <Group
        ref={groupRef}
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
        onDragMove={(e) => {
          if (onDragMove) onDragMove(id, { x: e.target.x(), y: e.target.y() });
        }}
        onDragEnd={(e) => {
          onDragEnd(id, { x: e.target.x(), y: e.target.y() });
        }}
      >
        {/* Background fill */}
        {backgroundColor && (
          <Rect
            width={width}
            height={height}
            fill={backgroundColor}
            cornerRadius={4}
            listening={false}
          />
        )}
        {/* Frame body - dashed border */}
        <Rect
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
            fill={titleColor}
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
                  color: titleColor,
                  padding: '0',
                  margin: '0',
                  pointerEvents: 'auto',
                }}
              />
            </div>
          </Html>
        )}
        {/* Drag indicator overlay */}
        {dragState && dragState.overFrameId === id && dragState.action && (
          <>
            <Rect
              width={width}
              height={height}
              fill={dragState.action === 'add' ? '#22c55e' : '#ef4444'}
              opacity={0.15}
              cornerRadius={4}
              listening={false}
            />
            <Text
              text={dragState.action === 'add' ? '+' : '-'}
              x={0}
              y={0}
              width={width}
              height={height}
              fontSize={48}
              fontStyle="bold"
              fill={dragState.action === 'add' ? '#22c55e' : '#ef4444'}
              opacity={0.6}
              align="center"
              verticalAlign="middle"
              listening={false}
            />
          </>
        )}
      </Group>
      {isSelected && !isEditing && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 100 || newBox.height < 80) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const group = groupRef.current;
            const scaleX = group.scaleX();
            const scaleY = group.scaleY();
            const rawX = group.x();
            const rawY = group.y();
            const rawW = Math.max(100, width * scaleX);
            const rawH = Math.max(80, height * scaleY);
            const s = (v) => snapToGrid ? Math.round(v / gridSize) * gridSize : v;
            const finalX = s(rawX);
            const finalY = s(rawY);
            const finalW = (snapToGrid ? Math.max(gridSize, s(rawX + rawW) - finalX) : rawW) || rawW;
            const finalH = (snapToGrid ? Math.max(gridSize, s(rawY + rawH) - finalY) : rawH) || rawH;
            group.scaleX(1);
            group.scaleY(1);
            group.position({ x: finalX, y: finalY });
            if (onTransformEnd) {
              onTransformEnd(id, {
                x: finalX,
                y: finalY,
                rotation: group.rotation(),
                width: finalW,
                height: finalH,
              });
            }
          }}
        />
      )}
    </>
  );
};
