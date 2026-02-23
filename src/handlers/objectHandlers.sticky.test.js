import { describe, it, expect, vi } from 'vitest';
import { makeObjectHandlers } from './objectHandlers.js';

// Story-110: sticky note dimension fallbacks in handleDragMove and handleContainedDragEnd.
// Pre-fix: a sticky object with no width/height fell back to 150 in both paths.
// Post-fix: the fallback is 200 for sticky objects.
//
// Geometry used throughout: FRAME_MARGIN = 20.
// rectsOverlap with margin M: overlap when obj_right + M > sibling_x.
// For obj at x=0:
//   - sticky (width=200): 200 + 20 = 220 > sibling_x=175 → overlap
//   - rectangle (width=150): 150 + 20 = 170 <= sibling_x=175 → NO overlap
// sibling frame placed at x=175 to differentiate the two cases.

const SIBLING_X = 175;

function makeBoard(objects) {
  return {
    objects,
    addObject: vi.fn(),
    updateObject: vi.fn(),
    deleteObject: vi.fn(),
    batchUpdateObjects: vi.fn(),
    batchWriteAndDelete: vi.fn(),
  };
}

function makeHandlers(objects) {
  const board = makeBoard(objects);
  const setDragState = vi.fn();
  const handlers = makeObjectHandlers({
    board,
    stageRef: { current: null },
    snap: (v) => v,
    setDragState,
    setSelectedId: vi.fn(),
    setSelectedIds: vi.fn(),
    stagePos: { x: 0, y: 0 },
    stageScale: 1,
    setShapeColors: vi.fn(),
    setDragPos: vi.fn(),
    updateColorHistory: vi.fn(),
    setResizeTooltip: vi.fn(),
    resizeTooltipTimer: { current: null },
  });
  return { board, setDragState, handlers };
}

// ---------------------------------------------------------------------------
// handleDragMove — sticky dimension fallback
// ---------------------------------------------------------------------------

describe('handleDragMove — sticky dimension fallback', () => {
  it('marks drag illegal when sticky (no explicit width) overlaps sibling frame — uses 200 default', () => {
    // sticky right edge with margin: 0 + 200 + 20 = 220 > SIBLING_X=175 → overlap
    const objects = {
      stickyObj: { id: 'stickyObj', type: 'sticky', x: 300, y: 0, frameId: null },
      siblingFrame: {
        id: 'siblingFrame', type: 'frame',
        x: SIBLING_X, y: 0, width: 200, height: 200,
        frameId: null, childIds: [],
      },
    };
    const { setDragState, handlers } = makeHandlers(objects);

    handlers.handleDragMove('stickyObj', { x: 0, y: 0 });

    const call = setDragState.mock.calls[0]?.[0];
    expect(call?.illegalDrag).toBe(true);
  });

  it('marks drag illegal when sticky (no explicit height) overlaps sibling frame vertically — uses 200 default', () => {
    // sticky bottom edge with margin: 0 + 200 + 20 = 220 > SIBLING_Y=175 → overlap
    const objects = {
      stickyObj: { id: 'stickyObj', type: 'sticky', x: 0, y: 300, frameId: null },
      siblingFrame: {
        id: 'siblingFrame', type: 'frame',
        x: 0, y: SIBLING_X, width: 200, height: 200,
        frameId: null, childIds: [],
      },
    };
    const { setDragState, handlers } = makeHandlers(objects);

    handlers.handleDragMove('stickyObj', { x: 0, y: 0 });

    const call = setDragState.mock.calls[0]?.[0];
    expect(call?.illegalDrag).toBe(true);
  });

  it('does not flag illegal drag for a rectangle without dimensions (uses 150 default) with sibling frame at 175', () => {
    // rectangle right edge with margin: 0 + 150 + 20 = 170 <= 175 → no overlap
    const objects = {
      rectObj: { id: 'rectObj', type: 'rectangle', x: 300, y: 0, frameId: null },
      siblingFrame: {
        id: 'siblingFrame', type: 'frame',
        x: SIBLING_X, y: 0, width: 200, height: 200,
        frameId: null, childIds: [],
      },
    };
    const { setDragState, handlers } = makeHandlers(objects);

    handlers.handleDragMove('rectObj', { x: 0, y: 0 });

    const call = setDragState.mock.calls[0]?.[0];
    expect(call?.illegalDrag).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleContainedDragEnd — sticky dimension fallback
// ---------------------------------------------------------------------------

describe('handleContainedDragEnd — sticky dimension fallback', () => {
  it('rejects drop when sticky (no width) at x=0 overlaps sibling frame — uses ow=200', () => {
    // 0 + 200 + 20 = 220 > SIBLING_X=175 → overlap → rejected
    const objects = {
      stickyObj: { id: 'stickyObj', type: 'sticky', x: 500, y: 0, frameId: null },
      siblingFrame: {
        id: 'siblingFrame', type: 'frame',
        x: SIBLING_X, y: 0, width: 200, height: 200,
        frameId: null, childIds: [],
      },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleContainedDragEnd('stickyObj', { x: 0, y: 0 });

    expect(board.updateObject).not.toHaveBeenCalled();
    expect(board.batchUpdateObjects).not.toHaveBeenCalled();
  });

  it('accepts drop for a sticky with no width at x=0 when no sibling frame is nearby', () => {
    const objects = {
      stickyObj: { id: 'stickyObj', type: 'sticky', x: 500, y: 0, frameId: null },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleContainedDragEnd('stickyObj', { x: 0, y: 0 });

    expect(board.updateObject).toHaveBeenCalledWith(
      'stickyObj',
      expect.objectContaining({ x: 0, y: 0, frameId: null }),
    );
  });

  it('accepts drop for a rectangle without width at x=0 with sibling frame at 175 (ow=150, fits)', () => {
    // 0 + 150 + 20 = 170 <= 175 → no overlap → accepted
    const objects = {
      rectObj: { id: 'rectObj', type: 'rectangle', x: 500, y: 0, frameId: null },
      siblingFrame: {
        id: 'siblingFrame', type: 'frame',
        x: SIBLING_X, y: 0, width: 200, height: 200,
        frameId: null, childIds: [],
      },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleContainedDragEnd('rectObj', { x: 0, y: 0 });

    expect(board.updateObject).toHaveBeenCalled();
  });
});
