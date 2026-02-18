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
    }, () => {
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const createBoard = async (name, group = null) => {
    const boardsRef = collection(db, 'boards');
    const data = {
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (group) data.group = group;
    const ref = await addDoc(boardsRef, data);
    return ref;
  };

  return { boards, loading, createBoard };
}
