import { describe, it, expect } from 'vitest';
import { multiSelectHit, sortObjects, computeVisibleIds, computeGridDimensions, GRID_CELL_LIMIT } from './BoardCanvas.jsx';

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

  it('returns true after object is resized larger so bounding box overlaps rect', () => {
    expect(multiSelectHit({ type: 'sticky', x: 0, y: 0, width: 50, height: 50 }, rect)).toBe(false);
    expect(multiSelectHit({ type: 'sticky', x: 0, y: 0, width: 150, height: 150 }, rect)).toBe(true);
  });

  it('returns false after object is resized smaller so bounding box no longer overlaps rect', () => {
    expect(multiSelectHit({ type: 'sticky', x: 50, y: 50, width: 100, height: 100 }, rect)).toBe(true);
    expect(multiSelectHit({ type: 'sticky', x: 50, y: 50, width: 40, height: 40 }, rect)).toBe(false);
  });

  it('returns the same result regardless of rotation field — uses unrotated bounding box', () => {
    const base = { type: 'sticky', x: 120, y: 120, width: 50, height: 50 };
    expect(multiSelectHit({ ...base, rotation: 0 }, rect)).toBe(true);
    expect(multiSelectHit({ ...base, rotation: 45 }, rect)).toBe(true);
    expect(multiSelectHit({ ...base, rotation: 90 }, rect)).toBe(true);
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

  it('returns 0 for equal-zIndex non-frames regardless of rotation field', () => {
    const a = { type: 'sticky', zIndex: 3, rotation: 0 };
    const b = { type: 'sticky', zIndex: 3, rotation: 45 };
    expect(sortObjects(a, b)).toBe(0);
  });

  it('sorts non-frames by zIndex regardless of rotation field value', () => {
    const a = { type: 'sticky', zIndex: 1, rotation: 90 };
    const b = { type: 'sticky', zIndex: 5, rotation: 0 };
    expect(sortObjects(a, b)).toBeLessThan(0);
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

  it('includes all childIds of a visible frame even when children are individually outside viewport', () => {
    const frame = { id: 'f1', type: 'frame', x: 10, y: 10, width: 200, height: 200, childIds: ['c1', 'c2'] };
    const c1 = { id: 'c1', type: 'sticky', x: 600, y: 600, width: 100, height: 100, frameId: 'f1' };
    const c2 = { id: 'c2', type: 'sticky', x: 700, y: 700, width: 100, height: 100, frameId: 'f1' };
    const objMap = { f1: frame, c1, c2 };
    const ids = computeVisibleIds([frame, c1, c2], objMap, viewport, null, null);
    expect(ids.has('c1')).toBe(true);
    expect(ids.has('c2')).toBe(true);
  });

  it('does not include childIds of a frame that is itself outside the viewport', () => {
    const frame = { id: 'f1', type: 'frame', x: 1000, y: 1000, width: 200, height: 200, childIds: ['c1'] };
    const c1 = { id: 'c1', type: 'sticky', x: 1050, y: 1050, width: 100, height: 100, frameId: 'f1' };
    const objMap = { f1: frame, c1 };
    const ids = computeVisibleIds([frame, c1], objMap, viewport, null, null);
    expect(ids.has('f1')).toBe(false);
    expect(ids.has('c1')).toBe(false);
  });

  it('includes only the in-viewport sibling when the frame itself is not visible', () => {
    const frame = { id: 'f1', type: 'frame', x: 1000, y: 1000, width: 200, height: 200, childIds: ['c1', 'c2'] };
    const c1 = { id: 'c1', type: 'sticky', x: 50, y: 50, width: 100, height: 100, frameId: 'f1' };
    const c2 = { id: 'c2', type: 'sticky', x: 900, y: 900, width: 100, height: 100, frameId: 'f1' };
    const objMap = { f1: frame, c1, c2 };
    const ids = computeVisibleIds([frame, c1, c2], objMap, viewport, null, null);
    expect(ids.has('c1')).toBe(true);
    expect(ids.has('c2')).toBe(false);
    expect(ids.has('f1')).toBe(true); // ancestor of c1, pulled in via frameId chain
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
