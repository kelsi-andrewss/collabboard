import React, { useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Shape as KonvaShape, Circle, Line as KonvaLine } from 'react-konva';
import { Frame } from './Frame';
import { StickyNote } from './StickyNote';
import { Shape } from './Shape';
import { LineShape } from './LineShape';
import { TextShape } from './TextShape';
import { Cursors } from './Cursors';
import { FRAME_MARGIN, getLineBounds } from '../utils/frameUtils.js';
import { PORTS, getPortCoords } from '../utils/connectorUtils.js';

const PORT_DISPLAY_RADIUS = 8;
const NEARBY_PORT_DISTANCE = 200;

const GRID_SIZE = 50;
const HEADER_HEIGHT = 60;

export const GRID_CELL_LIMIT = 5000;
export function computeGridDimensions(stagePos, stageScale, windowWidth, windowHeight) {
  const left = -stagePos.x / stageScale;
  const top = -stagePos.y / stageScale;
  const right = left + windowWidth / stageScale;
  const bottom = top + (windowHeight - HEADER_HEIGHT) / stageScale;
  const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
  const cols = Math.ceil((right - startX) / GRID_SIZE) + 1;
  const rows = Math.ceil((bottom - startY) / GRID_SIZE) + 1;
  return { cols, rows };
}

export function multiSelectHit(obj, rect) {
  if (obj.type === 'frame') return false;
  let ox, oy, ow, oh;
  if (obj.type === 'line' || obj.type === 'arrow') {
    const lb = getLineBounds(obj);
    ox = lb.x; oy = lb.y; ow = lb.width; oh = lb.height;
  } else {
    ox = obj.x ?? 0; oy = obj.y ?? 0;
    ow = obj.width ?? 150; oh = obj.height ?? 150;
  }
  return ox + ow >= rect.x && ox <= rect.x + rect.width &&
    oy + oh >= rect.y && oy <= rect.y + rect.height;
}

export function sortObjects(a, b) {
  const aFrame = a.type === 'frame' ? 0 : 1;
  const bFrame = b.type === 'frame' ? 0 : 1;
  if (aFrame !== bFrame) return aFrame - bFrame;
  if (a.type === 'frame' && b.type === 'frame') {
    const aDepth = a.frameId ? 1 : 0;
    const bDepth = b.frameId ? 1 : 0;
    if (aDepth !== bDepth) return aDepth - bDepth;
  }
  return (a.zIndex || 0) - (b.zIndex || 0);
}

export function computeVisibleIds(allObjs, objMap, viewport, selectedId, draggingId) {
  const { vLeft, vTop, vRight, vBottom } = viewport;
  const visibleIds = new Set();
  for (const obj of allObjs) {
    let ox, oy, ow, oh;
    if (obj.type === 'line' || obj.type === 'arrow') {
      const lb = getLineBounds(obj);
      ox = lb.x; oy = lb.y; ow = lb.width; oh = lb.height;
    } else {
      ox = obj.x ?? 0; oy = obj.y ?? 0;
      ow = obj.width ?? 150;
      oh = obj.type === 'text' ? (obj.height ?? 600) : (obj.height ?? 150);
    }
    if (ox + ow >= vLeft && ox <= vRight && oy + oh >= vTop && oy <= vBottom) {
      visibleIds.add(obj.id);
      if (obj.type === 'frame' && obj.childIds) {
        for (const cid of obj.childIds) visibleIds.add(cid);
      }
      if (obj.frameId) {
        let fid = obj.frameId;
        while (fid) {
          visibleIds.add(fid);
          const parent = objMap[fid];
          fid = parent?.frameId || null;
        }
      }
    }
  }
  if (selectedId) visibleIds.add(selectedId);
  if (draggingId) visibleIds.add(draggingId);
  return visibleIds;
}

