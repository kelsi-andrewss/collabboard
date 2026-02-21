import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeTransformHandlers } from './transformHandlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoard(objects = {}) {
  return {
    objects,
    updateObject: vi.fn(),
    batchUpdateObjects: vi.fn(),
  };
}

/**
 * Build a minimal Konva node stub that returns the given x/y/width values.
 * getClientRect({ skipTransform: true }) returns the intrinsic (unscaled) width,
 * matching the round-2 fix that replaced node.width() * node.scaleX().
 */
function makeKonvaNode({ x = 0, y = 0, width = 400 } = {}) {
  return {
    x: () => x,
    y: () => y,
    getClientRect: ({ skipTransform } = {}) => ({ width, height: 0, x, y }),
  };
}

/**
 * Build a stageRef stub. If `node` is provided, findOne returns it;
 * otherwise findOne returns null (simulating "node not found").
 */
function makeStageRef(node = null) {
  return {
    current: {
      findOne: vi.fn(() => node),
    },
  };
}

function makeHandlers({ objects = {}, stageRef = makeStageRef(), stageScale = 1, stagePos = { x: 0, y: 0 } } = {}) {
  const board = makeBoard(objects);
  const setResizeTooltip = vi.fn();
  const resizeTooltipTimer = { current: null };

  const handlers = makeTransformHandlers({
    board,
    stageRef,
    stageScale,
    stagePos,
    setResizeTooltip,
    resizeTooltipTimer,
  });

  return { board, handlers, setResizeTooltip, resizeTooltipTimer };
}

// ---------------------------------------------------------------------------
// handleResizeClamped — tooltip position source
// ---------------------------------------------------------------------------

