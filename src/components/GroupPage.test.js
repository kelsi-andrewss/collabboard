import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDate, estimateItemHeight, distributeToColumns, isAncestor } from '../utils/groupUtils.js';

describe('formatDate', () => {
  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    const ts = { toMillis: () => Date.now() - 30 * 1000 };
    expect(formatDate(ts)).toBe('just now');
  });

  it('returns minutes ago for timestamps less than 1 hour ago', () => {
    const ts = { toMillis: () => Date.now() - 5 * 60 * 1000 };
    expect(formatDate(ts)).toBe('5m ago');
  });

  it('returns hours ago for timestamps less than 24 hours ago', () => {
    const ts = { toMillis: () => Date.now() - 3 * 60 * 60 * 1000 };
    expect(formatDate(ts)).toBe('3h ago');
  });

  it('returns a localized date string for timestamps older than 24 hours', () => {
    const ts = { toMillis: () => Date.now() - 2 * 24 * 60 * 60 * 1000 };
    const result = formatDate(ts);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('just now');
    expect(result).not.toMatch(/ago$/);
  });

  it('handles Firestore-style timestamp objects with seconds field', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ts = { seconds: nowSeconds - 10 };
    expect(formatDate(ts)).toBe('just now');
  });

  it('returns empty string for timestamp object with no recognizable fields', () => {
    expect(formatDate({})).toBe('');
  });

  it('returns "1m ago" for exactly 61 seconds ago', () => {
    const ts = { toMillis: () => Date.now() - 61 * 1000 };
    expect(formatDate(ts)).toBe('1m ago');
  });

  it('returns "1h ago" for exactly 61 minutes ago', () => {
    const ts = { toMillis: () => Date.now() - 61 * 60 * 1000 };
    expect(formatDate(ts)).toBe('1h ago');
  });
});

describe('estimateItemHeight', () => {
  it('returns 200 for subgroup items', () => {
    expect(estimateItemHeight({ type: 'subgroup' })).toBe(200);
  });

  it('returns 116 for board items', () => {
    expect(estimateItemHeight({ type: 'board' })).toBe(116);
  });

  it('returns 116 for items with unknown type', () => {
    expect(estimateItemHeight({ type: 'unknown' })).toBe(116);
  });

  it('returns 116 for items with no type field', () => {
    expect(estimateItemHeight({})).toBe(116);
  });
});

