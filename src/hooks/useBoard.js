import { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  writeBatch,
  arrayRemove,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase/config';

export function useBoard(boardId, user) {
  const [objects, setObjects] = useState({});
  const [loading, setLoading] = useState(true);
  const hydrationRef = useRef(false);

  useEffect(() => {
    if (!boardId || !user) return;
    setLoading(true);
    hydrationRef.current = false;

    const objectsRef = collection(db, 'boards', boardId, 'objects');
    const q = query(objectsRef);

    console.log("Subscribing to board:", boardId);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newObjects = {};
      snapshot.forEach((doc) => {
        newObjects[doc.id] = { id: doc.id, ...doc.data() };
      });
      console.log("Received objects update:", Object.keys(newObjects).length);
      setObjects(newObjects);
      setLoading(false);

      // Hydrate childIds on first load
      if (!hydrationRef.current) {
        const frames = Object.values(newObjects).filter(o => o.type === 'frame');
        const needsHydration = frames.some(f => !f.childIds);
        if (needsHydration && frames.length > 0) {
          hydrationRef.current = true;
          const batch = writeBatch(db);
          for (const frame of frames) {
            const computed = Object.values(newObjects)
              .filter(o => o.frameId === frame.id)
              .map(o => o.id);
            batch.update(doc(db, 'boards', boardId, 'objects', frame.id),
              { childIds: computed, updatedAt: serverTimestamp() });
          }
          batch.commit(); // fire-and-forget; onSnapshot will re-trigger
        } else {
          hydrationRef.current = true;
        }
      }
    }, (error) => {
      console.error("Firestore Snapshot Error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [boardId, user]);

  const addObject = async (objectData) => {
    if (!boardId) return;
    const objectsRef = collection(db, 'boards', boardId, 'objects');
    const ref = await addDoc(objectsRef, {
      ...objectData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ref;
  };

  const updateObject = async (objectId, updates) => {
    if (!boardId) return;
    if ('frameId' in updates) {
      const oldObj = objects[objectId];
      const oldFrameId = oldObj?.frameId || null;
      const newFrameId = updates.frameId || null;
      if (oldFrameId !== newFrameId) {
        const batch = writeBatch(db);
        batch.update(doc(db, 'boards', boardId, 'objects', objectId),
          { ...updates, updatedAt: serverTimestamp() });
        if (oldFrameId) {
          batch.update(doc(db, 'boards', boardId, 'objects', oldFrameId),
            { childIds: arrayRemove(objectId), updatedAt: serverTimestamp() });
        }
        if (newFrameId) {
          batch.update(doc(db, 'boards', boardId, 'objects', newFrameId),
            { childIds: arrayUnion(objectId), updatedAt: serverTimestamp() });
        }
        await batch.commit();
        return;
      }
    }
    // No frameId change — single-doc write
    const objectRef = doc(db, 'boards', boardId, 'objects', objectId);
    await updateDoc(objectRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const deleteObject = async (objectId) => {
    if (!boardId) return;
    const objectRef = doc(db, 'boards', boardId, 'objects', objectId);
    await deleteDoc(objectRef);
  };

  const batchUpdateObjects = async (updates) => {
    if (!boardId || !updates.length) return;
    const batch = writeBatch(db);
    const parentAdds = {};
    const parentRemoves = {};
    updates.forEach(({ id, data }) => {
      batch.update(doc(db, 'boards', boardId, 'objects', id),
        { ...data, updatedAt: serverTimestamp() });
      if ('frameId' in data) {
        const oldObj = objects[id];
        const oldFid = oldObj?.frameId || null;
        const newFid = data.frameId || null;
        if (oldFid && oldFid !== newFid) {
          (parentRemoves[oldFid] ??= []).push(id);
        }
        if (newFid && newFid !== oldFid) {
          (parentAdds[newFid] ??= []).push(id);
        }
      }
    });
    for (const [pid, ids] of Object.entries(parentRemoves)) {
      batch.update(doc(db, 'boards', boardId, 'objects', pid),
        { childIds: arrayRemove(...ids), updatedAt: serverTimestamp() });
    }
    for (const [pid, ids] of Object.entries(parentAdds)) {
      batch.update(doc(db, 'boards', boardId, 'objects', pid),
        { childIds: arrayUnion(...ids), updatedAt: serverTimestamp() });
    }
    await batch.commit();
  };

  const batchWriteAndDelete = async (updates, deleteIds) => {
    if (!boardId) return;
    const batch = writeBatch(db);
    const parentAdds = {};
    const parentRemoves = {};
    updates.forEach(({ id, data }) => {
      batch.update(doc(db, 'boards', boardId, 'objects', id),
        { ...data, updatedAt: serverTimestamp() });
      if ('frameId' in data) {
        const oldObj = objects[id];
        const oldFid = oldObj?.frameId || null;
        const newFid = data.frameId || null;
        if (oldFid && oldFid !== newFid) {
          (parentRemoves[oldFid] ??= []).push(id);
        }
        if (newFid && newFid !== oldFid) {
          (parentAdds[newFid] ??= []).push(id);
        }
      }
    });
    for (const [pid, ids] of Object.entries(parentRemoves)) {
      batch.update(doc(db, 'boards', boardId, 'objects', pid),
        { childIds: arrayRemove(...ids), updatedAt: serverTimestamp() });
    }
    for (const [pid, ids] of Object.entries(parentAdds)) {
      batch.update(doc(db, 'boards', boardId, 'objects', pid),
        { childIds: arrayUnion(...ids), updatedAt: serverTimestamp() });
    }
    deleteIds.forEach(id => {
      batch.delete(doc(db, 'boards', boardId, 'objects', id));
    });
    await batch.commit();
  };

  return { objects, loading, addObject, updateObject, deleteObject, batchUpdateObjects, batchWriteAndDelete };
}
