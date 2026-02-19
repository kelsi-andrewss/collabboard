import { useState, useEffect } from 'react';

export function useCanvasViewport(boardId, handleRecenterRef, userId) {
  const storageKey = userId ? `collaboard_view_${userId}_${boardId}` : `collaboard_view_${boardId}`;

  const [stagePos, setStagePos] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const v = JSON.parse(saved); return { x: v.x ?? 0, y: v.y ?? 0 }; }
    } catch {}
    return { x: 0, y: 0 };
  });
  const [stageScale, setStageScale] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { const v = JSON.parse(saved); return v.scale ?? 1; }
    } catch {}
    return 1;
  });

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(storageKey, JSON.stringify({ x: stagePos.x, y: stagePos.y, scale: stageScale }));
    }
  }, [stagePos, stageScale, boardId, userId]);

  useEffect(() => {
    if (!boardId) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const v = JSON.parse(saved);
        setStagePos({ x: v.x ?? 0, y: v.y ?? 0 });
        setStageScale(v.scale ?? 1);
        return;
      }
    } catch {}
    // Only recenter if the stage is still at the default position (user hasn't panned this session)
    setStagePos(prev => {
      if (prev.x === 0 && prev.y === 0) {
        handleRecenterRef.current?.();
      }
      return prev;
    });
  }, [boardId, userId]);

  return { stagePos, setStagePos, stageScale, setStageScale };
}
