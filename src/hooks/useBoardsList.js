import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch, getDocs, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useBoardsList(currentUser) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setBoards([]);
      setLoading(false);
      return;
    }

    const boardsRef = collection(db, 'boards');
    // Fetch boards where user is owner, member, or board is public
    // Firestore doesn't support OR queries across different fields cleanly without composite indexes,
    // so we fetch all boards the user has access to via multiple queries and merge client-side.
    // For simplicity (and to not break existing data), we fetch all boards and filter client-side.
    const q = query(boardsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const uid = currentUser.uid;
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(b => {
          // Legacy boards (no ownerId/visibility) are visible to all
          if (!b.ownerId && !b.visibility) return true;
          // Public boards are visible to all
          if (b.visibility === 'public') return true;
          // Owner always has access
          if (b.ownerId === uid) return true;
          // Members have access
          if (b.members && b.members[uid]) return true;
          return false;
        });
      setBoards(list);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser?.uid]);

  const createBoard = async (name, group = null, visibility = 'private') => {
    const boardsRef = collection(db, 'boards');
    const data = {
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      thumbnail: null,
      ownerId: currentUser?.uid || null,
      visibility,
      members: currentUser ? { [currentUser.uid]: 'editor' } : {},
    };
    if (group) data.group = group;
    const ref = await addDoc(boardsRef, data);
    return ref;
  };

  const saveThumbnail = async (boardId, dataUrl) => {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, { thumbnail: dataUrl, updatedAt: serverTimestamp() });
  };

  const deleteBoard = async (boardId) => {
    const objectsRef = collection(db, 'boards', boardId, 'objects');
    const snap = await getDocs(objectsRef);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'boards', boardId));
    await batch.commit();
  };

  const deleteGroup = async (groupName) => {
    const groupBoards = boards.filter(b => b.group === groupName);
    const batch = writeBatch(db);
    for (const b of groupBoards) {
      const objectsRef = collection(db, 'boards', b.id, 'objects');
      const snap = await getDocs(objectsRef);
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'boards', b.id));
    }
    await batch.commit();
  };

  const updateBoardSettings = async (boardId, patches) => {
    await updateDoc(doc(db, 'boards', boardId), { ...patches, updatedAt: serverTimestamp() });
  };

  const inviteMember = async (boardId, uid, role = 'editor') => {
    await updateDoc(doc(db, 'boards', boardId), {
      [`members.${uid}`]: role,
      updatedAt: serverTimestamp(),
    });
  };

  const removeMember = async (boardId, uid) => {
    await updateDoc(doc(db, 'boards', boardId), {
      [`members.${uid}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  };

  return { boards, loading, createBoard, saveThumbnail, deleteBoard, deleteGroup, updateBoardSettings, inviteMember, removeMember };
}
