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

  const [redoStack, setRedoStack] = useState([]);
  const redoStackRef = useRef([]);
  redoStackRef.current = redoStack;

  const push = useCallback((entry) => {
    setStack(prev => [...prev.slice(-(MAX_STACK - 1)), entry]);
    setRedoStack([]);
    redoStackRef.current = [];
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

    let redoEntry = null;

    switch (entry.type) {
      case 'add': {
        const obj = board.objects[entry.objectId];
        if (obj) {
          const { id, ...rawSnapshot } = obj;
          redoEntry = { type: 'delete', objectId: entry.objectId, snapshot: cloneWithTimestamps(rawSnapshot) };
        }
        await board.deleteObject(entry.objectId);
        break;
      }
      case 'update': {
        const obj = board.objects[entry.objectId];
        if (obj) {
          const forwardPatch = {};
          for (const key of Object.keys(entry.rollback)) {
            forwardPatch[key] = obj[key] !== undefined ? cloneWithTimestamps(obj[key]) : null;
          }
          redoEntry = { type: 'update', objectId: entry.objectId, rollback: forwardPatch };
        }
        await board.updateObject(entry.objectId, entry.rollback);
        break;
      }
      case 'delete': {
        redoEntry = { type: 'add', objectId: entry.objectId };
        await board.addObject(entry.snapshot);
        break;
      }
      case 'batch': {
        const forwardRollbacks = entry.rollbacks.map(({ id, rollback }) => {
          const obj = board.objects[id];
          if (!obj) return null;
          const forwardPatch = {};
          for (const key of Object.keys(rollback)) {
            forwardPatch[key] = obj[key] !== undefined ? cloneWithTimestamps(obj[key]) : null;
          }
          return { id, rollback: forwardPatch };
        }).filter(Boolean);
        if (forwardRollbacks.length > 0) {
          redoEntry = { type: 'batch', rollbacks: forwardRollbacks };
        }
        if (entry.rollbacks.length > 0) {
          await board.batchUpdateObjects(
            entry.rollbacks.map(({ id, rollback }) => ({ id, data: rollback }))
          );
        }
        break;
      }
      case 'batchWriteAndDelete': {
        const forwardRollbacks = entry.rollbacks.map(({ id, rollback }) => {
          const obj = board.objects[id];
          if (!obj) return null;
          const forwardPatch = {};
          for (const key of Object.keys(rollback)) {
            forwardPatch[key] = obj[key] !== undefined ? cloneWithTimestamps(obj[key]) : null;
          }
          return { id, rollback: forwardPatch };
        }).filter(Boolean);
        const forwardDeletedSnapshots = (entry.deletedSnapshots || []).map(({ id, snapshot }) => ({ id, snapshot }));
        redoEntry = { type: 'batchWriteAndDelete', rollbacks: forwardRollbacks, deletedSnapshots: forwardDeletedSnapshots };

        for (const { snapshot } of (entry.deletedSnapshots || [])) {
          await board.addObject(snapshot);
        }
        if (entry.rollbacks.length > 0) {
          await board.batchUpdateObjects(
            entry.rollbacks.map(({ id, rollback }) => ({ id, data: rollback }))
          );
        }
        break;
      }
      case 'compound': {
        const { created = [], updated = [], deleted = [] } = entry.mutations;
        const forwardUpdated = updated.map(({ id, rollback }) => {
          const obj = board.objects[id];
          if (!obj) return null;
          const forwardPatch = {};
          for (const key of Object.keys(rollback)) {
            forwardPatch[key] = obj[key] !== undefined ? cloneWithTimestamps(obj[key]) : null;
          }
          return { id, rollback: forwardPatch };
        }).filter(Boolean);
        const forwardCreated = created.map(({ id }) => {
          const obj = board.objects[id];
          if (!obj) return null;
          const { id: _id, ...rawSnapshot } = obj;
          return { id, snapshot: cloneWithTimestamps(rawSnapshot) };
        }).filter(Boolean);
        redoEntry = { type: 'compound', mutations: { created: deleted, updated: forwardUpdated, deleted: forwardCreated } };

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

    if (redoEntry) {
      setRedoStack(prev => [...prev.slice(-(MAX_STACK - 1)), redoEntry]);
      redoStackRef.current = [...redoStackRef.current.slice(-(MAX_STACK - 1)), redoEntry];
    }
  }, [board.deleteObject, board.updateObject, board.addObject, board.batchUpdateObjects, board.objects]);

  const redo = useCallback(async () => {
    const current = redoStackRef.current;
    if (current.length === 0) return;
    const entry = current[current.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    redoStackRef.current = redoStackRef.current.slice(0, -1);

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
        for (const { id } of (entry.deletedSnapshots || [])) {
          await board.deleteObject(id);
        }
        if (entry.rollbacks.length > 0) {
          await board.batchUpdateObjects(
            entry.rollbacks.map(({ id, rollback }) => ({ id, data: rollback }))
          );
        }
        break;
      case 'compound': {
        const { created = [], updated = [], deleted = [] } = entry.mutations;
        for (const { snapshot } of created) {
          await board.addObject(snapshot);
        }
        if (updated.length > 0) {
          await board.batchUpdateObjects(
            updated.map(({ id, rollback }) => ({ id, data: rollback }))
          );
        }
        for (const { id } of deleted) {
          await board.deleteObject(id);
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
    redo,
    canRedo: redoStack.length > 0,
  };
}
