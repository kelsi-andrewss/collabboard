import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeStageHandlers } from './stageHandlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides = {}) {
  return {
    setSelectedId: vi.fn(),
    setSelectedIds: vi.fn(),
    setStagePos: vi.fn(),
    setStageScale: vi.fn(),
    presence: { updateCursor: vi.fn() },
    objectsRef: { current: {} },
    pendingToolRef: { current: null },
    pendingToolCountRef: { current: 0 },
    onPendingToolPlace: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// handleRecenter — board with content
// ---------------------------------------------------------------------------

describe('handleRecenter — board with content', () => {
  const objects = {
    a: { type: 'sticky', x: 100, y: 200, width: 200, height: 100 },
  };

  let cfg;
  let handlers;

  beforeEach(() => {
    // Provide a fixed viewport size so assertions are deterministic.
    vi.stubGlobal('innerWidth', 1200);
    vi.stubGlobal('innerHeight', 800);

    cfg = makeConfig({ objectsRef: { current: objects } });
    handlers = makeStageHandlers(cfg);
  });

  it('calls setStageScale with a value <= 1', () => {
    handlers.handleRecenter();
    const scale = cfg.setStageScale.mock.calls[0][0];
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(1);
  });

  it('calls setStagePos with numeric x and y', () => {
    handlers.handleRecenter();
    const pos = cfg.setStagePos.mock.calls[0][0];
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('does not reset to origin when there are objects', () => {
    handlers.handleRecenter();
    const pos = cfg.setStagePos.mock.calls[0][0];
    // With content at x:100, centering math produces a non-trivial offset.
    expect(pos).not.toEqual({ x: 0, y: 0 });
  });
});

// ---------------------------------------------------------------------------
// handleRecenter — zero-size content (degenerate bounds)
// ---------------------------------------------------------------------------

describe('handleRecenter — zero-dimension content', () => {
  it('resets to origin when all objects collapse to a point (contentW <= 0)', () => {
    const objects = {
      a: { type: 'sticky', x: 50, y: 50, width: 0, height: 0 },
    };
    const cfg = makeConfig({ objectsRef: { current: objects } });
    const { handleRecenter } = makeStageHandlers(cfg);
    handleRecenter();
    expect(cfg.setStagePos).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(cfg.setStageScale).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// handleStageClick
// ---------------------------------------------------------------------------

describe('handleStageClick', () => {
  it('calls setSelectedId(null) when clicking the stage background', () => {
    const cfg = makeConfig();
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = { getStage: () => fakeStage, name: () => 'stage', getPointerPosition: () => ({ x: 0, y: 0 }), x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1 };
    handleStageClick({ target: fakeStage });
    expect(cfg.setSelectedId).toHaveBeenCalledWith(null);
  });

  it('calls setSelectedIds(new Set()) when clicking the stage background', () => {
    const cfg = makeConfig();
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = { getStage: () => fakeStage, name: () => 'stage', getPointerPosition: () => ({ x: 0, y: 0 }), x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1 };
    handleStageClick({ target: fakeStage });
    expect(cfg.setSelectedIds).toHaveBeenCalledWith(new Set());
  });

  it('calls setSelectedId(null) when clicking bg-rect', () => {
    const cfg = makeConfig();
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = { name: () => 'bg-rect', getStage: () => fakeStage, getPointerPosition: () => ({ x: 0, y: 0 }), x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1 };
    handleStageClick({ target: fakeStage });
    expect(cfg.setSelectedId).toHaveBeenCalledWith(null);
  });

  it('calls setSelectedIds(new Set()) when clicking bg-rect', () => {
    const cfg = makeConfig();
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = { name: () => 'bg-rect', getStage: () => fakeStage, getPointerPosition: () => ({ x: 0, y: 0 }), x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1 };
    handleStageClick({ target: fakeStage });
    expect(cfg.setSelectedIds).toHaveBeenCalledWith(new Set());
  });

  it('invokes onPendingToolPlace when a pending tool is active', () => {
    const cfg = makeConfig({
      pendingToolRef: { current: 'sticky' },
      pendingToolCountRef: { current: 0 },
    });
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = {
      getPointerPosition: () => ({ x: 100, y: 200 }),
      x: () => 0,
      y: () => 0,
      scaleX: () => 1,
      scaleY: () => 1,
    };
    const fakeTarget = {
      getStage: () => fakeStage,
      name: () => 'bg-rect',
    };
    handleStageClick({ target: fakeTarget });
    expect(cfg.onPendingToolPlace).toHaveBeenCalledWith('sticky', 100, 200);
    expect(cfg.setSelectedId).not.toHaveBeenCalled();
    expect(cfg.setSelectedIds).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleWheel
// ---------------------------------------------------------------------------

describe('handleWheel', () => {
  it('zooms out when deltaY > 0', () => {
    const cfg = makeConfig();
    const { handleWheel } = makeStageHandlers(cfg);

    const fakeStage = {
      scaleX: () => 1,
      getPointerPosition: () => ({ x: 400, y: 300 }),
      x: () => 0,
      y: () => 0,
    };
    handleWheel({ evt: { preventDefault: vi.fn(), deltaY: 1 }, target: { getStage: () => fakeStage } });

    const newScale = cfg.setStageScale.mock.calls[0][0];
    expect(newScale).toBeLessThan(1);
  });

  it('zooms in when deltaY < 0', () => {
    const cfg = makeConfig();
    const { handleWheel } = makeStageHandlers(cfg);

    const fakeStage = {
      scaleX: () => 1,
      getPointerPosition: () => ({ x: 400, y: 300 }),
      x: () => 0,
      y: () => 0,
    };
    handleWheel({ evt: { preventDefault: vi.fn(), deltaY: -1 }, target: { getStage: () => fakeStage } });

    const newScale = cfg.setStageScale.mock.calls[0][0];
    expect(newScale).toBeGreaterThan(1);
  });
});
