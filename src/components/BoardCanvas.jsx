import React, { useRef } from 'react';
import { Stage, Layer, Rect, Text, Shape as KonvaShape } from 'react-konva';
import { Frame } from './Frame';
import { StickyNote } from './StickyNote';
import { Shape } from './Shape';
import { LineShape } from './LineShape';
import { Cursors } from './Cursors';
import { FRAME_MARGIN } from '../utils/frameUtils.js';

const GRID_SIZE = 50;

function BoardCanvasInner({ stageRef, state, handlers }) {
  const mainLayerRef = useRef();
  const dragLayerRef = useRef();
  const {
    selectedId, stagePos, stageScale, darkMode, snapToGrid,
    objects, dragState, dragStateRef, presentUsers, currentUserId, dragPos,
  } = state;
  const {
    handleMouseMove, handleStageClick, setStagePos, handleWheel,
    handleFrameDragEnd, handleFrameDragMove, handleTransformEnd,
    updateObject, handleDeleteWithCleanup, handleContainedDragEnd,
    handleDragMove, handleResizeClamped, setSelectedId,
  } = handlers;

  return (
    <Stage
      ref={stageRef}
      width={window.innerWidth}
      height={window.innerHeight - 50}
      onMouseMove={handleMouseMove}
      onClick={handleStageClick}
      draggable={!selectedId}
      x={stagePos.x}
      y={stagePos.y}
      scaleX={stageScale}
      scaleY={stageScale}
      onDragEnd={(e) => {
        if (e.target === e.target.getStage()) {
          setStagePos({
            x: e.target.x(),
            y: e.target.y(),
          });
        }
      }}
      onWheel={handleWheel}
    >
      <Layer ref={mainLayerRef}>
        <Rect
          name="bg-rect"
          x={-stagePos.x / stageScale}
          y={-stagePos.y / stageScale}
          width={window.innerWidth / stageScale}
          height={(window.innerHeight - 50) / stageScale}
          fill={darkMode ? '#111827' : '#ffffff'}
        />
        {snapToGrid && (() => {
          const left = -stagePos.x / stageScale;
          const top = -stagePos.y / stageScale;
          const right = left + window.innerWidth / stageScale;
          const bottom = top + (window.innerHeight - 50) / stageScale;
          const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
          const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
          const cols = Math.ceil((right - startX) / GRID_SIZE) + 1;
          const rows = Math.ceil((bottom - startY) / GRID_SIZE) + 1;
          const fill = darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
          const dotSize = 2 / stageScale;
          return (
            <KonvaShape
              listening={false}
              perfectDrawEnabled={false}
              sceneFunc={(ctx) => {
                ctx.fillStyle = fill;
                const r = dotSize / 2;
                for (let xi = 0; xi < cols; xi++) {
                  for (let yi = 0; yi < rows; yi++) {
                    const px = startX + xi * GRID_SIZE;
                    const py = startY + yi * GRID_SIZE;
                    ctx.beginPath();
                    ctx.arc(px, py, r, 0, Math.PI * 2);
                    ctx.fill();
                  }
                }
              }}
            />
          );
        })()}
        {Object.keys(objects).length === 0 && (() => {
          const cx = window.innerWidth / 2;
          const cy = (window.innerHeight - 50) / 2;
          const boldColor = darkMode ? '#d1d5db' : '#374151';
          const textColor = darkMode ? '#9ca3af' : '#6b7280';
          const dimColor = darkMode ? '#6b7280' : '#9ca3af';
          const font = 'system-ui, sans-serif';
          const tips = [
            { key: 'Drag', desc: ' to pan' },
            { key: 'Scroll', desc: ' to zoom' },
            { key: 'Click', desc: ' to select' },
          ];
          const mc = document.createElement('canvas').getContext('2d');
          const fontSize = 13;
          const segments = tips.map(tip => {
            mc.font = `bold ${fontSize}px ${font}`;
            const boldW = mc.measureText(tip.key).width;
            mc.font = `${fontSize}px ${font}`;
            const normalW = mc.measureText(tip.desc).width;
            mc.font = `${fontSize}px ${font}`;
            const sepW = mc.measureText('  ·  ').width;
            return { ...tip, boldW, normalW, sepW };
          });
          const totalLineW = segments.reduce((sum, s, i) =>
            sum + s.boldW + s.normalW + (i < segments.length - 1 ? s.sepW : 0), 0);
          let curX = cx - totalLineW / 2;
          const tipsY = cy + 38;
          return (
            <>
              <Text
                x={cx - 260}
                y={cy - 20}
                width={520}
                text="Your board is empty"
                fontSize={22}
                fontStyle="bold"
                fontFamily={font}
                fill={boldColor}
                align="center"
                listening={false}
              />
              <Text
                x={cx - 260}
                y={cy + 14}
                width={520}
                text="Pick a tool from the toolbar above to get started"
                fontSize={14}
                fontFamily={font}
                fill={textColor}
                align="center"
                listening={false}
              />
              {segments.map((s, i) => {
                const boldX = curX;
                const normalX = curX + s.boldW;
                const sepX = normalX + s.normalW;
                curX = sepX + s.sepW;
                return [
                  <Text key={`b${i}`} x={boldX} y={tipsY} text={s.key} fontSize={fontSize} fontStyle="bold" fontFamily={font} fill={boldColor} listening={false} />,
                  <Text key={`n${i}`} x={normalX} y={tipsY} text={s.desc} fontSize={fontSize} fontFamily={font} fill={dimColor} listening={false} />,
                  i < segments.length - 1 && <Text key={`sep${i}`} x={sepX} y={tipsY} text="  ·  " fontSize={fontSize} fontFamily={font} fill={dimColor} listening={false} />,
                ];
              })}
            </>
          );
        })()}
        {Object.values(objects)
          .sort((a, b) => {
            const aFrame = a.type === 'frame' ? 0 : 1;
            const bFrame = b.type === 'frame' ? 0 : 1;
            if (aFrame !== bFrame) return aFrame - bFrame;
            if (a.type === 'frame' && b.type === 'frame') {
              const aDepth = a.frameId ? 1 : 0;
              const bDepth = b.frameId ? 1 : 0;
              if (aDepth !== bDepth) return aDepth - bDepth;
            }
            return (a.zIndex || 0) - (b.zIndex || 0);
          })
          .map((obj) => {
            if (obj.type === 'frame') {
              const frameChildren = Object.values(objects).filter(o => o.frameId === obj.id);
              let frameMinW = 100;
              let frameMinH = 80;
              for (const child of frameChildren) {
                const cr = (child.x - obj.x) + (child.width || 150) + FRAME_MARGIN;
                const cb = (child.y - obj.y) + (child.height || 150) + FRAME_MARGIN;
                if (cr > frameMinW) frameMinW = cr;
                if (cb > frameMinH) frameMinH = cb;
              }
              return (
                <Frame
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  onSelect={setSelectedId}
                  onDragEnd={handleFrameDragEnd}
                  onDragMove={handleFrameDragMove}
                  onTransformEnd={handleTransformEnd}
                  onUpdate={updateObject}
                  onDelete={handleDeleteWithCleanup}
                  dragState={dragState}
                  snapToGrid={snapToGrid}
                  gridSize={GRID_SIZE}
                  minWidth={frameMinW}
                  minHeight={frameMinH}
                  onResizeClamped={handleResizeClamped}
                  dragLayerRef={dragLayerRef}
                  mainLayerRef={mainLayerRef}
                  dragPos={dragPos}
                />
              );
            }
            if (obj.type === 'sticky') {
              return (
                <StickyNote
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  onSelect={setSelectedId}
                  onDragEnd={handleContainedDragEnd}
                  onTransformEnd={handleTransformEnd}
                  onUpdate={updateObject}
                  onDelete={handleDeleteWithCleanup}
                  onDragMove={handleDragMove}
                  snapToGrid={snapToGrid}
                  gridSize={GRID_SIZE}
                  dragState={dragState}
                  dragLayerRef={dragLayerRef}
                  mainLayerRef={mainLayerRef}
                  dragPos={dragPos}
                />
              );
            }
            if (obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'triangle') {
              return (
                <Shape
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  onSelect={setSelectedId}
                  onDragEnd={handleContainedDragEnd}
                  onTransformEnd={handleTransformEnd}
                  onUpdate={updateObject}
                  onDelete={handleDeleteWithCleanup}
                  onDragMove={handleDragMove}
                  snapToGrid={snapToGrid}
                  gridSize={GRID_SIZE}
                  dragState={dragState}
                  dragLayerRef={dragLayerRef}
                  mainLayerRef={mainLayerRef}
                  dragPos={dragPos}
                />
              );
            }
            if (obj.type === 'line') {
              return (
                <LineShape
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  onSelect={setSelectedId}
                  onDragEnd={handleContainedDragEnd}
                  onTransformEnd={handleTransformEnd}
                  onDelete={handleDeleteWithCleanup}
                  onDragMove={handleDragMove}
                  snapToGrid={snapToGrid}
                  gridSize={GRID_SIZE}
                  dragState={dragState}
                  dragLayerRef={dragLayerRef}
                  mainLayerRef={mainLayerRef}
                  dragPos={dragPos}
                />
              );
            }
            return null;
          })}
        <Cursors presentUsers={presentUsers} userId={currentUserId} />
      </Layer>
      <Layer ref={dragLayerRef} />
    </Stage>
  );
}

function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.objects === ns.objects &&
    ps.presentUsers === ns.presentUsers &&
    ps.selectedId === ns.selectedId &&
    ps.stagePos === ns.stagePos &&
    ps.stageScale === ns.stageScale &&
    ps.darkMode === ns.darkMode &&
    ps.snapToGrid === ns.snapToGrid &&
    ps.currentUserId === ns.currentUserId &&
    ps.dragState?.overFrameId === ns.dragState?.overFrameId &&
    ps.dragState?.action === ns.dragState?.action &&
    ps.dragState?.draggingId === ns.dragState?.draggingId &&
    ps.dragState?.illegalDrag === ns.dragState?.illegalDrag &&
    ps.dragPos?.id === ns.dragPos?.id &&
    ps.dragPos?.x === ns.dragPos?.x &&
    ps.dragPos?.y === ns.dragPos?.y
  );
}

export const BoardCanvas = React.memo(BoardCanvasInner, areEqual);
