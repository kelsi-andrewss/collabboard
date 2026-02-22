import React, { useState, useEffect } from 'react';
import { useDraggableFloat } from '../hooks/useDraggableFloat';
import { usePerformanceMetrics } from '../hooks/usePerformanceMetrics';
import './PerformanceOverlay.css';

export function PerformanceOverlay({ objects, lastObjectSyncLatencyRef, cursorSyncLatencyRef }) {
  const defaultPos = { x: 16, y: window.innerHeight - 200 };
  const { pos, dragHandleProps } = useDraggableFloat('perf-overlay', defaultPos);

  const { fps } = usePerformanceMetrics();

  const [displayValues, setDisplayValues] = useState({
    fps: 0,
    objectCount: 0,
    syncLatency: null,
    cursorLatency: null,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayValues({
        fps,
        objectCount: objects.length,
        syncLatency: lastObjectSyncLatencyRef.current,
        cursorLatency: cursorSyncLatencyRef.current,
      });
    }, 500);

    return () => clearInterval(interval);
  }, [fps, objects, lastObjectSyncLatencyRef, cursorSyncLatencyRef]);

  const style = pos ? { left: pos.x, top: pos.y } : {};

  return (
    <div
      className="floating-toolbar-chip perf-overlay-chip"
      style={style}
      {...dragHandleProps}
    >
      <div className="perf-metric-row">
        <span className="perf-metric-label">FPS</span>
        <span>{displayValues.fps}</span>
      </div>
      <div className="perf-metric-row">
        <span className="perf-metric-label">Objects</span>
        <span>{displayValues.objectCount}</span>
      </div>
      <div className="perf-metric-row">
        <span className="perf-metric-label">Sync</span>
        <span>{displayValues.syncLatency !== null ? `${displayValues.syncLatency}ms` : '—'}</span>
      </div>
      <div className="perf-metric-row">
        <span className="perf-metric-label">Cursor</span>
        <span>{displayValues.cursorLatency !== null ? `${displayValues.cursorLatency}ms` : '—'}</span>
      </div>
    </div>
  );
}
