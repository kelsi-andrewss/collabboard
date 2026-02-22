import { describe, it, expect } from 'vitest';
import {
  computeAncestorExpansions,
  FRAME_MARGIN,
} from './frameUtils';

// Story-110: sticky note dimension fallbacks in frame bounding-box calculations.
// computeAncestorExpansions — sibling envelope uses type-aware defaults.
// Pre-fix: a sticky sibling with no width/height was treated as 150x150.
// Post-fix: a sticky sibling with no width/height is treated as 200x200.

describe('computeAncestorExpansions — sticky sibling dimension fallback', () => {
  it('uses 200 (not 150) as default width for a sticky sibling that has no width field', () => {
    // Frame is wide enough for a 150-wide sibling but NOT for a 200-wide sibling.
    // If the bug were present, no expansion would be produced. The fix must trigger one.
    const objects = {
      parent: {
        id: 'parent', type: 'frame',
        x: 0, y: 0, width: 180, height: 400,
        frameId: null,
        childIds: ['trigger', 'sibling'],
      },
      trigger: { id: 'trigger', type: 'sticky', x: 10, y: 50, width: 30, height: 30, frameId: 'parent' },
      // no width / height — sticky default should be 200
      sibling: { id: 'sibling', type: 'sticky', x: 0, y: 50, frameId: 'parent' },
    };
    // sibling right edge with correct default: 0 + 200 = 200, which exceeds parent width 180
    const expansions = computeAncestorExpansions(10, 50, 30, 30, 'parent', objects, FRAME_MARGIN);
    expect(expansions.length).toBeGreaterThan(0);
    const exp = expansions[0].data;
    // Right edge must cover sibling.x + 200 + FRAME_MARGIN
    expect(exp.x + exp.width).toBeGreaterThanOrEqual(200 + FRAME_MARGIN);
  });

  it('uses 200 (not 150) as default height for a sticky sibling that has no height field', () => {
    const objects = {
      parent: {
        id: 'parent', type: 'frame',
        x: 0, y: 0, width: 400, height: 180,
        frameId: null,
        childIds: ['trigger', 'sibling'],
      },
      trigger: { id: 'trigger', type: 'sticky', x: 50, y: 10, width: 30, height: 30, frameId: 'parent' },
      sibling: { id: 'sibling', type: 'sticky', x: 50, y: 0, frameId: 'parent' },
    };
    const expansions = computeAncestorExpansions(50, 10, 30, 30, 'parent', objects, FRAME_MARGIN);
    expect(expansions.length).toBeGreaterThan(0);
    const exp = expansions[0].data;
    // Bottom edge must cover sibling.y + 200 + FRAME_MARGIN
    expect(exp.y + exp.height).toBeGreaterThanOrEqual(200 + FRAME_MARGIN);
  });

  it('non-sticky sibling without dimensions still uses 150 as default', () => {
    const objects = {
      parent: {
        id: 'parent', type: 'frame',
        x: 0, y: 0, width: 180, height: 400,
        frameId: null,
        childIds: ['trigger', 'sibling'],
      },
      trigger: { id: 'trigger', type: 'sticky', x: 10, y: 50, width: 30, height: 30, frameId: 'parent' },
      // rectangle without width/height — default should be 150, which fits in 180
      sibling: { id: 'sibling', type: 'rectangle', x: 0, y: 50, frameId: 'parent' },
    };
    // 0 + 150 = 150 < 180, so the sibling alone should not force an expansion
    // (the trigger at x=10, w=30 gives right=40 which also fits)
    const expansions = computeAncestorExpansions(10, 50, 30, 30, 'parent', objects, FRAME_MARGIN);
    // Either no expansion, or if there is one it must NOT reach 200+FRAME_MARGIN from left
    if (expansions.length > 0) {
      const exp = expansions[0].data;
      expect(exp.x + exp.width).toBeLessThan(200 + FRAME_MARGIN);
    }
  });
});
