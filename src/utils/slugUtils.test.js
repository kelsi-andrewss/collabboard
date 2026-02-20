import { describe, it, expect } from 'vitest';
import { toSlug, findGroupBySlug, buildSlugChain, resolveSlugChain, isSlugTaken } from './slugUtils';

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

describe('findGroupBySlug', () => {
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

describe('buildSlugChain', () => {
  it('returns single-element array for root group', () => {
    const group = { id: '1', slug: 'team', name: 'Team' };
    expect(buildSlugChain(group, [group])).toEqual(['team']);
  });

  it('walks up parentGroupId chain', () => {
    const root = { id: '1', slug: 'org', name: 'Org' };
    const child = { id: '2', slug: 'frontend', name: 'Frontend', parentGroupId: '1' };
    const grandchild = { id: '3', slug: 'react', name: 'React', parentGroupId: '2' };
    const all = [root, child, grandchild];
    expect(buildSlugChain(grandchild, all)).toEqual(['org', 'frontend', 'react']);
  });

  it('falls back to toSlug(name) when slug field is missing', () => {
    const group = { id: '1', name: 'My Team' };
    expect(buildSlugChain(group, [group])).toEqual(['my-team']);
  });
});

describe('resolveSlugChain', () => {
  const root = { id: '1', slug: 'org', name: 'Org' };
  const child = { id: '2', slug: 'frontend', name: 'Frontend', parentGroupId: '1' };
  const sibling = { id: '3', slug: 'backend', name: 'Backend', parentGroupId: '1' };
  const all = [root, child, sibling];

  it('returns null for empty slug chain', () => {
    expect(resolveSlugChain([], all)).toBeNull();
  });

  it('resolves single-slug chain to root group', () => {
    expect(resolveSlugChain(['org'], all)).toBe(root);
  });

  it('resolves two-slug chain to child group', () => {
    expect(resolveSlugChain(['org', 'frontend'], all)).toBe(child);
  });

  it('returns null when root slug does not match', () => {
    expect(resolveSlugChain(['missing'], all)).toBeNull();
  });

  it('returns null when child slug does not match', () => {
    expect(resolveSlugChain(['org', 'missing'], all)).toBeNull();
  });

  it('does not match child slug at root level', () => {
    expect(resolveSlugChain(['frontend'], all)).toBeNull();
  });
});

describe('isSlugTaken', () => {
  const groups = [
    { id: '1', slug: 'team', name: 'Team' },
    { id: '2', slug: 'frontend', name: 'Frontend', parentGroupId: '1' },
    { id: '3', slug: 'team', name: 'Team', parentGroupId: '1' },
  ];

  it('detects collision at root level', () => {
    expect(isSlugTaken('team', null, groups)).toBe(true);
  });

  it('allows slug when no collision at root level', () => {
    expect(isSlugTaken('unique', null, groups)).toBe(false);
  });

  it('detects collision within same parent', () => {
    expect(isSlugTaken('frontend', '1', groups)).toBe(true);
  });

  it('allows slug in different parent', () => {
    expect(isSlugTaken('frontend', '99', groups)).toBe(false);
  });

  it('excludes specified group from collision check', () => {
    expect(isSlugTaken('team', null, groups, '1')).toBe(false);
  });
});
