import React, { useState, useEffect, useRef } from 'react';
import Konva from 'konva';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';
import { darkenHex, getContrastColor } from '../utils/colorUtils.js';
import { useObjectAnimationContext } from '../contexts/ObjectAnimationContext.js';

function StickyNoteInner({ id, x, y, width = 200, height = 200, text, color = '#fef08a', rotation = 0, isSelected, isMultiSelected, onSelect, onDragEnd, onTransformEnd, onUpdate, onDelete, onDragMove, snapToGrid = false, gridSize = 50, dragState, dragLayerRef, mainLayerRef, dragPos, frameId, onTypingChange, canEdit = true, pendingTool }) {
  const shapeRef = useRef();
  const textRef = useRef();
  const groupRef = useRef();
  const trRef = useRef();
  const sizeRef = useRef({ w: width, h: height });
  const [isEditing, setIsEditing] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark');
  const animCtx = useObjectAnimationContext();
  const xRef = useRef(x);
  const yRef = useRef(y);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const dragPosRef = useRef(dragPos);
  const prevIsSelectedRef = useRef(isSelected);
  xRef.current = x;
  yRef.current = y;
  widthRef.current = width;
  heightRef.current = height;
  dragPosRef.current = dragPos;

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

  // Spawn / die animations. Re-runs when the registry version bumps.
  useEffect(() => {
    if (!animCtx) return;
    const animState = animCtx.getAnimationState(id);
    const node = groupRef.current;
    if (!node || animState === 'idle') return;

    const w = widthRef.current;
    const h = heightRef.current;
    const dp = dragPosRef.current;
    const baseX = dp?.id === id ? dp.x : xRef.current;
    const baseY = dp?.id === id ? dp.y : yRef.current;

    if (animState === 'spawning') {
      node.opacity(0);
      node.scaleX(0.7);
      node.scaleY(0.7);
      node.offsetX(w / 2);
      node.offsetY(h / 2);
      node.x(baseX + w / 2);
      node.y(baseY + h / 2);
      const tween = new Konva.Tween({
        node,
        duration: 0.2,
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        easing: Konva.Easings.EaseOut,
        onFinish: () => {
          tween.destroy();
          node.offsetX(0);
          node.offsetY(0);
          node.x(dragPosRef.current?.id === id ? dragPosRef.current.x : xRef.current);
          node.y(dragPosRef.current?.id === id ? dragPosRef.current.y : yRef.current);
          animCtx.clearAnimation(id);
        },
      });
      tween.play();
      return () => tween.destroy();
    }

    if (animState === 'dying') {
      const onComplete = animCtx.getOnComplete(id);
      node.offsetX(w / 2);
      node.offsetY(h / 2);
      node.x(baseX + w / 2);
      node.y(baseY + h / 2);
      const tween = new Konva.Tween({
        node,
        duration: 0.15,
        opacity: 0,
        scaleX: 0.7,
        scaleY: 0.7,
        easing: Konva.Easings.EaseIn,
        onFinish: () => {
          tween.destroy();
          onComplete?.();
        },
      });
      tween.play();
      return () => tween.destroy();
    }
  }, [animCtx?.version]);

  useEffect(() => {
    const wasSelected = prevIsSelectedRef.current;
    prevIsSelectedRef.current = isSelected;
    if (!isSelected || wasSelected) return;
    if (document.documentElement.dataset.reducedMotion !== undefined) return;
    const node = groupRef.current;
    if (!node) return;
    if (animCtx) {
      const animState = animCtx.getAnimationState(id);
      if (animState === 'spawning' || animState === 'dying') return;
    }
    const tween1 = new Konva.Tween({
      node,
      duration: 0.08,
      scaleX: 1.04,
      scaleY: 1.04,
      easing: Konva.Easings.EaseOut,
      onFinish: () => {
        tween1.destroy();
        const tween2 = new Konva.Tween({
          node,
          duration: 0.08,
          scaleX: 1,
          scaleY: 1,
          easing: Konva.Easings.EaseIn,
          onFinish: () => tween2.destroy(),
        });
        tween2.play();
      },
    });
    tween1.play();
    return () => tween1.destroy();
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

  const TEXT_SCALE_FACTOR = 0.14;

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
        draggable={canEdit && !isEditing}
        dragDistance={3}
        onClick={(e) => {
          if (pendingTool) return;
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
          if (pendingTool) return;
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
          const finalX = e.target.x();
          const finalY = e.target.y();
          const pos = { x: finalX, y: finalY };
          if (mainLayerRef?.current && groupRef.current) {
            groupRef.current.moveTo(mainLayerRef.current);
            mainLayerRef.current.batchDraw();
          }
          onDragEnd(id, pos);
          if (document.documentElement.dataset.reducedMotion === undefined) {
            const node = groupRef.current;
            if (node) {
              const spring1 = new Konva.Tween({
                node,
                duration: 0.04,
                x: finalX - 3,
                y: finalY - 3,
                easing: Konva.Easings.EaseOut,
                onFinish: () => {
                  spring1.destroy();
                  const spring2 = new Konva.Tween({
                    node,
                    duration: 0.08,
                    x: finalX,
                    y: finalY,
                    easing: Konva.Easings.EaseIn,
                    onFinish: () => spring2.destroy(),
                  });
                  spring2.play();
                },
              });
              spring1.play();
            }
          }
        }}
      >
        <Rect
          ref={shapeRef}
          width={width}
          height={height}
          fill={color}
          shadowEnabled={true}
          shadowBlur={frameId ? 3 : 6}
          shadowOffsetX={0}
          shadowOffsetY={frameId ? 1 : 1}
          shadowOpacity={frameId ? 0.15 : 0.30}
          shadowColor="#000000"
          cornerRadius={12}
          stroke={isSelected ? '#6750A4' : isMultiSelected ? '#6366f1' : darkenHex(color, 0.15)}
          strokeWidth={isSelected ? 2 : isMultiSelected ? 3 : 1}
        />
        {dragState?.draggingId === id && dragState?.illegalDrag && (
          <Rect x={0} y={0} width={width} height={height}
            fill="#ef4444" opacity={0.35} cornerRadius={12}
            listening={false} perfectDrawEnabled={false} />
        )}
        {!isEditing ? (
          <Text
            ref={textRef}
            text={text}
            width={width}
            height={height}
            padding={10}
            fontSize={Math.max(12, Math.min(32, width * TEXT_SCALE_FACTOR))}
            verticalAlign="middle"
            align="center"
            fontFamily="sans-serif"
            lineHeight={1.2}
            fill={getContrastColor(color)}
            onClick={(e) => {
              if (pendingTool) return;
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
              if (pendingTool) return;
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
                onBlur={() => { setIsEditing(false); onTypingChange?.(false); }}
                autoFocus
                rows={1}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  textAlign: 'center',
                  fontSize: `${Math.max(12, Math.min(32, width * TEXT_SCALE_FACTOR))}px`,
                  fontFamily: 'sans-serif',
                  lineHeight: '1.2',
                  padding: '0',
                  margin: '0',
                  pointerEvents: 'auto',
                  color: getContrastColor(color),
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
      {isSelected && !isEditing && canEdit && pendingTool !== 'line' && pendingTool !== 'arrow' && (
        <Transformer
          ref={trRef}
          rotateEnabled={true}
          rotationSnaps={snapToGrid ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
          enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
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
            // Imperatively update children to prevent flash
            if (shapeRef.current) {
              shapeRef.current.width(finalW);
              shapeRef.current.height(finalH);
            }
            if (textRef.current) {
              textRef.current.width(finalW);
              textRef.current.height(finalH);
              textRef.current.fontSize(Math.max(12, Math.min(32, finalW * TEXT_SCALE_FACTOR)));
            }
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

export const StickyNote = React.memo(StickyNoteInner);
