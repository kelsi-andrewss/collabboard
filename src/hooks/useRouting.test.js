import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRouting } from './useRouting';

function setHash(hash) {
  window.location.hash = hash;
}

function clearHash() {
  history.pushState('', document.title, window.location.pathname);
}

beforeEach(() => {
  localStorage.clear();
  clearHash();
});

afterEach(() => {
  localStorage.clear();
  clearHash();
});

describe('useRouting — initial state from hash', () => {
  it('parses #group/<slug> as group-only', () => {
    setHash('group/my-team');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual(['my-team']);
    expect(result.current.boardId).toBeNull();
  });

  it('parses #group/<slug>/board/<id> as group + board', () => {
    setHash('group/my-team/board/abc123');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual(['my-team']);
    expect(result.current.boardId).toBe('abc123');
  });

  it('parses #group/<parent>/subgroup/<child> as nested group', () => {
    setHash('group/org/subgroup/frontend');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual(['org', 'frontend']);
    expect(result.current.boardId).toBeNull();
  });

  it('parses #group/<parent>/subgroup/<child>/board/<id> as nested group + board', () => {
    setHash('group/org/subgroup/frontend/board/xyz');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual(['org', 'frontend']);
    expect(result.current.boardId).toBe('xyz');
  });

  it('parses deep nesting: group/<a>/subgroup/<b>/subgroup/<c>', () => {
    setHash('group/a/subgroup/b/subgroup/c');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual(['a', 'b', 'c']);
    expect(result.current.boardId).toBeNull();
  });

  it('parses #board/<id> as ungrouped board', () => {
    setHash('board/solo-board');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual([]);
    expect(result.current.boardId).toBe('solo-board');
  });

  it('returns empty groupSlugs and null boardId for empty hash', () => {
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual([]);
    expect(result.current.boardId).toBeNull();
  });

  it('ignores localStorage boardId when hash is empty', () => {
    localStorage.setItem('collaboard_boardId', 'saved-board');
    const { result } = renderHook(() => useRouting());
    expect(result.current.boardId).toBeNull();
    expect(result.current.groupSlugs).toEqual([]);
  });
});

describe('useRouting — legacy hash parsing', () => {
  it('redirects legacy #slug/boardId to new format', () => {
    localStorage.setItem('collaboard_boardId', 'other');
    setHash('my-group/board-abc');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual(['my-group']);
    expect(result.current.boardId).toBe('board-abc');
  });

  it('redirects legacy #slug to new format', () => {
    setHash('some-group');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual(['some-group']);
    expect(result.current.boardId).toBeNull();
  });

  it('redirects legacy #boardId (matching localStorage) to new format', () => {
    localStorage.setItem('collaboard_boardId', 'board-xyz');
    setHash('board-xyz');
    const { result } = renderHook(() => useRouting());
    expect(result.current.boardId).toBe('board-xyz');
    expect(result.current.groupSlugs).toEqual([]);
  });

  it('redirects legacy #__ungrouped__ to home', () => {
    setHash('__ungrouped__');
    const { result } = renderHook(() => useRouting());
    expect(result.current.groupSlugs).toEqual([]);
    expect(result.current.boardId).toBeNull();
  });
});

describe('useRouting — navigation helpers', () => {
  it('navigateHome clears everything', () => {
    setHash('group/team/board/b1');
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateHome());
    expect(result.current.groupSlugs).toEqual([]);
    expect(result.current.boardId).toBeNull();
    expect(result.current.boardName).toBe('');
  });

  it('navigateToGroup sets groupSlugs and clears boardId', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToGroup(['design-team']));
    expect(result.current.groupSlugs).toEqual(['design-team']);
    expect(result.current.boardId).toBeNull();
  });

  it('navigateToGroup works with nested slugs', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToGroup(['org', 'frontend']));
    expect(result.current.groupSlugs).toEqual(['org', 'frontend']);
  });

  it('navigateToBoard sets groupSlugs, boardId, and boardName', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToBoard(['eng'], 'board-99', 'Sprint Board'));
    expect(result.current.groupSlugs).toEqual(['eng']);
    expect(result.current.boardId).toBe('board-99');
    expect(result.current.boardName).toBe('Sprint Board');
  });

  it('navigateToBoard with empty slugs for ungrouped board', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToBoard([], 'board-solo', 'Solo'));
    expect(result.current.groupSlugs).toEqual([]);
    expect(result.current.boardId).toBe('board-solo');
  });

  it('navigateToBoard falls back to id when name is omitted', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToBoard(['eng'], 'board-99'));
    expect(result.current.boardName).toBe('board-99');
  });
});

describe('useRouting — hash sync effect', () => {
  it('writes #group/<slug>/board/<id> when group and board are set', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToBoard(['my-group'], 'board-42', 'Test Board'));
    expect(window.location.hash).toBe('#group/my-group/board/board-42');
  });

  it('writes #group/<slug> when only group is set', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToGroup(['just-group']));
    expect(window.location.hash).toBe('#group/just-group');
  });

  it('writes #board/<id> for ungrouped board', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToBoard([], 'board-solo', 'Solo'));
    expect(window.location.hash).toBe('#board/board-solo');
  });

  it('writes nested group hash correctly', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToGroup(['org', 'frontend']));
    expect(window.location.hash).toBe('#group/org/subgroup/frontend');
  });

  it('writes nested group + board hash correctly', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToBoard(['org', 'frontend'], 'b1', 'Board'));
    expect(window.location.hash).toBe('#group/org/subgroup/frontend/board/b1');
  });

  it('persists boardId to localStorage when navigating to a board', () => {
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToBoard(['grp'], 'board-persist', 'Persist'));
    expect(localStorage.getItem('collaboard_boardId')).toBe('board-persist');
  });

  it('removes boardId from localStorage when navigating to a group only', () => {
    localStorage.setItem('collaboard_boardId', 'old-board');
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateToGroup(['grp']));
    expect(localStorage.getItem('collaboard_boardId')).toBeNull();
  });

  it('removes boardId from localStorage when navigating home', () => {
    localStorage.setItem('collaboard_boardId', 'old-board');
    const { result } = renderHook(() => useRouting());
    act(() => result.current.navigateHome());
    expect(localStorage.getItem('collaboard_boardId')).toBeNull();
  });
});

describe('useRouting — hashchange listener', () => {
  it('updates state when hash changes to new format', async () => {
    const { result } = renderHook(() => useRouting());
    act(() => {
      window.location.hash = 'group/new-group/board/new-board';
      window.dispatchEvent(new Event('hashchange'));
    });
    expect(result.current.boardId).toBe('new-board');
    expect(result.current.groupSlugs).toEqual(['new-group']);
  });

  it('clears boardId when hash changes to group-only', async () => {
    setHash('group/grp/board/board-123');
    const { result } = renderHook(() => useRouting());
    act(() => {
      window.location.hash = 'group/grp';
      window.dispatchEvent(new Event('hashchange'));
    });
    expect(result.current.boardId).toBeNull();
    expect(result.current.groupSlugs).toEqual(['grp']);
  });
});
