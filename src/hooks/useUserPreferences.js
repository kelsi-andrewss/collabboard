import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const DEFAULT_PREFERENCES = {
  darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
  themeColor: 'indigo',
  highContrast: false,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  largeText: false,
};

const LS_KEY = 'collabboard-preferences';

export function useUserPreferences(user) {
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('data-theme', preferences.darkMode ? 'dark' : 'light');
    html.setAttribute('data-theme-color', preferences.themeColor);

    if (preferences.highContrast) {
      html.setAttribute('data-high-contrast', '');
    } else {
      html.removeAttribute('data-high-contrast');
    }

    if (preferences.reducedMotion) {
      html.setAttribute('data-reduced-motion', '');
    } else {
      html.removeAttribute('data-reduced-motion');
    }

    if (preferences.largeText) {
      html.setAttribute('data-large-text', '');
    } else {
      html.removeAttribute('data-large-text');
    }

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(preferences));
    } catch { /* quota exceeded — ignore */ }
  }, [preferences]);

  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);

    getDoc(userDocRef).then(snap => {
      if (snap.exists() && snap.data().preferences) {
        const firestorePrefs = { ...DEFAULT_PREFERENCES, ...snap.data().preferences };
        setPreferences(firestorePrefs);
      }
      initialLoadDone.current = true;
      setIsLoading(false);
    }).catch(() => {
      initialLoadDone.current = true;
      setIsLoading(false);
    });
  }, [user?.uid]);

  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => {
      const next = { ...prev, [key]: value };

      if (user?.uid && initialLoadDone.current) {
        const userDocRef = doc(db, 'users', user.uid);
        setDoc(userDocRef, { preferences: next }, { merge: true }).catch(() => {});
      }

      return next;
    });
  }, [user?.uid]);

  return { preferences, updatePreference, isLoading };
}
