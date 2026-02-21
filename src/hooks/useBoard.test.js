import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../firebase/config', () => ({ db: {} }));

let mockBatchUpdate;
let mockBatchDelete;
let mockBatchCommit;

const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');
const mockArrayRemove = vi.fn((...ids) => ({ __op: 'arrayRemove', ids }));
const mockArrayUnion = vi.fn((...ids) => ({ __op: 'arrayUnion', ids }));
const mockDoc = vi.fn((db, ...path) => ({ __type: 'doc', path: path.join('/') }));
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockCollection = vi.fn(() => ({ __type: 'collection' }));
const mockQuery = vi.fn((ref) => ref);

let onSnapshotCallback = null;
const mockOnSnapshot = vi.fn((q, cb, errCb) => {
  onSnapshotCallback = cb;
  return vi.fn(); // unsubscribe
});

const mockWriteBatch = vi.fn(() => ({
  update: mockBatchUpdate,
  delete: mockBatchDelete,
  commit: mockBatchCommit,
}));

vi.mock('firebase/firestore', () => ({
  collection: (...args) => mockCollection(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  query: (...args) => mockQuery(...args),
  where: vi.fn(),
  addDoc: (...args) => mockAddDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  doc: (...args) => mockDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  writeBatch: (...args) => mockWriteBatch(...args),
  arrayRemove: (...args) => mockArrayRemove(...args),
  arrayUnion: (...args) => mockArrayUnion(...args),
}));

import { useBoard } from './useBoard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fakeUser = { uid: 'user-1' };
const boardId = 'board-abc';

function makeSnap(objectsMap) {
  const docs = Object.entries(objectsMap).map(([id, data]) => ({
    id,
    data: () => data,
  }));
  return { forEach: (fn) => docs.forEach(fn) };
}

function renderBoard(initialObjects = {}) {
  mockBatchUpdate = vi.fn();
  mockBatchDelete = vi.fn();
  mockBatchCommit = vi.fn().mockResolvedValue(undefined);

  mockWriteBatch.mockReturnValue({
    update: mockBatchUpdate,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  });

  const hook = renderHook(() => useBoard(boardId, fakeUser));

  // Trigger the onSnapshot callback to populate objects state
  act(() => {
    if (onSnapshotCallback) {
      onSnapshotCallback(makeSnap(initialObjects));
    }
  });

  // Reset batch mocks after the hydration batch that may fire
  mockBatchUpdate.mockClear();
  mockBatchDelete.mockClear();
  mockBatchCommit.mockClear();
  mockWriteBatch.mockReturnValue({
    update: mockBatchUpdate,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  });

  return hook;
}

// ---------------------------------------------------------------------------
// batchWriteAndDelete — frame parent update guard
// ---------------------------------------------------------------------------

describe('batchWriteAndDelete — skips batch.update on frame when frame is also being deleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotCallback = null;
  });

  it('does NOT call batch.update on the parent frame when the frame itself is in deleteIds', async () => {
    // Objects: a frame containing one child
    const objects = {
      'frame-1': { type: 'frame', frameId: null, childIds: ['child-1'] },
      'child-1': { type: 'sticky', frameId: 'frame-1', childIds: [] },
    };

    const { result } = renderBoard(objects);

    await act(async () => {
      // Delete both the child and its parent frame in one call
      await result.current.batchWriteAndDelete([], ['child-1', 'frame-1']);
    });

    // batch.delete must have been called for both ids
    const deletedPaths = mockBatchDelete.mock.calls.map(([ref]) => ref.path);
    expect(deletedPaths).toContain(`boards/${boardId}/objects/child-1`);
    expect(deletedPaths).toContain(`boards/${boardId}/objects/frame-1`);

    // batch.update must NOT have been called with frame-1's path
    // (which would be the "remove child from parent frame" update)
    const updatedPaths = mockBatchUpdate.mock.calls.map(([ref]) => ref.path);
    expect(updatedPaths).not.toContain(`boards/${boardId}/objects/frame-1`);
  });

  it('DOES call batch.update on the parent frame when the frame is NOT being deleted', async () => {
    // Objects: a frame containing one child; only the child is deleted
    const objects = {
      'frame-1': { type: 'frame', frameId: null, childIds: ['child-1'] },
      'child-1': { type: 'sticky', frameId: 'frame-1', childIds: [] },
    };

    const { result } = renderBoard(objects);

    await act(async () => {
      // Delete only the child — frame stays
      await result.current.batchWriteAndDelete([], ['child-1']);
    });

    // batch.update should be called on frame-1 to remove child-1 from childIds
    const updatedPaths = mockBatchUpdate.mock.calls.map(([ref]) => ref.path);
    expect(updatedPaths).toContain(`boards/${boardId}/objects/frame-1`);
  });

  it('calls batch.commit exactly once per batchWriteAndDelete call', async () => {
    const objects = {
      'frame-1': { type: 'frame', frameId: null, childIds: ['child-1', 'child-2'] },
      'child-1': { type: 'sticky', frameId: 'frame-1', childIds: [] },
      'child-2': { type: 'sticky', frameId: 'frame-1', childIds: [] },
    };

    const { result } = renderBoard(objects);

    await act(async () => {
      await result.current.batchWriteAndDelete([], ['child-1', 'child-2', 'frame-1']);
    });

    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('handles a child with no frameId without calling batch.update on any frame', async () => {
    // Orphaned sticky with no parent
    const objects = {
      'sticky-1': { type: 'sticky', frameId: null, childIds: [] },
    };

    const { result } = renderBoard(objects);

    await act(async () => {
      await result.current.batchWriteAndDelete([], ['sticky-1']);
    });

    // Only delete, no update for frame childIds cleanup
    const updatedPaths = mockBatchUpdate.mock.calls.map(([ref]) => ref.path);
    expect(updatedPaths).toHaveLength(0);
    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
  });

  it('skips the guard for each child individually when multiple children share a frame being deleted', async () => {
    const objects = {
      'frame-1': { type: 'frame', frameId: null, childIds: ['child-a', 'child-b'] },
      'child-a': { type: 'sticky', frameId: 'frame-1', childIds: [] },
      'child-b': { type: 'sticky', frameId: 'frame-1', childIds: [] },
    };

    const { result } = renderBoard(objects);

    await act(async () => {
      await result.current.batchWriteAndDelete([], ['child-a', 'child-b', 'frame-1']);
    });

    const updatedPaths = mockBatchUpdate.mock.calls.map(([ref]) => ref.path);
    // The frame itself must never appear as an update target
    const frameUpdates = updatedPaths.filter(p => p.includes('frame-1'));
    expect(frameUpdates).toHaveLength(0);
  });
});
