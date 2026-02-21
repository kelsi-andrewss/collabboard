import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeStageHandlers } from './stageHandlers.js';
import { centeredPlacementOffset } from '../utils/geometryUtils.js';

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
      getRelativePointerPosition: () => ({ x: 100, y: 200 }),
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

// ---------------------------------------------------------------------------
// ghost-placement agreement — click, move, click
// ---------------------------------------------------------------------------

function ghostPos(toolType, canvasX, canvasY, stageScale) {
  if (toolType === 'sticky') {
    const off = centeredPlacementOffset(canvasX, canvasY, 200, stageScale);
    return { x: off.x, y: off.y };
  }
  if (toolType === 'line' || toolType === 'arrow' || toolType === 'text') {
    return { x: canvasX, y: canvasY };
  }
  if (toolType === 'frame') {
    const fw = Math.round(window.innerWidth * 0.55 / stageScale);
    const fh = Math.round((window.innerHeight - 60) * 0.55 / stageScale);
    return { x: canvasX - fw / 2, y: canvasY - fh / 2 };
  }
  return { x: canvasX - 50, y: canvasY - 50 };
}

function makeFakeStage(canvasPos) {
  return {
    getRelativePointerPosition: () => canvasPos,
    getPointerPosition: () => canvasPos,
    x: () => 0, y: () => 0,
    scaleX: () => 1, scaleY: () => 1,
    name: () => 'bg-rect',
    getStage() { return this; },
  };
}

