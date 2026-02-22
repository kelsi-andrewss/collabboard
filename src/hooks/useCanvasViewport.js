import { useState, useEffect, useRef } from 'react';

export function useCanvasViewport(boardId, handleRecenterRef, userId) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const hasLoadedRef = useRef(false);

  const getKey = () => {
    const uid = userIdRef.current;
    return uid ? `collaboard_view_${uid}_${boardId}` : `collaboard_view_${boardId}`;
  };

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    if (!userId || !boardId) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    try {
      const saved = localStorage.getItem(getKey());
      if (saved) {
        const v = JSON.parse(saved);
        setStagePos({ x: v.x ?? 0, y: v.y ?? 0 });
        setStageScale(Math.max(0.1, Math.min(5, v.scale ?? 1)));
        return;
      }
    } catch {}

    if (stagePos.x === 0 && stagePos.y === 0) {
      handleRecenterRef.current?.();
    }
  }, [userId, boardId]);

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(getKey(), JSON.stringify({ x: stagePos.x, y: stagePos.y, scale: stageScale }));
    }
  }, [stagePos, stageScale, boardId, userId]);

  return { stagePos, setStagePos, stageScale, setStageScale };
}
