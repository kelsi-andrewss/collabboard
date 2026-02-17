import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

export function useGlobalPresence() {
  const [globalPresence, setGlobalPresence] = useState({});

  useEffect(() => {
    const presenceRef = ref(rtdb, 'boards');

    console.log("Initializing Global Presence Listener...");
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const boardsData = snapshot.val();
        const boardViewers = {};
        
        Object.entries(boardsData).forEach(([boardId, boardData]) => {
          if (boardData.presence) {
            // Include all users including current one for the dashboard preview
            boardViewers[boardId] = Object.values(boardData.presence);
          } else {
            boardViewers[boardId] = [];
          }
        });
        
        setGlobalPresence(boardViewers);
      } else {
        setGlobalPresence({});
      }
    }, (error) => {
      console.error("Global Presence Error:", error);
    });

    return () => unsubscribe();
  }, []);

  return globalPresence;
}
