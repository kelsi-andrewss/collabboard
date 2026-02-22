import { describe, it, expect, vi } from 'vitest';
import { makeTransformHandlers } from './transformHandlers.js';
import { FRAME_MARGIN } from '../utils/frameUtils.js';

// Story-110: sticky note dimension fallbacks in handleTransformEnd.
// Two changed lines:
//   1. Frame child clamping loop (cw/ch fallback for sticky children)
//   2. Ancestor expansion call (childW/childH fallback when transformed object is a sticky)

function makeBoard(objects = {}) {
  return {
    objects,
    updateObject: vi.fn(),
    batchUpdateObjects: vi.fn(),
  };
}

function makeHandlers(objects = {}) {
  const board = makeBoard(objects);
  const handlers = makeTransformHandlers({
    board,
    stageRef: { current: null },
    stageScale: 1,
    stagePos: { x: 0, y: 0 },
    setResizeTooltip: vi.fn(),
    resizeTooltipTimer: { current: null },
  });
  return { board, handlers };
}

// ---------------------------------------------------------------------------
// Frame child clamping: cw/ch fallback for sticky (handleTransformEnd lines 48-49)
// ---------------------------------------------------------------------------

describe('handleTransformEnd frame child clamping — sticky dimension fallback', () => {
  it('expands frame bottom edge to cover a sticky child with no height (uses 200, not 150)', () => {
    // Frame h=300. Sticky child at y=150, no explicit height.
    // Correct default ch=200: maxChildY = 150+200=350. Frame bottom = 0+300=300 < 350.
    // Clamp must push bottom to at least 350 + FRAME_MARGIN = 370.
    // With old ch=150: maxChildY = 300 == frame bottom — no expansion needed (the bug).
    const frame = {
      id: 'frame', type: 'frame',
      x: 0, y: 0, width: 400, height: 300,
      frameId: null, childIds: ['child'],
    };
    const child = {
      id: 'child', type: 'sticky',
      x: 50, y: 150,
      frameId: 'frame',
    };
    const objects = { frame, child };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleTransformEnd('frame', { x: 0, y: 0, width: 400, height: 300 });

    const written = board.updateObject.mock.calls[0]?.[1];
    const bottom = (written?.y ?? 0) + (written?.height ?? 300);
    expect(bottom).toBeGreaterThanOrEqual(150 + 200 + FRAME_MARGIN);
  });

  it('expands frame right edge to cover a sticky child with no width (uses 200, not 150)', () => {
    // Frame w=300. Sticky child at x=160, no explicit width.
    // Correct default cw=200: maxChildX = 160+200=360. Frame right = 0+300=300 < 360.
    // Clamp must push right to at least 360 + FRAME_MARGIN = 380.
    const frame = {
      id: 'frame', type: 'frame',
      x: 0, y: 0, width: 300, height: 400,
      frameId: null, childIds: ['child'],
    };
    const child = {
      id: 'child', type: 'sticky',
      x: 160, y: 50,
      frameId: 'frame',
    };
    const objects = { frame, child };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleTransformEnd('frame', { x: 0, y: 0, width: 300, height: 400 });

    const written = board.updateObject.mock.calls[0]?.[1];
    const right = (written?.x ?? 0) + (written?.width ?? 300);
    expect(right).toBeGreaterThanOrEqual(160 + 200 + FRAME_MARGIN);
  });

  it('frame bottom edge is not over-expanded for a non-sticky child with no height (150 default)', () => {
    // Frame h=400 (ample). Rectangle child at y=100, no height. Default ch=150.
    // maxChildY = 100 + 150 = 250. Frame bottom = 400 > 250+FRAME_MARGIN=270.
    // No bottom expansion — frame height stays at 400.
    // If sticky default (200) were used instead: maxChildY=300, still < 400, also no expansion.
    // Key: with either default, no expansion. But the critical difference is:
    // if frame height were exactly 270 (= 250+FRAME_MARGIN), with 150 it fits exactly,
    // with 200 the clamp would fire and expand to 320. We use a frame tuned to 270.
    const frame = {
      id: 'frame', type: 'frame',
      x: 0, y: 0, width: 400, height: 270,
      frameId: null, childIds: ['child'],
    };
    const child = {
      id: 'child', type: 'rectangle',
      x: 50, y: 100,
      frameId: 'frame',
    };
    const objects = { frame, child };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleTransformEnd('frame', { x: 0, y: 0, width: 400, height: 270 });

    const written = board.updateObject.mock.calls[0]?.[1];
    const bottom = (written?.y ?? 0) + (written?.height ?? 270);
    // With correct 150 default: maxChildY=250, 250+20=270 = frame bottom — no expansion.
    // With wrong 200 default: maxChildY=300, 300+20=320 > 270 — expansion fires.
    // So the frame bottom must stay at 270 (no expansion).
    expect(bottom).toBe(270);
  });
});

