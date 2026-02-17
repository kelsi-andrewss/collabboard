import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';


export const Frame = ({ id, x, y, width = 400, height = 300, title = 'Frame', color = '#6366f1', rotation = 0, isSelected, onSelect, onDragEnd, onDragMove, onTransformEnd, onUpdate, onDelete, onResizeClamped, dragState, snapToGrid = false, gridSize = 50, minWidth = 100, minHeight = 80 }) => {
  const groupRef = useRef();
  const trRef = useRef();
  const bgRectRef = useRef();
  const borderRectRef = useRef();
  const titleBarRef = useRef();
  const titleTextRef = useRef();
  const [isEditing, setIsEditing] = useState(false);
  // Track committed dimensions imperatively so consecutive resizes use the latest values
  const sizeRef = useRef({ width, height });

  useEffect(() => {
    sizeRef.current = { width, height };
  }, [width, height]);

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

  const titleBarHeight = Math.max(32, Math.min(52, height * 0.12));
  const titleFontSize = Math.max(13, Math.min(20, titleBarHeight * 0.5));
  const titleColor = color;

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
        {/* Translucent background fill derived from frame color */}
        <Rect
          ref={bgRectRef}
          width={width}
          height={height}
          fill={color}
          opacity={0.06}
          cornerRadius={4}
          listening={false}
        />
        {/* Frame body - dashed border */}
        <Rect
          ref={borderRectRef}
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
          ref={titleBarRef}
          width={width}
          height={titleBarHeight}
          fill={color}
          opacity={0.25}
          cornerRadius={[4, 4, 0, 0]}
        />
        {/* Title text */}
        {!isEditing ? (
          <Text
            ref={titleTextRef}
            text={title}
            x={8}
            y={0}
            width={width - 16}
            height={titleBarHeight}
            fontSize={titleFontSize}
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
                  fontSize: `${titleFontSize}px`,
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
          rotationSnaps={snapToGrid ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
          anchorSize={10}
          anchorStrokeWidth={2}
          anchorCornerRadius={2}
          anchorHitStrokeWidth={12}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 40) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const group = groupRef.current;
            const scaleX = group.scaleX();
            const scaleY = group.scaleY();
            const rawX = group.x();
            const rawY = group.y();
            const rawW = Math.max(100, sizeRef.current.width * scaleX);
            const rawH = Math.max(80, sizeRef.current.height * scaleY);
            const isResize = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;
            let finalX, finalY, finalW, finalH;
            if (snapToGrid && isResize) {
              const s = (v) => Math.round(v / gridSize) * gridSize;
              finalX = s(rawX);
              finalY = s(rawY);
              finalW = Math.max(gridSize, s(rawX + rawW) - finalX);
              finalH = Math.max(gridSize, s(rawY + rawH) - finalY);
            } else {
              finalX = rawX;
              finalY = rawY;
              finalW = rawW;
              finalH = rawH;
            }
            // Clamp to minimum size required by children
            const wasClamped = finalW < minWidth || finalH < minHeight;
            finalW = Math.max(finalW, minWidth);
            finalH = Math.max(finalH, minHeight);

            group.scaleX(1);
            group.scaleY(1);
            group.position({ x: finalX, y: finalY });
            sizeRef.current = { width: finalW, height: finalH };
            // Imperatively resize the full-frame Rects so outline and background
            // snap to the new size immediately, before React re-renders
            if (bgRectRef.current) {
              bgRectRef.current.width(finalW);
              bgRectRef.current.height(finalH);
            }
            if (borderRectRef.current) {
              borderRectRef.current.width(finalW);
              borderRectRef.current.height(finalH);
            }
            const finalTitleBarH = Math.max(32, Math.min(52, finalH * 0.12));
            if (titleBarRef.current) {
              titleBarRef.current.width(finalW);
              titleBarRef.current.height(finalTitleBarH);
            }
            if (titleTextRef.current) {
              titleTextRef.current.width(finalW - 16);
              titleTextRef.current.height(finalTitleBarH);
            }
            trRef.current?.nodes([group]);
            group.getLayer()?.batchDraw();
            if (wasClamped && onResizeClamped) {
              onResizeClamped(id);
            }
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
