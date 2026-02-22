import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock useDraggableFloat so the component renders without DOM geometry
// ---------------------------------------------------------------------------

vi.mock('../hooks/useDraggableFloat', () => ({
  useDraggableFloat: vi.fn(() => ({
    pos: { x: 16, y: 400 },
    dragHandleProps: { onMouseDown: vi.fn(), onDoubleClick: vi.fn(), ref: { current: null } },
  })),
}));

// ---------------------------------------------------------------------------
// Mock usePerformanceMetrics so we control the fps value
// ---------------------------------------------------------------------------

const mockUsePerfMetrics = vi.fn(() => ({ fps: 0 }));

vi.mock('../hooks/usePerformanceMetrics', () => ({
  usePerformanceMetrics: () => mockUsePerfMetrics(),
}));

import { PerformanceOverlay } from './PerformanceOverlay.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRefs(syncLatency = null, cursorLatency = null) {
  return {
    lastObjectSyncLatencyRef: { current: syncLatency },
    cursorSyncLatencyRef: { current: cursorLatency },
  };
}

describe('PerformanceOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUsePerfMetrics.mockReturnValue({ fps: 0 });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('renders without throwing with minimal props', () => {
    const refs = makeRefs();
    expect(() => {
      render(
        <PerformanceOverlay
          objects={[]}
          lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
          cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
        />
      );
    }).not.toThrow();
  });

  it('renders the FPS label', () => {
    const refs = makeRefs();
    render(
      <PerformanceOverlay
        objects={[]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    expect(screen.getByText('FPS')).toBeTruthy();
  });

  it('renders the Objects label', () => {
    const refs = makeRefs();
    render(
      <PerformanceOverlay
        objects={[]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    expect(screen.getByText('Objects')).toBeTruthy();
  });

  it('renders the Sync label', () => {
    const refs = makeRefs();
    render(
      <PerformanceOverlay
        objects={[]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    expect(screen.getByText('Sync')).toBeTruthy();
  });

  it('renders the Cursor label', () => {
    const refs = makeRefs();
    render(
      <PerformanceOverlay
        objects={[]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    expect(screen.getByText('Cursor')).toBeTruthy();
  });

  it('shows em-dash for Sync when lastObjectSyncLatencyRef.current is null', () => {
    const refs = makeRefs(null, null);
    render(
      <PerformanceOverlay
        objects={[]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    // Initial displayValues all null — after 500ms interval they update
    // Before the interval fires: syncLatency starts as null in displayValues init
    // but we need to advance the timer for display to show
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // After interval: syncLatency = null → display "—"
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('shows formatted latency in ms after interval fires when refs have values', () => {
    const refs = makeRefs(42, 18);
    render(
      <PerformanceOverlay
        objects={[{ id: 'a' }, { id: 'b' }]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('42ms')).toBeTruthy();
    expect(screen.getByText('18ms')).toBeTruthy();
  });

  it('shows object count from the objects array after interval fires', () => {
    const refs = makeRefs();
    render(
      <PerformanceOverlay
        objects={[{ id: '1' }, { id: '2' }, { id: '3' }]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('updates displayed fps from usePerformanceMetrics after interval fires', () => {
    mockUsePerfMetrics.mockReturnValue({ fps: 60 });
    const refs = makeRefs();
    render(
      <PerformanceOverlay
        objects={[]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('60')).toBeTruthy();
  });

  it('applies position style from useDraggableFloat', () => {
    const refs = makeRefs();
    const { container } = render(
      <PerformanceOverlay
        objects={[]}
        lastObjectSyncLatencyRef={refs.lastObjectSyncLatencyRef}
        cursorSyncLatencyRef={refs.cursorSyncLatencyRef}
      />
    );
    const chip = container.querySelector('.perf-overlay-chip');
    expect(chip).toBeTruthy();
    expect(chip.style.left).toBe('16px');
    expect(chip.style.top).toBe('400px');
  });
});
