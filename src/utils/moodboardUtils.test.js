import { describe, it, expect } from 'vitest';
import { computeMoodboardLayout } from './moodboardUtils.js';

const CARD_WIDTH = 240;
const GAP = 16;
const START_X = 50;
const START_Y = 50;
const MAX_CARD_HEIGHT = 320;

describe('computeMoodboardLayout — empty and trivial inputs', () => {
  it('returns empty array for an empty objects list', () => {
    expect(computeMoodboardLayout([])).toEqual([]);
  });

  it('returns empty array when all objects are framed children', () => {
    const objects = [
      { id: 'a', frameId: 'f1', color: '#ff0000', width: 200, height: 200 },
      { id: 'b', frameId: 'f1', color: '#00ff00', width: 200, height: 200 },
    ];
    expect(computeMoodboardLayout(objects)).toEqual([]);
  });

  it('handles a single unframed object', () => {
    const objects = [{ id: 'obj1', color: '#ff0000', width: 200, height: 200 }];
    const result = computeMoodboardLayout(objects);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('obj1');
    expect(result[0].x).toBe(START_X);
    expect(result[0].y).toBe(START_Y);
    expect(result[0].width).toBe(CARD_WIDTH);
  });
});

describe('computeMoodboardLayout — framed objects are skipped', () => {
  it('excludes objects with a frameId from placement', () => {
    const objects = [
      { id: 'free1', color: '#ff0000', width: 100, height: 100 },
      { id: 'child1', frameId: 'frame-abc', color: '#00ff00', width: 100, height: 100 },
      { id: 'free2', color: '#0000ff', width: 100, height: 100 },
    ];
    const result = computeMoodboardLayout(objects);
    const ids = result.map(p => p.id);
    expect(ids).not.toContain('child1');
    expect(ids).toContain('free1');
    expect(ids).toContain('free2');
    expect(result).toHaveLength(2);
  });

  it('treats objects with null frameId as unframed', () => {
    const objects = [
      { id: 'obj1', frameId: null, color: '#aabbcc', width: 200, height: 100 },
    ];
    const result = computeMoodboardLayout(objects);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('obj1');
  });

  it('treats objects with undefined frameId as unframed', () => {
    const objects = [
      { id: 'obj2', color: '#aabbcc', width: 200, height: 100 },
    ];
    const result = computeMoodboardLayout(objects);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('obj2');
  });
});

