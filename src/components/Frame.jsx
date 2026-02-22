import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';


function FrameInner({ id, x, y, width = 400, height = 300, title = 'Frame', color = '#6366f1', rotation = 0, isSelected, onSelect, onDragEnd, onDragMove, onTransformEnd, onUpdate, onDelete, onResizeClamped, dragState, snapToGrid = false, gridSize = 50, minWidth = 100, minHeight = 80, dragLayerRef, mainLayerRef, dragPos, canEdit = true, onAutoFit }) {
  const groupRef = useRef();
  const trRef = useRef();
  const hitRectRef = useRef();
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

  const titleBarHeight = 48;
  const titleFontSize = 20;
  const titleColor = color;

  return (
    <>
      <Group
        ref={groupRef}
        name={id}
        x={dragPos?.id === id ? dragPos.x : x}
        y={dragPos?.id === id ? dragPos.y : y}
        rotation={0}
        draggable={canEdit && !isEditing}
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
          const pos = { x: e.target.x(), y: e.target.y() };
          if (mainLayerRef?.current && groupRef.current) {
            groupRef.current.moveTo(mainLayerRef.current);
            mainLayerRef.current.batchDraw();
          }
          onDragEnd(id, pos);
        }}
      >
        {/* Invisible hit area for the full frame body */}
        <Rect
          ref={hitRectRef}
          width={width}
          height={height}
          fill="transparent"
          listening={true}
          onDblClick={(e) => {
            if (!canEdit || !onAutoFit) return;
            e.cancelBubble = true;
            onAutoFit(id);
          }}
          onDblTap={(e) => {
            if (!canEdit || !onAutoFit) return;
            e.cancelBubble = true;
            onAutoFit(id);
          }}
        />
        {/* Translucent background fill derived from frame color */}
        <Rect
          ref={bgRectRef}
          width={width}
          height={height}
          fill={color}
          opacity={0.06}
          cornerRadius={4}
          listening={false}
          shadowEnabled={true}
          shadowBlur={14}
          shadowOffsetX={3}
          shadowOffsetY={5}
          shadowOpacity={0.18}
          shadowColor="#000000"
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
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Title bar */}
        <Rect
          ref={titleBarRef}
          width={width}
          height={titleBarHeight}
          fill={color}
          opacity={0.25}
          cornerRadius={[4, 4, 0, 0]}
          listening={false}
          perfectDrawEnabled={false}
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
            perfectDrawEnabled={false}
            onDblClick={(e) => {
              if (!canEdit) return;
              e.cancelBubble = true;
              setIsEditing(true);
            }}
            onDblTap={(e) => {
              if (!canEdit) return;
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
        {(() => {
          const showIllegal = dragState?.draggingId === id && dragState?.illegalDrag;
          const showAction = dragState && dragState.overFrameId === id && dragState.action;
          if (!showIllegal && !showAction) return null;
          return (
            <>
              <Rect
                width={width}
                height={height}
                fill={showIllegal ? '#ef4444' : (dragState.action === 'add' ? '#22c55e' : '#ef4444')}
                opacity={showIllegal ? 0.25 : 0.15}
                cornerRadius={4}
                listening={false}
                perfectDrawEnabled={false}
              />
              {!showIllegal && (
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
              )}
            </>
          );
        })()}
      </Group>
      {isSelected && !isEditing && canEdit && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
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
            let finalX = rawX, finalY = rawY, finalW = rawW, finalH = rawH;
            if (snapToGrid && isResize) {
              const s = (v) => Math.round(v / gridSize) * gridSize;
              finalX = s(rawX); finalY = s(rawY);
              finalW = Math.max(gridSize, s(rawX + rawW) - finalX);
              finalH = Math.max(gridSize, s(rawY + rawH) - finalY);
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
            if (hitRectRef.current) {
              hitRectRef.current.width(finalW);
              hitRectRef.current.height(finalH);
            }
            if (bgRectRef.current) {
              bgRectRef.current.width(finalW);
              bgRectRef.current.height(finalH);
            }
            if (borderRectRef.current) {
              borderRectRef.current.width(finalW);
              borderRectRef.current.height(finalH);
            }
            const finalTitleBarH = 48;
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
              const clamped = onTransformEnd(id, {
                x: finalX,
                y: finalY,
                rotation: 0,
                width: finalW,
                height: finalH,
              });

              if (clamped && (clamped.width !== finalW || clamped.height !== finalH || clamped.x !== finalX || clamped.y !== finalY)) {
                groupRef.current.x(clamped.x);
                groupRef.current.y(clamped.y);
                if (hitRectRef.current) { hitRectRef.current.width(clamped.width); hitRectRef.current.height(clamped.height); }
                bgRectRef.current.width(clamped.width);
                bgRectRef.current.height(clamped.height);
                borderRectRef.current.width(clamped.width);
                borderRectRef.current.height(clamped.height);
                const clampedTitleBarH = 48;
                titleBarRef.current.width(clamped.width);
                titleBarRef.current.height(clampedTitleBarH);
                titleTextRef.current.width(clamped.width - 16);
                titleTextRef.current.height(clampedTitleBarH);
                trRef.current?.nodes([groupRef.current]);
                groupRef.current.getLayer()?.batchDraw();
              }
            }
          }}
        />
      )}
    </>
  );
}

export const Frame = React.memo(FrameInner);
