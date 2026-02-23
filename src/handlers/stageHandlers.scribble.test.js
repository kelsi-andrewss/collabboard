import { describe, it, expect, vi } from 'vitest';
import { makeStageHandlers } from './stageHandlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScribbleConfig(overrides = {}) {
  return {
    setSelectedId: vi.fn(),
    setSelectedIds: vi.fn(),
    setStagePos: vi.fn(),
    setStageScale: vi.fn(),
    presence: { updateCursor: vi.fn() },
    objectsRef: { current: {} },
    pendingToolRef: { current: 'scribble' },
    pendingToolCountRef: { current: 0 },
    onPendingToolPlace: vi.fn(),
    connectorFirstPointRef: { current: null },
    setConnectorFirstPoint: vi.fn(),
    addObject: vi.fn(),
    isScribblingRef: { current: false },
    scribblePointsRef: { current: [] },
    onScribbleUpdate: vi.fn(),
    onScribbleCommit: vi.fn(),
    ...overrides,
  };
}

function makeFakeStage(relPos) {
  return {
    getRelativePointerPosition: () => relPos,
    getPointerPosition: () => relPos,
    x: () => 0,
    y: () => 0,
    scaleX: () => 1,
    scaleY: () => 1,
  };
}

function makeFakeEvent(stage) {
  return { target: { getStage: () => stage, name: () => 'bg-rect' } };
}

// ---------------------------------------------------------------------------
// handleStageMouseDown — scribble tool
// ---------------------------------------------------------------------------

describe('handleStageMouseDown — scribble tool', () => {
  it('sets isScribblingRef.current to true on mousedown', () => {
    const cfg = makeScribbleConfig();
    const { handleStageMouseDown } = makeStageHandlers(cfg);
    const stage = makeFakeStage({ x: 100, y: 200 });
    handleStageMouseDown(makeFakeEvent(stage));
    expect(cfg.isScribblingRef.current).toBe(true);
  });

  it('initializes scribblePointsRef with the starting position', () => {
    const cfg = makeScribbleConfig();
    const { handleStageMouseDown } = makeStageHandlers(cfg);
    const stage = makeFakeStage({ x: 50, y: 75 });
    handleStageMouseDown(makeFakeEvent(stage));
    expect(cfg.scribblePointsRef.current).toEqual([50, 75]);
  });

  it('does not call onPendingToolPlace for scribble tool', () => {
    const cfg = makeScribbleConfig();
    const { handleStageMouseDown } = makeStageHandlers(cfg);
    handleStageMouseDown(makeFakeEvent(makeFakeStage({ x: 10, y: 10 })));
    expect(cfg.onPendingToolPlace).not.toHaveBeenCalled();
  });

  it('does not start scribble when getStage returns null', () => {
    const cfg = makeScribbleConfig();
    const { handleStageMouseDown } = makeStageHandlers(cfg);
    handleStageMouseDown({ target: { getStage: () => null } });
    expect(cfg.isScribblingRef.current).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleMouseMove — scribble point accumulation
// ---------------------------------------------------------------------------

describe('handleMouseMove — scribble point accumulation', () => {
  it('appends a new point when pointer moves >= 5 units', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: [0, 0] },
    });
    const { handleMouseMove } = makeStageHandlers(cfg);

    const stage = {
      getPointerPosition: () => ({ x: 10, y: 10 }),
      x: () => 0,
      y: () => 0,
      scaleX: () => 1,
      scaleY: () => 1,
    };
    handleMouseMove({ target: { getStage: () => stage } });

    // distance from (0,0) to (10,10) = ~14.1 >= 5
    expect(cfg.scribblePointsRef.current).toEqual([0, 0, 10, 10]);
  });

  it('calls onScribbleUpdate with updated points after appending', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: [0, 0] },
    });
    const { handleMouseMove } = makeStageHandlers(cfg);

    const stage = {
      getPointerPosition: () => ({ x: 10, y: 0 }),
      x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1,
    };
    handleMouseMove({ target: { getStage: () => stage } });

    expect(cfg.onScribbleUpdate).toHaveBeenCalledWith([0, 0, 10, 0]);
  });

  it('does not append a point when pointer moves < 5 units', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: [0, 0] },
    });
    const { handleMouseMove } = makeStageHandlers(cfg);

    const stage = {
      getPointerPosition: () => ({ x: 3, y: 0 }),
      x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1,
    };
    handleMouseMove({ target: { getStage: () => stage } });

    // distance = 3 < 5 — point should not be added
    expect(cfg.scribblePointsRef.current).toEqual([0, 0]);
    expect(cfg.onScribbleUpdate).not.toHaveBeenCalled();
  });

  it('does not accumulate points when not scribbling', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: false },
      scribblePointsRef: { current: [0, 0] },
    });
    const { handleMouseMove } = makeStageHandlers(cfg);

    const stage = {
      getPointerPosition: () => ({ x: 100, y: 100 }),
      x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1,
    };
    handleMouseMove({ target: { getStage: () => stage } });

    expect(cfg.scribblePointsRef.current).toEqual([0, 0]);
    expect(cfg.onScribbleUpdate).not.toHaveBeenCalled();
  });

  it('still updates cursor presence when scribbling', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: [0, 0] },
    });
    const { handleMouseMove } = makeStageHandlers(cfg);

    const stage = {
      getPointerPosition: () => ({ x: 50, y: 50 }),
      x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1,
    };
    handleMouseMove({ target: { getStage: () => stage } });

    expect(cfg.presence.updateCursor).toHaveBeenCalledWith(50, 50);
  });
});

