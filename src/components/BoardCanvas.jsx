import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Group, Shape as KonvaShape, Circle, Line, Arrow, RegularPolygon } from 'react-konva';
import { Frame } from './Frame';
import { StickyNote } from './StickyNote';
import { Shape } from './Shape';
import { LineShape } from './LineShape';
import { TextShape } from './TextShape';
import { Cursors } from './Cursors';
import { FRAME_MARGIN, getLineBounds, findFrameAtPoint } from '../utils/frameUtils.js';
import { PORTS, getPortCoords, findSnapTarget } from '../utils/connectorUtils.js';

const PORT_DISPLAY_RADIUS = 8;

const cssVarCache = {};
let cssVarObserver = null;

function initCSSVarObserver() {
  if (cssVarObserver) return;
  cssVarObserver = new MutationObserver(() => {
    const style = getComputedStyle(document.documentElement);
    for (const name of Object.keys(cssVarCache)) {
      cssVarCache[name] = style.getPropertyValue(name).trim();
    }
  });
  cssVarObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-theme-color'],
  });
}

function getCSSVar(name) {
  if (name in cssVarCache) return cssVarCache[name];
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  cssVarCache[name] = val;
  initCSSVarObserver();
  return val;
}

const OFFSCREEN = -99999;

function ConnectorGhostLayer({ stageScale, layerRef, connectorFirstPoint, ghostLineRef, tooltipGroupRef }) {
  const strokeW = 1.5 / stageScale;
  const dashLen = 8 / stageScale;
  const dashGap = 4 / stageScale;
  const ghostOpacity = 0.45;

  const isDrawing = connectorFirstPoint !== null;

  return (
    <Layer ref={layerRef} listening={false}>
      {isDrawing && (
        <Circle
          x={connectorFirstPoint.x}
          y={connectorFirstPoint.y}
          radius={6 / stageScale}
          fill="#6366f1"
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      {isDrawing ? (
        <Line
          ref={ghostLineRef}
          x={connectorFirstPoint.x}
          y={connectorFirstPoint.y}
          points={[0, 0, 0, 0]}
          stroke="#6366f1"
          strokeWidth={strokeW * 2}
          dash={[dashLen, dashGap]}
          opacity={ghostOpacity}
          listening={false}
          perfectDrawEnabled={false}
        />
      ) : (
        <Line
          ref={ghostLineRef}
          points={[0, 0, 0, 0]}
          x={OFFSCREEN}
          y={OFFSCREEN}
          stroke="#6366f1"
          strokeWidth={strokeW * 2}
          dash={[dashLen, dashGap]}
          opacity={0}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}
      <Group ref={tooltipGroupRef} x={OFFSCREEN} y={OFFSCREEN} listening={false}>
        <Text
          x={8 / stageScale}
          y={8 / stageScale}
          text={isDrawing ? 'Press Esc to cancel' : 'Press Esc to exit'}
          fontSize={12 / stageScale}
          fontFamily="sans-serif"
          fill="#6366f1"
          opacity={0.7}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
    </Layer>
  );
}

function GhostLayer({ pendingTool, stageScale, layerRef, nodeRef }) {
  const strokeW = 1.5 / stageScale;
  const dashLen = 6 / stageScale;
  const dashGap = 3 / stageScale;
  const ghostOpacity = 0.45;

  if (pendingTool === 'frame') {
    const fw = Math.round(window.innerWidth * 0.55 / stageScale);
    const fh = Math.round((window.innerHeight - 60) * 0.55 / stageScale);
    return (
      <Layer ref={layerRef}>
        <Group ref={nodeRef} x={OFFSCREEN} y={OFFSCREEN} opacity={ghostOpacity} listening={false}>
          <Rect
            width={fw}
            height={fh}
            fill="rgba(99,102,241,0.06)"
            stroke="#6366f1"
            strokeWidth={strokeW}
            dash={[dashLen, dashGap]}
            perfectDrawEnabled={false}
          />
          <Text
            x={0}
            y={fh + 4 / stageScale}
            text="Press Esc to cancel"
            fontSize={12 / stageScale}
            fontFamily="sans-serif"
            fill="#6366f1"
            opacity={0.7}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      </Layer>
    );
  }

  if (pendingTool === 'sticky') {
    const sw = 200 / stageScale;
    return (
      <Layer ref={layerRef}>
        <Group ref={nodeRef} x={OFFSCREEN} y={OFFSCREEN} opacity={ghostOpacity} listening={false}>
          <Rect
            width={sw}
            height={sw}
            fill="rgba(250,204,21,0.25)"
            stroke="rgba(250,204,21,0.8)"
            strokeWidth={strokeW}
            dash={[dashLen, dashGap]}
            cornerRadius={4 / stageScale}
            perfectDrawEnabled={false}
          />
          <Text
            x={0}
            y={sw + 4 / stageScale}
            text="Press Esc to cancel"
            fontSize={12 / stageScale}
            fontFamily="sans-serif"
            fill="#6366f1"
            opacity={0.7}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      </Layer>
    );
  }

  if (pendingTool === 'text') {
    const tw = 200 / stageScale;
    const th = 40 / stageScale;
    const fontSize = 16 / stageScale;
    return (
      <Layer ref={layerRef}>
        <Group ref={nodeRef} x={OFFSCREEN} y={OFFSCREEN} opacity={ghostOpacity} listening={false}>
          <Rect
            width={tw}
            height={th}
            fill="transparent"
            stroke="#6366f1"
            strokeWidth={strokeW}
            dash={[dashLen, dashGap]}
            perfectDrawEnabled={false}
          />
          <Text
            y={th * 0.15}
            width={tw}
            text="Type something..."
            fontSize={fontSize}
            fontFamily="sans-serif"
            fill="#6366f1"
            opacity={0.8}
            perfectDrawEnabled={false}
          />
          <Text
            x={0}
            y={th + 4 / stageScale}
            text="Press Esc to cancel"
            fontSize={12 / stageScale}
            fontFamily="sans-serif"
            fill="#6366f1"
            opacity={0.7}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      </Layer>
    );
  }

  if (pendingTool === 'rectangle') {
    const sz = 100 / stageScale;
    return (
      <Layer ref={layerRef}>
        <Group ref={nodeRef} x={OFFSCREEN} y={OFFSCREEN} opacity={ghostOpacity} listening={false}>
          <Rect
            width={sz}
            height={sz}
            fill="rgba(99,102,241,0.08)"
            stroke="#6366f1"
            strokeWidth={strokeW}
            dash={[dashLen, dashGap]}
            perfectDrawEnabled={false}
          />
          <Text
            x={0}
            y={sz + 4 / stageScale}
            text="Press Esc to cancel"
            fontSize={12 / stageScale}
            fontFamily="sans-serif"
            fill="#6366f1"
            opacity={0.7}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      </Layer>
    );
  }

  if (pendingTool === 'circle') {
    const r = 50 / stageScale;
    return (
      <Layer ref={layerRef}>
        <Group ref={nodeRef} x={OFFSCREEN} y={OFFSCREEN} opacity={ghostOpacity} listening={false}>
          <Circle
            x={r}
            y={r}
            radius={r}
            fill="rgba(99,102,241,0.08)"
            stroke="#6366f1"
            strokeWidth={strokeW}
            dash={[dashLen, dashGap]}
            perfectDrawEnabled={false}
          />
          <Text
            x={0}
            y={r * 2 + 4 / stageScale}
            text="Press Esc to cancel"
            fontSize={12 / stageScale}
            fontFamily="sans-serif"
            fill="#6366f1"
            opacity={0.7}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      </Layer>
    );
  }

  if (pendingTool === 'triangle') {
    const r = 58 / stageScale;
    return (
      <Layer ref={layerRef}>
        <Group ref={nodeRef} x={OFFSCREEN} y={OFFSCREEN} opacity={ghostOpacity} listening={false}>
          <RegularPolygon
            x={r}
            y={r}
            sides={3}
            radius={r}
            fill="rgba(99,102,241,0.08)"
            stroke="#6366f1"
            strokeWidth={strokeW}
            dash={[dashLen, dashGap]}
            perfectDrawEnabled={false}
          />
          <Text
            x={0}
            y={r * 2 + 4 / stageScale}
            text="Press Esc to cancel"
            fontSize={12 / stageScale}
            fontFamily="sans-serif"
            fill="#6366f1"
            opacity={0.7}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      </Layer>
    );
  }

  return (
    <Layer ref={layerRef}>
      <Group ref={nodeRef} x={OFFSCREEN} y={OFFSCREEN} opacity={ghostOpacity} listening={false}>
        <Rect
          width={100}
          height={100}
          fill="rgba(99,102,241,0.08)"
          stroke="#6366f1"
          strokeWidth={strokeW}
          dash={[dashLen, dashGap]}
          perfectDrawEnabled={false}
        />
        <Text
          x={0}
          y={100 + 4 / stageScale}
          text="Press Esc to cancel"
          fontSize={12 / stageScale}
          fontFamily="sans-serif"
          fill="#6366f1"
          opacity={0.7}
          listening={false}
          perfectDrawEnabled={false}
        />
      </Group>
    </Layer>
  );
}

const GRID_SIZE = 50;
const HEADER_HEIGHT = 0;

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

export function buildRenderOrder(objects) {
  const objArr = Object.values(objects);

  const rootFrames = objArr
    .filter(o => o.type === 'frame' && !o.frameId)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  const childFrames = {};
  for (const o of objArr) {
    if (o.type === 'frame' && o.frameId) {
      (childFrames[o.frameId] ||= []).push(o);
    }
  }

  const nonFramesByParent = {};
  for (const o of objArr) {
    if (o.type !== 'frame') {
      const key = o.frameId || '__root__';
      (nonFramesByParent[key] ||= []).push(o);
    }
  }
  for (const arr of Object.values(nonFramesByParent)) {
    arr.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }

  const result = [];

  function visitFrame(frame) {
    result.push(frame);
    const nested = (childFrames[frame.id] || [])
      .slice()
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    for (const nf of nested) {
      visitFrame(nf);
    }
    for (const child of (nonFramesByParent[frame.id] || [])) {
      result.push(child);
    }
  }

  for (const frame of rootFrames) {
    visitFrame(frame);
  }

  for (const obj of (nonFramesByParent['__root__'] || [])) {
    result.push(obj);
  }

  return result;
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
  const ghostLayerRef = useRef();
  const ghostNodeRef = useRef();
  const connectorGhostLayerRef = useRef();
  const ghostLineKonvaRef = useRef();
  const tooltipGroupKonvaRef = useRef();
  const hoveredSnapTargetRef = useRef(null);
  const portCircleRefsRef = useRef({});
  const objectsRef = useRef({});
  const connectorFirstPointRef = useRef(null);
  const stageScaleRef = useRef(1);
  const isMiddlePanningRef = useRef(false);
  const middlePanStartRef = useRef({ clientX: 0, clientY: 0 });
  const middlePanStagePosRef = useRef({ x: 0, y: 0 });
  const [shiftHeld, setShiftHeld] = useState(false);
  const pendingShiftSelectRef = useRef(null);
  const selectedIdsRef = useRef(null);
  const {
    selectedId, stagePos, stageScale, darkMode, snapToGrid,
    objects, dragState, presentUsers, currentUserId, dragPos,
    activeTool, selectedIds, canEdit, pendingTool, connectorFirstPoint,
    onFollowUser,
  } = state;

  objectsRef.current = objects;
  connectorFirstPointRef.current = connectorFirstPoint;
  stageScaleRef.current = stageScale;

  // B2: Prime cache on mount so first render never calls getComputedStyle inline
  useEffect(() => {
    getCSSVar('--md-sys-color-surface');
    getCSSVar('--md-sys-color-outline-variant');
  }, []);

  // B3: Pre-compute frameChildMap in a single O(n) pass keyed on objects identity
  const frameChildMap = useMemo(() => {
    const map = {};
    for (const obj of Object.values(objects)) {
      if (obj.frameId) {
        (map[obj.frameId] ||= []).push(obj);
      }
    }
    return map;
  }, [objects]);

  // B1: Memoize viewport bounds, buildRenderOrder, and computeVisibleIds
  const pad = 200;
  const viewport = useMemo(() => ({
    vLeft: -stagePos.x / stageScale - pad,
    vTop: -stagePos.y / stageScale - pad,
    vRight: -stagePos.x / stageScale - pad + window.innerWidth / stageScale + pad * 2,
    vBottom: -stagePos.y / stageScale - pad + (window.innerHeight - HEADER_HEIGHT) / stageScale + pad * 2,
  }), [stagePos, stageScale]);

  const renderOrder = useMemo(() => buildRenderOrder(objects), [objects]);

  const visibleIds = useMemo(
    () => computeVisibleIds(renderOrder, objects, viewport, selectedId, dragState?.draggingId),
    [renderOrder, objects, viewport, selectedId, dragState?.draggingId]
  );

  const visibleRenderOrder = useMemo(
    () => renderOrder.filter(obj => visibleIds.has(obj.id)),
    [renderOrder, visibleIds]
  );

  // B6: Suppress shadows at scale or when object count is high
  const shadowsEnabled = stageScale >= 0.4 && Object.keys(objects).length <= 150;
  const {
    handleMouseMove, handleStageClick, setStagePos, handleWheel,
    handleFrameDragEnd, handleFrameDragMove, handleTransformEnd,
    updateObject, handleDeleteWithCleanup, handleContainedDragEnd,
    handleDragMove, handleResizeClamped, setSelectedId, onContextMenu, onTypingChange,
    setSelectedIds, handleFrameAutoFit,
  } = handlers;

  const [selRect, setSelRect] = useState(null);
  const selRectRef = useRef(null);
  const [toolHoverFrameId, setToolHoverFrameId] = useState(null);
  const selStartRef = useRef(null);
  const shiftDragRef = useRef(false);

  const isSelectMode = activeTool === 'select';

  React.useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const flushPendingShiftSelect = () => {
    const pendingId = pendingShiftSelectRef.current;
    if (!pendingId) return;
    pendingShiftSelectRef.current = null;
    if (setSelectedIds) {
      const next = new Set(selectedIdsRef.current);
      if (next.has(pendingId)) {
        next.delete(pendingId);
      } else {
        next.add(pendingId);
      }
      setSelectedIds(next);
    }
  };

  React.useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Shift') setShiftHeld(true); };
    const onKeyUp = (e) => {
      if (e.key === 'Shift') {
        setShiftHeld(false);
        flushPendingShiftSelect();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleMouseDown = (e) => {
    if (e.evt.button === 1) {
      e.evt.preventDefault();
      isMiddlePanningRef.current = true;
      middlePanStartRef.current = { clientX: e.evt.clientX, clientY: e.evt.clientY };
      middlePanStagePosRef.current = { x: stagePos.x, y: stagePos.y };
      return;
    }
    const isShiftDrag = e.evt.shiftKey && !pendingTool;
    if (!isSelectMode && !isShiftDrag) return;
    const target = e.target;
    const stage = target.getStage();
    if (e.evt.shiftKey && target !== stage && target.name() !== 'bg-rect') {
      const id = target.id() || target.parent?.id();
      if (id) {
        pendingShiftSelectRef.current = id;
      }
      return;
    }
    if (!e.evt.shiftKey) {
      pendingShiftSelectRef.current = null;
    }
    if (target !== stage && target.name() !== 'bg-rect') return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const canvasX = (pointer.x - stage.x()) / stage.scaleX();
    const canvasY = (pointer.y - stage.y()) / stage.scaleY();
    selStartRef.current = { x: canvasX, y: canvasY };
    shiftDragRef.current = isShiftDrag && !isSelectMode;
    const initRect = { x: canvasX, y: canvasY, width: 0, height: 0 };
    selRectRef.current = initRect;
    setSelRect(initRect);
  };

  const handleMouseMoveWrapped = (e) => {
    if (isMiddlePanningRef.current) {
      const dx = e.evt.clientX - middlePanStartRef.current.clientX;
      const dy = e.evt.clientY - middlePanStartRef.current.clientY;
      const newPos = {
        x: middlePanStagePosRef.current.x + dx,
        y: middlePanStagePosRef.current.y + dy,
      };
      const stage = e.target.getStage();
      stage.position(newPos);
      stage.batchDraw();
      setStagePos(newPos);
      return;
    }
    handleMouseMove(e);
    const stage = e.target.getStage();
    const pos = stage.getRelativePointerPosition();
    if (!pos) return;
    const canvasX = pos.x;
    const canvasY = pos.y;

    const tool = pendingTool;
    const isConnectorTool = tool === 'line' || tool === 'arrow';

    if (isConnectorTool) {
      const objs = objectsRef.current;
      const snapTarget = findSnapTarget(canvasX, canvasY, objs, new Set());
      const prevSnap = hoveredSnapTargetRef.current;
      const snapChanged = (
        prevSnap?.objectId !== snapTarget?.objectId ||
        prevSnap?.port !== snapTarget?.port
      );

      if (snapChanged) {
        if (prevSnap) {
          const key = `${prevSnap.objectId}-${prevSnap.port}`;
          const circleNode = portCircleRefsRef.current[key];
          if (circleNode) {
            circleNode.fill('rgba(99,102,241,0.15)');
          }
        }
        if (snapTarget) {
          const key = `${snapTarget.objectId}-${snapTarget.port}`;
          const circleNode = portCircleRefsRef.current[key];
          if (circleNode) {
            circleNode.fill('rgba(99,102,241,0.6)');
          }
        }
        hoveredSnapTargetRef.current = snapTarget;
        mainLayerRef.current?.batchDraw();
      }

      const fp = connectorFirstPointRef.current;
      if (fp !== null && ghostLineKonvaRef.current) {
        const endX = snapTarget ? snapTarget.x : canvasX;
        const endY = snapTarget ? snapTarget.y : canvasY;
        ghostLineKonvaRef.current.points([0, 0, endX - fp.x, endY - fp.y]);
        if (tooltipGroupKonvaRef.current) {
          tooltipGroupKonvaRef.current.x(canvasX);
          tooltipGroupKonvaRef.current.y(canvasY);
        }
        connectorGhostLayerRef.current?.batchDraw();
      } else if (fp === null && tooltipGroupKonvaRef.current) {
        tooltipGroupKonvaRef.current.x(canvasX);
        tooltipGroupKonvaRef.current.y(canvasY);
        connectorGhostLayerRef.current?.batchDraw();
      }
    } else if (ghostNodeRef.current) {
      const node = ghostNodeRef.current;
      if (tool === 'sticky') {
        node.x(canvasX - 100 / stageScale);
        node.y(canvasY - 100 / stageScale);
      } else if (tool === 'text') {
        node.x(canvasX);
        node.y(canvasY);
      } else if (tool === 'frame') {
        const scale = stageScaleRef.current;
        const fw = Math.round(window.innerWidth * 0.55 / scale);
        const fh = Math.round((window.innerHeight - 60) * 0.55 / scale);
        node.x(canvasX - fw / 2);
        node.y(canvasY - fh / 2);
      } else if (tool === 'rectangle') {
        const half = 50 / stageScaleRef.current;
        node.x(canvasX - half);
        node.y(canvasY - half);
      } else if (tool === 'circle') {
        const r = 50 / stageScaleRef.current;
        node.x(canvasX - r);
        node.y(canvasY - r);
      } else if (tool === 'triangle') {
        const r = 58 / stageScaleRef.current;
        node.x(canvasX - r);
        node.y(canvasY - r);
      } else {
        node.x(canvasX - 50);
        node.y(canvasY - 50);
      }
      ghostLayerRef.current?.batchDraw();
    }

    if (pendingTool && pendingTool !== 'line' && pendingTool !== 'arrow' && pendingTool !== 'frame') {
      const overFrame = findFrameAtPoint(canvasX, canvasY, objectsRef.current);
      setToolHoverFrameId(overFrame ? overFrame.id : null);
    } else {
      setToolHoverFrameId(null);
    }

    if (!selStartRef.current || (!isSelectMode && !shiftDragRef.current)) return;
    const start = selStartRef.current;
    const updatedRect = {
      x: Math.min(start.x, canvasX),
      y: Math.min(start.y, canvasY),
      width: Math.abs(canvasX - start.x),
      height: Math.abs(canvasY - start.y),
    };
    selRectRef.current = updatedRect;
    setSelRect(updatedRect);
  };

  const handleMouseUp = (e) => {
    if (e.evt.button === 1) {
      isMiddlePanningRef.current = false;
      return;
    }
    flushPendingShiftSelect();
    if (!selStartRef.current || (!isSelectMode && !shiftDragRef.current)) return;
    const rect = selRectRef.current;
    const wasShiftDrag = shiftDragRef.current;
    selStartRef.current = null;
    shiftDragRef.current = false;
    selRectRef.current = null;
    setSelRect(null);
    if (!rect || rect.width < 5 || rect.height < 5) return;
    const hit = new Set();
    for (const obj of Object.values(objectsRef.current)) {
      if (multiSelectHit(obj, rect)) hit.add(obj.id);
    }
    if (setSelectedIds) {
      if (wasShiftDrag) {
        const next = new Set(selectedIds);
        for (const id of hit) next.add(id);
        setSelectedIds(next);
      } else {
        setSelectedIds(hit);
      }
    }
  };

  const handleStageClickWrapped = (e) => {
    if (e.evt.button === 1) return;
    if (e.evt.shiftKey && (activeTool === 'select' || activeTool === 'pan')) {
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
      draggable={activeTool === 'pan' && !selectedId && !(shiftHeld && !pendingTool)}
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
          fill={getCSSVar('--md-sys-color-surface') || (darkMode ? '#111827' : '#ffffff')}
        />
        {snapToGrid && (() => {
          const left = -stagePos.x / stageScale;
          const top = -stagePos.y / stageScale;
          const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
          const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
          const { cols, rows } = computeGridDimensions(stagePos, stageScale, window.innerWidth, window.innerHeight);
          const fill = getCSSVar('--md-sys-color-outline-variant') || (darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)');
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
            { key: 'Drag', desc: '\u00a0to pan' },
            { key: 'Scroll', desc: '\u00a0to zoom' },
            { key: 'Click', desc: '\u00a0to select' },
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
        {visibleRenderOrder
          .map((obj) => {
            const isMultiSelected = selectedIds?.has(obj.id);
            if (obj.type === 'frame') {
              const frameChildren = frameChildMap[obj.id] || [];
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
                  pendingTool={pendingTool}
                  toolHoverFrameId={toolHoverFrameId}
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
                  pendingTool={pendingTool}
                  shadowsEnabled={shadowsEnabled}
                  darkMode={darkMode}
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
                  pendingTool={pendingTool}
                  shadowsEnabled={shadowsEnabled}
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
                  stageScale={stageScale}
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
                  pendingTool={pendingTool}
                />
              );
            }
            return null;
          })}
        {(() => {
          const isConnectorTool = pendingTool === 'line' || pendingTool === 'arrow';
          const selectedObj = selectedId ? objects[selectedId] : null;
          const isLineSelected = selectedObj && (selectedObj.type === 'line' || selectedObj.type === 'arrow');

          if (!isConnectorTool && !isLineSelected) {
            portCircleRefsRef.current = {};
            return null;
          }

          const portTargets = [];

          if (isConnectorTool) {
            for (const obj of Object.values(objects)) {
              if (obj.type === 'line' || obj.type === 'arrow') continue;
              if (!visibleIds.has(obj.id)) continue;
              portTargets.push(obj);
            }
          } else if (isLineSelected) {
            for (const obj of Object.values(objects)) {
              if (obj.id === selectedId) continue;
              if (obj.type === 'line' || obj.type === 'arrow') continue;
              if (!visibleIds.has(obj.id)) continue;
              portTargets.push(obj);
            }
          }

          const portRadius = PORT_DISPLAY_RADIUS / stageScale;
          const strokeW = 1.5 / stageScale;
          const hovered = hoveredSnapTargetRef.current;
          const nextRefs = {};
          const circles = [];
          for (const obj of portTargets) {
            for (const port of PORTS) {
              const p = getPortCoords(obj, port);
              const key = `${obj.id}-${port}`;
              const isHovered = hovered && hovered.objectId === obj.id && hovered.port === port;
              circles.push(
                <Circle
                  key={key}
                  ref={(node) => { if (node) nextRefs[key] = node; }}
                  x={p.x}
                  y={p.y}
                  radius={portRadius}
                  fill={isHovered ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.15)'}
                  stroke="#6366f1"
                  strokeWidth={strokeW}
                  listening={false}
                  perfectDrawEnabled={false}
                />
              );
            }
          }
          portCircleRefsRef.current = nextRefs;
          return circles;
        })()}
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
        <Cursors presentUsers={presentUsers} userId={currentUserId} onFollowUser={onFollowUser} />
      </Layer>
      <Layer ref={dragLayerRef} />
      {pendingTool && (pendingTool === 'line' || pendingTool === 'arrow') && (
        <ConnectorGhostLayer
          stageScale={stageScale}
          layerRef={connectorGhostLayerRef}
          connectorFirstPoint={connectorFirstPoint}
          ghostLineRef={ghostLineKonvaRef}
          tooltipGroupRef={tooltipGroupKonvaRef}
        />
      )}
      {pendingTool && pendingTool !== 'line' && pendingTool !== 'arrow' && pendingTool !== 'scribble' && (
        <GhostLayer
          pendingTool={pendingTool}
          stageScale={stageScale}
          layerRef={ghostLayerRef}
          nodeRef={ghostNodeRef}
        />
      )}
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
    ps.connectorFirstPoint === ns.connectorFirstPoint &&
    ps.pendingTool === ns.pendingTool &&
    ps.onFollowUser === ns.onFollowUser
  );
}

export const BoardCanvas = React.memo(BoardCanvasInner, areEqual);
