import { useState, useEffect, useRef } from 'react';
import { ref, onValue, set, update, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb } from '../firebase/config';
import { getUserColor } from '../utils/colorUtils.js';

export function usePresence(boardId, currentUser) {
  const [presentUsers, setPresentUsers] = useState({});
  const typingRef = useRef(false);
  const presenceRefDb = useRef(null);
  const cursorWriteTsRef = useRef(0);
  const cursorSyncLatencyRef = useRef(null);

  useEffect(() => {
    if (!boardId || !currentUser) return;

    const presRef = ref(rtdb, `boards/${boardId}/presence/${currentUser.uid}`);
    presenceRefDb.current = presRef;
    const boardPresenceRef = ref(rtdb, `boards/${boardId}/presence`);

    set(presRef, {
      name: currentUser.displayName || 'Anonymous',
      color: getUserColor(currentUser.uid),
      photoURL: currentUser.photoURL || null,
      lastSeen: serverTimestamp(),
      x: 0,
      y: 0,
      isTyping: false,
    });

    onDisconnect(presRef).remove();

    const unsubscribe = onValue(boardPresenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (cursorWriteTsRef.current > 0 && data[currentUser.uid]) {
          cursorSyncLatencyRef.current = Date.now() - cursorWriteTsRef.current;
          cursorWriteTsRef.current = 0;
        }
        setPresentUsers(data);
      } else {
        setPresentUsers({});
      }
    });

    return () => {
      unsubscribe();
      set(presRef, null);
      presenceRefDb.current = null;
    };
  }, [boardId, currentUser]);

  const lastCursorWrite = useRef(0);
  const updateCursor = (x, y, stageX, stageY, stageScale) => {
    if (!boardId || !currentUser) return;
    const now = Date.now();
    if (now - lastCursorWrite.current < 50) return;
    lastCursorWrite.current = now;
    const presRef = ref(rtdb, `boards/${boardId}/presence/${currentUser.uid}`);
    cursorWriteTsRef.current = Date.now();
    set(presRef, {
      name: currentUser.displayName || 'Anonymous',
      color: getUserColor(currentUser.uid),
      photoURL: currentUser.photoURL || null,
      lastSeen: serverTimestamp(),
      x,
      y,
      stageX: stageX ?? 0,
      stageY: stageY ?? 0,
      stageScale: stageScale ?? 1,
      isTyping: typingRef.current,
    });
  };

  const setTyping = (typing) => {
    typingRef.current = typing;
    if (presenceRefDb.current) {
      update(presenceRefDb.current, { isTyping: typing });
    }
  };

  const lastViewportWrite = useRef(0);
  const updateViewport = (stageX, stageY, stageScale) => {
    if (!boardId || !currentUser) return;
    const now = Date.now();
    if (now - lastViewportWrite.current < 50) return;
    lastViewportWrite.current = now;
    if (presenceRefDb.current) {
      update(presenceRefDb.current, { stageX, stageY, stageScale });
    }
  };

  return { presentUsers, updateCursor, setTyping, updateViewport, cursorSyncLatencyRef };
}
