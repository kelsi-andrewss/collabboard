import { useState, useEffect, useRef } from 'react';
import { ref, onValue, push, remove, onDisconnect } from 'firebase/database';
import { rtdb } from '../firebase/config';

export function useReactions(boardId, currentUser) {
  const [reactions, setReactions] = useState([]);
  const ownReactionRefsRef = useRef([]);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (!boardId || !currentUser) return;

    const reactionsPath = ref(rtdb, `boards/${boardId}/reactions`);

    const unsubscribe = onValue(reactionsPath, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setReactions(list);
      } else {
        setReactions([]);
      }
    });

    unsubscribeRef.current = unsubscribe;

    const handleBeforeUnload = () => {
      for (const reactionRef of ownReactionRefsRef.current) {
        remove(reactionRef);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [boardId, currentUser]);

  const sendReaction = (emoji, x, y) => {
    if (!boardId || !currentUser) return;

    const reactionsPath = ref(rtdb, `boards/${boardId}/reactions`);
    const newReactionRef = push(reactionsPath, {
      emoji,
      x,
      y,
      userId: currentUser.uid,
      timestamp: Date.now(),
    });

    onDisconnect(newReactionRef).remove();
    ownReactionRefsRef.current.push(newReactionRef);

    setTimeout(() => {
      remove(newReactionRef);
      ownReactionRefsRef.current = ownReactionRefsRef.current.filter(
        (r) => r.key !== newReactionRef.key
      );
    }, 2000);
  };

  return { reactions, sendReaction };
}
