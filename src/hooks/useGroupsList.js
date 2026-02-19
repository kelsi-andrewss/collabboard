import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, deleteField, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toSlug } from '../utils/slugUtils.js';

export function useGroupsList(currentUser, isAdminView = false) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const uid = currentUser.uid;
    const ref = collection(db, 'groups');

    if (isAdminView) {
      const unsub = onSnapshot(query(ref), snap => {
        setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, () => setLoading(false));
      return unsub;
    }

    const snaps = { owned: [], public: [], member: [] };
    let resolved = 0;

    const merge = () => {
      const seen = new Set();
      return [...snaps.owned, ...snaps.public, ...snaps.member].filter(g => {
        if (seen.has(g.id)) return false;
        seen.add(g.id);
        return true;
      });
    };

    const onError = (key) => (err) => {
      console.warn(`[useGroupsList] ${key} query error:`, err.code, err.message);
      resolved++;
      if (resolved === 3) setLoading(false);
    };

    const handle = (key) => (snap) => {
      snaps[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (resolved < 3) resolved++;
      if (resolved === 3) setLoading(false);
      setGroups(merge());
    };

    const u1 = onSnapshot(query(ref, where('ownerId', '==', uid)), handle('owned'), onError('owned'));
    const u2 = onSnapshot(query(ref, where('visibility', 'in', ['public', 'open'])), handle('public'), onError('public'));
    const u3 = onSnapshot(query(ref, where(`members.${uid}`, '!=', null)), handle('member'), onError('member'));

    return () => { u1(); u2(); u3(); };
  }, [currentUser?.uid, isAdminView]);

  const createGroup = async (name, visibility = 'private') => {
    const slug = toSlug(name);
    // Check for slug uniqueness
    let finalSlug = slug;
    const existing = groups.filter(g => g.slug === slug || g.slug?.startsWith(slug + '-'));
    if (existing.length > 0) {
      finalSlug = `${slug}-${existing.length + 1}`;
    }

    const groupsRef = collection(db, 'groups');
    const ref = await addDoc(groupsRef, {
      name,
      slug: finalSlug,
      visibility,
      ownerId: currentUser?.uid || null,
      members: currentUser ? { [currentUser.uid]: 'admin' } : {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref;
  };

  const updateGroup = async (groupId, patches) => {
    await updateDoc(doc(db, 'groups', groupId), { ...patches, updatedAt: serverTimestamp() });
  };

  const deleteGroupDoc = async (groupId) => {
    await deleteDoc(doc(db, 'groups', groupId));
  };

  const inviteGroupMember = async (groupId, uid, role = 'admin') => {
    await updateDoc(doc(db, 'groups', groupId), {
      [`members.${uid}`]: role,
      updatedAt: serverTimestamp(),
    });
  };

  const removeGroupMember = async (groupId, uid) => {
    await updateDoc(doc(db, 'groups', groupId), {
      [`members.${uid}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  };

  const migrateGroupStrings = async () => {
    const boardsRef = collection(db, 'boards');
    const snap = await getDocs(boardsRef);
    const boardsWithGroup = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(b => b.group && !b.groupId);

    if (boardsWithGroup.length === 0) return;

    const uniqueNames = [...new Set(boardsWithGroup.map(b => b.group))];
    const nameToGroupId = {};

    for (const name of uniqueNames) {
      const existing = groups.find(g => g.name === name);
      if (existing) {
        nameToGroupId[name] = existing.id;
      } else {
        const ref = await createGroup(name, 'private');
        nameToGroupId[name] = ref.id;
      }
    }

    const batch = writeBatch(db);
    for (const b of boardsWithGroup) {
      const gId = nameToGroupId[b.group];
      if (gId) {
        batch.update(doc(db, 'boards', b.id), {
          groupId: gId,
          group: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  };

  return { groups, loading, createGroup, updateGroup, deleteGroup: deleteGroupDoc, inviteGroupMember, removeGroupMember, migrateGroupStrings };
}
