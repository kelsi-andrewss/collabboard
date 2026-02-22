import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFrameDragHandlers } from './frameDragHandlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoard(objects = {}) {
  return {
    objects,
    batchUpdateObjects: vi.fn(),
  };
}

/**
 * Build a minimal Konva stage stub.
 * findOne returns a node stub if the name matches a key in nodeMap;
 * otherwise returns null.
 */
function makeStageRef(nodeMap = {}) {
  const nodes = {};
  for (const id of Object.keys(nodeMap)) {
    nodes[id] = { x: vi.fn(), y: vi.fn() };
  }
  return {
    current: {
      findOne: vi.fn((selector) => {
        const id = selector.replace(/^\./, '');
        return nodes[id] || null;
      }),
      getLayers: vi.fn(() => [{ batchDraw: vi.fn() }]),
      getPointerPosition: vi.fn(() => null),
      batchDraw: vi.fn(),
    },
    _nodes: nodes,
  };
}

function makeFrameDragRef() {
  return { current: { frameId: null, dx: 0, dy: 0, startX: 0, startY: 0 } };
}

function makeHandlers({
  objects = {},
  stageRefArg = null,
  snap = (v) => v,
  setDragPos = vi.fn(),
  setDragState = vi.fn(),
  setResizeTooltip = vi.fn(),
} = {}) {
  const board = makeBoard(objects);
  const frameDragRef = makeFrameDragRef();
  const stageRef = stageRefArg || makeStageRef();

  const handlers = makeFrameDragHandlers({
    board,
    stageRef,
    snap,
    frameDragRef,
    setDragState,
    handleDragMove: vi.fn(),
    stagePos: { x: 0, y: 0 },
    stageScale: 1,
    setResizeTooltip,
    resizeTooltipTimer: { current: null },
    setDragPos,
  });

  return { board, frameDragRef, stageRef, setDragPos, setDragState, handlers };
}

// ---------------------------------------------------------------------------
// handleFrameDragMove — story-047: setDragPos is called during drag
// ---------------------------------------------------------------------------

