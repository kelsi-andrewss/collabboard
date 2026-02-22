import React, { useState, useEffect, useRef } from 'react';
import { Text, Rect, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';

function TextShapeInner({
  id, x, y, width = 200, text = '', fontSize = 16, color = '#1a1a1a',
  rotation = 0, isSelected, isMultiSelected, onSelect, onDragEnd,
  onTransformEnd, onUpdate, onDelete, onDragMove, snapToGrid = false,
  gridSize = 50, dragState, dragLayerRef, mainLayerRef, dragPos,
  onTypingChange, canEdit = true, pendingTool,
}) {
  const groupRef = useRef();
  const textRef = useRef();
  const trRef = useRef();
  const widthRef = useRef(width);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (isSelected && !isEditing && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, isEditing, width]);

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

  const currentX = dragPos?.id === id ? dragPos.x : x;
  const currentY = dragPos?.id === id ? dragPos.y : y;

  return (
    <>
      <Group
        ref={groupRef}
        name={id}
        x={currentX}
        y={currentY}
        rotation={rotation}
        draggable={canEdit && !isEditing}
        dragDistance={3}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect(id);
        }}
        onDblClick={(e) => {
          if (!canEdit) return;
          e.cancelBubble = true;
          setIsEditing(true);
          onTypingChange?.(true);
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
        {isMultiSelected && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={textRef.current?.height() || fontSize * 4}
            fill="transparent"
            stroke="#6366f1"
            strokeWidth={3}
            dash={[6, 3]}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}
        {dragState?.draggingId === id && dragState?.illegalDrag && (
          <Rect
            x={0}
            y={0}
            width={width}
            height={textRef.current?.height() || fontSize * 4}
            fill="#ef4444"
            opacity={0.35}
            listening={false}
            perfectDrawEnabled={false}
          />
        )}
        {!isEditing ? (
          <Text
            ref={textRef}
            text={text || 'Type something...'}
            opacity={text ? 1 : 0.35}
            width={width}
            fontSize={fontSize}
            fontFamily="sans-serif"
            lineHeight={1.3}
            fill={color}
            wrap="word"
            align="left"
            onClick={(e) => {
              e.cancelBubble = true;
              onSelect(id);
            }}
            onDblClick={(e) => {
              if (!canEdit) return;
              e.cancelBubble = true;
              setIsEditing(true);
              onTypingChange?.(true);
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
              pointerEvents: 'none',
            }}>
              <textarea
                value={text}
                onChange={handleTextChange}
                onBlur={() => { setIsEditing(false); onTypingChange?.(false); }}
                autoFocus
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  textAlign: 'left',
                  fontSize: `${fontSize}px`,
                  fontFamily: 'sans-serif',
                  lineHeight: '1.3',
                  padding: '0',
                  margin: '0',
                  pointerEvents: 'auto',
                  color: color,
                  overflow: 'hidden',
                  display: 'block',
                  minHeight: `${fontSize * 1.3}px`,
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setIsEditing(false);
                    onTypingChange?.(false);
                  }
                }}
              />
            </div>
          </Html>
        )}
      </Group>
      {isSelected && !isEditing && canEdit && pendingTool !== 'line' && pendingTool !== 'arrow' && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          rotationSnaps={snapToGrid ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          enabledAnchors={['middle-left', 'middle-right']}
          anchorSize={10}
          anchorCornerRadius={2}
          anchorHitStrokeWidth={12}
          borderStroke="#6366f1"
          borderStrokeWidth={1.5}
          borderDash={[4, 4]}
          anchorFill="#ffffff"
          anchorStroke="#6366f1"
          anchorStrokeWidth={1.5}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 40) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const group = groupRef.current;
            const scaleX = group.scaleX();
            const rawX = group.x();
            const rawY = group.y();
            const rawW = Math.max(40, widthRef.current * scaleX);
            let finalX = rawX, finalY = rawY, finalW = rawW;
            if (snapToGrid) {
              const s = (v) => Math.round(v / gridSize) * gridSize;
              finalX = s(rawX);
              finalY = s(rawY);
              finalW = Math.max(gridSize, s(rawX + rawW) - finalX);
            }
            widthRef.current = finalW;
            group.scaleX(1);
            group.scaleY(1);
            group.position({ x: finalX, y: finalY });
            if (textRef.current) {
              textRef.current.width(finalW);
            }
            trRef.current?.nodes([group]);
            group.getLayer()?.batchDraw();
            if (onTransformEnd) {
              onTransformEnd(id, {
                x: finalX,
                y: finalY,
                rotation: group.rotation(),
                width: finalW,
              });
            }
          }}
        />
      )}
    </>
  );
}

export const TextShape = React.memo(TextShapeInner);
