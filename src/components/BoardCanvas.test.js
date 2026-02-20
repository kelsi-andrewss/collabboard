import { describe, it, expect, vi } from 'vitest';
import { multiSelectHit, sortObjects, computeVisibleIds, areEqual, computeGridDimensions, GRID_CELL_LIMIT } from './BoardCanvas.jsx';

// ---------------------------------------------------------------------------
// multiSelectHit
// ---------------------------------------------------------------------------

describe('multiSelectHit', () => {
  const rect = { x: 100, y: 100, width: 200, height: 200 };

  it('returns false for frame type', () => {
    expect(multiSelectHit({ type: 'frame', x: 100, y: 100, width: 100, height: 100 }, rect)).toBe(false);
  });

  it('returns false when object is fully to the left', () => {
    expect(multiSelectHit({ type: 'sticky', x: 0, y: 100, width: 50, height: 50 }, rect)).toBe(false);
  });

  it('returns false when object is fully to the right', () => {
    expect(multiSelectHit({ type: 'sticky', x: 350, y: 100, width: 50, height: 50 }, rect)).toBe(false);
  });

  it('returns false when object is fully above', () => {
    expect(multiSelectHit({ type: 'sticky', x: 100, y: 0, width: 50, height: 50 }, rect)).toBe(false);
  });

  it('returns false when object is fully below', () => {
    expect(multiSelectHit({ type: 'sticky', x: 100, y: 350, width: 50, height: 50 }, rect)).toBe(false);
  });

  it('returns true when object is fully inside rect', () => {
    expect(multiSelectHit({ type: 'sticky', x: 120, y: 120, width: 50, height: 50 }, rect)).toBe(true);
  });

  it('returns true when object partially overlaps rect', () => {
    expect(multiSelectHit({ type: 'sticky', x: 50, y: 50, width: 100, height: 100 }, rect)).toBe(true);
  });

  it('returns true when object edge exactly touches rect left boundary', () => {
    // ox + ow === rect.x means the right edge equals rect.x — included by >=
    expect(multiSelectHit({ type: 'sticky', x: 50, y: 150, width: 50, height: 50 }, rect)).toBe(true);
  });

  it('returns true for a line type using getLineBounds', () => {
    // points [50, 150, 200, 200] → bounds that overlap rect
    const line = { type: 'line', x: 0, y: 0, points: [50, 150, 200, 200] };
    expect(multiSelectHit(line, rect)).toBe(true);
  });

  it('returns false for a line type entirely outside rect', () => {
    const line = { type: 'line', x: 0, y: 0, points: [0, 0, 50, 50] };
    expect(multiSelectHit(line, rect)).toBe(false);
  });

  it('uses default width/height of 150 when not set', () => {
    // object at x:0, y:0 with default 150x150 — rect starts at 100 — overlaps
    expect(multiSelectHit({ type: 'sticky', x: 0, y: 0 }, rect)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sortObjects
// ---------------------------------------------------------------------------

describe('sortObjects', () => {
  it('sorts frame before non-frame', () => {
    const frame = { type: 'frame', zIndex: 10 };
    const sticky = { type: 'sticky', zIndex: 1 };
    expect(sortObjects(frame, sticky)).toBeLessThan(0);
    expect(sortObjects(sticky, frame)).toBeGreaterThan(0);
  });

  it('sorts non-frames by zIndex', () => {
    const a = { type: 'sticky', zIndex: 1 };
    const b = { type: 'sticky', zIndex: 5 };
    expect(sortObjects(a, b)).toBeLessThan(0);
    expect(sortObjects(b, a)).toBeGreaterThan(0);
  });

  it('sorts root frame before nested frame (no frameId before frameId set)', () => {
    const root = { type: 'frame', zIndex: 1 };
    const nested = { type: 'frame', frameId: 'parent1', zIndex: 1 };
    expect(sortObjects(root, nested)).toBeLessThan(0);
    expect(sortObjects(nested, root)).toBeGreaterThan(0);
  });

  it('sorts root frames by zIndex', () => {
    const a = { type: 'frame', zIndex: 2 };
    const b = { type: 'frame', zIndex: 8 };
    expect(sortObjects(a, b)).toBeLessThan(0);
    expect(sortObjects(b, a)).toBeGreaterThan(0);
  });

  it('treats missing zIndex as 0', () => {
    const a = { type: 'sticky' };
    const b = { type: 'sticky', zIndex: 1 };
    expect(sortObjects(a, b)).toBeLessThan(0);
  });

  it('returns 0 for equal zIndex non-frames', () => {
    const a = { type: 'sticky', zIndex: 3 };
    const b = { type: 'sticky', zIndex: 3 };
    expect(sortObjects(a, b)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeVisibleIds
// ---------------------------------------------------------------------------

describe('computeVisibleIds', () => {
  const viewport = { vLeft: 0, vTop: 0, vRight: 500, vBottom: 500 };

  it('includes object fully inside viewport', () => {
    const obj = { id: 'a', type: 'sticky', x: 50, y: 50, width: 100, height: 100 };
    const ids = computeVisibleIds([obj], { a: obj }, viewport, null, null);
    expect(ids.has('a')).toBe(true);
  });

  it('excludes object fully outside viewport', () => {
    const obj = { id: 'a', type: 'sticky', x: 600, y: 600, width: 100, height: 100 };
    const ids = computeVisibleIds([obj], { a: obj }, viewport, null, null);
    expect(ids.has('a')).toBe(false);
  });

  it('includes childIds of a visible frame', () => {
    const frame = { id: 'f1', type: 'frame', x: 10, y: 10, width: 200, height: 200, childIds: ['c1', 'c2'] };
    const ids = computeVisibleIds([frame], { f1: frame }, viewport, null, null);
    expect(ids.has('c1')).toBe(true);
    expect(ids.has('c2')).toBe(true);
  });

  it('includes ancestor frame chain when child is visible', () => {
    const grandparent = { id: 'gp', type: 'frame', x: 10, y: 10, width: 400, height: 400, childIds: ['p1'] };
    const parent = { id: 'p1', type: 'frame', x: 20, y: 20, width: 300, height: 300, frameId: 'gp', childIds: ['c1'] };
    const child = { id: 'c1', type: 'sticky', x: 30, y: 30, width: 100, height: 100, frameId: 'p1' };
    const objMap = { gp: grandparent, p1: parent, c1: child };
    const ids = computeVisibleIds([child], objMap, viewport, null, null);
    expect(ids.has('p1')).toBe(true);
    expect(ids.has('gp')).toBe(true);
  });

  it('always includes selectedId even when outside viewport', () => {
    const obj = { id: 'sel', type: 'sticky', x: 9000, y: 9000, width: 100, height: 100 };
    const ids = computeVisibleIds([obj], { sel: obj }, viewport, 'sel', null);
    expect(ids.has('sel')).toBe(true);
  });

  it('always includes draggingId even when outside viewport', () => {
    const obj = { id: 'drag', type: 'sticky', x: 9000, y: 9000, width: 100, height: 100 };
    const ids = computeVisibleIds([obj], { drag: obj }, viewport, null, 'drag');
    expect(ids.has('drag')).toBe(true);
  });

  it('handles line type via bounds', () => {
    // line with points that fall inside viewport
    const line = { id: 'l1', type: 'line', x: 0, y: 0, points: [10, 10, 100, 100] };
    const ids = computeVisibleIds([line], { l1: line }, viewport, null, null);
    expect(ids.has('l1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// areEqual
// ---------------------------------------------------------------------------

describe('areEqual', () => {
  function makeState(overrides = {}) {
    const base = {
      objects: {},
      presentUsers: [],
      selectedId: null,
      stagePos: { x: 0, y: 0 },
      stageScale: 1,
      darkMode: false,
      snapToGrid: false,
      currentUserId: 'u1',
      dragState: { overFrameId: null, action: null, draggingId: null, illegalDrag: false },
      dragPos: { id: null, x: 0, y: 0 },
      activeTool: 'select',
      selectedIds: new Set(),
      canEdit: true,
    };
    return { state: { ...base, ...overrides } };
  }

  it('returns true when all fields are identical', () => {
    const s = makeState();
    expect(areEqual(s, s)).toBe(true);
  });

  it('returns false when objects reference changes', () => {
    const a = makeState({ objects: {} });
    const b = makeState({ objects: {} });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when selectedId changes', () => {
    const a = makeState({ selectedId: null });
    const b = makeState({ selectedId: 'x' });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when stagePos reference changes', () => {
    const a = makeState({ stagePos: { x: 0, y: 0 } });
    const b = makeState({ stagePos: { x: 0, y: 0 } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when stageScale changes', () => {
    const a = makeState({ stageScale: 1 });
    const b = makeState({ stageScale: 1.5 });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when darkMode changes', () => {
    const a = makeState({ darkMode: false });
    const b = makeState({ darkMode: true });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when snapToGrid changes', () => {
    const a = makeState({ snapToGrid: false });
    const b = makeState({ snapToGrid: true });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when dragState.overFrameId changes', () => {
    const a = makeState({ dragState: { overFrameId: null, action: null, draggingId: null, illegalDrag: false } });
    const b = makeState({ dragState: { overFrameId: 'f1', action: null, draggingId: null, illegalDrag: false } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when dragState.action changes', () => {
    const a = makeState({ dragState: { overFrameId: null, action: null, draggingId: null, illegalDrag: false } });
    const b = makeState({ dragState: { overFrameId: null, action: 'move', draggingId: null, illegalDrag: false } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when dragState.draggingId changes', () => {
    const a = makeState({ dragState: { overFrameId: null, action: null, draggingId: null, illegalDrag: false } });
    const b = makeState({ dragState: { overFrameId: null, action: null, draggingId: 'x', illegalDrag: false } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when dragState.illegalDrag changes', () => {
    const a = makeState({ dragState: { overFrameId: null, action: null, draggingId: null, illegalDrag: false } });
    const b = makeState({ dragState: { overFrameId: null, action: null, draggingId: null, illegalDrag: true } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when dragPos.id changes', () => {
    const a = makeState({ dragPos: { id: null, x: 0, y: 0 } });
    const b = makeState({ dragPos: { id: 'obj1', x: 0, y: 0 } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when dragPos.x changes', () => {
    const a = makeState({ dragPos: { id: 'x', x: 0, y: 0 } });
    const b = makeState({ dragPos: { id: 'x', x: 5, y: 0 } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when dragPos.y changes', () => {
    const a = makeState({ dragPos: { id: 'x', x: 0, y: 0 } });
    const b = makeState({ dragPos: { id: 'x', x: 0, y: 5 } });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when presentUsers reference changes', () => {
    const a = makeState({ presentUsers: [] });
    const b = makeState({ presentUsers: [] });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when currentUserId changes', () => {
    const a = makeState({ currentUserId: 'u1' });
    const b = makeState({ currentUserId: 'u2' });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when activeTool changes', () => {
    const a = makeState({ activeTool: 'select' });
    const b = makeState({ activeTool: 'pan' });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when selectedIds reference changes', () => {
    const a = makeState({ selectedIds: new Set() });
    const b = makeState({ selectedIds: new Set() });
    expect(areEqual(a, b)).toBe(false);
  });

  it('returns false when canEdit changes', () => {
    const a = makeState({ canEdit: true });
    const b = makeState({ canEdit: false });
    expect(areEqual(a, b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Grid guard formula
// ---------------------------------------------------------------------------

describe('grid guard formula', () => {
  it('produces a manageable grid at normal zoom (scale=1, 1200x800)', () => {
    const { cols, rows } = computeGridDimensions({ x: 0, y: 0 }, 1, 1200, 800);
    expect(cols * rows).toBeLessThanOrEqual(GRID_CELL_LIMIT);
  });

  it('would exceed GRID_CELL_LIMIT cells at extreme zoom-out (scale=0.01)', () => {
    const { cols, rows } = computeGridDimensions({ x: 0, y: 0 }, 0.01, 1200, 800);
    expect(cols * rows).toBeGreaterThan(GRID_CELL_LIMIT);
  });

  it('cols is at least 1', () => {
    const { cols } = computeGridDimensions({ x: 0, y: 0 }, 1, 1200, 800);
    expect(cols).toBeGreaterThanOrEqual(1);
  });

  it('rows is at least 1', () => {
    const { rows } = computeGridDimensions({ x: 0, y: 0 }, 1, 1200, 800);
    expect(rows).toBeGreaterThanOrEqual(1);
  });
});