describe('handleFrameDragMove — setDragPos called in real-time', () => {
  it('calls setDragPos with the current frame id and new position', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const setDragPos = vi.fn();
    const { handlers } = makeHandlers({ objects, setDragPos });

    handlers.handleFrameDragMove('f1', { x: 50, y: 80 });

    expect(setDragPos).toHaveBeenCalledOnce();
    expect(setDragPos).toHaveBeenCalledWith({ id: 'f1', x: 50, y: 80 });
  });

  it('calls setDragPos on every move event, not just the first', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const setDragPos = vi.fn();
    const { handlers } = makeHandlers({ objects, setDragPos });

    handlers.handleFrameDragMove('f1', { x: 10, y: 20 });
    handlers.handleFrameDragMove('f1', { x: 30, y: 40 });

    expect(setDragPos).toHaveBeenCalledTimes(2);
    expect(setDragPos).toHaveBeenNthCalledWith(2, { id: 'f1', x: 30, y: 40 });
  });

  it('does not throw when setDragPos is undefined (optional param)', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const board = makeBoard(objects);
    const frameDragRef = makeFrameDragRef();
    const stageRef = makeStageRef();

    expect(() => {
      const handlers = makeFrameDragHandlers({
        board,
        stageRef,
        snap: (v) => v,
        frameDragRef,
        setDragState: vi.fn(),
        handleDragMove: vi.fn(),
        stagePos: { x: 0, y: 0 },
        stageScale: 1,
        setResizeTooltip: vi.fn(),
        resizeTooltipTimer: { current: null },
        setDragPos: undefined,
      });
      handlers.handleFrameDragMove('f1', { x: 50, y: 80 });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// handleFrameDragMove — frameDragRef updates
// ---------------------------------------------------------------------------

describe('handleFrameDragMove — frameDragRef tracking', () => {
  it('sets frameDragRef.current.frameId to the dragged frame id', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 100, y: 200, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const { handlers, frameDragRef } = makeHandlers({ objects });

    handlers.handleFrameDragMove('f1', { x: 110, y: 210 });

    expect(frameDragRef.current.frameId).toBe('f1');
  });

  it('computes dx and dy as delta from the stored frame position', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 100, y: 200, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const { handlers, frameDragRef } = makeHandlers({ objects });

    handlers.handleFrameDragMove('f1', { x: 150, y: 240 });

    expect(frameDragRef.current.dx).toBe(50);
    expect(frameDragRef.current.dy).toBe(40);
  });

  it('records startX and startY from the frame on the first drag event', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 100, y: 200, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const { handlers, frameDragRef } = makeHandlers({ objects });

    handlers.handleFrameDragMove('f1', { x: 150, y: 240 });

    expect(frameDragRef.current.startX).toBe(100);
    expect(frameDragRef.current.startY).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// handleFrameDragMove — early-return guards
// ---------------------------------------------------------------------------

describe('handleFrameDragMove — guard conditions', () => {
  it('does nothing when the frame id is not in board.objects', () => {
    const setDragPos = vi.fn();
    const setDragState = vi.fn();
    const { handlers } = makeHandlers({ objects: {}, setDragPos, setDragState });

    handlers.handleFrameDragMove('nonexistent', { x: 50, y: 80 });

    expect(setDragPos).not.toHaveBeenCalled();
    expect(setDragState).not.toHaveBeenCalled();
  });

  it('returns before setDragPos when stageRef.current is null', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const setDragPos = vi.fn();
    const nullStageRef = { current: null };
    const { handlers } = makeHandlers({ objects, stageRefArg: nullStageRef, setDragPos });

    handlers.handleFrameDragMove('f1', { x: 50, y: 80 });

    expect(setDragPos).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleFrameDragMove — descendant node movement
// ---------------------------------------------------------------------------

describe('handleFrameDragMove — descendant nodes moved imperatively', () => {
  it('moves a direct child node by dx/dy relative to its stored position', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: ['c1'] },
      c1: { id: 'c1', type: 'sticky', x: 50, y: 60, frameId: 'f1' },
    };
    const stageRefArg = makeStageRef({ c1: {} });
    const { handlers } = makeHandlers({ objects, stageRefArg });

    handlers.handleFrameDragMove('f1', { x: 100, y: 0 });

    const childNode = stageRefArg.current.findOne('.c1');
    // dx = 100 - 0 = 100, so child should move to 50 + 100 = 150
    expect(childNode.x).toHaveBeenCalledWith(150);
    expect(childNode.y).toHaveBeenCalledWith(60);
  });
});

// ---------------------------------------------------------------------------
// handleFrameDragEnd — story-047: setDragPos called after successful drop
// ---------------------------------------------------------------------------

describe('handleFrameDragEnd — setDragPos called on successful drop', () => {
  it('calls setDragPos with the frame id and snapped position', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const setDragPos = vi.fn();
    const { board, handlers } = makeHandlers({ objects, setDragPos });

    handlers.handleFrameDragEnd('f1', { x: 100, y: 200 });

    expect(setDragPos).toHaveBeenCalledOnce();
    expect(setDragPos).toHaveBeenCalledWith({ id: 'f1', x: 100, y: 200 });
    expect(board.batchUpdateObjects).toHaveBeenCalledOnce();
  });

  it('uses the snap function before passing coordinates to setDragPos', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const setDragPos = vi.fn();
    const snap = (v) => Math.round(v / 20) * 20;
    const { handlers } = makeHandlers({ objects, setDragPos, snap });

    handlers.handleFrameDragEnd('f1', { x: 107, y: 193 });

    // 107 snaps to 100, 193 snaps to 200
    expect(setDragPos).toHaveBeenCalledWith({ id: 'f1', x: 100, y: 200 });
  });
});

// ---------------------------------------------------------------------------
// handleFrameDragEnd — batch update correctness
// ---------------------------------------------------------------------------

describe('handleFrameDragEnd — batch update includes frame and descendants', () => {
  it('includes the primary frame update with new position and null frameId', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const { board, handlers } = makeHandlers({ objects });

    handlers.handleFrameDragEnd('f1', { x: 100, y: 200 });

    expect(board.batchUpdateObjects).toHaveBeenCalledOnce();
    const [updates] = board.batchUpdateObjects.mock.calls[0];
    const frameUpdate = updates.find((u) => u.id === 'f1');
    expect(frameUpdate).toBeDefined();
    expect(frameUpdate.data).toMatchObject({ x: 100, y: 200, frameId: null });
  });

  it('includes position updates for each descendant offset by dx/dy', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: ['c1'] },
      c1: { id: 'c1', type: 'sticky', x: 50, y: 60, frameId: 'f1' },
    };
    const { board, handlers } = makeHandlers({ objects });

    handlers.handleFrameDragEnd('f1', { x: 100, y: 0 });

    const [updates] = board.batchUpdateObjects.mock.calls[0];
    const childUpdate = updates.find((u) => u.id === 'c1');
    expect(childUpdate).toBeDefined();
    // dx = 100, dy = 0 → child moves from (50,60) to (150,60)
    expect(childUpdate.data).toMatchObject({ x: 150, y: 60 });
  });

  it('resets frameDragRef to idle state after a successful drop', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const { handlers, frameDragRef } = makeHandlers({ objects });

    handlers.handleFrameDragEnd('f1', { x: 50, y: 50 });

    expect(frameDragRef.current.frameId).toBeNull();
    expect(frameDragRef.current.dx).toBe(0);
    expect(frameDragRef.current.dy).toBe(0);
  });

  it('calls setDragState with all-clear values after a successful drop', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 0, y: 0, width: 400, height: 300, frameId: null, childIds: [] },
    };
    const setDragState = vi.fn();
    const { handlers } = makeHandlers({ objects, setDragState });

    handlers.handleFrameDragEnd('f1', { x: 50, y: 50 });

    const lastCall = setDragState.mock.calls[setDragState.mock.calls.length - 1][0];
    expect(lastCall).toMatchObject({ draggingId: null, overFrameId: null, action: null, illegalDrag: false });
  });
});

