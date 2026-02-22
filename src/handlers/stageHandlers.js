import { getContentBounds } from '../utils/frameUtils.js';
import { findSnapTarget } from '../utils/connectorUtils.js';

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 5;

const HEADER_HEIGHT = 60;

export function makeStageHandlers({
  setSelectedId, setSelectedIds, setStagePos, setStageScale, presence, objectsRef,
  pendingToolRef, pendingToolCountRef, onPendingToolPlace,
  connectorFirstPointRef, setConnectorFirstPoint,
  addObject, currentColorRef, currentStrokeWidthRef, userIdRef,
}) {
  const handleMouseMove = (e) => {
    if (!presence.updateCursor) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (pointer) {
      const pos = {
        x: (pointer.x - stage.x()) / stage.scaleX(),
        y: (pointer.y - stage.y()) / stage.scaleY(),
      };
      presence.updateCursor(pos.x, pos.y);
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy));

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage() || e.target.name() === 'bg-rect') {
      const tool = pendingToolRef?.current;

      if (tool === 'line' || tool === 'arrow') {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
        if (!pos) return;
        const canvasX = pos.x;
        const canvasY = pos.y;
        const objects = objectsRef.current;
        const snapTarget = findSnapTarget(canvasX, canvasY, objects, new Set());
        const firstPoint = connectorFirstPointRef?.current;

        if (firstPoint === null) {
          const pt = snapTarget
            ? { x: snapTarget.x, y: snapTarget.y, connectedId: snapTarget.objectId, connectedPort: snapTarget.port }
            : { x: canvasX, y: canvasY, connectedId: null, connectedPort: null };
          setConnectorFirstPoint(pt);
          return;
        } else {
          const p1 = firstPoint;
          const p2 = snapTarget
            ? { x: snapTarget.x, y: snapTarget.y, connectedId: snapTarget.objectId, connectedPort: snapTarget.port }
            : { x: canvasX, y: canvasY, connectedId: null, connectedPort: null };

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;

          addObject({
            type: tool,
            x: p1.x,
            y: p1.y,
            points: [0, 0, dx, dy],
            startConnectedId: p1.connectedId,
            startConnectedPort: p1.connectedPort,
            endConnectedId: p2.connectedId,
            endConnectedPort: p2.connectedPort,
            color: currentColorRef?.current || '#3b82f6',
            strokeWidth: currentStrokeWidthRef?.current || 3,
            userId: userIdRef?.current || null,
          });
          setConnectorFirstPoint(null);
          return;
        }
      }

      if (tool && onPendingToolPlace) {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
        if (pos) {
          onPendingToolPlace(tool, pos.x, pos.y);
        }
        return;
      }
      setSelectedId(null);
      setSelectedIds(new Set());
    }
  };

  const handleRecenter = () => {
    const bounds = getContentBounds(objectsRef.current);
    if (!bounds) {
      setStagePos({ x: 0, y: 0 });
      setStageScale(1);
      return;
    }
    const { minX, minY, maxX, maxY } = bounds;
    const PADDING = 60;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight - HEADER_HEIGHT;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) {
      setStagePos({ x: 0, y: 0 });
      setStageScale(1);
      return;
    }
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(
      (viewW - PADDING * 2) / contentW,
      (viewH - PADDING * 2) / contentH,
      1
    )));
    setStageScale(scale);
    setStagePos({
      x: (viewW - contentW * scale) / 2 - minX * scale,
      y: (viewH - contentH * scale) / 2 - minY * scale,
    });
  };

  return { handleMouseMove, handleWheel, handleStageClick, handleRecenter };
}
