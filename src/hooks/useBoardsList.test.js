import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Thumbnail selection logic — theme-matched variant with fallback
//
// The display components select a thumbnail using:
//   darkMode ? (thumbnailDark || thumbnailLight || thumbnail)
//            : (thumbnailLight || thumbnailDark || thumbnail)
//
// This models the exact selection logic extracted from GroupCard, GroupPage,
// and BoardSelector so it can be exercised without rendering.
// ---------------------------------------------------------------------------

function selectThumbnail(board, darkMode) {
  return darkMode
    ? (board.thumbnailDark || board.thumbnailLight || board.thumbnail)
    : (board.thumbnailLight || board.thumbnailDark || board.thumbnail);
}

describe('thumbnail selection — light mode', () => {
  it('returns thumbnailLight when both themed variants are set', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url', thumbnail: 'legacy' };
    expect(selectThumbnail(board, false)).toBe('light-url');
  });

  it('falls back to thumbnailDark when thumbnailLight is missing', () => {
    const board = { thumbnailLight: null, thumbnailDark: 'dark-url', thumbnail: 'legacy' };
    expect(selectThumbnail(board, false)).toBe('dark-url');
  });

  it('falls back to legacy thumbnail when both themed variants are missing', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: 'legacy' };
    expect(selectThumbnail(board, false)).toBe('legacy');
  });

  it('returns undefined when all thumbnail fields are null', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: null };
    expect(selectThumbnail(board, false)).toBeFalsy();
  });

  it('returns thumbnailLight when legacy thumbnail field is absent', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url' };
    expect(selectThumbnail(board, false)).toBe('light-url');
  });
});

describe('thumbnail selection — dark mode', () => {
  it('returns thumbnailDark when both themed variants are set', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url', thumbnail: 'legacy' };
    expect(selectThumbnail(board, true)).toBe('dark-url');
  });

  it('falls back to thumbnailLight when thumbnailDark is missing', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: null, thumbnail: 'legacy' };
    expect(selectThumbnail(board, true)).toBe('light-url');
  });

  it('falls back to legacy thumbnail when both themed variants are missing', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: 'legacy' };
    expect(selectThumbnail(board, true)).toBe('legacy');
  });

  it('returns undefined when all thumbnail fields are null', () => {
    const board = { thumbnailLight: null, thumbnailDark: null, thumbnail: null };
    expect(selectThumbnail(board, true)).toBeFalsy();
  });

  it('returns thumbnailDark when legacy thumbnail field is absent', () => {
    const board = { thumbnailLight: 'light-url', thumbnailDark: 'dark-url' };
    expect(selectThumbnail(board, true)).toBe('dark-url');
  });
});