// ---------------------------------------------------------------------------
// Ancestor expansion call: childW/childH fallback for sticky (lines 102-103)
// ---------------------------------------------------------------------------

describe('handleTransformEnd ancestor expansion — sticky dimension fallback', () => {
  it('triggers ancestor expansion when sticky with no explicit width is transformed inside a 160-wide frame', () => {
    // Sticky (no width) inside parent (width=160).
    // childW fallback = 200 (sticky): right edge 0+200=200 > 160 → parent must expand.
    // With old fallback=150: right=150 < 160 — no expansion needed (the bug).
    const grandparent = {
      id: 'gp', type: 'frame',
      x: 0, y: 0, width: 600, height: 600,
      frameId: null, childIds: ['parent'],
    };
    const parent = {
      id: 'parent', type: 'frame',
      x: 0, y: 0, width: 160, height: 400,
      frameId: 'gp', childIds: ['stickyObj'],
    };
    const stickyObj = {
      id: 'stickyObj', type: 'sticky',
      x: 0, y: 50,
      frameId: 'parent',
    };
    const objects = { gp: grandparent, parent, stickyObj };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleTransformEnd('stickyObj', { x: 0, y: 50 });

    expect(board.batchUpdateObjects).toHaveBeenCalled();
    const updates = board.batchUpdateObjects.mock.calls[0][0];
    const parentUpdate = updates.find(u => u.id === 'parent');
    expect(parentUpdate).toBeDefined();
    expect(parentUpdate.data.width).toBeGreaterThanOrEqual(200 + FRAME_MARGIN);
  });

  it('ancestor expansion for sticky uses width 200, producing wider update than rectangle default of 150', () => {
    // Two runs: one with sticky (default 200), one with rectangle (default 150).
    // Both inside a tight 160-wide parent. The sticky expansion must be wider.
    const makeObjects = (type) => ({
      gp: { id: 'gp', type: 'frame', x: 0, y: 0, width: 600, height: 600, frameId: null, childIds: ['parent'] },
      parent: { id: 'parent', type: 'frame', x: 0, y: 0, width: 160, height: 400, frameId: 'gp', childIds: ['obj'] },
      obj: { id: 'obj', type, x: 0, y: 50, frameId: 'parent' },
    });

    const { board: boardSticky, handlers: handlersSticky } = makeHandlers(makeObjects('sticky'));
    handlersSticky.handleTransformEnd('obj', { x: 0, y: 50 });
    const stickyUpdate = boardSticky.batchUpdateObjects.mock.calls[0][0].find(u => u.id === 'parent');

    const { board: boardRect, handlers: handlersRect } = makeHandlers(makeObjects('rectangle'));
    handlersRect.handleTransformEnd('obj', { x: 0, y: 50 });
    const rectUpdate = boardRect.batchUpdateObjects.mock.calls[0][0].find(u => u.id === 'parent');

    // Sticky expansion must be wider than rectangle expansion (200 > 150)
    expect(stickyUpdate.data.width).toBeGreaterThan(rectUpdate.data.width);
  });
});