function BoardCanvasInner({ stageRef, state, handlers }) {
  const mainLayerRef = useRef();
  const dragLayerRef = useRef();
  const inProgressLineRef = useRef(null);
  const {
    selectedId, stagePos, stageScale, darkMode, snapToGrid,
    objects, dragState, presentUsers, currentUserId, dragPos,
    activeTool, selectedIds, canEdit, connectorState, pendingTool,
  } = state;
  const {
    handleMouseMove, handleStageClick, setStagePos, handleWheel,
    handleFrameDragEnd, handleFrameDragMove, handleTransformEnd,
    updateObject, handleDeleteWithCleanup, handleContainedDragEnd,
    handleDragMove, handleResizeClamped, setSelectedId, onContextMenu, onTypingChange,
    setSelectedIds, onPortClick, handleFrameAutoFit,
  } = handlers;

  const [selRect, setSelRect] = useState(null);
  const selStartRef = useRef(null);
  const shiftDragRef = useRef(false);

  const isSelectMode = activeTool === 'select';

  const handleMouseDown = (e) => {
    const isShiftDrag = e.evt.shiftKey;
    if (!isSelectMode && !isShiftDrag) return;
    const target = e.target;
    const stage = target.getStage();
    if (target !== stage && target.name() !== 'bg-rect') return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const canvasX = (pointer.x - stage.x()) / stage.scaleX();
    const canvasY = (pointer.y - stage.y()) / stage.scaleY();
    selStartRef.current = { x: canvasX, y: canvasY };
    shiftDragRef.current = isShiftDrag && !isSelectMode;
    setSelRect({ x: canvasX, y: canvasY, width: 0, height: 0 });
  };

  const connectorStateRef = useRef(connectorState);
  connectorStateRef.current = connectorState;

  const handleMouseMoveWrapped = (e) => {
    handleMouseMove(e);
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const canvasX = (pointer.x - stage.x()) / stage.scaleX();
    const canvasY = (pointer.y - stage.y()) / stage.scaleY();

    if (inProgressLineRef.current && connectorStateRef.current?.active) {
      const cs = connectorStateRef.current;
      inProgressLineRef.current.points([cs.x, cs.y, canvasX, canvasY]);
      const layer = inProgressLineRef.current.getLayer();
      if (layer) layer.batchDraw();
    }

    if (!selStartRef.current || (!isSelectMode && !shiftDragRef.current)) return;
    const start = selStartRef.current;
    setSelRect({
      x: Math.min(start.x, canvasX),
      y: Math.min(start.y, canvasY),
      width: Math.abs(canvasX - start.x),
      height: Math.abs(canvasY - start.y),
    });
  };

  const handleMouseUp = () => {
    if (!selStartRef.current || (!isSelectMode && !shiftDragRef.current)) return;
    const rect = selRect;
    selStartRef.current = null;
    shiftDragRef.current = false;
    setSelRect(null);
    if (!rect || rect.width < 5 || rect.height < 5) return;
    const hit = new Set();
    for (const obj of Object.values(objects)) {
      if (multiSelectHit(obj, rect)) hit.add(obj.id);
    }
    if (setSelectedIds) setSelectedIds(hit);
  };

  const handleStageClickWrapped = (e) => {
    if (e.evt.shiftKey && activeTool === 'select') {
      const target = e.target;
      const stage = target.getStage();
      if (target !== stage && target.name() !== 'bg-rect') {
        const id = target.id() || target.parent?.id();
        if (id && setSelectedIds) {
          const next = new Set(selectedIds);
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
          setSelectedIds(next);
          return;
        }
      }
    }
    handleStageClick(e);
  };

  return (
    <Stage
      ref={stageRef}
      width={window.innerWidth}
      height={window.innerHeight - HEADER_HEIGHT}
      onMouseMove={handleMouseMoveWrapped}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleStageClickWrapped}
      draggable={activeTool === 'pan' && !selectedId}
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
      onContextMenu={(e) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        const pointer = stage.getPointerPosition();
        if (onContextMenu && pointer) {
          const isStageOrBg = e.target === stage || e.target.name() === 'bg-rect';
          onContextMenu({
            screenX: pointer.x,
            screenY: pointer.y + 60,
            canvasX: (pointer.x - stage.x()) / stage.scaleX(),
            canvasY: (pointer.y - stage.y()) / stage.scaleY(),
            targetId: isStageOrBg ? null : e.target.id() || e.target.parent?.id(),
          });
        }
      }}
    >
      <Layer ref={mainLayerRef}>
        <Rect
          name="bg-rect"
          x={-stagePos.x / stageScale}
          y={-stagePos.y / stageScale}
          width={window.innerWidth / stageScale}
          height={(window.innerHeight - HEADER_HEIGHT) / stageScale}
          fill={darkMode ? '#111827' : '#ffffff'}
        />
        {snapToGrid && (() => {
          const left = -stagePos.x / stageScale;
          const top = -stagePos.y / stageScale;
          const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
          const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
          const { cols, rows } = computeGridDimensions(stagePos, stageScale, window.innerWidth, window.innerHeight);
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
          const cy = (window.innerHeight - HEADER_HEIGHT) / 2;
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
          const fontSize = 14;
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
          const tipsY = cy + 52;
          return (
            <>
              <Text
                x={cx - 300}
                y={cy - 20}
                width={600}
                text="Your board is empty"
                fontSize={30}
                fontStyle="bold"
                fontFamily={font}
                fill={boldColor}
                align="center"
                listening={false}
              />
              <Text
                x={cx - 300}
                y={cy + 20}
                width={600}
                text="Pick a tool from the toolbar above to get started"
                fontSize={16}
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
        {(() => {
          const pad = 200;
          const vLeft = -stagePos.x / stageScale - pad;
          const vTop = -stagePos.y / stageScale - pad;
          const vRight = vLeft + window.innerWidth / stageScale + pad * 2;
          const vBottom = vTop + (window.innerHeight - HEADER_HEIGHT) / stageScale + pad * 2;
          const allObjs = Object.values(objects);
          const objMap = objects;
          const visibleIds = computeVisibleIds(allObjs, objMap, { vLeft, vTop, vRight, vBottom }, selectedId, dragState?.draggingId);
          return allObjs
            .filter(obj => visibleIds.has(obj.id));
        })()
          .sort(sortObjects)
          .map((obj) => {
            const isMultiSelected = selectedIds?.has(obj.id);
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
                  canEdit={canEdit}
                  onAutoFit={handleFrameAutoFit}
                />
              );
            }
            if (obj.type === 'sticky') {
              return (
                <StickyNote
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  isMultiSelected={isMultiSelected}
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
                  onTypingChange={onTypingChange}
                  canEdit={canEdit}
                />
              );
            }
            if (obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'triangle') {
              return (
                <Shape
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  isMultiSelected={isMultiSelected}
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
                  canEdit={canEdit}
                />
              );
            }
            if (obj.type === 'line' || obj.type === 'arrow') {
              return (
                <LineShape
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  isMultiSelected={isMultiSelected}
                  onSelect={setSelectedId}
                  onDragEnd={handleContainedDragEnd}
                  onTransformEnd={handleTransformEnd}
                  onDelete={handleDeleteWithCleanup}
                  onDragMove={handleDragMove}
                  onUpdate={updateObject}
                  snapToGrid={snapToGrid}
                  gridSize={GRID_SIZE}
                  dragState={dragState}
                  dragLayerRef={dragLayerRef}
                  mainLayerRef={mainLayerRef}
                  dragPos={dragPos}
                  canEdit={canEdit}
                  objects={objects}
                />
              );
            }
            if (obj.type === 'text') {
              return (
                <TextShape
                  key={obj.id}
                  {...obj}
                  isSelected={obj.id === selectedId}
                  isMultiSelected={isMultiSelected}
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
                  onTypingChange={onTypingChange}
                  canEdit={canEdit}
                />
              );
            }
            return null;
          })}
        {(() => {
          const isConnectorTool = pendingTool === 'line' || pendingTool === 'arrow';
          const selectedObj = selectedId ? objects[selectedId] : null;
          const isLineSelected = selectedObj && (selectedObj.type === 'line' || selectedObj.type === 'arrow');

          if (!isConnectorTool && !isLineSelected) return null;

          const portTargets = [];

          if (isConnectorTool) {
            for (const obj of Object.values(objects)) {
              if (obj.type === 'line' || obj.type === 'arrow' || obj.type === 'frame') continue;
              portTargets.push(obj);
            }
          } else if (isLineSelected) {
            const pts = selectedObj.points || [0, 0, 200, 0];
            const ep1x = selectedObj.x + pts[0];
            const ep1y = selectedObj.y + pts[1];
            const ep2x = selectedObj.x + pts[pts.length - 2];
            const ep2y = selectedObj.y + pts[pts.length - 1];
            for (const obj of Object.values(objects)) {
              if (obj.id === selectedId) continue;
              if (obj.type === 'line' || obj.type === 'arrow' || obj.type === 'frame') continue;
              const cx = (obj.x ?? 0) + (obj.width ?? 150) / 2;
              const cy = (obj.y ?? 0) + (obj.height ?? 150) / 2;
              const d1 = Math.sqrt((cx - ep1x) ** 2 + (cy - ep1y) ** 2);
              const d2 = Math.sqrt((cx - ep2x) ** 2 + (cy - ep2y) ** 2);
              if (d1 < NEARBY_PORT_DISTANCE || d2 < NEARBY_PORT_DISTANCE) {
                portTargets.push(obj);
              }
            }
          }

          const portRadius = PORT_DISPLAY_RADIUS / stageScale;
          const strokeW = 1.5 / stageScale;
          const circles = [];
          for (const obj of portTargets) {
            for (const port of PORTS) {
              const p = getPortCoords(obj, port);
              const key = `${obj.id}-${port}`;
              circles.push(
                <Circle
                  key={key}
                  x={p.x}
                  y={p.y}
                  radius={portRadius}
                  fill="rgba(99,102,241,0.15)"
                  stroke="#6366f1"
                  strokeWidth={strokeW}
                  listening={isConnectorTool && !!onPortClick}
                  perfectDrawEnabled={false}
                  onClick={isConnectorTool && onPortClick ? (e) => {
                    e.cancelBubble = true;
                    onPortClick({ objectId: obj.id, port, x: p.x, y: p.y });
                  } : undefined}
                  onTap={isConnectorTool && onPortClick ? (e) => {
                    e.cancelBubble = true;
                    onPortClick({ objectId: obj.id, port, x: p.x, y: p.y });
                  } : undefined}
                />
              );
            }
          }
          return circles;
        })()}
        {connectorState?.active && (
          <KonvaLine
            ref={inProgressLineRef}
            points={[connectorState.x, connectorState.y, connectorState.x, connectorState.y]}
            stroke="#6366f1"
            strokeWidth={2 / stageScale}
            dash={[8 / stageScale, 4 / stageScale]}
            lineCap="round"
            listening={false}
            perfectDrawEnabled={false}
          />
        )}
        {selRect && (
          <Rect
            x={selRect.x}
            y={selRect.y}
            width={selRect.width}
            height={selRect.height}
            fill="rgba(99, 102, 241, 0.1)"
            stroke="#6366f1"
            strokeWidth={1 / stageScale}
            dash={[6 / stageScale, 3 / stageScale]}
            listening={false}
          />
        )}
        <Cursors presentUsers={presentUsers} userId={currentUserId} />
      </Layer>
      <Layer ref={dragLayerRef} />
    </Stage>
  );
}

export function areEqual(prev, next) {
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
    ps.dragPos?.y === ns.dragPos?.y &&
    ps.activeTool === ns.activeTool &&
    ps.selectedIds === ns.selectedIds &&
    ps.canEdit === ns.canEdit &&
    ps.connectorState === ns.connectorState &&
    ps.pendingTool === ns.pendingTool
  );
}

export const BoardCanvas = React.memo(BoardCanvasInner, areEqual);
