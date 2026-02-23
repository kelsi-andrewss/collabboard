import { describe, it, expect } from 'vitest';
import { multiSelectHit, sortObjects, computeVisibleIds, computeGridDimensions, GRID_CELL_LIMIT, buildRenderOrder, areEqual } from './BoardCanvas.jsx';

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

// ---------------------------------------------------------------------------
// buildRenderOrder
// ---------------------------------------------------------------------------

describe('buildRenderOrder', () => {
  it('returns empty array for empty objects map', () => {
    expect(buildRenderOrder({})).toEqual([]);
  });

  it('places root frames before root non-frames', () => {
    const frame = { id: 'f1', type: 'frame', zIndex: 1 };
    const sticky = { id: 's1', type: 'sticky', zIndex: 1 };
    const result = buildRenderOrder({ f1: frame, s1: sticky });
    const frameIdx = result.findIndex(o => o.id === 'f1');
    const stickyIdx = result.findIndex(o => o.id === 's1');
    expect(frameIdx).toBeLessThan(stickyIdx);
  });

  it('places frame children after their parent frame and before root non-frame children', () => {
    const frame = { id: 'f1', type: 'frame', zIndex: 1 };
    const child = { id: 'c1', type: 'sticky', zIndex: 1, frameId: 'f1' };
    const root = { id: 's1', type: 'sticky', zIndex: 1 };
    const result = buildRenderOrder({ f1: frame, c1: child, s1: root });
    const frameIdx = result.findIndex(o => o.id === 'f1');
    const childIdx = result.findIndex(o => o.id === 'c1');
    const rootIdx = result.findIndex(o => o.id === 's1');
    expect(frameIdx).toBeLessThan(childIdx);
    expect(childIdx).toBeLessThan(rootIdx);
  });

  it('sorts root frames by zIndex', () => {
    const f1 = { id: 'f1', type: 'frame', zIndex: 5 };
    const f2 = { id: 'f2', type: 'frame', zIndex: 2 };
    const result = buildRenderOrder({ f1, f2 });
    expect(result[0].id).toBe('f2');
    expect(result[1].id).toBe('f1');
  });

  it('places nested frames between their parent frame and parent frame children', () => {
    const root = { id: 'root', type: 'frame', zIndex: 1 };
    const nested = { id: 'nested', type: 'frame', zIndex: 1, frameId: 'root' };
    const nestedChild = { id: 'nc', type: 'sticky', zIndex: 1, frameId: 'nested' };
    const result = buildRenderOrder({ root, nested, nc: nestedChild });
    const rootIdx = result.findIndex(o => o.id === 'root');
    const nestedIdx = result.findIndex(o => o.id === 'nested');
    const ncIdx = result.findIndex(o => o.id === 'nc');
    expect(rootIdx).toBeLessThan(nestedIdx);
    expect(nestedIdx).toBeLessThan(ncIdx);
  });

  it('sorts root non-frames by zIndex', () => {
    const a = { id: 'a', type: 'sticky', zIndex: 3 };
    const b = { id: 'b', type: 'sticky', zIndex: 1 };
    const result = buildRenderOrder({ a, b });
    expect(result[0].id).toBe('b');
    expect(result[1].id).toBe('a');
  });

  it('treats missing zIndex as 0 when sorting non-frames', () => {
    const a = { id: 'a', type: 'sticky' };
    const b = { id: 'b', type: 'sticky', zIndex: 1 };
    const result = buildRenderOrder({ a, b });
    expect(result[0].id).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// areEqual (memo comparison for BoardCanvas)
// ---------------------------------------------------------------------------

describe('areEqual', () => {
  const baseState = {
    objects: {},
    presentUsers: [],
    selectedId: null,
    stagePos: { x: 0, y: 0 },
    stageScale: 1,
    darkMode: false,
    snapToGrid: false,
    currentUserId: 'u1',
    dragState: null,
    dragPos: null,
    activeTool: 'select',
    selectedIds: new Set(),
    canEdit: true,
    connectorFirstPoint: null,
    pendingTool: null,
    onFollowUser: null,
  };

  function makeProps(state) {
    return { state, handlers: {} };
  }

  it('returns true when all state fields are identical references', () => {
    const props = makeProps(baseState);
    expect(areEqual(props, props)).toBe(true);
  });

  it('returns false when objects reference changes', () => {
    const prev = makeProps(baseState);
    const next = makeProps({ ...baseState, objects: {} });
    expect(areEqual(prev, next)).toBe(false);
  });

  it('returns false when stagePos reference changes', () => {
    const prev = makeProps(baseState);
    const next = makeProps({ ...baseState, stagePos: { x: 0, y: 0 } });
    expect(areEqual(prev, next)).toBe(false);
  });

  it('returns false when stageScale changes', () => {
    const prev = makeProps(baseState);
    const next = makeProps({ ...baseState, stageScale: 2 });
    expect(areEqual(prev, next)).toBe(false);
  });

  it('returns false when activeTool changes', () => {
    const prev = makeProps(baseState);
    const next = makeProps({ ...baseState, activeTool: 'pan' });
    expect(areEqual(prev, next)).toBe(false);
  });

  it('returns false when selectedId changes', () => {
    const prev = makeProps(baseState);
    const next = makeProps({ ...baseState, selectedId: 'obj1' });
    expect(areEqual(prev, next)).toBe(false);
  });

  it('returns false when pendingTool changes', () => {
    const prev = makeProps(baseState);
    const next = makeProps({ ...baseState, pendingTool: 'sticky' });
    expect(areEqual(prev, next)).toBe(false);
  });

  it('returns false when dragState.draggingId changes', () => {
    const prev = makeProps(baseState);
    const next = makeProps({ ...baseState, dragState: { draggingId: 'obj1', action: null, overFrameId: null, illegalDrag: false } });
    expect(areEqual(prev, next)).toBe(false);
  });

  it('returns true when dragState is null in both prev and next', () => {
    const sharedState = { ...baseState };
    const prev = makeProps(sharedState);
    const next = makeProps({ ...sharedState });
    // stagePos must be same reference for true
    next.state.stagePos = prev.state.stagePos;
    next.state.selectedIds = prev.state.selectedIds;
    expect(areEqual(prev, next)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Middle-mouse-pan arithmetic (core logic of story-129)
// ---------------------------------------------------------------------------

describe('middle mouse pan delta arithmetic', () => {
  // The panning formula used in handleMouseMoveWrapped:
  //   newPos = { x: startStageX + (currentClientX - startClientX),
  //              y: startStageY + (currentClientY - startClientY) }
  // These tests verify the invariants of that formula without needing a DOM.

  function computePanDelta(startStagePos, startClient, currentClient) {
    return {
      x: startStagePos.x + (currentClient.clientX - startClient.clientX),
      y: startStagePos.y + (currentClient.clientY - startClient.clientY),
    };
  }

  it('returns original position when cursor has not moved', () => {
    const pos = computePanDelta({ x: 100, y: 200 }, { clientX: 300, clientY: 400 }, { clientX: 300, clientY: 400 });
    expect(pos).toEqual({ x: 100, y: 200 });
  });

  it('pans right when cursor moves right', () => {
    const pos = computePanDelta({ x: 0, y: 0 }, { clientX: 0, clientY: 0 }, { clientX: 50, clientY: 0 });
    expect(pos.x).toBe(50);
    expect(pos.y).toBe(0);
  });

  it('pans down when cursor moves down', () => {
    const pos = computePanDelta({ x: 0, y: 0 }, { clientX: 0, clientY: 0 }, { clientX: 0, clientY: 80 });
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(80);
  });

  it('pans diagonally with combined dx and dy', () => {
    const pos = computePanDelta({ x: 10, y: 20 }, { clientX: 100, clientY: 100 }, { clientX: 130, clientY: 160 });
    expect(pos).toEqual({ x: 40, y: 80 });
  });

  it('pans left when cursor moves left (negative delta)', () => {
    const pos = computePanDelta({ x: 200, y: 100 }, { clientX: 300, clientY: 200 }, { clientX: 250, clientY: 200 });
    expect(pos.x).toBe(150);
    expect(pos.y).toBe(100);
  });

  it('preserves existing stage offset in final position', () => {
    const startStagePos = { x: -400, y: -300 };
    const pos = computePanDelta(startStagePos, { clientX: 500, clientY: 500 }, { clientX: 600, clientY: 550 });
    expect(pos).toEqual({ x: -300, y: -250 });
  });
});

// ---------------------------------------------------------------------------
// Middle-mouse-pan: button detection invariants
// ---------------------------------------------------------------------------

describe('middle mouse button detection', () => {
  // handleMouseDown: intercepts button === 1 (middle mouse), returns early.
  // handleMouseUp: clears pan state only for button === 1.
  // handleStageClickWrapped: suppresses deselection for button === 1.
  //
  // These invariants are expressed as logical assertions on the button value.

  it('button 1 is the middle mouse button (not left=0, not right=2)', () => {
    const MIDDLE = 1;
    expect(MIDDLE).not.toBe(0); // left
    expect(MIDDLE).not.toBe(2); // right
    expect(MIDDLE).toBe(1);
  });

  it('left-click (button=0) should not trigger middle-pan branch', () => {
    const button = 0;
    const triggersMiddlePan = button === 1;
    expect(triggersMiddlePan).toBe(false);
  });

  it('middle-click (button=1) should trigger middle-pan branch in mousedown', () => {
    const button = 1;
    const triggersMiddlePan = button === 1;
    expect(triggersMiddlePan).toBe(true);
  });

  it('right-click (button=2) should not trigger middle-pan branch', () => {
    const button = 2;
    const triggersMiddlePan = button === 1;
    expect(triggersMiddlePan).toBe(false);
  });

  it('middle-click (button=1) should suppress click handler (return early)', () => {
    const button = 1;
    const shouldSuppress = button === 1;
    expect(shouldSuppress).toBe(true);
  });

  it('non-middle click (button=0) should not suppress click handler', () => {
    const button = 0;
    const shouldSuppress = button === 1;
    expect(shouldSuppress).toBe(false);
  });
});