describe('thumbnail selection — legacy boards without themed variants', () => {
  it('returns the legacy thumbnail in light mode', () => {
    const board = { thumbnail: 'old-thumb' };
    expect(selectThumbnail(board, false)).toBe('old-thumb');
  });

  it('returns the legacy thumbnail in dark mode', () => {
    const board = { thumbnail: 'old-thumb' };
    expect(selectThumbnail(board, true)).toBe('old-thumb');
  });

  it('returns undefined for a brand-new board with no thumbnails in either mode', () => {
    const board = { thumbnail: null };
    expect(selectThumbnail(board, false)).toBeFalsy();
    expect(selectThumbnail(board, true)).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// captureThumbnail — dual capture sequence
//
// The capture function sets the bg-rect fill to #ffffff for the light capture,
// then to #111827 for the dark capture, and always restores the original fill.
// We model this state-machine logic as pure functions.
// ---------------------------------------------------------------------------

function simulateCapture(bgRect, stage, saveThumbnail, boardId) {
  const originalFill = bgRect ? bgRect.fill() : null;
  try {
    const captureOpts = { pixelRatio: 1, mimeType: 'image/jpeg', quality: 0.7 };
    if (bgRect) bgRect.fill('#ffffff');
    const lightUrl = stage.toDataURL(captureOpts);
    if (bgRect) bgRect.fill('#111827');
    const darkUrl = stage.toDataURL(captureOpts);
    saveThumbnail(boardId, lightUrl, darkUrl);
  } finally {
    if (bgRect) bgRect.fill(originalFill);
  }
}

describe('captureThumbnail — dual capture sequence', () => {
  let fillHistory;
  let bgRect;
  let stage;
  let saveThumbnail;

  beforeEach(() => {
    fillHistory = [];
    let currentFill = '#111827';
    bgRect = {
      fill: vi.fn((v) => {
        if (v !== undefined) {
          fillHistory.push(v);
          currentFill = v;
        }
        return currentFill;
      }),
    };
    let captureCount = 0;
    stage = {
      toDataURL: vi.fn(() => {
        captureCount++;
        return captureCount === 1 ? 'data:light' : 'data:dark';
      }),
    };
    saveThumbnail = vi.fn();
  });

  it('sets fill to #ffffff before the light capture', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(fillHistory[0]).toBe('#ffffff');
  });

  it('sets fill to #111827 before the dark capture', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(fillHistory[1]).toBe('#111827');
  });

  it('restores the original fill after both captures', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(fillHistory[2]).toBe('#111827');
  });

  it('calls toDataURL exactly twice', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(stage.toDataURL).toHaveBeenCalledTimes(2);
  });

  it('calls saveThumbnail with the light url as the second arg', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(saveThumbnail).toHaveBeenCalledWith('board-1', 'data:light', 'data:dark');
  });

  it('calls saveThumbnail with the dark url as the third arg', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    const [, , darkArg] = saveThumbnail.mock.calls[0];
    expect(darkArg).toBe('data:dark');
  });

  it('calls saveThumbnail exactly once', () => {
    simulateCapture(bgRect, stage, saveThumbnail, 'board-1');
    expect(saveThumbnail).toHaveBeenCalledOnce();
  });

  it('restores the fill even when toDataURL throws', () => {
    stage.toDataURL = vi.fn(() => { throw new Error('canvas error'); });
    try { simulateCapture(bgRect, stage, saveThumbnail, 'board-1'); } catch { /* ignore */ }
    expect(fillHistory[fillHistory.length - 1]).toBe('#111827');
  });
});

// ---------------------------------------------------------------------------
// Module mocks for useBoardsList hook tests
// ---------------------------------------------------------------------------

vi.mock('../firebase/config', () => ({ db: {} }));

let onSnapshotCallbacks = {};
let unsubscribers = {};

const mockOnSnapshot = vi.fn((q, callback) => {
  const key = q.__key || 'default';
  onSnapshotCallbacks[key] = callback;
  const unsub = vi.fn();
  unsubscribers[key] = unsub;
  return unsub;
});

const mockCollection = vi.fn(() => ({ __type: 'collection', __key: 'boards' }));
const mockQuery = vi.fn((...args) => {
  const constraints = args.slice(1).map(a => a.__constraintKey || '').join('|');
  return { __type: 'query', __constraints: args.slice(1), __key: constraints || 'all' };
});
const mockWhere = vi.fn((field, op, val) => ({
  __type: 'where',
  __constraintKey: `${field}${op}${val}`,
  field,
  op,
  val,
}));
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockWriteBatch = vi.fn(() => ({
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));
const mockDoc = vi.fn((db, ...path) => ({ __type: 'doc', path: path.join('/') }));
const mockDeleteField = vi.fn(() => '__DELETE__');

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  query: (...args) => mockQuery(...args),
  where: (...args) => mockWhere(...args),
  addDoc: (...args) => mockAddDoc(...args),
  serverTimestamp: (...args) => mockServerTimestamp(...args),
  doc: (...args) => mockDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  writeBatch: (...args) => mockWriteBatch(...args),
  deleteField: (...args) => mockDeleteField(...args),
}));

import { useBoardsList } from './useBoardsList';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeUser = { uid: 'user-abc' };

function makeDoc(id, data) {
  return { id, data: () => data };
}

function makeSnap(docs) {
  return { docs };
}

