import { useState, useEffect } from 'react';

const DEFAULTS = {
  sticky: { active: '#fef08a' },
  shapes: { active: '#bfdbfe' },
  rectangle: { active: '#bfdbfe' },
  circle: { active: '#fbcfe8' },
  triangle: { active: '#e9d5ff' },
  line: { active: '#3b82f6' }
};

export function useShapeColors(boardId) {
  const [shapeColors, setShapeColors] = useState(() => {
    const saved = localStorage.getItem(`shapeColors_${boardId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULTS, ...parsed };
    }
    return DEFAULTS;
  });
  const [colorHistory, setColorHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('collaboard_colorHistory') || '[]'); } catch { return []; }
  });

  const updateColorHistory = (color) => {
    setColorHistory(prev => {
      const next = [color, ...prev.filter(c => c !== color)].slice(0, 10);
      localStorage.setItem('collaboard_colorHistory', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`shapeColors_${boardId}`, JSON.stringify(shapeColors));
    }
  }, [shapeColors, boardId]);

  return { shapeColors, setShapeColors, colorHistory, updateColorHistory };
}
