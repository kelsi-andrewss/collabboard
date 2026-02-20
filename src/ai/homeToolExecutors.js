import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export async function executeHomeToolCall(toolName, args, { createNewBoard, allBoards, setBoardId, setBoardName }) {
  if (toolName === 'createBoard') {
    const { name, group } = args;
    const ref = await createNewBoard(name, group || null);
    setBoardId(ref.id);
    setBoardName(name);
    return;
  }

  if (toolName === 'openBoard') {
    const { boardName } = args;
    const q = boardName.toLowerCase();
    const match = allBoards.find(b => b.name.toLowerCase().includes(q));
    if (match) {
      setBoardId(match.id);
      setBoardName(match.name);
    }
    return;
  }

  if (toolName === 'updateBoardGroup') {
    const { boardName, group } = args;
    const q = boardName.toLowerCase();
    const match = allBoards.find(b => b.name.toLowerCase().includes(q));
    if (match) {
      const boardRef = doc(db, 'boards', match.id);
      await updateDoc(boardRef, { group });
    }
    return;
  }
}