describe('ghost-placement agreement — click, move, click', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sticky at scale 1.0 — placed coords match ghost position', () => {
    const canvasPos = { x: 300, y: 400 };
    const stageScale = 1.0;
    const cfg = makeConfig({
      pendingToolRef: { current: 'sticky' },
      pendingToolCountRef: { current: 0 },
    });
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = makeFakeStage(canvasPos);
    const fakeTarget = { getStage: () => fakeStage, name: () => 'bg-rect' };
    handleStageClick({ target: fakeTarget });

    const [toolType, placedX, placedY] = cfg.onPendingToolPlace.mock.calls[0];
    expect(toolType).toBe('sticky');

    const ghost = ghostPos('sticky', 300, 400, stageScale);
    const placed = centeredPlacementOffset(placedX, placedY, 200, stageScale);
    expect(placed.x).toBe(ghost.x);
    expect(placed.y).toBe(ghost.y);
  });

  it('sticky at scale 0.75 — placed coords match ghost position', () => {
    const canvasPos = { x: 333, y: 777 };
    const stageScale = 0.75;
    const cfg = makeConfig({
      pendingToolRef: { current: 'sticky' },
      pendingToolCountRef: { current: 0 },
    });
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = makeFakeStage(canvasPos);
    const fakeTarget = { getStage: () => fakeStage, name: () => 'bg-rect' };
    handleStageClick({ target: fakeTarget });

    const [toolType, placedX, placedY] = cfg.onPendingToolPlace.mock.calls[0];
    expect(toolType).toBe('sticky');

    const ghost = ghostPos('sticky', 333, 777, stageScale);
    const placed = centeredPlacementOffset(placedX, placedY, 200, stageScale);
    expect(placed.x).toBe(ghost.x);
    expect(placed.y).toBe(ghost.y);
  });

  it('sticky — move then click again does not stagger placement', () => {
    const stageScale = 1.0;
    let currentPos = { x: 100, y: 200 };

    const pendingToolCountRef = { current: 0 };
    const cfg = makeConfig({
      pendingToolRef: { current: 'sticky' },
      pendingToolCountRef,
    });
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = {
      getRelativePointerPosition: () => currentPos,
      getPointerPosition: () => currentPos,
      x: () => 0, y: () => 0,
      scaleX: () => 1, scaleY: () => 1,
      name: () => 'bg-rect',
      getStage() { return this; },
    };
    const fakeTarget = { getStage: () => fakeStage, name: () => 'bg-rect' };

    handleStageClick({ target: fakeTarget });
    const [, placedX1, placedY1] = cfg.onPendingToolPlace.mock.calls[0];
    const ghost1 = ghostPos('sticky', 100, 200, stageScale);
    const placed1 = centeredPlacementOffset(placedX1, placedY1, 200, stageScale);
    expect(placed1.x).toBe(ghost1.x);
    expect(placed1.y).toBe(ghost1.y);

    currentPos = { x: 500, y: 600 };
    pendingToolCountRef.current = 1;

    handleStageClick({ target: fakeTarget });
    const [, placedX2, placedY2] = cfg.onPendingToolPlace.mock.calls[1];
    const ghost2 = ghostPos('sticky', 500, 600, stageScale);
    const placed2 = centeredPlacementOffset(placedX2, placedY2, 200, stageScale);
    expect(placed2.x).toBe(ghost2.x);
    expect(placed2.y).toBe(ghost2.y);
    expect(placedX2).not.toBe(520);
    expect(placedY2).not.toBe(620);
  });

  it('line at scale 1.0 — placed coords equal canvas coords', () => {
    const canvasPos = { x: 200, y: 300 };
    const cfg = makeConfig({
      pendingToolRef: { current: 'line' },
      pendingToolCountRef: { current: 0 },
    });
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = makeFakeStage(canvasPos);
    const fakeTarget = { getStage: () => fakeStage, name: () => 'bg-rect' };
    handleStageClick({ target: fakeTarget });

    const [, placedX, placedY] = cfg.onPendingToolPlace.mock.calls[0];
    const ghost = ghostPos('line', 200, 300, 1.0);
    expect(placedX).toBe(ghost.x);
    expect(placedY).toBe(ghost.y);
    expect(placedX).toBe(200);
    expect(placedY).toBe(300);
  });

  it('default shape (rectangle) at scale 1.5 — handler passes raw canvas coords', () => {
    const canvasPos = { x: 100, y: 100 };
    const stageScale = 1.5;
    const cfg = makeConfig({
      pendingToolRef: { current: 'rectangle' },
      pendingToolCountRef: { current: 0 },
    });
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = makeFakeStage(canvasPos);
    const fakeTarget = { getStage: () => fakeStage, name: () => 'bg-rect' };
    handleStageClick({ target: fakeTarget });

    const [, placedX, placedY] = cfg.onPendingToolPlace.mock.calls[0];
    expect(placedX).toBe(100);
    expect(placedY).toBe(100);

    const ghost = ghostPos('rectangle', placedX, placedY, stageScale);
    expect(ghost.x).toBe(placedX - 50);
    expect(ghost.y).toBe(placedY - 50);
  });

  it('frame at scale 0.5 — handler passes raw canvas coords', () => {
    vi.stubGlobal('innerWidth', 1440);
    vi.stubGlobal('innerHeight', 900);

    const canvasPos = { x: 400, y: 300 };
    const stageScale = 0.5;
    const fw = Math.round(1440 * 0.55 / stageScale);
    const fh = Math.round(840 * 0.55 / stageScale);

    const cfg = makeConfig({
      pendingToolRef: { current: 'frame' },
      pendingToolCountRef: { current: 0 },
    });
    const { handleStageClick } = makeStageHandlers(cfg);

    const fakeStage = makeFakeStage(canvasPos);
    const fakeTarget = { getStage: () => fakeStage, name: () => 'bg-rect' };
    handleStageClick({ target: fakeTarget });

    const [, placedX, placedY] = cfg.onPendingToolPlace.mock.calls[0];
    expect(placedX).toBe(400);
    expect(placedY).toBe(300);

    const ghost = ghostPos('frame', placedX, placedY, stageScale);
    expect(ghost.x).toBe(400 - fw / 2);
    expect(ghost.y).toBe(300 - fh / 2);
  });
});
