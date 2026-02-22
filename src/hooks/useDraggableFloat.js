import { useState, useRef, useEffect } from 'react';

export function useDraggableFloat(storageKey, defaultPos) {
  const [pos, setPos] = useState(() => {
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
    return () => {
      if (mouseMoveHandlerRef.current) {
        document.removeEventListener('mousemove', mouseMoveHandlerRef.current);
      }
      if (mouseUpHandlerRef.current) {
        document.removeEventListener('mouseup', mouseUpHandlerRef.current);
      }
    };
  }, []);

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

  return {
    pos,
    dragHandleProps: {
      onMouseDown,
      ref: elementRef,
    },
  };
}
