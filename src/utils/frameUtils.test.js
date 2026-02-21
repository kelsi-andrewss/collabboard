import { describe, it, expect } from 'vitest';
import {
  getContentBounds,
  getLineBounds,
  isInsideFrame,
  findOverlappingFrame,
  rectsOverlap,
  findNonOverlappingPosition,
  hasDisallowedSiblingOverlap,
  findFrameAtPoint,
  findObjectsToAbsorb,
  getDescendantIds,
  computeAncestorExpansions,
  computeAutoFitBounds,
  FRAME_MARGIN,
} from './frameUtils';

describe('getContentBounds', () => {
  it('returns null for empty objects', () => {
    expect(getContentBounds({})).toBeNull();
  });

  it('returns bounds for a single rect', () => {
    const objects = { a: { x: 10, y: 20, width: 100, height: 50 } };
    expect(getContentBounds(objects)).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
  });

  it('returns envelope of multiple objects', () => {
    const objects = {
      a: { x: 0, y: 0, width: 50, height: 50 },
      b: { x: 100, y: 100, width: 50, height: 50 },
    };
    expect(getContentBounds(objects)).toEqual({ minX: 0, minY: 0, maxX: 150, maxY: 150 });
  });

  it('handles line objects with points', () => {
    const objects = {
      a: { type: 'line', x: 10, y: 10, points: [0, 0, 100, 50] },
    };
    expect(getContentBounds(objects)).toEqual({ minX: 10, minY: 10, maxX: 110, maxY: 60 });
  });

  it('uses default width/height of 150 when missing', () => {
    const objects = { a: { x: 0, y: 0 } };
    expect(getContentBounds(objects)).toEqual({ minX: 0, minY: 0, maxX: 150, maxY: 150 });
  });

  it('skips lines with insufficient points', () => {
    const objects = {
      a: { type: 'line', x: 0, y: 0, points: [5] },
      b: { x: 10, y: 10, width: 20, height: 20 },
    };
    expect(getContentBounds(objects)).toEqual({ minX: 10, minY: 10, maxX: 30, maxY: 30 });
  });
});

describe('getLineBounds', () => {
  it('computes bounds from a points array', () => {
    const obj = { x: 5, y: 10, points: [0, 0, 100, 50], strokeWidth: 2 };
    expect(getLineBounds(obj)).toEqual({ x: 5, y: 10, width: 100, height: 50 });
  });

  it('uses default points [0,0,200,0] when none provided', () => {
    const obj = { x: 0, y: 0 };
    expect(getLineBounds(obj)).toEqual({ x: 0, y: 0, width: 200, height: 3 });
  });

  it('uses strokeWidth as minimum dimension', () => {
    const obj = { x: 0, y: 0, points: [0, 0, 0, 0], strokeWidth: 5 };
    expect(getLineBounds(obj)).toEqual({ x: 0, y: 0, width: 5, height: 5 });
  });
});

describe('isInsideFrame', () => {
  const frame = { x: 0, y: 0, width: 100, height: 100 };

  it('returns true when center is inside frame', () => {
    expect(isInsideFrame({ x: 20, y: 20, width: 30, height: 30 }, frame)).toBe(true);
  });

  it('returns false when center is outside frame', () => {
    expect(isInsideFrame({ x: 200, y: 200, width: 30, height: 30 }, frame)).toBe(false);
  });

  it('returns true when center is on the edge', () => {
    expect(isInsideFrame({ x: 80, y: 80, width: 40, height: 40 }, frame)).toBe(true);
  });
});

describe('findOverlappingFrame', () => {
  it('returns the smallest frame containing the object', () => {
    const objects = {
      big: { id: 'big', type: 'frame', x: 0, y: 0, width: 500, height: 500 },
      small: { id: 'small', type: 'frame', x: 10, y: 10, width: 100, height: 100 },
      obj: { id: 'obj', x: 30, y: 30, width: 20, height: 20 },
    };
    expect(findOverlappingFrame(objects.obj, objects)).toEqual(objects.small);
  });

  it('returns null when no frames contain the object', () => {
    const objects = {
      frame: { id: 'frame', type: 'frame', x: 0, y: 0, width: 50, height: 50 },
      obj: { id: 'obj', x: 200, y: 200, width: 10, height: 10 },
    };
    expect(findOverlappingFrame(objects.obj, objects)).toBeNull();
  });

  it('excludes self from candidates', () => {
    const objects = {
      f: { id: 'f', type: 'frame', x: 0, y: 0, width: 200, height: 200 },
    };
    expect(findOverlappingFrame(objects.f, objects)).toBeNull();
  });
});