describe('handleResizeClamped — tooltip position', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when the object id is not in board.objects', () => {
    const { handlers, setResizeTooltip } = makeHandlers({ objects: {} });
    handlers.handleResizeClamped('nonexistent');
    expect(setResizeTooltip).not.toHaveBeenCalled();
  });

  it('does nothing when stageRef.current is null', () => {
    const objects = { f1: { id: 'f1', type: 'frame', x: 10, y: 20, width: 400 } };
    const stageRef = { current: null };
    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef });
    handlers.handleResizeClamped('f1');
    expect(setResizeTooltip).not.toHaveBeenCalled();
  });

  it('uses live node position when the Konva node exists', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { f1: obj };
    const node = makeKonvaNode({ x: 50, y: 80, width: 300, scaleX: 1 });
    const stageRef = makeStageRef(node);
    const stageScale = 1;
    const stagePos = { x: 0, y: 0 };

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef, stageScale, stagePos });
    handlers.handleResizeClamped('f1');

    expect(setResizeTooltip).toHaveBeenCalledOnce();
    const tooltip = setResizeTooltip.mock.calls[0][0];

    // x should be centred: liveX * scale + stagePos.x + liveW / 2 = 50 + 150 = 200
    expect(tooltip.x).toBe(200);
    // y: liveY * scale + stagePos.y - 12 = 80 - 12 = 68
    expect(tooltip.y).toBe(68);
  });

  it('falls back to object.x / object.y when findOne returns null', () => {
    const obj = { id: 'f1', type: 'frame', x: 100, y: 200, width: 400 };
    const objects = { f1: obj };
    const stageRef = makeStageRef(null); // node not found
    const stageScale = 1;
    const stagePos = { x: 0, y: 0 };

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef, stageScale, stagePos });
    handlers.handleResizeClamped('f1');

    expect(setResizeTooltip).toHaveBeenCalledOnce();
    const tooltip = setResizeTooltip.mock.calls[0][0];

    // Falls back: x centred on obj.x + obj.width/2 = 100 + 200 = 300
    expect(tooltip.x).toBe(300);
    // y: obj.y - 12 = 200 - 12 = 188
    expect(tooltip.y).toBe(188);
  });

  it('accounts for stageScale when converting live node position to screen coords', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { f1: obj };
    const node = makeKonvaNode({ x: 100, y: 50, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);
    const stageScale = 2;
    const stagePos = { x: 0, y: 0 };

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef, stageScale, stagePos });
    handlers.handleResizeClamped('f1');

    const tooltip = setResizeTooltip.mock.calls[0][0];
    // screenX = 100 * 2 = 200; objW = 200 * 2 = 400; x = 200 + 200 = 400
    expect(tooltip.x).toBe(400);
    // screenY = 50 * 2 - 12 = 88
    expect(tooltip.y).toBe(88);
  });

  it('accounts for stagePos offset when converting node position to screen coords', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { f1: obj };
    const node = makeKonvaNode({ x: 10, y: 20, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);
    const stageScale = 1;
    const stagePos = { x: 30, y: 40 };

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef, stageScale, stagePos });
    handlers.handleResizeClamped('f1');

    const tooltip = setResizeTooltip.mock.calls[0][0];
    // screenX = 10 + 30 = 40; objW = 200; x = 40 + 100 = 140
    expect(tooltip.x).toBe(140);
    // screenY = 20 + 40 - 12 = 48
    expect(tooltip.y).toBe(48);
  });

  it('uses getClientRect intrinsic width to centre the tooltip', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 100 };
    const objects = { f1: obj };
    // getClientRect({ skipTransform: true }) returns intrinsic width = 200
    const node = makeKonvaNode({ x: 0, y: 0, width: 200 });
    const stageRef = makeStageRef(node);
    const stageScale = 1;
    const stagePos = { x: 0, y: 0 };

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef, stageScale, stagePos });
    handlers.handleResizeClamped('f1');

    const tooltip = setResizeTooltip.mock.calls[0][0];
    // liveW = getClientRect({ skipTransform: true }).width = 200; centreX = 0 + 100 = 100
    expect(tooltip.x).toBe(100);
  });

  it('reflects live drag position, not stale object coords, when node has moved', () => {
    // Object is at (0,0) in Firestore but mid-drag the Konva node is at (300, 400)
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { f1: obj };
    const node = makeKonvaNode({ x: 300, y: 400, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef });
    handlers.handleResizeClamped('f1');

    const tooltip = setResizeTooltip.mock.calls[0][0];
    // Tooltip must follow drag position, not the stale obj.x = 0
    expect(tooltip.x).not.toBe(100);  // 100 would be from stale obj.x + objW/2
    expect(tooltip.x).toBe(400);       // 300 (live) + 200/2
  });

  it('passes the correct error message to the tooltip', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { f1: obj };
    const node = makeKonvaNode({ x: 0, y: 0, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef });
    handlers.handleResizeClamped('f1');

    const tooltip = setResizeTooltip.mock.calls[0][0];
    expect(tooltip.msg).toBe('Parent cannot be smaller than child. Remove child first.');
  });

  it('auto-dismisses the tooltip after 2500 ms', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { f1: obj };
    const node = makeKonvaNode({ x: 0, y: 0, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef });
    handlers.handleResizeClamped('f1');

    expect(setResizeTooltip).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(2500);
    // The dismiss callback passes null
    expect(setResizeTooltip).toHaveBeenCalledWith(null);
  });

  it('flips tooltip below the object when screen Y is less than 40', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200, height: 100 };
    const objects = { f1: obj };
    // Node near top of viewport so screenY - 12 would be negative → flipY
    const node = makeKonvaNode({ x: 0, y: 10, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);
    const stageScale = 1;
    const stagePos = { x: 0, y: 0 };

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef, stageScale, stagePos });
    handlers.handleResizeClamped('f1');

    const tooltip = setResizeTooltip.mock.calls[0][0];
    // screenY = 10 - 12 = -2 which is < 40 → flipY = true
    expect(tooltip.flipY).toBe(true);
  });

  it('does not flip tooltip when screen Y is at or above 40', () => {
    const obj = { id: 'f1', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { f1: obj };
    // Node far enough down that screenY - 12 >= 40
    const node = makeKonvaNode({ x: 0, y: 100, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);
    const stageScale = 1;
    const stagePos = { x: 0, y: 0 };

    const { handlers, setResizeTooltip } = makeHandlers({ objects, stageRef, stageScale, stagePos });
    handlers.handleResizeClamped('f1');

    const tooltip = setResizeTooltip.mock.calls[0][0];
    // screenY = 100 - 12 = 88 >= 40 → flipY = false
    expect(tooltip.flipY).toBe(false);
  });

  it('uses findOne with the object id prefixed by a dot to look up the Konva node', () => {
    const obj = { id: 'abc123', type: 'frame', x: 0, y: 0, width: 200 };
    const objects = { abc123: obj };
    const node = makeKonvaNode({ x: 0, y: 100, width: 200, scaleX: 1 });
    const stageRef = makeStageRef(node);

    const { handlers } = makeHandlers({ objects, stageRef });
    handlers.handleResizeClamped('abc123');

    expect(stageRef.current.findOne).toHaveBeenCalledWith('.abc123');
  });
});

// ---------------------------------------------------------------------------
// handleTransformEnd — basic contract (not story-036 focus, quick smoke tests)
// ---------------------------------------------------------------------------

describe('handleTransformEnd — basic contract', () => {
  it('calls updateObject when object has no frameId and no connector updates', () => {
    const obj = { id: 's1', type: 'sticky', x: 0, y: 0, width: 150, height: 150, frameId: null };
    const board = makeBoard({ s1: obj });
    const setResizeTooltip = vi.fn();
    const handlers = makeTransformHandlers({
      board,
      stageRef: makeStageRef(),
      stageScale: 1,
      stagePos: { x: 0, y: 0 },
      setResizeTooltip,
      resizeTooltipTimer: { current: null },
    });

    handlers.handleTransformEnd('s1', { x: 10, y: 20, width: 150, height: 150 });

    expect(board.updateObject).toHaveBeenCalledWith('s1', expect.objectContaining({ x: 10, y: 20 }));
  });

  it('calls updateObject when object id is not found (no-op guard)', () => {
    const board = makeBoard({});
    const handlers = makeTransformHandlers({
      board,
      stageRef: makeStageRef(),
      stageScale: 1,
      stagePos: { x: 0, y: 0 },
      setResizeTooltip: vi.fn(),
      resizeTooltipTimer: { current: null },
    });

    handlers.handleTransformEnd('missing', { x: 5, y: 5 });

    expect(board.updateObject).toHaveBeenCalledWith('missing', { x: 5, y: 5 });
  });
});