// ---------------------------------------------------------------------------
// handleStageMouseUp — scribble commit
// ---------------------------------------------------------------------------

describe('handleStageMouseUp — scribble commit', () => {
  it('calls onScribbleCommit with accumulated points on mouseup', () => {
    const pts = [0, 0, 10, 0, 20, 5];
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: pts },
    });
    const { handleStageMouseUp } = makeStageHandlers(cfg);

    const stage = makeFakeStage({ x: 20, y: 5 });
    handleStageMouseUp(makeFakeEvent(stage));

    expect(cfg.onScribbleCommit).toHaveBeenCalledWith(pts);
  });

  it('sets isScribblingRef.current to false after commit', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: [0, 0, 10, 10] },
    });
    const { handleStageMouseUp } = makeStageHandlers(cfg);

    handleStageMouseUp(makeFakeEvent(makeFakeStage({ x: 10, y: 10 })));

    expect(cfg.isScribblingRef.current).toBe(false);
  });

  it('clears scribblePointsRef after commit', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: [0, 0, 5, 5] },
    });
    const { handleStageMouseUp } = makeStageHandlers(cfg);

    handleStageMouseUp(makeFakeEvent(makeFakeStage({ x: 5, y: 5 })));

    expect(cfg.scribblePointsRef.current).toEqual([]);
  });

  it('does not call onScribbleCommit when isScribblingRef is false', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: false },
      scribblePointsRef: { current: [0, 0] },
    });
    const { handleStageMouseUp } = makeStageHandlers(cfg);

    handleStageMouseUp(makeFakeEvent(makeFakeStage({ x: 10, y: 10 })));

    expect(cfg.onScribbleCommit).not.toHaveBeenCalled();
  });

  it('does not call addObject during scribble commit', () => {
    const cfg = makeScribbleConfig({
      isScribblingRef: { current: true },
      scribblePointsRef: { current: [0, 0, 10, 10] },
    });
    const { handleStageMouseUp } = makeStageHandlers(cfg);

    handleStageMouseUp(makeFakeEvent(makeFakeStage({ x: 10, y: 10 })));

    expect(cfg.addObject).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleStageClick — scribble tool is a no-op
// ---------------------------------------------------------------------------

describe('handleStageClick — scribble tool', () => {
  it('does not call onPendingToolPlace when scribble tool is active', () => {
    const cfg = makeScribbleConfig();
    const { handleStageClick } = makeStageHandlers(cfg);

    const stage = makeFakeStage({ x: 100, y: 100 });
    handleStageClick({ target: { getStage: () => stage, name: () => 'bg-rect' } });

    expect(cfg.onPendingToolPlace).not.toHaveBeenCalled();
  });

  it('does not call setSelectedId when scribble tool is active', () => {
    const cfg = makeScribbleConfig();
    const { handleStageClick } = makeStageHandlers(cfg);

    const stage = makeFakeStage({ x: 100, y: 100 });
    handleStageClick({ target: { getStage: () => stage, name: () => 'bg-rect' } });

    expect(cfg.setSelectedId).not.toHaveBeenCalled();
  });
});
