import { useState, useEffect, useRef } from 'react';

export function useCanvasViewport(boardId, handleRecenterRef, userId) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const getKey = () => {
    const uid = userIdRef.current;
    return uid ? `collaboard_view_${uid}_${boardId}` : `collaboard_view_${boardId}`;
  };

  const [stagePos, setStagePos] = useState(() => {
    try {
      const saved = localStorage.getItem(getKey());
      if (saved) { const v = JSON.parse(saved); return { x: v.x ?? 0, y: v.y ?? 0 }; }
    } catch {}
    return { x: 0, y: 0 };
  });
  const [stageScale, setStageScale] = useState(() => {
    try {
      const saved = localStorage.getItem(getKey());
      if (saved) { const v = JSON.parse(saved); return Math.max(0.1, Math.min(5, v.scale ?? 1)); }
    } catch {}
    return 1;
  });

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(getKey(), JSON.stringify({ x: stagePos.x, y: stagePos.y, scale: stageScale }));
    }
  }, [stagePos, stageScale, boardId, userId]);

  useEffect(() => {
    if (!boardId) return;
    try {
      const saved = localStorage.getItem(getKey());
      if (saved) {
        const v = JSON.parse(saved);
        setStagePos({ x: v.x ?? 0, y: v.y ?? 0 });
        setStageScale(Math.max(0.1, Math.min(5, v.scale ?? 1)));
        return;
      }
    } catch {}
    setStagePos(prev => {
      if (prev.x === 0 && prev.y === 0) {
        handleRecenterRef.current?.();
      }
      return prev;
    });
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { stagePos, setStagePos, stageScale, setStageScale };
}
