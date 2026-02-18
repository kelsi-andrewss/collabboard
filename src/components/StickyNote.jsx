import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';
import { darkenHex } from '../utils/colorUtils.js';

function StickyNoteInner({ id, x, y, width = 150, height = 150, text, color = '#fef08a', rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, onUpdate, onDelete, onDragMove, snapToGrid = false, gridSize = 50, dragState, dragLayerRef, mainLayerRef, dragPos, frameId }) {
  const shapeRef = useRef();
  const textRef = useRef();
  const groupRef = useRef();
  const trRef = useRef();
  const sizeRef = useRef({ w: width, h: height });
  const [isEditing, setIsEditing] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark');

  useEffect(() => {
    sizeRef.current = { w: width, h: height };
  }, [width, height]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isSelected && !isEditing && trRef.current) {
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

  return (
    <>
      <Group
        ref={groupRef}
        name={id}
        x={dragPos?.id === id ? dragPos.x : x}
        y={dragPos?.id === id ? dragPos.y : y}
        rotation={rotation}
        draggable={!isEditing}
        dragDistance={3}
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
        <Rect
          ref={shapeRef}
          width={width}
          height={height}
          fill={color}
          shadowEnabled={true}
          shadowBlur={frameId ? 6 : 18}
          shadowOffsetX={frameId ? 1 : 4}
          shadowOffsetY={frameId ? 2 : 6}
          shadowOpacity={frameId ? 0.12 : 0.22}
          shadowColor={isSelected ? color : '#000000'}
          cornerRadius={4}
          stroke={isSelected ? '#2563eb' : darkenHex(color, 0.2)}
          strokeWidth={2}
        />
        {dragState?.draggingId === id && dragState?.illegalDrag && (
          <Rect x={0} y={0} width={width} height={height}
            fill="#ef4444" opacity={0.35} cornerRadius={4}
            listening={false} perfectDrawEnabled={false} />
        )}
        {!isEditing ? (
          <Text
            ref={textRef}
            text={text}
            width={width}
            height={height}
            padding={10}
            fontSize={14}
            verticalAlign="middle"
            align="center"
            fontFamily="sans-serif"
            lineHeight={1.2}
            fill="#000000"
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
                  lineHeight: '1.2',
                  padding: '0',
                  margin: '0',
                  pointerEvents: 'auto',
                  color: '#000000',
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
          rotateEnabled={true}
          rotationSnaps={snapToGrid ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
          anchorSize={10}
          anchorStrokeWidth={2}
          anchorCornerRadius={2}
          anchorHitStrokeWidth={12}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 50) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const group = groupRef.current;
            const scaleX = group.scaleX();
            const scaleY = group.scaleY();
            const rawX = group.x();
            const rawY = group.y();
            const rawW = Math.max(50, sizeRef.current.w * scaleX);
            const rawH = Math.max(50, sizeRef.current.h * scaleY);
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
            sizeRef.current = { w: finalW, h: finalH };
            group.scaleX(1);
            group.scaleY(1);
            group.position({ x: finalX, y: finalY });
            // Imperatively update children to prevent flash
            if (shapeRef.current) {
              shapeRef.current.width(finalW);
              shapeRef.current.height(finalH);
            }
            if (textRef.current) {
              textRef.current.width(finalW);
              textRef.current.height(finalH);
            }
            trRef.current?.nodes([group]);
            group.getLayer()?.batchDraw();
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
}

export const StickyNote = React.memo(StickyNoteInner);