describe('computeMoodboardLayout — masonry column placement', () => {
  it('places first three objects in three separate columns', () => {
    const objects = [
      { id: 'a', color: '#ff0000', width: 240, height: 240 },
      { id: 'b', color: '#00ff00', width: 240, height: 240 },
      { id: 'c', color: '#0000ff', width: 240, height: 240 },
    ];
    const result = computeMoodboardLayout(objects);
    const xs = result.map(p => p.x);
    const expectedXs = [0, 1, 2].map(col => START_X + col * (CARD_WIDTH + GAP));
    expect(new Set(xs).size).toBe(3);
    for (const x of xs) {
      expect(expectedXs).toContain(x);
    }
  });

  it('each patch carries the correct CARD_WIDTH and a non-negative height', () => {
    const objects = [{ id: 'x', color: '#112233', width: 240, height: 120 }];
    const [patch] = computeMoodboardLayout(objects);
    expect(patch.width).toBe(CARD_WIDTH);
    expect(patch.height).toBeGreaterThanOrEqual(0);
  });

  it('height is capped at MAX_CARD_HEIGHT for very tall objects', () => {
    const objects = [{ id: 'tall', color: '#112233', width: 100, height: 10000 }];
    const [patch] = computeMoodboardLayout(objects);
    expect(patch.height).toBeLessThanOrEqual(MAX_CARD_HEIGHT);
  });

  it('fourth object goes to the shortest column', () => {
    // After hue sort: red(0) → green(120) → cyan(180) → blue(240)
    // col assignment sequence: red→col0, green→col1, cyan→col2, blue→shortest
    // red height is short so col0 is shortest when blue gets placed
    const objects = [
      { id: 'red',   color: '#ff0000', width: 240, height: 50  },
      { id: 'green', color: '#00ff00', width: 240, height: 240 },
      { id: 'cyan',  color: '#00ffff', width: 240, height: 240 },
      { id: 'blue',  color: '#0000ff', width: 240, height: 50  },
    ];
    const result = computeMoodboardLayout(objects);
    const redPatch  = result.find(p => p.id === 'red');
    const bluePatch = result.find(p => p.id === 'blue');
    expect(redPatch).toBeDefined();
    expect(bluePatch).toBeDefined();
    expect(bluePatch.x).toBe(redPatch.x);
  });

  it('second object in a column starts below the first with a gap', () => {
    // Three objects: first fills col0 and col1 and col2, then fourth wraps to col0
    const objects = [
      { id: 'a', color: '#ff0000', width: 240, height: 100 },
      { id: 'b', color: '#00ff00', width: 240, height: 200 },
      { id: 'c', color: '#0000ff', width: 240, height: 200 },
      { id: 'd', color: '#ff00ff', width: 240, height: 50  },
    ];
    const result = computeMoodboardLayout(objects);
    const aPatch = result.find(p => p.id === 'a');
    const dPatch = result.find(p => p.id === 'd');
    // d goes to col0 (same x as a), and must start below a + GAP
    expect(dPatch.x).toBe(aPatch.x);
    expect(dPatch.y).toBe(aPatch.y + aPatch.height + GAP);
  });

  it('all patches have numeric coordinates', () => {
    const objects = [
      { id: 'a', color: '#ff0000', width: 200, height: 150 },
      { id: 'b', color: '#00ff00', width: 200, height: 200 },
      { id: 'c', color: '#0000ff', width: 200, height: 100 },
    ];
    const result = computeMoodboardLayout(objects);
    for (const patch of result) {
      expect(typeof patch.x).toBe('number');
      expect(typeof patch.y).toBe('number');
      expect(typeof patch.width).toBe('number');
      expect(typeof patch.height).toBe('number');
    }
  });
});

describe('computeMoodboardLayout — color sorting', () => {
  it('sorts objects by hue so red-ish appears before blue-ish', () => {
    const objects = [
      { id: 'blue',  color: '#0000ff' },
      { id: 'green', color: '#00ff00' },
      { id: 'red',   color: '#ff0000' },
    ];
    const result = computeMoodboardLayout(objects);
    // After hue sort: red(0) → green(120) → blue(240)
    // red gets the first column slot at START_X
    const colZeroX = START_X + 0 * (CARD_WIDTH + GAP);
    const redPatch = result.find(p => p.id === 'red');
    expect(redPatch.x).toBe(colZeroX);
  });

  it('handles null color without throwing', () => {
    const objects = [{ id: 'nocolor', color: null, width: 100, height: 100 }];
    expect(() => computeMoodboardLayout(objects)).not.toThrow();
    expect(computeMoodboardLayout(objects)).toHaveLength(1);
  });

  it('handles invalid hex string without throwing', () => {
    const objects = [{ id: 'badcolor', color: 'not-a-color', width: 100, height: 100 }];
    expect(() => computeMoodboardLayout(objects)).not.toThrow();
    expect(computeMoodboardLayout(objects)).toHaveLength(1);
  });
});

describe('computeMoodboardLayout — aspect ratio and dimensions', () => {
  it('scales height proportionally: 240x120 object gets height 120', () => {
    const objects = [{ id: 'wide', color: '#ff0000', width: 240, height: 120 }];
    const [patch] = computeMoodboardLayout(objects);
    expect(patch.height).toBe(120);
  });

  it('square 240x240 object gets height 240', () => {
    const objects = [{ id: 'square', color: '#ff0000', width: 240, height: 240 }];
    const [patch] = computeMoodboardLayout(objects);
    expect(patch.height).toBe(240);
  });

  it('uses CARD_WIDTH fallback when object width is 0', () => {
    const objects = [{ id: 'nowidth', color: '#ff0000', width: 0, height: 0 }];
    const [patch] = computeMoodboardLayout(objects);
    expect(patch.width).toBe(CARD_WIDTH);
  });
});
