import { useState, useEffect, useRef } from 'react';

const STATIC_DEFAULTS = {
  line: { active: '#3b82f6' },
  text: { active: '#1a1a1a' },
};

function readThemeDefaults() {
  const style = getComputedStyle(document.documentElement);
  const primary = style.getPropertyValue('--md-sys-color-primary-container').trim();
  const secondary = style.getPropertyValue('--md-sys-color-secondary-container').trim();
  const tertiary = style.getPropertyValue('--md-sys-color-tertiary-container').trim();
  const primaryBase = style.getPropertyValue('--md-sys-color-primary').trim();
  return {
    sticky: { active: secondary || '#fef08a' },
    shapes: { active: primary || '#bfdbfe' },
    rectangle: { active: primary || '#bfdbfe' },
    circle: { active: tertiary || '#fbcfe8' },
    triangle: { active: secondary || '#e9d5ff' },
    frame: { active: primaryBase || '#6366f1' },
  };
}

function buildDefaults() {
  return { ...readThemeDefaults(), ...STATIC_DEFAULTS };
}

export function useShapeColors(boardId, themeColor, darkMode) {
  const [shapeColors, setShapeColors] = useState(() => {
    const saved = localStorage.getItem(`shapeColors_${boardId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...buildDefaults(), ...parsed };
      } catch {
        return buildDefaults();
      }
    }
    return buildDefaults();
  });

  const [colorHistory, setColorHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('collaboard_colorHistory') || '[]'); } catch { return []; }
  });

  const prevThemeDefaultsRef = useRef(null);

  useEffect(() => {
    const newDefaults = readThemeDefaults();

    if (prevThemeDefaultsRef.current === null) {
      prevThemeDefaultsRef.current = newDefaults;
      return;
    }

    const oldDefaults = prevThemeDefaultsRef.current;
    prevThemeDefaultsRef.current = newDefaults;

    setShapeColors(prev => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(newDefaults)) {
        const oldDefault = oldDefaults[key]?.active;
        const newDefault = newDefaults[key]?.active;
        if (oldDefault && newDefault && prev[key]?.active === oldDefault) {
          next[key] = { ...prev[key], active: newDefault };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [themeColor, darkMode]);

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`shapeColors_${boardId}`, JSON.stringify(shapeColors));
    }
  }, [shapeColors, boardId]);

  const updateColorHistory = (color) => {
    setColorHistory(prev => {
      const next = [color, ...prev.filter(c => c !== color)].slice(0, 10);
      localStorage.setItem('collaboard_colorHistory', JSON.stringify(next));
      return next;
    });
  };

  return { shapeColors, setShapeColors, colorHistory, updateColorHistory };
}
