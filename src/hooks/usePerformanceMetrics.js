import { useState, useEffect } from 'react';

export function usePerformanceMetrics() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const frameTimes = [];
    let rafId;
    let lastUpdate = performance.now();

    const tick = (now) => {
      frameTimes.push(now);

      // Keep only the last 30 frame timestamps
      while (frameTimes.length > 30) {
        frameTimes.shift();
      }

      // Update FPS once per second
      if (now - lastUpdate >= 1000) {
        if (frameTimes.length >= 2) {
          const elapsed = frameTimes[frameTimes.length - 1] - frameTimes[0];
          const calculatedFps = Math.round(((frameTimes.length - 1) / elapsed) * 1000);
          setFps(calculatedFps);
        }
        lastUpdate = now;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return { fps };
}
