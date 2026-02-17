import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useBoardsList() {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const boardsRef = collection(db, 'boards');
    const q = query(boardsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBoards(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching boards:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const createBoard = async (name, group = 'General') => {
    const boardsRef = collection(db, 'boards');
    await addDoc(boardsRef, {
      name,
      group,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };

  return { boards, loading, createBoard };
}