// ---------------------------------------------------------------------------
// handleFrameDragEnd — abort when frame not found
// ---------------------------------------------------------------------------

describe('handleFrameDragEnd — guard conditions', () => {
  it('does nothing when the frame id is not in board.objects', () => {
    const setDragPos = vi.fn();
    const { board, handlers } = makeHandlers({ objects: {}, setDragPos });

    handlers.handleFrameDragEnd('nonexistent', { x: 50, y: 50 });

    expect(board.batchUpdateObjects).not.toHaveBeenCalled();
    expect(setDragPos).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleFrameDragEnd — sibling overlap aborts the drop
// ---------------------------------------------------------------------------

describe('handleFrameDragEnd — sibling overlap aborts the drop', () => {
  // Geometry: f2 sits at (0, 0) with size (200, 200).
  // f1 starts at (500, 0) and is dropped at (150, 150) with size (200, 200).
  // f1's center at drop = (250, 250) — NOT inside f2 (0,0,200,200) so no parent adoption.
  // But f1 rect (150,150,200,200) and f2 rect (0,0,200,200) DO overlap (x overlap: 150<200).
  // With FRAME_MARGIN=20, rectsOverlap returns true → sibling overlap → abort.
  it('does not call batchUpdateObjects when the drop position overlaps a sibling frame', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 500, y: 0, width: 200, height: 200, frameId: null, childIds: [] },
      f2: { id: 'f2', type: 'frame', x: 0, y: 0, width: 200, height: 200, frameId: null, childIds: [] },
    };
    const f1Node = { x: vi.fn(), y: vi.fn() };
    const stageRefArg = makeStageRef();
    stageRefArg.current.findOne = vi.fn((sel) => (sel === '.f1' ? f1Node : null));

    const setDragPos = vi.fn();
    const { board, handlers } = makeHandlers({ objects, stageRefArg, setDragPos });

    handlers.handleFrameDragEnd('f1', { x: 150, y: 150 });

    expect(board.batchUpdateObjects).not.toHaveBeenCalled();
  });

  it('does not call setDragPos when the drop is aborted due to sibling overlap', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 500, y: 0, width: 200, height: 200, frameId: null, childIds: [] },
      f2: { id: 'f2', type: 'frame', x: 0, y: 0, width: 200, height: 200, frameId: null, childIds: [] },
    };
    const f1Node = { x: vi.fn(), y: vi.fn() };
    const stageRefArg = makeStageRef();
    stageRefArg.current.findOne = vi.fn((sel) => (sel === '.f1' ? f1Node : null));

    const setDragPos = vi.fn();
    const { handlers } = makeHandlers({ objects, stageRefArg, setDragPos });

    handlers.handleFrameDragEnd('f1', { x: 150, y: 150 });

    expect(setDragPos).not.toHaveBeenCalled();
  });

  it('resets the Konva node position to the pre-drag location on abort', () => {
    const objects = {
      f1: { id: 'f1', type: 'frame', x: 500, y: 100, width: 200, height: 200, frameId: null, childIds: [] },
      f2: { id: 'f2', type: 'frame', x: 0, y: 0, width: 200, height: 200, frameId: null, childIds: [] },
    };
    const f1Node = { x: vi.fn(), y: vi.fn() };
    const stageRefArg = makeStageRef();
    stageRefArg.current.findOne = vi.fn((sel) => (sel === '.f1' ? f1Node : null));

    const { handlers } = makeHandlers({ objects, stageRefArg });

    handlers.handleFrameDragEnd('f1', { x: 150, y: 150 });

    // Node should be reset to original position (500, 100)
    expect(f1Node.x).toHaveBeenCalledWith(500);
    expect(f1Node.y).toHaveBeenCalledWith(100);
  });
});
