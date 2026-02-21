import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeObjectHandlers } from './objectHandlers.js';

function makeBoard(objects) {
  return {
    objects,
    addObject: vi.fn(),
    updateObject: vi.fn(),
    deleteObject: vi.fn(),
    batchUpdateObjects: vi.fn(),
    batchWriteAndDelete: vi.fn(),
  };
}

function makeHandlers(objects) {
  const board = makeBoard(objects);
  const setSelectedId = vi.fn();
  const handlers = makeObjectHandlers({
    board,
    stageRef: { current: null },
    snap: (v) => v,
    setDragState: vi.fn(),
    setSelectedId,
    stagePos: { x: 0, y: 0 },
    stageScale: 1,
    setShapeColors: vi.fn(),
    setDragPos: vi.fn(),
    updateColorHistory: vi.fn(),
    setResizeTooltip: vi.fn(),
    resizeTooltipTimer: { current: null },
  });
  return { board, setSelectedId, handlers };
}

describe('handleDeleteMultiple', () => {
  it('calls batchWriteAndDelete with all ids when no frames selected', () => {
    const objects = {
      a: { id: 'a', type: 'sticky', x: 0, y: 0 },
      b: { id: 'b', type: 'rectangle', x: 10, y: 10 },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleDeleteMultiple(new Set(['a', 'b']));

    expect(board.batchWriteAndDelete).toHaveBeenCalledOnce();
    const [updates, deleteIds] = board.batchWriteAndDelete.mock.calls[0];
    expect(updates).toHaveLength(0);
    expect(deleteIds).toContain('a');
    expect(deleteIds).toContain('b');
    expect(deleteIds).toHaveLength(2);
  });

  it('reparents frame children not in the delete set', () => {
    const objects = {
      frame1: { id: 'frame1', type: 'frame', x: 0, y: 0, width: 300, height: 300 },
      child1: { id: 'child1', type: 'sticky', frameId: 'frame1', x: 10, y: 10 },
      child2: { id: 'child2', type: 'rectangle', frameId: 'frame1', x: 20, y: 20 },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleDeleteMultiple(new Set(['frame1']));

    expect(board.batchWriteAndDelete).toHaveBeenCalledOnce();
    const [updates, deleteIds] = board.batchWriteAndDelete.mock.calls[0];
    expect(deleteIds).toEqual(['frame1']);
    expect(updates).toHaveLength(2);
    const childIds = updates.map(u => u.id);
    expect(childIds).toContain('child1');
    expect(childIds).toContain('child2');
    for (const u of updates) {
      expect(u.data).toEqual({ frameId: null });
    }
  });

  it('does not reparent frame children that are also being deleted', () => {
    const objects = {
      frame1: { id: 'frame1', type: 'frame', x: 0, y: 0, width: 300, height: 300 },
      child1: { id: 'child1', type: 'sticky', frameId: 'frame1', x: 10, y: 10 },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleDeleteMultiple(new Set(['frame1', 'child1']));

    expect(board.batchWriteAndDelete).toHaveBeenCalledOnce();
    const [updates, deleteIds] = board.batchWriteAndDelete.mock.calls[0];
    expect(updates).toHaveLength(0);
    expect(deleteIds).toContain('frame1');
    expect(deleteIds).toContain('child1');
  });

  it('calls batchWriteAndDelete once regardless of how many objects are deleted', () => {
    const objects = {};
    for (let i = 0; i < 10; i++) {
      objects[`obj${i}`] = { id: `obj${i}`, type: 'sticky', x: i * 10, y: 0 };
    }
    const { board, handlers } = makeHandlers(objects);

    handlers.handleDeleteMultiple(new Set(Object.keys(objects)));

    expect(board.batchWriteAndDelete).toHaveBeenCalledOnce();
    expect(board.deleteObject).not.toHaveBeenCalled();
  });

  it('calls setSelectedId(null) after deletion', () => {
    const objects = {
      a: { id: 'a', type: 'sticky', x: 0, y: 0 },
    };
    const { setSelectedId, handlers } = makeHandlers(objects);

    handlers.handleDeleteMultiple(new Set(['a']));

    expect(setSelectedId).toHaveBeenCalledWith(null);
  });

  it('accepts an array as well as a Set', () => {
    const objects = {
      a: { id: 'a', type: 'sticky', x: 0, y: 0 },
      b: { id: 'b', type: 'sticky', x: 10, y: 0 },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleDeleteMultiple(['a', 'b']);

    expect(board.batchWriteAndDelete).toHaveBeenCalledOnce();
    const [, deleteIds] = board.batchWriteAndDelete.mock.calls[0];
    expect(deleteIds).toHaveLength(2);
  });

  it('skips ids not present in board.objects', () => {
    const objects = {
      a: { id: 'a', type: 'sticky', x: 0, y: 0 },
    };
    const { board, handlers } = makeHandlers(objects);

    handlers.handleDeleteMultiple(new Set(['a', 'nonexistent']));

    expect(board.batchWriteAndDelete).toHaveBeenCalledOnce();
    const [, deleteIds] = board.batchWriteAndDelete.mock.calls[0];
    expect(deleteIds).toEqual(['a']);
  });
});
