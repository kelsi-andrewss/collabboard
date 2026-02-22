import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, writeBatch, getDocs, deleteField } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useBoardsList(currentUser, { isAdminView = false } = {}) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setBoards([]);
      setLoading(false);
      return;
    }

    const uid = currentUser.uid;
    const ref = collection(db, 'boards');

    if (isAdminView) {
      const unsub = onSnapshot(query(ref), snap => {
        setBoards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, () => setLoading(false));
      return unsub;
    }

    const snaps = { owned: [], public: [], member: [], groupMember: [], templates: [] };
    let resolved = 0;

    const merge = () => {
      const seen = new Set();
      return [...snaps.owned, ...snaps.public, ...snaps.member, ...snaps.groupMember, ...snaps.templates].filter(b => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });
    };

    const onError = () => {
      resolved++;
      if (resolved === 5) setLoading(false);
    };

    const handle = (key) => (snap) => {
      snaps[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (resolved < 5) resolved++;
      if (resolved === 5) setLoading(false);
      setBoards(merge());
    };

    const u1 = onSnapshot(query(ref, where('ownerId', '==', uid)), handle('owned'), onError);
    const u2 = onSnapshot(query(ref, where('visibility', 'in', ['public', 'open'])), handle('public'), onError);
    const u3 = onSnapshot(query(ref, where(`members.${uid}`, '!=', null)), handle('member'), onError);
    const u4 = onSnapshot(
      query(ref, where(`groupMembers.${uid}`, '!=', null)),
      handle('groupMember'),
      onError
    );
    const u5 = onSnapshot(query(ref, where('template', '==', true)), handle('templates'), onError);

    return () => { u1(); u2(); u3(); u4(); u5(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, isAdminView]);

  const createBoard = async (name, groupId = null, visibility = 'private') => {
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
    if (groupId) data.groupId = groupId;
    const ref = await addDoc(boardsRef, data);
    return ref;
  };

  const saveThumbnail = async (boardId, lightUrl, darkUrl) => {
    const boardRef = doc(db, 'boards', boardId);
    await updateDoc(boardRef, {
      thumbnailLight: lightUrl,
      thumbnailDark: darkUrl,
      thumbnail: lightUrl,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteBoard = async (boardId) => {
    const objectsRef = collection(db, 'boards', boardId, 'objects');
    const snap = await getDocs(objectsRef);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'boards', boardId));
    await batch.commit();
  };

  const deleteGroup = async (groupId) => {
    const groupBoards = boards.filter(b => b.groupId === groupId);
    const batch = writeBatch(db);
    for (const b of groupBoards) {
      const objectsRef = collection(db, 'boards', b.id, 'objects');
      const snap = await getDocs(objectsRef);
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'boards', b.id));
    }
    // Delete the group doc itself
    batch.delete(doc(db, 'groups', groupId));
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

  const moveBoard = async (boardId, newGroupId) => {
    const boardRef = doc(db, 'boards', boardId);
    if (newGroupId) {
      await updateDoc(boardRef, { groupId: newGroupId });
    } else {
      await updateDoc(boardRef, { groupId: deleteField() });
    }
  };

  const setBoardProtected = async (boardId, bool) => {
    await updateDoc(doc(db, 'boards', boardId), { protected: bool, updatedAt: serverTimestamp() });
  };

  const publishTemplate = async (boardId) => {
    const objectsSnap = await getDocs(collection(db, 'boards', boardId, 'objects'));
    const snapshotSnap = await getDocs(collection(db, 'boards', boardId, 'templateSnapshot'));

    const deleteDocs = snapshotSnap.docs;
    for (let i = 0; i < deleteDocs.length; i += 500) {
      const batch = writeBatch(db);
      deleteDocs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    const newDocs = objectsSnap.docs;
    for (let i = 0; i < newDocs.length; i += 500) {
      const batch = writeBatch(db);
      newDocs.slice(i, i + 500).forEach(d => {
        const ref = doc(db, 'boards', boardId, 'templateSnapshot', d.id);
        batch.set(ref, d.data());
      });
      await batch.commit();
    }

    await updateDoc(doc(db, 'boards', boardId), {
      template: true,
      templateSnapshotAt: serverTimestamp(),
    });
  };

  const updateTemplate = async (boardId) => {
    const objectsSnap = await getDocs(collection(db, 'boards', boardId, 'objects'));
    const snapshotSnap = await getDocs(collection(db, 'boards', boardId, 'templateSnapshot'));

    const deleteDocs = snapshotSnap.docs;
    for (let i = 0; i < deleteDocs.length; i += 500) {
      const batch = writeBatch(db);
      deleteDocs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    const newDocs = objectsSnap.docs;
    for (let i = 0; i < newDocs.length; i += 500) {
      const batch = writeBatch(db);
      newDocs.slice(i, i + 500).forEach(d => {
        const ref = doc(db, 'boards', boardId, 'templateSnapshot', d.id);
        batch.set(ref, d.data());
      });
      await batch.commit();
    }

    await updateDoc(doc(db, 'boards', boardId), {
      template: true,
      templateSnapshotAt: serverTimestamp(),
    });
  };

  const unpublishTemplate = async (boardId) => {
    await updateDoc(doc(db, 'boards', boardId), {
      template: false,
      templateSnapshotAt: deleteField(),
    });
  };

  const createBoardFromTemplate = async (templateBoardId, name, groupId, visibility) => {
    const ref = await createBoard(name, groupId, visibility);
    const newBoardId = ref.id;
    const snapshotSnap = await getDocs(collection(db, 'boards', templateBoardId, 'templateSnapshot'));
    const snapDocs = snapshotSnap.docs;
    for (let i = 0; i < snapDocs.length; i += 500) {
      const batch = writeBatch(db);
      snapDocs.slice(i, i + 500).forEach(d => {
        const objRef = doc(db, 'boards', newBoardId, 'objects', d.id);
        batch.set(objRef, {
          ...d.data(),
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
    return newBoardId;
  };

  return { boards, loading, createBoard, saveThumbnail, deleteBoard, deleteGroup, updateBoardSettings, inviteMember, removeMember, moveBoard, setBoardProtected, publishTemplate, updateTemplate, unpublishTemplate, createBoardFromTemplate };
}
