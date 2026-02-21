import { getContentBounds } from '../utils/frameUtils.js';

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 5;

const HEADER_HEIGHT = 60;

export function makeStageHandlers({
  setSelectedId, setSelectedIds, setStagePos, setStageScale, presence, objectsRef,
  pendingToolRef, pendingToolCountRef, onPendingToolPlace,
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
      if (pendingToolRef?.current && onPendingToolPlace) {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();
        if (pos) {
          const canvasX = pos.x;
          const canvasY = pos.y;
          const count = pendingToolCountRef?.current || 0;
          onPendingToolPlace(pendingToolRef.current, canvasX, canvasY);
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
