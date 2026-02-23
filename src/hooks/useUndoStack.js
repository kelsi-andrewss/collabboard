import { useState, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';

const MAX_STACK = 50;

function cloneWithTimestamps(obj) {
  if (obj instanceof Timestamp) return new Timestamp(obj.seconds, obj.nanoseconds);
  if (Array.isArray(obj)) return obj.map(cloneWithTimestamps);
  if (obj && typeof obj === 'object') return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, cloneWithTimestamps(v)])
  );
  return obj;
}

export function useUndoStack(board) {
  const [stack, setStack] = useState([]);
  const stackRef = useRef([]);
  stackRef.current = stack;

  const push = useCallback((entry) => {
    setStack(prev => [...prev.slice(-(MAX_STACK - 1)), entry]);
  }, []);

  const addObject = useCallback(async (data) => {
    const ref = await board.addObject(data);
    if (ref) {
      push({ type: 'add', objectId: ref.id });
    }
    return ref;
  }, [board.addObject, push]);

  const updateObject = useCallback(async (objectId, updates) => {
    // Snapshot the keys being changed for rollback
    const current = board.objects[objectId];
    if (current) {
      const rollback = {};
      for (const key of Object.keys(updates)) {
        rollback[key] = current[key] !== undefined ? cloneWithTimestamps(current[key]) : null;
      }
      push({ type: 'update', objectId, rollback });
    }
    return board.updateObject(objectId, updates);
  }, [board.updateObject, board.objects, push]);

  const deleteObject = useCallback(async (objectId) => {
    const current = board.objects[objectId];
    if (current) {
      const { id, ...rawSnapshot } = current;
      const snapshot = cloneWithTimestamps(rawSnapshot);
      push({ type: 'delete', objectId, snapshot });
    }
    return board.deleteObject(objectId);
  }, [board.deleteObject, board.objects, push]);

  const batchUpdateObjects = useCallback(async (updates) => {
    // Snapshot all changed keys for each object
    const rollbacks = updates.map(({ id, data }) => {
      const current = board.objects[id];
      if (!current) return null;
      const rollback = {};
      for (const key of Object.keys(data)) {
        rollback[key] = current[key] !== undefined ? cloneWithTimestamps(current[key]) : null;
      }
      return { id, rollback };
    }).filter(Boolean);
    if (rollbacks.length > 0) {
      push({ type: 'batch', rollbacks });
    }
    return board.batchUpdateObjects(updates);
  }, [board.batchUpdateObjects, board.objects, push]);

  const batchWriteAndDelete = useCallback(async (updates, deleteIds) => {
    // Snapshot deleted objects for rollback
    const deletedSnapshots = deleteIds.map(id => {
      const current = board.objects[id];
      if (!current) return null;
      const { id: _id, ...rawSnapshot } = current;
      return { id, snapshot: cloneWithTimestamps(rawSnapshot) };
    }).filter(Boolean);

    // Snapshot updated objects for rollback
    const rollbacks = updates.map(({ id, data }) => {
      const current = board.objects[id];
      if (!current) return null;
      const rollback = {};
      for (const key of Object.keys(data)) {
        rollback[key] = current[key] !== undefined ? cloneWithTimestamps(current[key]) : null;
      }
      return { id, rollback };
    }).filter(Boolean);

    if (rollbacks.length > 0 || deletedSnapshots.length > 0) {
      push({ type: 'batchWriteAndDelete', rollbacks, deletedSnapshots });
    }
    return board.batchWriteAndDelete(updates, deleteIds);
  }, [board.batchWriteAndDelete, board.objects, push]);

  const pushCompoundEntry = useCallback((mutations) => {
    push({ type: 'compound', mutations });
  }, [push]);

  const undo = useCallback(async () => {
    const current = stackRef.current;
    if (current.length === 0) return;
    const entry = current[current.length - 1];
    setStack(prev => prev.slice(0, -1));

    switch (entry.type) {
      case 'add':
        await board.deleteObject(entry.objectId);
        break;
      case 'update':
        await board.updateObject(entry.objectId, entry.rollback);
        break;
      case 'delete':
        await board.addObject(entry.snapshot);
        break;
      case 'batch':
        if (entry.rollbacks.length > 0) {
          await board.batchUpdateObjects(
            entry.rollbacks.map(({ id, rollback }) => ({ id, data: rollback }))
          );
        }
        break;
      case 'batchWriteAndDelete':
        // Re-create deleted objects
        for (const { snapshot } of (entry.deletedSnapshots || [])) {
          await board.addObject(snapshot);
        }
        // Rollback updated objects
        if (entry.rollbacks.length > 0) {
          await board.batchUpdateObjects(
            entry.rollbacks.map(({ id, rollback }) => ({ id, data: rollback }))
          );
        }
        break;
      case 'compound': {
        const { created = [], updated = [], deleted = [] } = entry.mutations;
        for (let i = created.length - 1; i >= 0; i--) {
          await board.deleteObject(created[i].id);
        }
        if (updated.length > 0) {
          await board.batchUpdateObjects(
            updated.map(({ id, rollback }) => ({ id, data: rollback }))
          );
        }
        for (const { snapshot } of deleted) {
          await board.addObject(snapshot);
        }
        break;
      }
    }
  }, [board.deleteObject, board.updateObject, board.addObject, board.batchUpdateObjects]);

  return {
    objects: board.objects,
    loading: board.loading,
    addObject,
    updateObject,
    deleteObject,
    batchUpdateObjects,
    batchWriteAndDelete,
    pushCompoundEntry,
    undo,
    canUndo: stack.length > 0,
  };
}
