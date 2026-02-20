import { describe, it, expect, vi, afterEach } from 'vitest';
import { showErrorTooltip } from './tooltipUtils';

describe('showErrorTooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls setResizeTooltip with computed position and message', () => {
    vi.useFakeTimers();
    const setter = vi.fn();
    const timerRef = { current: null };
    showErrorTooltip('Overlap!', { screenX: 100, screenY: 200, objW: 40, objH: 30 }, setter, timerRef);
    expect(setter).toHaveBeenCalledWith({
      x: 120,
      y: 200,
      msg: 'Overlap!',
      flipY: false,
    });
  });

  it('flips Y when screenY < 40', () => {
    vi.useFakeTimers();
    const setter = vi.fn();
    const timerRef = { current: null };
    showErrorTooltip('Flip!', { screenX: 50, screenY: 10, objW: 20, objH: 60 }, setter, timerRef);
    expect(setter).toHaveBeenCalledWith({
      x: 60,
      y: 70,
      msg: 'Flip!',
      flipY: true,
    });
  });

  it('clears previous timer before setting a new one', () => {
    vi.useFakeTimers();
    const setter = vi.fn();
    const timerRef = { current: null };
    showErrorTooltip('First', { screenX: 0, screenY: 100, objW: 10, objH: 10 }, setter, timerRef);
    const firstTimer = timerRef.current;
    showErrorTooltip('Second', { screenX: 0, screenY: 100, objW: 10, objH: 10 }, setter, timerRef);
    vi.advanceTimersByTime(2500);
    const nullCalls = setter.mock.calls.filter(c => c[0] === null);
    expect(nullCalls).toHaveLength(1);
    expect(timerRef.current).not.toBe(firstTimer);
  });

  it('auto-dismisses after 2500ms', () => {
    vi.useFakeTimers();
    const setter = vi.fn();
    const timerRef = { current: null };
    showErrorTooltip('Gone', { screenX: 0, screenY: 100, objW: 10, objH: 10 }, setter, timerRef);
    expect(setter).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2500);
    expect(setter).toHaveBeenCalledTimes(2);
    expect(setter).toHaveBeenLastCalledWith(null);
  });
});
