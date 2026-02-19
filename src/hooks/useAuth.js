import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../firebase/config';

async function writeUserProfile(user) {
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || 'Anonymous',
    displayNameLower: (user.displayName || 'Anonymous').toLowerCase(),
    photoURL: user.photoURL || null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) writeUserProfile(u).catch(() => {});
    });

    getRedirectResult(auth).catch((error) => {
      alert("Redirect login failed: " + error.message);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) { setUserRole(null); return; }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setUserRole(snap.data()?.role || null);
    });
    return unsub;
  }, [user?.uid]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code === 'auth/popup-blocked') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          alert("Redirect failed: " + redirectError.message);
        }
      } else if (error.code === 'auth/operation-not-allowed') {
        alert("Google Sign-In is not enabled in the Firebase Console. Go to Authentication -> Sign-in method.");
      } else {
        alert("Login failed: " + error.message);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {}

  };

  const isAdmin = userRole === 'admin';

  return { user, loading, login, logout, isAdmin };
}