describe('rectsOverlap', () => {
  it('detects overlapping rectangles', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 25, y: 25, width: 50, height: 50 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('returns false for non-overlapping rectangles', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 100, y: 100, width: 50, height: 50 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for edge-touching rectangles', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 50, y: 0, width: 50, height: 50 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('detects overlap with margin', () => {
    const a = { x: 0, y: 0, width: 50, height: 50 };
    const b = { x: 55, y: 0, width: 50, height: 50 };
    expect(rectsOverlap(a, b, 10)).toBe(true);
  });
});

describe('findNonOverlappingPosition', () => {
  it('returns center position when board is empty', () => {
    const result = findNonOverlappingPosition(100, 100, 50, 50, false, {});
    expect(result).toEqual({ x: 75, y: 75 });
  });

  it('returns a position that does not overlap existing objects', () => {
    const objects = {
      a: { x: 75, y: 75, width: 50, height: 50, type: 'sticky' },
    };
    const result = findNonOverlappingPosition(100, 100, 50, 50, false, objects);
    const overlapsAny = Object.values(objects).some(o =>
      result.x < o.x + o.width && result.x + 50 > o.x &&
      result.y < o.y + o.height && result.y + 50 > o.y
    );
    expect(overlapsAny).toBe(false);
  });
});

describe('hasDisallowedSiblingOverlap', () => {
  it('returns false when there is no overlap', () => {
    const objects = {
      f: { id: 'f', type: 'frame', x: 0, y: 0, width: 500, height: 500, childIds: ['a', 'b'] },
      a: { id: 'a', type: 'sticky', x: 10, y: 10, width: 50, height: 50, frameId: 'f' },
      b: { id: 'b', type: 'sticky', x: 200, y: 200, width: 50, height: 50, frameId: 'f' },
    };
    expect(hasDisallowedSiblingOverlap('a', 'sticky', { x: 10, y: 10, width: 50, height: 50 }, 'f', objects, 0)).toBe(false);
  });

  it('returns true when a frame overlaps a sibling', () => {
    const objects = {
      parent: { id: 'parent', type: 'frame', x: 0, y: 0, width: 800, height: 800, childIds: ['f1', 'f2'] },
      f1: { id: 'f1', type: 'frame', x: 10, y: 10, width: 100, height: 100, frameId: 'parent' },
      f2: { id: 'f2', type: 'frame', x: 50, y: 50, width: 100, height: 100, frameId: 'parent' },
    };
    expect(hasDisallowedSiblingOverlap('f1', 'frame', { x: 10, y: 10, width: 100, height: 100 }, 'parent', objects, 0)).toBe(true);
  });

  it('non-frame only checks sibling frames for overlap', () => {
    const objects = {
      parent: { id: 'parent', type: 'frame', x: 0, y: 0, width: 800, height: 800, childIds: ['s1', 's2'] },
      s1: { id: 's1', type: 'sticky', x: 10, y: 10, width: 50, height: 50, frameId: 'parent' },
      s2: { id: 's2', type: 'sticky', x: 20, y: 20, width: 50, height: 50, frameId: 'parent' },
    };
    expect(hasDisallowedSiblingOverlap('s1', 'sticky', { x: 10, y: 10, width: 50, height: 50 }, 'parent', objects, 0)).toBe(false);
  });
});

describe('findFrameAtPoint', () => {
  it('returns the smallest frame at the given point', () => {
    const objects = {
      big: { id: 'big', type: 'frame', x: 0, y: 0, width: 500, height: 500 },
      small: { id: 'small', type: 'frame', x: 10, y: 10, width: 100, height: 100 },
    };
    expect(findFrameAtPoint(50, 50, objects)).toEqual(objects.small);
  });

  it('returns null when no frame contains the point', () => {
    expect(findFrameAtPoint(999, 999, {})).toBeNull();
  });

  it('excludes the specified excludeId', () => {
    const objects = {
      f: { id: 'f', type: 'frame', x: 0, y: 0, width: 200, height: 200 },
    };
    expect(findFrameAtPoint(50, 50, objects, 'f')).toBeNull();
  });
});

