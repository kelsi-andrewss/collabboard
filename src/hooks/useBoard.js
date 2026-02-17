import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';

export function useBoard(boardId) {
  const [objects, setObjects] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) return;
    setLoading(true);

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
    }, (error) => {
      console.error("Firestore Snapshot Error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [boardId]);

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
    const objectRef = doc(db, 'boards', boardId, 'objects', objectId);
    await updateDoc(objectRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  };

  const deleteObject = async (objectId) => {
    if (!boardId) return;
    const objectRef = doc(db, 'boards', boardId, 'objects', objectId);
    await deleteDoc(objectRef);
  };

  const batchUpdateObjects = async (updates) => {
    if (!boardId || !updates.length) return;
    const batch = writeBatch(db);
    updates.forEach(({ id, data }) => {
      const ref = doc(db, 'boards', boardId, 'objects', id);
      batch.update(ref, { ...data, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  };

  return { objects, loading, addObject, updateObject, deleteObject, batchUpdateObjects };
}