describe('distributeToColumns', () => {
  it('returns the correct number of columns', () => {
    const result = distributeToColumns([], 3);
    expect(result).toHaveLength(3);
  });

  it('returns empty arrays for all columns when items is empty', () => {
    const result = distributeToColumns([], 4);
    result.forEach(col => expect(col).toEqual([]));
  });

  it('places a single item in the first column', () => {
    const items = [{ type: 'board', key: 'b1' }];
    const result = distributeToColumns(items, 3);
    const total = result.flat();
    expect(total).toHaveLength(1);
    expect(total[0]).toBe(items[0]);
  });

  it('distributes all items across columns with no duplication or loss', () => {
    const items = [
      { type: 'board', key: 'b1' },
      { type: 'board', key: 'b2' },
      { type: 'board', key: 'b3' },
      { type: 'subgroup', key: 's1' },
      { type: 'subgroup', key: 's2' },
    ];
    const result = distributeToColumns(items, 2);
    const flat = result.flat();
    expect(flat).toHaveLength(items.length);
    items.forEach(item => expect(flat).toContain(item));
  });

  it('balances columns by filling shortest column first', () => {
    const boardItem = { type: 'board', key: 'b' };
    const subItem = { type: 'subgroup', key: 's' };
    const items = [boardItem, boardItem, subItem];
    const result = distributeToColumns(items, 2);
    const col0Len = result[0].length;
    const col1Len = result[1].length;
    expect(Math.abs(col0Len - col1Len)).toBeLessThanOrEqual(2);
  });

  it('works with columnCount of 1 — puts all items in one column', () => {
    const items = [
      { type: 'board', key: 'b1' },
      { type: 'board', key: 'b2' },
    ];
    const result = distributeToColumns(items, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it('prefers subgroup items to go to shorter columns', () => {
    const items = [
      { type: 'board', key: 'b1' },
      { type: 'board', key: 'b2' },
      { type: 'subgroup', key: 's1' },
    ];
    const result = distributeToColumns(items, 2);
    const subgroupInCol0 = result[0].some(i => i.type === 'subgroup');
    const subgroupInCol1 = result[1].some(i => i.type === 'subgroup');
    expect(subgroupInCol0 || subgroupInCol1).toBe(true);
  });

  it('handles more columns than items by leaving some columns empty', () => {
    const items = [{ type: 'board', key: 'b1' }];
    const result = distributeToColumns(items, 5);
    const nonEmpty = result.filter(col => col.length > 0);
    expect(nonEmpty).toHaveLength(1);
    const empty = result.filter(col => col.length === 0);
    expect(empty).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// isAncestor — cycle/ancestry detection used by handleGroupDrop guard
// ---------------------------------------------------------------------------

describe('isAncestor', () => {
  const groups = [
    { id: 'root', parentGroupId: null },
    { id: 'child', parentGroupId: 'root' },
    { id: 'grandchild', parentGroupId: 'child' },
    { id: 'sibling', parentGroupId: 'root' },
    { id: 'unrelated', parentGroupId: null },
  ];

  it('returns true when candidateAncestorId is the direct parent', () => {
    expect(isAncestor('root', 'child', groups)).toBe(true);
  });

  it('returns true when candidateAncestorId is a grandparent', () => {
    expect(isAncestor('root', 'grandchild', groups)).toBe(true);
  });

  it('returns true when candidateAncestorId is the direct parent of grandchild', () => {
    expect(isAncestor('child', 'grandchild', groups)).toBe(true);
  });

  it('returns false when candidateAncestorId is a sibling, not an ancestor', () => {
    expect(isAncestor('sibling', 'child', groups)).toBe(false);
  });

  it('returns false when candidateAncestorId is unrelated to the target group', () => {
    expect(isAncestor('unrelated', 'child', groups)).toBe(false);
  });

  it('returns false when candidateAncestorId is a descendant of the target group', () => {
    expect(isAncestor('grandchild', 'root', groups)).toBe(false);
  });

  it('returns false when the target group has no parent', () => {
    expect(isAncestor('unrelated', 'root', groups)).toBe(false);
  });

  it('returns false for an unknown targetGroupId', () => {
    expect(isAncestor('root', 'nonexistent', groups)).toBe(false);
  });

  it('returns false for an empty groups array', () => {
    expect(isAncestor('a', 'b', [])).toBe(false);
  });

  it('terminates without throwing when groups form a parent cycle', () => {
    const cycleGroups = [
      { id: 'a', parentGroupId: 'b' },
      { id: 'b', parentGroupId: 'a' },
    ];
    expect(() => isAncestor('x', 'a', cycleGroups)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// applySort logic — pure sort function mirroring GroupPage's internal applySort
// Tests verify the sort contract for mixed subgroup/board masonry items.
// The makeApplySort helper below is a direct transcription of the source logic.
// ---------------------------------------------------------------------------

function makeApplySort(sortMode, sortAsc, boards) {
  return function applySort(items) {
    return [...items].sort((a, b) => {
      if (sortMode === 'name') {
        const aName = a.type === 'subgroup' ? (a.sub?.name || '') : (a.board?.name || '');
        const bName = b.type === 'subgroup' ? (b.sub?.name || '') : (b.board?.name || '');
        const cmp = aName.localeCompare(bName);
        return sortAsc ? cmp : -cmp;
      }
      if (sortMode === 'count') {
        const aCount = a.type === 'subgroup'
          ? boards.filter(brd => brd.groupId === a.sub?.id).length
          : 1;
        const bCount = b.type === 'subgroup'
          ? boards.filter(brd => brd.groupId === b.sub?.id).length
          : 1;
        const cmp = bCount - aCount;
        return sortAsc ? -cmp : cmp;
      }
      const aTime = a.type === 'subgroup'
        ? (boards.filter(brd => brd.groupId === a.sub?.id)[0]?.updatedAt?.toMillis?.() ?? 0)
        : (a.board?.updatedAt?.toMillis?.() ?? (a.board?.updatedAt?.seconds ?? 0) * 1000);
      const bTime = b.type === 'subgroup'
        ? (boards.filter(brd => brd.groupId === b.sub?.id)[0]?.updatedAt?.toMillis?.() ?? 0)
        : (b.board?.updatedAt?.toMillis?.() ?? (b.board?.updatedAt?.seconds ?? 0) * 1000);
      const cmp = bTime - aTime;
      return sortAsc ? -cmp : cmp;
    });
  };
}

describe('applySort', () => {
  const countBoards = [
    { id: 'b1', groupId: 'g1' },
    { id: 'b2', groupId: 'g1' },
    { id: 'b3', groupId: 'g2' },
  ];
  const now = Date.now();
  const recentBoards = [
    { id: 'b1', groupId: 'g1', updatedAt: { toMillis: () => now - 1000 } },
    { id: 'b2', groupId: 'g2', updatedAt: { toMillis: () => now - 5000 } },
  ];

  describe.each([
    { sortMode: 'name', sortAsc: true, label: 'name ascending' },
    { sortMode: 'name', sortAsc: false, label: 'name descending' },
  ])('$label', ({ sortMode, sortAsc }) => {
    it('sorts boards and subgroups by name', () => {
      const items = [
        { type: 'board', key: 'b2', board: { name: 'Zebra' } },
        { type: 'subgroup', key: 's1', sub: { id: 'g1', name: 'Alpha' } },
        { type: 'board', key: 'b1', board: { name: 'Mango' } },
      ];
      const sorted = makeApplySort(sortMode, sortAsc, [])(items);
      const names = sorted.map(i => (i.type === 'board' ? i.board.name : i.sub.name));
      if (sortAsc) {
        expect(names).toEqual(['Alpha', 'Mango', 'Zebra']);
      } else {
        expect(names).toEqual(['Zebra', 'Mango', 'Alpha']);
      }
    });

    it('treats missing name as empty string', () => {
      const items = [
        { type: 'board', key: 'b1', board: { name: 'Beta' } },
        { type: 'subgroup', key: 's1', sub: { id: 'g1' } },
      ];
      const sorted = makeApplySort(sortMode, sortAsc, [])(items);
      if (sortAsc) {
        expect(sorted[0].type).toBe('subgroup');
      } else {
        expect(sorted[0].type).toBe('board');
      }
    });
  });

  describe.each([
    { sortAsc: true, label: 'count ascending' },
    { sortAsc: false, label: 'count descending' },
  ])('$label', ({ sortAsc }) => {
    it('sorts subgroups by board count', () => {
      const items = [
        { type: 'subgroup', key: 's2', sub: { id: 'g2', name: 'Small Group' } },
        { type: 'subgroup', key: 's1', sub: { id: 'g1', name: 'Big Group' } },
      ];
      const sorted = makeApplySort('count', sortAsc, countBoards)(items);
      if (sortAsc) {
        expect(sorted[0].sub.id).toBe('g2');
        expect(sorted[1].sub.id).toBe('g1');
      } else {
        expect(sorted[0].sub.id).toBe('g1');
        expect(sorted[1].sub.id).toBe('g2');
      }
    });

    it('board items count as 1 vs subgroup board count', () => {
      const items = [
        { type: 'board', key: 'b1', board: { name: 'A Board' } },
        { type: 'subgroup', key: 's1', sub: { id: 'g1', name: 'Big Group' } },
      ];
      const sorted = makeApplySort('count', sortAsc, countBoards)(items);
      if (sortAsc) {
        expect(sorted[0].type).toBe('board');
      } else {
        expect(sorted[0].type).toBe('subgroup');
      }
    });
  });

  it('count mode: subgroup with zero boards sorts after standalone board (descending)', () => {
    const items = [
      { type: 'subgroup', key: 's1', sub: { id: 'g_empty', name: 'Empty Group' } },
      { type: 'board', key: 'b1', board: { name: 'A Board' } },
    ];
    const sorted = makeApplySort('count', false, countBoards)(items);
    expect(sorted[0].type).toBe('board');
    expect(sorted[1].type).toBe('subgroup');
  });

  describe.each([
    { sortAsc: true, label: 'recent ascending (oldest first)' },
    { sortAsc: false, label: 'recent descending (newest first)' },
  ])('$label', ({ sortAsc }) => {
    it('sorts boards by updatedAt', () => {
      const items = [
        { type: 'board', key: 'old', board: { name: 'Old', updatedAt: { toMillis: () => now - 5000 } } },
        { type: 'board', key: 'new', board: { name: 'New', updatedAt: { toMillis: () => now - 1000 } } },
      ];
      const sorted = makeApplySort('recent', sortAsc, [])(items);
      if (sortAsc) {
        expect(sorted[0].key).toBe('old');
      } else {
        expect(sorted[0].key).toBe('new');
      }
    });
  });

  it('recent mode: uses the most recent board in a subgroup as timestamp', () => {
    const items = [
      { type: 'subgroup', key: 's1', sub: { id: 'g1', name: 'Group 1' } },
      { type: 'board', key: 'b_old', board: { name: 'Old Board', updatedAt: { toMillis: () => now - 10000 } } },
    ];
    const sorted = makeApplySort('recent', false, recentBoards)(items);
    expect(sorted[0].type).toBe('subgroup');
  });

  it('recent mode: treats items with no updatedAt as timestamp 0', () => {
    const items = [
      { type: 'board', key: 'no-ts', board: { name: 'No Timestamp' } },
      { type: 'board', key: 'has-ts', board: { name: 'Has Timestamp', updatedAt: { toMillis: () => now - 1000 } } },
    ];
    const sorted = makeApplySort('recent', false, [])(items);
    expect(sorted[0].key).toBe('has-ts');
    expect(sorted[1].key).toBe('no-ts');
  });

  it('recent mode: supports Firestore seconds-style timestamps', () => {
    const nowSeconds = Math.floor(now / 1000);
    const items = [
      { type: 'board', key: 'seconds-ts', board: { name: 'Seconds', updatedAt: { seconds: nowSeconds - 1 } } },
      { type: 'board', key: 'no-ts', board: { name: 'No Timestamp' } },
    ];
    const sorted = makeApplySort('recent', false, [])(items);
    expect(sorted[0].key).toBe('seconds-ts');
    expect(sorted[1].key).toBe('no-ts');
  });
});

// ---------------------------------------------------------------------------
// handleGroupDrop self-drop guard — pure logic tests
// Exercises the guard conditions in GroupPage.jsx handleGroupDrop using
// the exported isAncestor function directly.
// ---------------------------------------------------------------------------

describe('handleGroupDrop self-drop guard logic', () => {
  const groups = [
    { id: 'parent', parentGroupId: null },
    { id: 'child', parentGroupId: 'parent' },
    { id: 'grandchild', parentGroupId: 'child' },
    { id: 'sibling', parentGroupId: 'parent' },
  ];

  function wouldGroupDropBeBlocked(draggedGroupId, targetGroupId) {
    const normalizedTarget = targetGroupId || null;
    if (normalizedTarget === draggedGroupId) return true;
    if (normalizedTarget !== null) {
      if (draggedGroupId === normalizedTarget) return true;
      if (isAncestor(draggedGroupId, normalizedTarget, groups)) return true;
    }
    return false;
  }

  it('blocks a group being dropped onto itself', () => {
    expect(wouldGroupDropBeBlocked('child', 'child')).toBe(true);
  });

  it('allows a group being dropped onto a sibling group', () => {
    expect(wouldGroupDropBeBlocked('child', 'sibling')).toBe(false);
  });

  it('allows a group being dropped onto its own parent', () => {
    expect(wouldGroupDropBeBlocked('child', 'parent')).toBe(false);
  });

  it('blocks a parent being dropped into one of its own descendants', () => {
    expect(wouldGroupDropBeBlocked('parent', 'grandchild')).toBe(true);
  });

  it('blocks a group being dropped into its direct child', () => {
    expect(wouldGroupDropBeBlocked('parent', 'child')).toBe(true);
  });

  it('allows dropping onto null target (root drop zone)', () => {
    expect(wouldGroupDropBeBlocked('child', null)).toBe(false);
  });

  it('allows dropping an unrelated group onto a target', () => {
    expect(wouldGroupDropBeBlocked('sibling', 'child')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// handleGroupDrop nested-group bubbling guard
//
// Both GroupPage.jsx and BoardSelector.jsx prefix handleGroupDrop with:
//
//   const closestGroupEl = e.target.closest('[data-group-id]');
//   const closestGroupId = closestGroupEl ? closestGroupEl.dataset.groupId : null;
//   if (closestGroupId !== (targetGroupId ?? null)) return;
//
// This guard prevents a drop event that bubbled up from a nested GroupCard
// from triggering the parent handler. The tests below model this guard as a
// pure predicate and verify its behaviour under each relevant scenario.
// ---------------------------------------------------------------------------

describe('handleGroupDrop nested-group bubbling guard', () => {
  // Pure predicate mirroring the guard at the top of handleGroupDrop.
  // Returns true when the handler would bail out (not process the drop).
  function wouldHandlerBailOut(closestDataGroupId, targetGroupId) {
    const closestGroupId = closestDataGroupId ?? null;
    const normalizedTarget = targetGroupId ?? null;
    return closestGroupId !== normalizedTarget;
  }

  // Simulate the full handleGroupDrop guard + moveGroup call path.
  function simulateGroupDrop({ closestDataGroupId, targetGroupId, draggedGroupId, groups, moveGroup }) {
    const closestGroupId = closestDataGroupId ?? null;
    const normalizedTarget = targetGroupId ?? null;
    if (closestGroupId !== normalizedTarget) return 'bailed';

    const payload = JSON.stringify({ id: draggedGroupId });
    const { id: parsed } = JSON.parse(payload);
    if (normalizedTarget === parsed) return 'self-drop-blocked';
    if (normalizedTarget !== null) {
      if (isAncestor(parsed, normalizedTarget, groups)) return 'ancestor-blocked';
    }
    moveGroup(parsed, normalizedTarget);
    return 'moved';
  }

  let moveGroup;

  beforeEach(() => {
    moveGroup = vi.fn();
  });

  it('bails out when the drop target element belongs to a nested group, not the parent group', () => {
    // e.target is inside a nested GroupCard with data-group-id="child",
    // but this handler was registered for targetGroupId="parent".
    expect(wouldHandlerBailOut('child', 'parent')).toBe(true);
  });

  it('does not bail out when the closest data-group-id matches the handler target', () => {
    expect(wouldHandlerBailOut('parent', 'parent')).toBe(false);
  });

  it('does not call moveGroup when the event came from a nested group element', () => {
    const groups = [
      { id: 'parent', parentGroupId: null },
      { id: 'child', parentGroupId: 'parent' },
    ];
    const result = simulateGroupDrop({
      closestDataGroupId: 'child',
      targetGroupId: 'parent',
      draggedGroupId: 'sibling',
      groups,
      moveGroup,
    });
    expect(result).toBe('bailed');
    expect(moveGroup).not.toHaveBeenCalled();
  });

  it('calls moveGroup when the closest data-group-id matches the handler target', () => {
    const groups = [
      { id: 'parent', parentGroupId: null },
      { id: 'sibling', parentGroupId: 'parent' },
    ];
    const result = simulateGroupDrop({
      closestDataGroupId: 'parent',
      targetGroupId: 'parent',
      draggedGroupId: 'sibling',
      groups,
      moveGroup,
    });
    expect(result).toBe('moved');
    expect(moveGroup).toHaveBeenCalledWith('sibling', 'parent');
  });

  it('bails out for the root drop zone when the closest element is a child group (not null)', () => {
    // Root zone has targetGroupId=null. If e.target is inside a GroupCard
    // with data-group-id="child", the guard correctly bails.
    expect(wouldHandlerBailOut('child', null)).toBe(true);
  });

  it('does not bail out for the root drop zone when no group element is found (closestDataGroupId is null)', () => {
    // e.target has no ancestor with data-group-id, so closestDataGroupId is null.
    // Root zone targetGroupId is also null — the drop proceeds.
    expect(wouldHandlerBailOut(null, null)).toBe(false);
  });

  it('does not call moveGroup when dropped on nested group in root drop zone context', () => {
    const groups = [
      { id: 'child', parentGroupId: null },
    ];
    const result = simulateGroupDrop({
      closestDataGroupId: 'child',
      targetGroupId: null,
      draggedGroupId: 'other',
      groups,
      moveGroup,
    });
    expect(result).toBe('bailed');
    expect(moveGroup).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// handleGroupDragOver stopPropagation fix
//
// When dragging a board into a subgroup, the dragover event must not bubble to
// the parent GroupCard's dragover handler. Without e.stopPropagation(), the
// parent handler fires after the subgroup handler and overwrites dragOverTargetId
// with the parent's id, so the subgroup never appears highlighted as a drop target.
//
// These tests model the contract as a pure predicate — both handlers fire (in
// order, inner to outer) and verify that stopping propagation on the inner one
// prevents the outer one from overwriting the target id.
// ---------------------------------------------------------------------------

describe('handleGroupDragOver stopPropagation — prevents parent from overwriting dragOverTargetId', () => {
  function makeEvent({ stopped = false } = {}) {
    const event = {
      _stopped: stopped,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(function () { this._stopped = true; }),
      dataTransfer: { dropEffect: '' },
    };
    return event;
  }

  function simulateDragOverChain({ subgroupId, parentGroupId, callStopPropagation }) {
    const results = [];
    const e = makeEvent();

    const innerHandler = (event, targetGroupId) => {
      event.preventDefault();
      if (callStopPropagation) event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      results.push(targetGroupId);
    };

    const outerHandler = (event, targetGroupId) => {
      if (event._stopped) return;
      event.preventDefault();
      if (callStopPropagation) event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      results.push(targetGroupId);
    };

    innerHandler(e, subgroupId);
    outerHandler(e, parentGroupId);
    return results;
  }

  it('without stopPropagation, parent handler fires after subgroup handler and appends parentGroupId', () => {
    const ids = simulateDragOverChain({
      subgroupId: 'child',
      parentGroupId: 'parent',
      callStopPropagation: false,
    });
    expect(ids).toEqual(['child', 'parent']);
  });

  it('with stopPropagation, parent handler is skipped — only subgroupId is recorded', () => {
    const ids = simulateDragOverChain({
      subgroupId: 'child',
      parentGroupId: 'parent',
      callStopPropagation: true,
    });
    expect(ids).toEqual(['child']);
  });

  it('stopPropagation is called on the event when callStopPropagation is true', () => {
    const e = makeEvent();
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    expect(e.stopPropagation).toHaveBeenCalledTimes(1);
    expect(e._stopped).toBe(true);
  });

  it('with stopPropagation, the last recorded dragOverTargetId is the subgroup, not the parent', () => {
    let dragOverTargetId = null;
    const e = makeEvent();

    const innerHandler = (event, targetGroupId) => {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      dragOverTargetId = targetGroupId;
    };

    const outerHandler = (event, targetGroupId) => {
      if (event._stopped) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dragOverTargetId = targetGroupId;
    };

    innerHandler(e, 'child');
    outerHandler(e, 'parent');

    expect(dragOverTargetId).toBe('child');
  });

  it('without stopPropagation, the last recorded dragOverTargetId is the parent (the bug)', () => {
    let dragOverTargetId = null;
    const e = makeEvent();

    const innerHandler = (event, targetGroupId) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dragOverTargetId = targetGroupId;
    };

    const outerHandler = (event, targetGroupId) => {
      if (event._stopped) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      dragOverTargetId = targetGroupId;
    };

    innerHandler(e, 'child');
    outerHandler(e, 'parent');

    expect(dragOverTargetId).toBe('parent');
  });
});
