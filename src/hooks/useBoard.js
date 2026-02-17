import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export function useBoard(boardId) {
  const [objects, setObjects] = useState({});

  useEffect(() => {
    if (!boardId) return;

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
    }, (error) => {
      console.error("Firestore Snapshot Error:", error);
    });

    return unsubscribe;
  }, [boardId]);

  const addObject = async (objectData) => {
    if (!boardId) return;
    const objectsRef = collection(db, 'boards', boardId, 'objects');
    await addDoc(objectsRef, {
      ...objectData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
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

  return { objects, addObject, updateObject, deleteObject };
}
