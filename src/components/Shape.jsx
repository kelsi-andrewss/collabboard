import React, { useState, useEffect, useRef } from 'react';
import { Rect, Ellipse, Group, Transformer, Text, Shape as KonvaShape } from 'react-konva';
import { Html } from 'react-konva-utils';

function ShapeInner({ id, type, x, y, width = 100, height = 100, text = '', color = '#3b82f6', rotation = 0, isSelected, isMultiSelected, onSelect, onDragEnd, onTransformEnd, onUpdate, onDelete, onDragMove, snapToGrid = false, gridSize = 50, dragState, dragLayerRef, mainLayerRef, dragPos, frameId, canEdit = true }) {
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


  const updateShapeSize = (w, h) => {
    const shape = shapeRef.current;
    if (shape) {
      if (type === 'circle') {
        shape.radiusX(w / 2);
        shape.radiusY(h / 2);
        shape.x(w / 2);
        shape.y(h / 2);
      } else if (type === 'triangle') {
        shape.width(w);
        shape.height(h);
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
        x={dragPos?.id === id ? dragPos.x : x}
        y={dragPos?.id === id ? dragPos.y : y}
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
        {type === 'rectangle' && (
          <Rect
            ref={shapeRef}
            width={width}
            height={height}
            fill={color}
            cornerRadius={4}
            shadowEnabled={true}
            shadowBlur={frameId ? 6 : 18}
            shadowOffsetX={frameId ? 1 : 4}
            shadowOffsetY={frameId ? 2 : 6}
            shadowOpacity={frameId ? 0.12 : 0.22}
            shadowColor="#000000"
            stroke={isMultiSelected ? '#6366f1' : undefined}
            strokeWidth={isMultiSelected ? 3 : 0}
          />
        )}
        {type === 'circle' && (
          <Ellipse
            ref={shapeRef}
            x={width / 2}
            y={height / 2}
            radiusX={width / 2}
            radiusY={height / 2}
            fill={color}
            shadowEnabled={true}
            shadowBlur={frameId ? 6 : 18}
            shadowOffsetX={frameId ? 1 : 4}
            shadowOffsetY={frameId ? 2 : 6}
            shadowOpacity={frameId ? 0.12 : 0.22}
            shadowColor="#000000"
            stroke={isMultiSelected ? '#6366f1' : undefined}
            strokeWidth={isMultiSelected ? 3 : 0}
          />
        )}
        {type === 'triangle' && (
          <KonvaShape
            ref={shapeRef}
            width={width}
            height={height}
            fill={color}
            shadowEnabled={true}
            shadowBlur={frameId ? 6 : 18}
            shadowOffsetX={frameId ? 1 : 4}
            shadowOffsetY={frameId ? 2 : 6}
            shadowOpacity={frameId ? 0.12 : 0.22}
            shadowColor="#000000"
            stroke={isMultiSelected ? '#6366f1' : undefined}
            strokeWidth={isMultiSelected ? 3 : 0}
            sceneFunc={(ctx, shape) => {
              const w = shape.width();
              const h = shape.height();
              const r = Math.min(6, w / 8, h / 8);
              const p0 = { x: w / 2, y: 0 };
              const p1 = { x: 0, y: h };
              const p2 = { x: w, y: h };
              ctx.beginPath();
              ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
              ctx.arcTo(p1.x, p1.y, p2.x, p2.y, r);
              ctx.arcTo(p2.x, p2.y, p0.x, p0.y, r);
              ctx.arcTo(p0.x, p0.y, p1.x, p1.y, r);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
          />
        )}

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
            fontSize={Math.max(12, Math.min(32, width * 0.14))}
            fill="#ffffff"
            verticalAlign="middle"
            align="center"
            fontFamily="sans-serif"
            lineHeight={1.2}
            onClick={(e) => {
              e.cancelBubble = true;
              onSelect(id);
            }}
            onDblClick={(e) => {
              if (!canEdit) return;
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
                  fontSize: `${Math.max(12, Math.min(32, width * 0.14))}px`,
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
      {isSelected && !isEditing && canEdit && (
        <Transformer
          ref={trRef}
          rotationSnaps={snapToGrid ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          anchorSize={10}
          anchorStrokeWidth={2}
          anchorCornerRadius={2}
          anchorHitStrokeWidth={12}
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
            const rawW = Math.max(5, sizeRef.current.w * scaleX);
            const rawH = Math.max(5, sizeRef.current.h * scaleY);
            const isResize = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;
            let finalX = rawX, finalY = rawY, finalW = rawW, finalH = rawH;
            if (snapToGrid && isResize) {
              const s = (v) => Math.round(v / gridSize) * gridSize;
              finalX = s(rawX); finalY = s(rawY);
              finalW = Math.max(gridSize, s(rawX + rawW) - finalX);
              finalH = Math.max(gridSize, s(rawY + rawH) - finalY);
            }
            sizeRef.current = { w: finalW, h: finalH };
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
}

export const Shape = React.memo(ShapeInner);
