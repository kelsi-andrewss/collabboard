import React, { useState, useEffect, useRef } from 'react';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';

export const StickyNote = ({ id, x, y, width = 150, height = 150, text, color = '#fef08a', rotation = 0, isSelected, onSelect, onDragEnd, onTransformEnd, onUpdate, onDelete, onDragMove, snapToGrid = false, gridSize = 50 }) => {
  const shapeRef = useRef();
  const groupRef = useRef();
  const trRef = useRef();
  const [isEditing, setIsEditing] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark');

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isSelected && trRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

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
        <Rect
          ref={shapeRef}
          width={width}
          height={height}
          fill={color}
          shadowBlur={5}
          shadowOpacity={0.3}
          cornerRadius={2}
          stroke={isSelected ? '#2563eb' : 'transparent'}
          strokeWidth={2}
        />
        {!isEditing ? (
          <Text
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
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 50) return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const node = shapeRef.current;
            const group = groupRef.current;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            const rawX = group.x() + node.x();
            const rawY = group.y() + node.y();
            const rawW = Math.max(50, node.width() * scaleX);
            const rawH = Math.max(50, node.height() * scaleY);
            const s = (v) => snapToGrid ? Math.round(v / gridSize) * gridSize : v;
            const finalX = s(rawX);
            const finalY = s(rawY);
            const finalW = (snapToGrid ? Math.max(gridSize, s(rawX + rawW) - finalX) : rawW) || rawW;
            const finalH = (snapToGrid ? Math.max(gridSize, s(rawY + rawH) - finalY) : rawH) || rawH;
            node.scaleX(1);
            node.scaleY(1);
            node.position({ x: 0, y: 0 });
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