describe('findObjectsToAbsorb', () => {
  it('absorbs unparented non-frames inside the rect', () => {
    const frame = { x: 0, y: 0, width: 200, height: 200 };
    const objects = {
      f: { id: 'f', type: 'frame', x: 0, y: 0, width: 200, height: 200 },
      s: { id: 's', type: 'sticky', x: 50, y: 50, width: 30, height: 30 },
    };
    expect(findObjectsToAbsorb('f', frame, objects)).toEqual(['s']);
  });

  it('excludes objects that already have a parent', () => {
    const frame = { x: 0, y: 0, width: 200, height: 200 };
    const objects = {
      f: { id: 'f', type: 'frame', x: 0, y: 0, width: 200, height: 200 },
      s: { id: 's', type: 'sticky', x: 50, y: 50, width: 30, height: 30, frameId: 'other' },
    };
    expect(findObjectsToAbsorb('f', frame, objects)).toEqual([]);
  });

  it('excludes frame-type objects', () => {
    const frame = { x: 0, y: 0, width: 200, height: 200 };
    const objects = {
      f: { id: 'f', type: 'frame', x: 0, y: 0, width: 200, height: 200 },
      f2: { id: 'f2', type: 'frame', x: 50, y: 50, width: 30, height: 30 },
    };
    expect(findObjectsToAbsorb('f', frame, objects)).toEqual([]);
  });
});

describe('getDescendantIds', () => {
  it('recursively collects all descendant ids', () => {
    const objects = {
      root: { id: 'root', type: 'frame', frameId: null },
      child: { id: 'child', type: 'frame', frameId: 'root' },
      grandchild: { id: 'grandchild', type: 'sticky', frameId: 'child' },
    };
    const ids = getDescendantIds('root', objects);
    expect(ids).toEqual(new Set(['child', 'grandchild']));
  });

  it('returns empty set for childless frame', () => {
    const objects = {
      solo: { id: 'solo', type: 'frame', frameId: null },
    };
    expect(getDescendantIds('solo', objects)).toEqual(new Set());
  });
});

describe('computeAncestorExpansions', () => {
  it('returns no expansions when child fits within parent', () => {
    const objects = {
      parent: { id: 'parent', type: 'frame', x: 0, y: 0, width: 500, height: 500, frameId: null, childIds: ['child'] },
      child: { id: 'child', type: 'sticky', x: 100, y: 100, width: 30, height: 30, frameId: 'parent' },
    };
    const expansions = computeAncestorExpansions(100, 100, 30, 30, 'parent', objects, FRAME_MARGIN);
    expect(expansions).toEqual([]);
  });

  it('expands parent when child extends past right edge', () => {
    const objects = {
      parent: { id: 'parent', type: 'frame', x: 0, y: 0, width: 200, height: 200, frameId: null, childIds: ['child'] },
      child: { id: 'child', type: 'sticky', x: 190, y: 50, width: 100, height: 30, frameId: 'parent' },
    };
    const expansions = computeAncestorExpansions(190, 50, 100, 30, 'parent', objects, FRAME_MARGIN);
    expect(expansions.length).toBe(1);
    expect(expansions[0].id).toBe('parent');
    expect(expansions[0].data.width).toBeGreaterThanOrEqual(310);
  });

  it('walks up to grandparent when needed', () => {
    const objects = {
      grandparent: { id: 'grandparent', type: 'frame', x: 0, y: 0, width: 300, height: 300, frameId: null, childIds: ['parent'] },
      parent: { id: 'parent', type: 'frame', x: 10, y: 10, width: 200, height: 200, frameId: 'grandparent', childIds: ['child'] },
      child: { id: 'child', type: 'sticky', x: 190, y: 50, width: 100, height: 30, frameId: 'parent' },
    };
    const expansions = computeAncestorExpansions(190, 50, 100, 30, 'parent', objects, FRAME_MARGIN);
    expect(expansions.length).toBe(2);
    expect(expansions[0].id).toBe('parent');
    expect(expansions[1].id).toBe('grandparent');
  });
});