function triggerSnapshot(key, docs) {
  const cb = onSnapshotCallbacks[key];
  if (cb) cb(makeSnap(docs));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBoardsList — isAdminView=true fetches all boards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotCallbacks = {};
    unsubscribers = {};
  });

  it('subscribes to all boards (no where constraints) when isAdminView is true', () => {
    renderHook(() => useBoardsList(fakeUser, { isAdminView: true }));

    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
  });

  it('sets boards from snapshot when isAdminView is true', () => {
    const { result } = renderHook(() => useBoardsList(fakeUser, { isAdminView: true }));

    act(() => {
      triggerSnapshot('all', [
        makeDoc('board-1', { name: 'Alpha', ownerId: 'other-user' }),
        makeDoc('board-2', { name: 'Beta', ownerId: fakeUser.uid }),
      ]);
    });

    expect(result.current.boards).toHaveLength(2);
    expect(result.current.boards[0].id).toBe('board-1');
    expect(result.current.boards[1].id).toBe('board-2');
    expect(result.current.loading).toBe(false);
  });

  it('starts with loading=true and loading=false after snapshot fires', () => {
    const { result } = renderHook(() => useBoardsList(fakeUser, { isAdminView: true }));

    expect(result.current.loading).toBe(true);

    act(() => {
      triggerSnapshot('all', [makeDoc('board-1', { name: 'Alpha' })]);
    });

    expect(result.current.loading).toBe(false);
  });

  it('calls unsubscribe on cleanup when isAdminView is true', () => {
    const { unmount } = renderHook(() => useBoardsList(fakeUser, { isAdminView: true }));

    const unsub = unsubscribers['all'];
    expect(unsub).toBeDefined();

    unmount();

    expect(unsub).toHaveBeenCalledTimes(1);
  });
});

describe('useBoardsList — isAdminView=false uses owned/public/member queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotCallbacks = {};
    unsubscribers = {};
  });

  it('subscribes to three separate queries when isAdminView is false', () => {
    renderHook(() => useBoardsList(fakeUser, { isAdminView: false }));

    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);
  });

  it('queries by ownerId for the user', () => {
    renderHook(() => useBoardsList(fakeUser, { isAdminView: false }));

    expect(mockWhere).toHaveBeenCalledWith('ownerId', '==', fakeUser.uid);
  });

  it('queries by visibility in [public, open]', () => {
    renderHook(() => useBoardsList(fakeUser, { isAdminView: false }));

    expect(mockWhere).toHaveBeenCalledWith('visibility', 'in', ['public', 'open']);
  });

  it('queries by member field for the user', () => {
    renderHook(() => useBoardsList(fakeUser, { isAdminView: false }));

    expect(mockWhere).toHaveBeenCalledWith(`members.${fakeUser.uid}`, '!=', null);
  });

  it('deduplicates boards appearing in multiple snapshots', () => {
    const { result } = renderHook(() => useBoardsList(fakeUser, { isAdminView: false }));

    const ownedKey = `ownerId==${fakeUser.uid}`;
    const publicKey = `visibility in public,open`;
    const memberKey = `members.${fakeUser.uid}!=null`;

    act(() => {
      triggerSnapshot(ownedKey, [makeDoc('board-1', { name: 'Shared' })]);
    });
    act(() => {
      triggerSnapshot(publicKey, [makeDoc('board-1', { name: 'Shared' })]);
    });
    act(() => {
      triggerSnapshot(memberKey, [makeDoc('board-2', { name: 'Member Board' })]);
    });

    const ids = result.current.boards.map(b => b.id);
    expect(ids.filter(id => id === 'board-1')).toHaveLength(1);
    expect(ids).toContain('board-2');
  });
});

describe('useBoardsList — no user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotCallbacks = {};
    unsubscribers = {};
  });

  it('returns empty boards and loading=false when currentUser is null', () => {
    const { result } = renderHook(() => useBoardsList(null));

    expect(result.current.boards).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});

describe('useBoardsList — switching isAdminView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotCallbacks = {};
    unsubscribers = {};
  });

  it('unsubscribes from admin query and resubscribes to three queries when toggled off', () => {
    const { rerender } = renderHook(
      ({ isAdminView }) => useBoardsList(fakeUser, { isAdminView }),
      { initialProps: { isAdminView: true } }
    );

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    const adminUnsub = unsubscribers['all'];

    vi.clearAllMocks();
    onSnapshotCallbacks = {};
    unsubscribers = {};

    rerender({ isAdminView: false });

    expect(adminUnsub).toHaveBeenCalledTimes(1);
    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);
  });

  it('unsubscribes from three queries and resubscribes to admin query when toggled on', () => {
    const { rerender } = renderHook(
      ({ isAdminView }) => useBoardsList(fakeUser, { isAdminView }),
      { initialProps: { isAdminView: false } }
    );

    expect(mockOnSnapshot).toHaveBeenCalledTimes(3);

    vi.clearAllMocks();
    onSnapshotCallbacks = {};
    unsubscribers = {};

    rerender({ isAdminView: true });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(mockWhere).not.toHaveBeenCalled();
  });
});
