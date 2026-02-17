import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Check for redirect result
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect login failed", error);
      alert("Redirect login failed: " + error.message);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      console.log("Attempting login with popup...");
      await signInWithPopup(auth, googleProvider);
      console.log("Login popup completed");
    } catch (error) {
      console.error("Login popup failed", error);
      
      if (error.code === 'auth/popup-blocked') {
        console.log("Popup blocked, trying redirect...");
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError) {
          console.error("Redirect failed", redirectError);
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
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return { user, loading, login, logout };
}
