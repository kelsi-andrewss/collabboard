import { useState, useRef, useEffect, useCallback } from 'react';

export function useDraggableFloat(storageKey, defaultPos, options = {}) {
  const { fixedPositions, orientations } = options;
  const isFixedMode = Array.isArray(fixedPositions) && fixedPositions.length > 0;

  const lockedOrientation = Array.isArray(orientations) && orientations.length === 1
    ? orientations[0]
    : null;

  const [orientation, setOrientation] = useState(() => {
    if (lockedOrientation) return lockedOrientation;
    try {
      const stored = localStorage.getItem(storageKey + '-orient');
      if (stored === 'horizontal' || stored === 'vertical') return stored;
    } catch {
      // localStorage unavailable
    }
    return 'horizontal';
  });

  // posIndex: only meaningful in fixed-positions mode
  const [posIndex, setPosIndex] = useState(() => {
    if (!isFixedMode) return 0;
    try {
      const stored = localStorage.getItem(storageKey + '-pin');
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < fixedPositions.length) {
          return parsed;
        }
      }
    } catch {
      // localStorage unavailable
    }
    return 0;
  });

  // pos: only meaningful in free-drag mode
  const [pos, setPos] = useState(() => {
    if (isFixedMode) return null;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // invalid JSON — fall through to default
    }
    return defaultPos;
  });

  const elementRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startOffsetRef = useRef({ x: 0, y: 0 });
  const mouseMoveHandlerRef = useRef(null);
  const mouseUpHandlerRef = useRef(null);

  useEffect(() => {
    if (isFixedMode) return;
    return () => {
      if (mouseMoveHandlerRef.current) {
        document.removeEventListener('mousemove', mouseMoveHandlerRef.current);
      }
      if (mouseUpHandlerRef.current) {
        document.removeEventListener('mouseup', mouseUpHandlerRef.current);
      }
    };
  }, [isFixedMode]);

  const toggleOrientation = useCallback(() => {
    if (lockedOrientation) return;
    setOrientation(prev => {
      const next = prev === 'horizontal' ? 'vertical' : 'horizontal';
      try {
        localStorage.setItem(storageKey + '-orient', next);
      } catch {
        // localStorage unavailable
      }
      return next;
    });
  }, [storageKey, lockedOrientation]);

  if (isFixedMode) {
    const entry = fixedPositions[posIndex] || fixedPositions[0];
    const chipHeight = elementRef.current?.offsetHeight ?? 44;
    const chipWidth = elementRef.current?.offsetWidth ?? 52;

    const resolvedX = entry.xFromRight !== undefined
      ? window.innerWidth - chipWidth - entry.xFromRight
      : entry.x;
    const resolvedY = entry.yFromBottom !== undefined
      ? window.innerHeight - chipHeight - entry.yFromBottom
      : entry.y;

    const fixedPos = { x: resolvedX, y: resolvedY };

    const cyclePosition = () => {
      setPosIndex(prev => {
        const next = (prev + 1) % fixedPositions.length;
        try {
          localStorage.setItem(storageKey + '-pin', String(next));
        } catch {
          // localStorage unavailable
        }
        return next;
      });
    };

    return {
      pos: fixedPos,
      orientation,
      ref: elementRef,
      dragHandleProps: null,
      cyclePosition,
    };
  }

  // Free-drag mode

  const onMouseDown = (e) => {
    if (e.button !== 0) return;

    let currentX;
    let currentY;

    if (pos === null) {
      const rect = elementRef.current?.getBoundingClientRect();
      if (rect) {
        currentX = rect.left;
        currentY = rect.top;
      } else {
        currentX = 0;
        currentY = 0;
      }
    } else {
      currentX = pos.x;
      currentY = pos.y;
    }

    startOffsetRef.current = {
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    };

    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      setPos({
        x: moveEvent.clientX - startOffsetRef.current.x,
        y: moveEvent.clientY - startOffsetRef.current.y,
      });
    };

    const handleMouseUp = (upEvent) => {
      isDraggingRef.current = false;

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      mouseMoveHandlerRef.current = null;
      mouseUpHandlerRef.current = null;

      let finalX = upEvent.clientX - startOffsetRef.current.x;
      let finalY = upEvent.clientY - startOffsetRef.current.y;

      const rect = elementRef.current?.getBoundingClientRect();
      const chipWidth = rect ? rect.width : 0;
      const chipHeight = rect ? rect.height : 0;

      if (finalX < 40) {
        finalX = 16;
      } else if (finalX + chipWidth > window.innerWidth - 40) {
        finalX = window.innerWidth - chipWidth - 16;
      }

      if (finalY < 40) {
        finalY = 16;
      } else if (finalY + chipHeight > window.innerHeight - 40) {
        finalY = window.innerHeight - chipHeight - 16;
      }

      const snappedPos = { x: finalX, y: finalY };
      setPos(snappedPos);

      try {
        localStorage.setItem(storageKey, JSON.stringify(snappedPos));
      } catch {
        // localStorage unavailable — silently skip persistence
      }
    };

    mouseMoveHandlerRef.current = handleMouseMove;
    mouseUpHandlerRef.current = handleMouseUp;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const onDoubleClick = (e) => {
    e.preventDefault();
    toggleOrientation();
  };

  return {
    pos,
    orientation,
    dragHandleProps: {
      onMouseDown,
      onDoubleClick,
      ref: elementRef,
    },
  };
}
