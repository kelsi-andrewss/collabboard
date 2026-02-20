import { useState, useEffect, useRef } from 'react';

function parseHash() {
  const hash = window.location.hash.slice(1);
  if (!hash) return { groupSlugs: [], boardId: null };

  const tokens = hash.split('/');
  const groupSlugs = [];
  let boardId = null;
  let i = 0;

  if (tokens[0] === 'group' && tokens.length > 1) {
    groupSlugs.push(tokens[1]);
    i = 2;
    while (i < tokens.length - 1 && tokens[i] === 'subgroup') {
      groupSlugs.push(tokens[i + 1]);
      i += 2;
    }
    if (i < tokens.length - 1 && tokens[i] === 'board') {
      boardId = tokens[i + 1];
    }
    return { groupSlugs, boardId };
  }

  if (tokens[0] === 'board' && tokens.length > 1) {
    return { groupSlugs: [], boardId: tokens[1] };
  }

  return parseLegacyHash(hash);
}

function parseLegacyHash(hash) {
  const parts = hash.split('/');
  if (parts.length >= 2) {
    const slug = parts[0] === '__ungrouped__' ? null : parts[0];
    return { groupSlugs: slug ? [slug] : [], boardId: parts[1] };
  }
  if (parts[0] === '__ungrouped__') {
    return { groupSlugs: [], boardId: null };
  }
  const savedBoardId = localStorage.getItem('collaboard_boardId');
  if (savedBoardId === parts[0]) {
    return { groupSlugs: [], boardId: parts[0] };
  }
  return { groupSlugs: [parts[0]], boardId: null };
}

function buildHash(groupSlugs, boardId) {
  const parts = [];
  if (groupSlugs.length > 0) {
    parts.push('group', groupSlugs[0]);
    for (let i = 1; i < groupSlugs.length; i++) {
      parts.push('subgroup', groupSlugs[i]);
    }
  }
  if (boardId) {
    parts.push('board', boardId);
  }
  return parts.length > 0 ? parts.join('/') : '';
}

export function useRouting() {
  const [groupPath, setGroupPath] = useState(() => {
    const { groupSlugs } = parseHash();
    return groupSlugs.join('/');
  });
  const [boardId, setBoardId] = useState(() => {
    const { boardId: hashBoard, groupSlugs } = parseHash();
    return hashBoard || (groupSlugs.length === 0 ? localStorage.getItem('collaboard_boardId') : null) || null;
  });
  const [boardName, setBoardName] = useState(() => localStorage.getItem('collaboard_boardName') || '');

  const groupSlugs = groupPath ? groupPath.split('/') : [];

  const setGroupSlugs = (slugs) => {
    setGroupPath(slugs.join('/'));
  };

  const navigateHome = () => { setGroupPath(''); setBoardId(null); setBoardName(''); };
  const navigateToGroup = (slugChain) => { setGroupPath(slugChain.join('/')); setBoardId(null); };
  const navigateToBoard = (slugChain, id, name) => { setGroupPath(slugChain.join('/')); setBoardId(id); setBoardName(name || id); };

  const legacyRedirected = useRef(false);
  useEffect(() => {
    if (legacyRedirected.current) return;
    legacyRedirected.current = true;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const tokens = hash.split('/');
    if (tokens[0] === 'group' || tokens[0] === 'board') return;
    const parsed = parseLegacyHash(hash);
    const newHash = buildHash(parsed.groupSlugs, parsed.boardId);
    if (newHash) {
      window.location.hash = newHash;
    } else {
      history.replaceState('', document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const parsed = parseHash();
      setGroupPath(parsed.groupSlugs.join('/'));
      setBoardId(parsed.boardId || null);
      if (!parsed.boardId) setBoardName('');
    };
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  useEffect(() => {
    const hash = buildHash(groupSlugs, boardId);
    if (hash) {
      window.location.hash = hash;
    } else {
      history.pushState('', document.title, window.location.pathname);
    }

    if (boardId) {
      localStorage.setItem('collaboard_boardId', boardId);
      localStorage.setItem('collaboard_boardName', boardName);
    } else {
      localStorage.removeItem('collaboard_boardId');
      localStorage.removeItem('collaboard_boardName');
    }
  }, [boardId, boardName, groupPath]);

  return { groupSlugs, setGroupSlugs, boardId, setBoardId, boardName, setBoardName,
           navigateHome, navigateToGroup, navigateToBoard };
}
