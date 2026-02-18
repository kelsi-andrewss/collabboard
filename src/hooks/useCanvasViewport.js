import { useState, useEffect } from 'react';

export function useCanvasViewport(boardId, handleRecenterRef) {
  const [stagePos, setStagePos] = useState(() => {
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) { const v = JSON.parse(saved); return { x: v.x ?? 0, y: v.y ?? 0 }; }
    } catch {}
    return { x: 0, y: 0 };
  });
  const [stageScale, setStageScale] = useState(() => {
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) { const v = JSON.parse(saved); return v.scale ?? 1; }
    } catch {}
    return 1;
  });

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`collaboard_view_${boardId}`, JSON.stringify({ x: stagePos.x, y: stagePos.y, scale: stageScale }));
    }
  }, [stagePos, stageScale, boardId]);

  useEffect(() => {
    if (!boardId) return;
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) {
        const v = JSON.parse(saved);
        setStagePos({ x: v.x ?? 0, y: v.y ?? 0 });
        setStageScale(v.scale ?? 1);
        return;
      }
    } catch {}
    handleRecenterRef.current?.();
  }, [boardId]);

  return { stagePos, setStagePos, stageScale, setStageScale };
}
