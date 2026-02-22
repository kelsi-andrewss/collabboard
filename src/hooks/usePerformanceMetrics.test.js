import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerformanceMetrics } from './usePerformanceMetrics';

describe('usePerformanceMetrics', () => {
  let rafCallbacks = [];
  let nowValue = 1000;

  beforeEach(() => {
    rafCallbacks = [];
    nowValue = 1000;

    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = rafCallbacks.length;
      rafCallbacks.push(cb);
      return id;
    });

    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks[id] = null;
    });

    vi.spyOn(performance, 'now').mockImplementation(() => nowValue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fps=0 on initial render before any frames tick', () => {
    const { result } = renderHook(() => usePerformanceMetrics());
    expect(result.current.fps).toBe(0);
  });

  it('schedules a requestAnimationFrame on mount', () => {
    renderHook(() => usePerformanceMetrics());
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('cancels the animation frame on unmount', () => {
    const { unmount } = renderHook(() => usePerformanceMetrics());
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('does not update fps until at least 1000ms have elapsed since mount', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    // Tick 9 frames at 100ms each = 900ms total — stays under the 1000ms threshold
    act(() => {
      for (let i = 0; i < 9; i++) {
        nowValue += 100;
        const cb = rafCallbacks.pop();
        if (cb) cb(nowValue);
      }
    });

    // Still under 1000ms total elapsed — fps should remain 0
    expect(result.current.fps).toBe(0);
  });

  it('computes fps after 1000ms elapsed and enough frames accumulated', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    // Simulate 31 frames over ~1033ms (each ~33ms apart, ~30fps)
    act(() => {
      for (let i = 0; i < 31; i++) {
        nowValue += 33;
        const cb = rafCallbacks.pop();
        if (cb) cb(nowValue);
      }
    });

    // After 1000ms elapsed the fps should be set to a non-zero value
    expect(result.current.fps).toBeGreaterThan(0);
  });

  it('fps reflects the calculated rate (30fps at 33ms intervals)', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    // Push enough frames to cross the 1000ms threshold
    // 31 frames * 33ms = 1023ms elapsed
    act(() => {
      for (let i = 0; i < 31; i++) {
        nowValue += 33;
        const cb = rafCallbacks.pop();
        if (cb) cb(nowValue);
      }
    });

    // 30 intervals / (30 * 33ms) * 1000 = ~30fps
    expect(result.current.fps).toBeGreaterThanOrEqual(28);
    expect(result.current.fps).toBeLessThanOrEqual(32);
  });

  it('resets the update timer after each 1-second interval', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    // First interval — 31 frames at ~33ms each (~1023ms total, crosses 1000ms)
    act(() => {
      for (let i = 0; i < 31; i++) {
        nowValue += 33;
        const cb = rafCallbacks.pop();
        if (cb) cb(nowValue);
      }
    });
    const firstFps = result.current.fps;
    expect(firstFps).toBeGreaterThan(0);

    // Second interval — simulate ~60fps (16ms per frame, need >1000ms so use 65 frames)
    act(() => {
      for (let i = 0; i < 65; i++) {
        nowValue += 16;
        const cb = rafCallbacks.pop();
        if (cb) cb(nowValue);
      }
    });

    // fps should have updated to reflect ~60fps, which is greater than the ~30fps first reading
    expect(result.current.fps).toBeGreaterThan(firstFps);
    expect(result.current.fps).toBeGreaterThanOrEqual(55);
  });

  it('keeps only the last 30 frame timestamps in the sliding window', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    // Push 50 frames without crossing 1000ms (keep them small)
    act(() => {
      for (let i = 0; i < 50; i++) {
        nowValue += 10; // 10ms each = 500ms total, under threshold
        const cb = rafCallbacks.pop();
        if (cb) cb(nowValue);
      }
    });

    // Now push enough frames to cross the 1000ms threshold in one go
    act(() => {
      nowValue += 1000;
      const cb = rafCallbacks.pop();
      if (cb) cb(nowValue);
    });

    // fps should be computable (not zero/NaN) because window kept last 30 frames
    // At 10ms intervals for 30 frames: 29 intervals / 290ms * 1000 = ~100fps
    expect(result.current.fps).toBeGreaterThan(0);
    expect(typeof result.current.fps).toBe('number');
  });
});