describe('computeAutoFitBounds', () => {
  it('returns null when frame has no children', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const objects = { frame };
    expect(computeAutoFitBounds(frame, objects)).toBeNull();
  });

  it('computes bounds for a single child', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const child = { id: 'child', type: 'sticky', x: 50, y: 50, width: 100, height: 100, frameId: 'frame' };
    const objects = { frame, child };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds).toBeDefined();
    expect(bounds.x).toBeLessThanOrEqual(50 - FRAME_MARGIN);
    expect(bounds.y).toBeLessThanOrEqual(50 - FRAME_MARGIN);
    expect(bounds.width).toBeGreaterThanOrEqual(100 + FRAME_MARGIN * 2);
    expect(bounds.height).toBeGreaterThanOrEqual(100 + FRAME_MARGIN * 2);
  });

  it('envelopes multiple children', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 500, height: 500 };
    const child1 = { id: 'c1', type: 'sticky', x: 10, y: 10, width: 50, height: 50, frameId: 'frame' };
    const child2 = { id: 'c2', type: 'sticky', x: 200, y: 200, width: 50, height: 50, frameId: 'frame' };
    const objects = { frame, child1, child2 };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds.x).toBeLessThanOrEqual(10 - FRAME_MARGIN);
    expect(bounds.y).toBeLessThanOrEqual(10 - FRAME_MARGIN);
    expect(bounds.width + bounds.x).toBeGreaterThanOrEqual(250 + FRAME_MARGIN);
    expect(bounds.height + bounds.y).toBeGreaterThanOrEqual(250 + FRAME_MARGIN);
  });

  it('handles line children with points', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const line = { id: 'line', type: 'line', x: 50, y: 50, points: [0, 0, 100, 100], frameId: 'frame' };
    const objects = { frame, line };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds).toBeDefined();
    expect(bounds.x).toBeLessThanOrEqual(50 - FRAME_MARGIN);
    expect(bounds.y).toBeLessThanOrEqual(50 - FRAME_MARGIN);
  });

  it('handles arrow children with points', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const arrow = { id: 'arrow', type: 'arrow', x: 100, y: 100, points: [0, 0, 50, 50], frameId: 'frame' };
    const objects = { frame, arrow };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds).toBeDefined();
    expect(bounds.width).toBeGreaterThanOrEqual(50 + FRAME_MARGIN * 2);
  });

  it('respects minimum width and height', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const child = { id: 'child', type: 'sticky', x: 0, y: 0, width: 1, height: 1, frameId: 'frame' };
    const objects = { frame, child };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds.width).toBeGreaterThanOrEqual(100);
    expect(bounds.height).toBeGreaterThanOrEqual(80);
  });

  it('uses default dimensions for children without width/height', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const child = { id: 'child', type: 'rectangle', x: 50, y: 50, frameId: 'frame' };
    const objects = { frame, child };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds).toBeDefined();
    expect(bounds.width).toBeGreaterThanOrEqual(150 + FRAME_MARGIN * 2);
    expect(bounds.height).toBeGreaterThanOrEqual(150 + FRAME_MARGIN * 2);
  });

  it('accounts for title bar height in vertical positioning', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const child = { id: 'child', type: 'sticky', x: 50, y: 100, width: 50, height: 50, frameId: 'frame' };
    const objects = { frame, child };
    const bounds = computeAutoFitBounds(frame, objects);
    const titleBarHeight = Math.max(32, Math.min(52, frame.height * 0.12));
    expect(bounds.y).toBeLessThanOrEqual(100 - titleBarHeight - FRAME_MARGIN);
    expect(bounds.height).toBeGreaterThanOrEqual(50 + titleBarHeight + FRAME_MARGIN * 2);
  });

  it('mixes regular children with lines/arrows', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 500, height: 500 };
    const sticky = { id: 'sticky', type: 'sticky', x: 20, y: 20, width: 40, height: 40, frameId: 'frame' };
    const line = { id: 'line', type: 'line', x: 100, y: 100, points: [0, 0, 80, 80], frameId: 'frame' };
    const objects = { frame, sticky, line };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds.x).toBeLessThanOrEqual(20 - FRAME_MARGIN);
    expect(bounds.y).toBeLessThanOrEqual(20 - FRAME_MARGIN);
    expect(bounds.width + bounds.x).toBeGreaterThanOrEqual(180 + FRAME_MARGIN);
    expect(bounds.height + bounds.y).toBeGreaterThanOrEqual(180 + FRAME_MARGIN);
  });

  it('ignores objects that are not children of the frame', () => {
    const frame = { id: 'frame', type: 'frame', x: 0, y: 0, width: 400, height: 300 };
    const child = { id: 'child', type: 'sticky', x: 50, y: 50, width: 50, height: 50, frameId: 'frame' };
    const outsider = { id: 'outsider', type: 'sticky', x: 300, y: 300, width: 50, height: 50, frameId: null };
    const objects = { frame, child, outsider };
    const bounds = computeAutoFitBounds(frame, objects);
    expect(bounds.width).toBeLessThan(300 + 50 + FRAME_MARGIN);
  });
});
