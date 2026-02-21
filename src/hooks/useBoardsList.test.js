import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../firebase/config', () => ({ db: {} }));

let onSnapshotCallbacks = {};
let unsubscribers = {};

const mockOnSnapshot = vi.fn((q, callback, errCallback) => {
  const key = q.__key || 'default';
  onSnapshotCallbacks[key] = callback;
  const unsub = vi.fn();
  unsubscribers[key] = unsub;
  return unsub;
});

const mockCollection = vi.fn(() => ({ __type: 'collection', __key: 'boards' }));
const mockQuery = vi.fn((...args) => {
  // Build a key from the where constraints to distinguish queries
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

    // The admin branch should call query(ref) — no where() calls
    expect(mockWhere).not.toHaveBeenCalled();
    // onSnapshot should be called exactly once (the all-boards query)
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

    // Simulate all three snapshots firing, with board-1 appearing in owned and public
    act(() => {
      triggerSnapshot(ownedKey, [makeDoc('board-1', { name: 'Shared' })]);
    });
    act(() => {
      triggerSnapshot(publicKey, [makeDoc('board-1', { name: 'Shared' })]);
    });
    act(() => {
      triggerSnapshot(memberKey, [makeDoc('board-2', { name: 'Member Board' })]);
    });

    // board-1 should appear only once despite being in two snapshots
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

    // Single admin snapshot
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(mockWhere).not.toHaveBeenCalled();
  });
});
