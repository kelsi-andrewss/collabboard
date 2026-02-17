import { useState, useEffect } from 'react';
import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';

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
      lastSeen: serverTimestamp(),
      x: 0,
      y: 0
    });

    // Remove presence on disconnect
    onDisconnect(presenceRef).remove();

    // Listen for other users
    const unsubscribe = onValue(boardPresenceRef, (snapshot) => {
      console.log("Internal Board Presence Data:", snapshot.val());
      if (snapshot.exists()) {
        const val = snapshot.val();
        setPresentUsers(val);
      } else {
        setPresentUsers({});
      }
    }, (error) => {
      console.error("RTDB Presence Error:", error);
    });

    return () => {
      unsubscribe();
      // Remove presence from the current board when leaving or changing boards
      set(presenceRef, null);
    };
  }, [boardId, currentUser]);

  const updateCursor = (x, y) => {
    if (!boardId || !currentUser) return;
    const presenceRef = ref(rtdb, `boards/${boardId}/presence/${currentUser.uid}`);
    set(presenceRef, {
      name: currentUser.displayName || 'Anonymous',
      color: getUserColor(currentUser.uid),
      lastSeen: serverTimestamp(),
      x,
      y
    });
  };

  return { presentUsers, updateCursor };
}

function getUserColor(uid) {
  const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
  const index = Math.abs(hashCode(uid)) % colors.length;
  return colors[index];
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}
