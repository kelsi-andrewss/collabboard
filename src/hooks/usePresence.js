import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { getUserColor } from '../utils/colorUtils.js';

export function usePresence(boardId, currentUser) {
  const [presentUsers, setPresentUsers] = useState({});

  useEffect(() => {
    if (!boardId || !currentUser) return;

    const presenceRef = ref(rtdb, `boards/${boardId}/presence/${currentUser.uid}`);
    const boardPresenceRef = ref(rtdb, `boards/${boardId}/presence`);

    // Set presence on connect
    set(presenceRef, {
      name: currentUser.displayName || 'Anonymous',
      color: getUserColor(currentUser.uid),
      photoURL: currentUser.photoURL || null,
      lastSeen: serverTimestamp(),
      x: 0,
      y: 0
    });

    // Remove presence on disconnect
    onDisconnect(presenceRef).remove();

    // Listen for other users
    const unsubscribe = onValue(boardPresenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        setPresentUsers(val);
      } else {
        setPresentUsers({});
      }
    });

    return () => {
      unsubscribe();
      // Remove presence from the current board when leaving or changing boards
      set(presenceRef, null);
    };
  }, [boardId, currentUser]);

  const lastCursorWrite = useRef(0);
  const updateCursor = (x, y) => {
    if (!boardId || !currentUser) return;
    const now = Date.now();
    if (now - lastCursorWrite.current < 50) return;
    lastCursorWrite.current = now;
    const presenceRef = ref(rtdb, `boards/${boardId}/presence/${currentUser.uid}`);
    set(presenceRef, {
      name: currentUser.displayName || 'Anonymous',
      color: getUserColor(currentUser.uid),
      photoURL: currentUser.photoURL || null,
      lastSeen: serverTimestamp(),
      x,
      y
    });
  };

  return { presentUsers, updateCursor };
}
