import { useState, useEffect } from 'react';

const parseHash = () => {
  const hash = window.location.hash.slice(1);
  if (!hash) return { groupSlug: null, boardId: null };
  const parts = hash.split('/');
  if (parts.length >= 2) return { groupSlug: parts[0], boardId: parts[1] };
  const savedBoardId = localStorage.getItem('collaboard_boardId');
  if (savedBoardId === parts[0]) return { groupSlug: null, boardId: parts[0] };
  return { groupSlug: parts[0], boardId: null };
};

export function useRouting() {
  const [groupSlug, setGroupSlug] = useState(() => parseHash().groupSlug);
  const [boardId, setBoardId] = useState(() => {
    const { boardId: hashBoard } = parseHash();
    return hashBoard || localStorage.getItem('collaboard_boardId') || null;
  });
  const [boardName, setBoardName] = useState(() => localStorage.getItem('collaboard_boardName') || '');

  const navigateHome = () => { setGroupSlug(null); setBoardId(null); setBoardName(''); };
  const navigateToGroup = (slug) => { setGroupSlug(slug); setBoardId(null); };
  const navigateToBoard = (slug, id, name) => { setGroupSlug(slug); setBoardId(id); setBoardName(name || id); };

  useEffect(() => {
    if (boardId && groupSlug) {
      window.location.hash = `${groupSlug}/${boardId}`;
      localStorage.setItem('collaboard_boardId', boardId);
      localStorage.setItem('collaboard_boardName', boardName);
    } else if (groupSlug) {
      window.location.hash = groupSlug;
      localStorage.removeItem('collaboard_boardId');
      localStorage.removeItem('collaboard_boardName');
    } else if (boardId) {
      window.location.hash = boardId;
      localStorage.setItem('collaboard_boardId', boardId);
      localStorage.setItem('collaboard_boardName', boardName);
    } else {
      history.pushState('', document.title, window.location.pathname);
      localStorage.removeItem('collaboard_boardId');
      localStorage.removeItem('collaboard_boardName');
    }
  }, [boardId, boardName, groupSlug]);

  return { groupSlug, setGroupSlug, boardId, setBoardId, boardName, setBoardName,
           navigateHome, navigateToGroup, navigateToBoard };
}
