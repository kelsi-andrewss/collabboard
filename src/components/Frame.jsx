import React, { useState, useEffect, useRef } from 'react';
import Konva from 'konva';
import { Rect, Text, Group, Transformer } from 'react-konva';
import { Html } from 'react-konva-utils';
import { useObjectAnimationContext } from '../contexts/ObjectAnimationContext.js';

function FrameInner({ id, x, y, width = 400, height = 300, title = 'Frame', color = '#6366f1', rotation = 0, isSelected, onSelect, onDragEnd, onDragMove, onTransformEnd, onUpdate, onDelete, onResizeClamped, dragState, snapToGrid = false, gridSize = 50, minWidth = 100, minHeight = 80, dragLayerRef, mainLayerRef, dragPos, canEdit = true, onAutoFit, pendingTool, toolHoverFrameId }) {
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
  const animCtx = useObjectAnimationContext();
  const xRef = useRef(x);
  const yRef = useRef(y);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  const dragPosRef = useRef(dragPos);
  xRef.current = x;
  yRef.current = y;
  widthRef.current = width;
  heightRef.current = height;
  dragPosRef.current = dragPos;

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
        {/* Invisible hit area for the title bar only */}
        <Rect
          ref={hitRectRef}
          width={width}
          height={height}
          fill="transparent"
          listening={true}
          onClick={(e) => {
            if (pendingTool) return;
            e.cancelBubble = true;
            onSelect(id);
          }}
          onTap={(e) => {
            if (pendingTool) return;
            e.cancelBubble = true;
            onSelect(id);
          }}
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
        {/* M3 elevation — ambient shadow (wide, soft) */}
        <Rect
          width={width}
          height={height}
          fill="transparent"
          cornerRadius={12}
          listening={false}
          shadowEnabled={true}
          shadowBlur={28}
          shadowOffsetX={0}
          shadowOffsetY={4}
          shadowOpacity={0.14}
          shadowColor="#000000"
        />
        {/* M3 elevation — key shadow (tight, directional) */}
        <Rect
          width={width}
          height={height}
          fill="transparent"
          cornerRadius={12}
          listening={false}
          shadowEnabled={true}
          shadowBlur={8}
          shadowOffsetX={0}
          shadowOffsetY={3}
          shadowOpacity={0.22}
          shadowColor="#000000"
        />
        {/* Translucent background fill — M3 surface at ~8% opacity */}
        <Rect
          ref={bgRectRef}
          width={width}
          height={height}
          fill={color}
          opacity={0.08}
          cornerRadius={12}
          listening={false}
        />
        {/* Frame body border — outline-variant in default state, primary when selected */}
        <Rect
          ref={borderRectRef}
          width={width}
          height={height}
          fill="transparent"
          stroke={isSelected ? '#6750A4' : '#CAC4D0'}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={12}
          opacity={1}
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Title bar — frame color as surface accent */}
        <Rect
          ref={titleBarRef}
          width={width}
          height={titleBarHeight}
          fill={color}
          opacity={1}
          cornerRadius={[12, 12, 0, 0]}
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Divider between title bar and body */}
        <Rect
          x={0}
          y={titleBarHeight}
          width={width}
          height={1}
          fill={color}
          opacity={0.6}
          listening={false}
          perfectDrawEnabled={false}
        />
        {/* Title text — white for contrast on colored title bar */}
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
            fill="#ffffff"
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
                  color: '#ffffff',
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
          const showToolHover = !!(pendingTool && pendingTool !== 'line' && pendingTool !== 'arrow' && toolHoverFrameId === id);
          if (!showIllegal && !showAction && !showToolHover) return null;
          const overlayFill = showIllegal
            ? '#ef4444'
            : (showAction && dragState.action !== 'add')
              ? '#ef4444'
              : '#22c55e';
          const overlayOpacity = showIllegal ? 0.25 : 0.15;
          const symbolText = showIllegal ? null : (showAction ? (dragState.action === 'add' ? '+' : '-') : '+');
          const symbolFill = showIllegal ? null : (showAction && dragState.action !== 'add') ? '#ef4444' : '#22c55e';
          return (
            <>
              <Rect
                width={width}
                height={height}
                fill={overlayFill}
                opacity={overlayOpacity}
                cornerRadius={4}
                listening={false}
                perfectDrawEnabled={false}
              />
              {symbolText && (
                <Text
                  text={symbolText}
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  fontSize={48}
                  fontStyle="bold"
                  fill={symbolFill}
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
      {isSelected && !isEditing && canEdit && pendingTool !== 'line' && pendingTool !== 'arrow' && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
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
