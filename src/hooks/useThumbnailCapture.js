import { useEffect, useRef } from 'react';

export function useThumbnailCapture({ boardId, stageRef, saveThumbnail, themeColor, darkMode }) {
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  const captureThumbnail = (bId) => {
    if (document.visibilityState !== 'visible') return;
    const stage = stageRef.current;
    if (!stage || !bId) return;
    const bgRect = stage.findOne('.bg-rect');
    const originalFill = bgRect ? bgRect.fill() : null;
    const html = document.documentElement;
    const origTheme = html.getAttribute('data-theme');
    try {
      const captureOpts = { pixelRatio: Math.min(window.devicePixelRatio || 1, 2), mimeType: 'image/jpeg', quality: 0.7 };

      html.setAttribute('data-theme', 'light');
      const lightSurface = getComputedStyle(html).getPropertyValue('--md-sys-color-surface').trim();
      if (bgRect) bgRect.fill(lightSurface);
      const lightUrl = stage.toDataURL(captureOpts);

      html.setAttribute('data-theme', 'dark');
      const darkSurface = getComputedStyle(html).getPropertyValue('--md-sys-color-surface').trim();
      if (bgRect) bgRect.fill(darkSurface);
      const darkUrl = stage.toDataURL(captureOpts);

      saveThumbnail(bId, lightUrl, darkUrl).catch(() => {});
    } catch {
    } finally {
      if (bgRect) bgRect.fill(originalFill);
      html.setAttribute('data-theme', origTheme);
    }
  };

  const captureThumbnailRef = useRef(captureThumbnail);
  captureThumbnailRef.current = captureThumbnail;

  useEffect(() => {
    if (!boardId) return;
    const interval = setInterval(() => captureThumbnailRef.current(boardIdRef.current), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [boardId]);

  const prevBoardIdRef = useRef(null);
  useEffect(() => {
    const prev = prevBoardIdRef.current;
    if (prev && !boardId) {
      captureThumbnailRef.current(prev);
    }
    prevBoardIdRef.current = boardId;
  }, [boardId]);

  useEffect(() => {
    if (!boardId) return;
    captureThumbnailRef.current(boardId);
  }, [themeColor, darkMode, boardId]);

  return { captureThumbnail };
}
