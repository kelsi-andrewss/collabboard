import { describe, it, expect } from 'vitest';
import { formatDate, estimateItemHeight, distributeToColumns } from './GroupPage';

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
  it('returns 48 for subgroup items', () => {
    expect(estimateItemHeight({ type: 'subgroup' })).toBe(48);
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
