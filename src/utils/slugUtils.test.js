import { describe, it, expect } from 'vitest';
import { toSlug, groupToSlug, findGroupBySlug, UNGROUPED_SLUG } from './slugUtils';

describe('toSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('strips special characters', () => {
    expect(toSlug('Hello! @World#')).toBe('hello-world');
  });

  it('returns empty string for empty input', () => {
    expect(toSlug('')).toBe('');
  });
});

describe('groupToSlug', () => {
  it('returns UNGROUPED_SLUG for null', () => {
    expect(groupToSlug(null)).toBe(UNGROUPED_SLUG);
  });

  it('returns UNGROUPED_SLUG for empty string', () => {
    expect(groupToSlug('')).toBe(UNGROUPED_SLUG);
  });

  it('slugifies a string input', () => {
    expect(groupToSlug('My Group')).toBe('my-group');
  });

  it('uses .slug field when present on object', () => {
    expect(groupToSlug({ slug: 'custom-slug', name: 'Ignored' })).toBe('custom-slug');
  });

  it('falls back to toSlug(name) when object has no .slug', () => {
    expect(groupToSlug({ name: 'Some Name' })).toBe('some-name');
  });
});

describe('findGroupBySlug', () => {
  it('returns null for UNGROUPED_SLUG', () => {
    expect(findGroupBySlug([], UNGROUPED_SLUG)).toBeNull();
  });

  it('finds group object by .slug field', () => {
    const groups = [
      { slug: 'alpha', name: 'Alpha' },
      { slug: 'beta', name: 'Beta' },
    ];
    expect(findGroupBySlug(groups, 'beta')).toEqual({ slug: 'beta', name: 'Beta' });
  });

  it('returns null when no group matches slug', () => {
    const groups = [{ slug: 'alpha', name: 'Alpha' }];
    expect(findGroupBySlug(groups, 'missing')).toBeNull();
  });

  it('matches legacy board.group string by slugifying', () => {
    const boards = [
      { group: 'My Project' },
      { group: 'Other' },
    ];
    expect(findGroupBySlug(boards, 'my-project')).toBe('My Project');
  });
});
