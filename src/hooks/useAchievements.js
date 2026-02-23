import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, setDoc, doc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useAchievements(user) {
  const [achievements, setAchievements] = useState([]);
  const unlockAchievementRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const ref = collection(db, 'users', user.uid, 'achievements');
    const unsub = onSnapshot(ref, snap => {
      setAchievements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user?.uid]);

  const unlockAchievement = async (id, meta) => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid, 'achievements', id);
    await setDoc(ref, {
      ...meta,
      count: increment(1),
      unlockedAt: serverTimestamp(),
    }, { merge: true });
  };

  unlockAchievementRef.current = unlockAchievement;

  return { achievements, unlockAchievement, unlockAchievementRef };
}
