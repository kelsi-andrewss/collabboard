import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Text, Line } from 'react-konva';
import { useAuth } from './hooks/useAuth';
import { usePresence } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { useUndoStack } from './hooks/useUndoStack';
import { useBoardsList } from './hooks/useBoardsList';
import { useGlobalPresence } from './hooks/useGlobalPresence';
import { useAI } from './hooks/useAI';
import { Cursors } from './components/Cursors';
import { StickyNote } from './components/StickyNote';
import { Shape } from './components/Shape';
import { LineShape } from './components/LineShape';
import { Frame } from './components/Frame';
import { Tutorial } from './components/Tutorial';
import { Square, Circle, Plus, MessageSquare, Send, Layout, Folder, Sun, Moon, Maximize, ChevronDown, Triangle, Trash2, Minus, AppWindow, LogOut, Grid3x3, Search, ArrowUpToLine, ArrowDownToLine, Palette, Undo2, HelpCircle } from 'lucide-react';
import './App.css';

function isInsideFrame(obj, frame) {
  const cx = obj.x + (obj.width || 0) / 2;
  const cy = obj.y + (obj.height || 0) / 2;
  return cx >= frame.x && cx <= frame.x + frame.width &&
         cy >= frame.y && cy <= frame.y + frame.height;
}

function findOverlappingFrame(obj, allObjects) {
  const frames = Object.values(allObjects).filter(o => o.type === 'frame' && o.id !== obj.id);
  let best = null;
  let bestArea = Infinity;
  for (const frame of frames) {
    if (isInsideFrame(obj, frame)) {
      const area = frame.width * frame.height;
      if (area < bestArea) {
        best = frame;
        bestArea = area;
      }
    }
  }
  return best;
}

function computeAncestorExpansions(childX, childY, childW, childH, parentFrameId, allObjects, margin) {
  const expansions = [];
  const working = { ...allObjects };
  let cx = childX, cy = childY, cw = childW, ch = childH;
  let currentParent = working[parentFrameId];
  while (currentParent) {
    const neededW = cx + cw + margin - currentParent.x;
    const neededH = cy + ch + margin - currentParent.y;
    const newW = Math.max(currentParent.width, neededW);
    const newH = Math.max(currentParent.height, neededH);
    if (newW > currentParent.width || newH > currentParent.height) {
      expansions.push({ id: currentParent.id, data: { width: newW, height: newH } });
      working[currentParent.id] = { ...currentParent, width: newW, height: newH };
    }
    cx = currentParent.x; cy = currentParent.y;
    cw = newW; ch = newH;
    currentParent = currentParent.frameId ? working[currentParent.frameId] : null;
  }
  return expansions;
}

function rectsOverlap(a, b) {
  return a.x < b.x + (b.width || 0) && a.x + a.width > b.x &&
         a.y < b.y + (b.height || 0) && a.y + a.height > b.y;
}

function darkenHex(hex, amount = 0.3) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseColorForInput(colorStr) {
  if (!colorStr) return '#000000';
  if (colorStr.startsWith('#')) return colorStr.slice(0, 7);
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const toHex = (n) => parseInt(n).toString(16).padStart(2, '0');
    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
  }
  return '#000000';
}

function parseOpacity(colorStr) {
  if (!colorStr) return 1;
  const match = colorStr.match(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

const SUGGESTED_COLORS = [
  // Warm pastels
  '#fef08a', '#fde68a', '#fed7aa', '#fecaca', '#fbcfe8',
  // Cool pastels
  '#bfdbfe', '#c7d2fe', '#e9d5ff', '#a7f3d0', '#d9f99d',
  // Vivid accents
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  // Deep tones
  '#7c3aed', '#db2777', '#0d9488', '#1d4ed8', '#374151',
];

function ColorPickerMenu({ type, data, onSelect }) {
  const [opacity, setOpacity] = useState(() => parseOpacity(data.active));
  const hexValue = parseColorForInput(data.active);

  const handleColorChange = (e) => {
    const hex = e.target.value;
    const color = opacity < 1 ? hexToRgba(hex, opacity) : hex;
    onSelect(type, color);
  };

  const handleOpacityChange = (e) => {
    const newOpacity = parseFloat(e.target.value);
    setOpacity(newOpacity);
    const color = newOpacity < 1 ? hexToRgba(hexValue, newOpacity) : hexValue;
    onSelect(type, color);
  };

  return (
    <div className="color-dropdown complex-picker" onClick={e => e.stopPropagation()}>
      <div className="picker-row">
        <label>Pick Color</label>
        <input
          type="color"
          value={hexValue}
          onChange={handleColorChange}
          className="native-picker"
        />
      </div>
      <div className="slider-row" style={{marginTop: 4}}>
        <label>Op</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={handleOpacityChange}
        />
        <span style={{fontSize: '0.7rem', color: 'var(--text-secondary)', minWidth: 30}}>{Math.round(opacity * 100)}%</span>
      </div>
      <div className="color-suggestions">
        <label>Suggestions</label>
        <div className="suggestions-grid">
          {SUGGESTED_COLORS.map((c) => (
            <div
              key={c}
              className="color-swatch"
              style={{ background: c }}
              onClick={() => {
                setOpacity(1);
                onSelect(type, c);
              }}
            />
          ))}
        </div>
      </div>
      <div className="color-history">
        <label>History</label>
        <div className="history-grid">
          {Array.from({ length: 10 }).map((_, i) => {
            const c = data.history[i];
            return c ? (
              <div
                key={`${c}-${i}`}
                className="color-swatch"
                style={{backgroundImage: `linear-gradient(${c}, ${c}), linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`}}
                onClick={() => {
                  setOpacity(parseOpacity(c));
                  onSelect(type, c);
                }}
              />
            ) : (
              <div key={`empty-${i}`} className="color-swatch empty-swatch" />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UserAvatarMenu({ user, logout }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!e.target.closest('.user-avatar-menu')) setOpen(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    const timer = setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('keydown', esc);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();
  const avatarColor = '#6366f1';

  return (
    <div className="user-avatar-menu">
      <div
        className="user-avatar-circle"
        style={{ backgroundColor: avatarColor }}
        onClick={() => setOpen(!open)}
        title={user.displayName || user.email}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="user-avatar-img" referrerPolicy="no-referrer" />
        ) : (
          initial
        )}
      </div>
      {open && (
        <div className="user-avatar-dropdown">
          <div className="dropdown-user-info">
            <span className="dropdown-user-name">{user.displayName}</span>
            <span className="dropdown-user-email">{user.email}</span>
          </div>
          <div className="dropdown-divider" />
          <button className="dropdown-item" onClick={logout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function BoardSelector({ onSelectBoard, darkMode, setDarkMode, user, logout }) {
  const { boards, loading, createBoard } = useBoardsList();
  const globalPresence = useGlobalPresence();
  const [showModal, setShowModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const groupDropdownRef = useRef(null);

  const groupInputRef = useRef(null);
  const boardNameInputRef = useRef(null);

  const existingGroups = [...new Set(boards.map(b => b.group).filter(Boolean))];
  const filteredGroups = newGroupName
    ? existingGroups.filter(g => g.toLowerCase().includes(newGroupName.toLowerCase()))
    : existingGroups;
  const isNewGroup = newGroupName.trim() && !existingGroups.some(g => g.toLowerCase() === newGroupName.trim().toLowerCase());

  const submitCreate = async (name, group) => {
    const ref = await createBoard(name, group || null);
    setNewBoardName('');
    setNewGroupName('');
    setGroupDropdownOpen(false);
    setShowModal(false);
    onSelectBoard(ref.id, name);
  };

  const handleAddBoard = (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    submitCreate(newBoardName.trim(), newGroupName.trim());
  };

  const handleGroupKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!newBoardName.trim()) {
        boardNameInputRef.current?.focus();
        return;
      }
      submitCreate(newBoardName.trim(), newGroupName.trim());
    } else if (e.key === 'Escape') {
      setGroupDropdownOpen(false);
      groupInputRef.current?.blur();
    }
  };

  if (loading) return <div className="loading">Loading boards...</div>;

  // Group boards - null key for ungrouped boards
  const groups = boards.reduce((acc, board) => {
    const g = board.group || null;
    if (!acc[g]) acc[g] = [];
    acc[g].push(board);
    return acc;
  }, {});

  // Sort boards within each group by updatedAt descending
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? a.updatedAt?.seconds * 1000 ?? 0;
      const bTime = b.updatedAt?.toMillis?.() ?? b.updatedAt?.seconds * 1000 ?? 0;
      return bTime - aTime;
    });
  }

  // Filter boards/groups by search query
  const q = searchQuery.trim().toLowerCase();
  const searchedGroups = {};
  for (const [key, groupBoards] of Object.entries(groups)) {
    const matchedBoards = q
      ? groupBoards.filter(b =>
          b.name.toLowerCase().includes(q) ||
          (key !== 'null' && key.toLowerCase().includes(q))
        )
      : groupBoards;
    if (matchedBoards.length > 0) searchedGroups[key] = matchedBoards;
  }

  // Sort groups: ungrouped (null) first, then named groups by most-recently-edited board desc
  const sortedGroupEntries = Object.entries(searchedGroups).sort(([a, aBoards], [b, bBoards]) => {
    if (a === 'null') return -1;
    if (b === 'null') return 1;
    const aTime = aBoards[0]?.updatedAt?.toMillis?.() ?? aBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
    const bTime = bBoards[0]?.updatedAt?.toMillis?.() ?? bBoards[0]?.updatedAt?.seconds * 1000 ?? 0;
    return bTime - aTime;
  });

  return (
    <div className="board-selector-container">
      <div className="selector-header">
        <div className="dashboard-top">
          <h1>CollabBoard</h1>
          <UserAvatarMenu user={user} logout={logout} />
        </div>
        <p>Everyone can see and edit all boards</p>
        <div className="dashboard-search">
          <Search size={16} className="dashboard-search-icon" />
          <input
            type="text"
            placeholder="Search boards and groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="dashboard-search-input"
          />
          {searchQuery && (
            <button className="dashboard-search-clear" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>
      </div>

      <div className="groups-list">
        {sortedGroupEntries.map(([groupKey, groupBoards]) => (
          <div key={groupKey} className="board-group">
            {groupKey !== 'null' && (
              <h2 className="group-title">
                <Folder size={20} /> {groupKey}
              </h2>
            )}
            <div className="boards-grid">
              {groupBoards.map(board => (
                <div
                  key={board.id}
                  className="board-card"
                  onClick={() => onSelectBoard(board.id, board.name)}
                >
                  <div className="board-card-preview">
                    <Layout size={40} />
                  </div>
                  <div className="board-card-info">
                    <h3>{board.name}</h3>
                    <div className="board-card-footer">
                      <p>Updated {board.updatedAt ? new Date(board.updatedAt.toDate()).toLocaleDateString() : 'Just now'}</p>
                      {globalPresence[board.id] && globalPresence[board.id].length > 0 && (
                        <div className="card-avatars">
                          {globalPresence[board.id].slice(0, 3).map((u, i) => (
                            <div
                              key={i}
                              className="mini-avatar"
                              style={{ backgroundColor: u.color }}
                              title={u.name}
                            >
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {globalPresence[board.id].length > 3 && (
                            <div className="mini-avatar mini-chip">
                              +{globalPresence[board.id].length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {boards.length === 0 && (
          <div className="empty-state">
            <p>No boards found. Create the first one!</p>
          </div>
        )}
        {boards.length > 0 && sortedGroupEntries.length === 0 && (
          <div className="empty-state">
            <p>No boards match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        )}
      </div>

      <button className="create-board-fab" onClick={() => setShowModal(true)} title="Create New Board">
        <Plus size={32} />
      </button>

      <button
        className="theme-fab"
        onClick={() => setDarkMode(!darkMode)}
        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {darkMode ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Create New Board</h2>
            <form onSubmit={handleAddBoard}>
              <div className="form-group">
                <label>Board Name</label>
                <input
                  ref={boardNameInputRef}
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="My Creative Board"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Group <span className="label-optional">(optional)</span></label>
                <div className="group-search-wrapper" ref={groupDropdownRef}>
                  <div className="group-search-input-row">
                    {isNewGroup
                      ? <Plus size={14} className="group-search-icon group-search-icon--plus" />
                      : <Search size={14} className="group-search-icon" />
                    }
                    <input
                      ref={groupInputRef}
                      type="text"
                      value={newGroupName}
                      onChange={(e) => {
                        setNewGroupName(e.target.value);
                        setGroupDropdownOpen(true);
                      }}
                      onFocus={() => setGroupDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setGroupDropdownOpen(false), 150)}
                      onKeyDown={handleGroupKeyDown}
                      placeholder="Search or create a group..."
                    />
                    {newGroupName && (
                      <button
                        type="button"
                        className="group-clear-btn"
                        onClick={() => {
                          setNewGroupName('');
                          setGroupDropdownOpen(false);
                          groupInputRef.current?.focus();
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {isNewGroup && newGroupName && (
                    <div className="group-new-hint">
                      <Plus size={12} /> New group &ldquo;{newGroupName.trim()}&rdquo;
                      {newBoardName.trim() ? ' — press Enter to create' : ' — enter a board name first'}
                    </div>
                  )}
                  {groupDropdownOpen && filteredGroups.length > 0 && (
                    <div className="group-dropdown-list">
                      {filteredGroups.map(g => (
                        <div
                          key={g}
                          className="group-dropdown-item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setNewGroupName(g);
                            setGroupDropdownOpen(false);
                          }}
                        >
                          <Folder size={14} /> {g}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => { setShowModal(false); setNewGroupName(''); setGroupDropdownOpen(false); }}>Cancel</button>
                <button type="submit" className="primary-btn">Create Board</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PresenceAvatars({ presentUsers, currentUserId }) {
  const [showModal, setShowModal] = useState(false);
  
  if (!presentUsers) return null;
  
  const users = Object.entries(presentUsers).map(([id, data]) => ({ id, ...data }));
  
  if (users.length === 0) return null;
  
  // Sort users so current user is last or first for consistency
  const sortedUsers = [...users].sort((a, b) => (a.id === currentUserId ? -1 : 1));
  
  const visibleUsers = sortedUsers.slice(0, 3);
  const remainingCount = sortedUsers.length - 3;

  return (
    <div className="presence-avatars">
      <div className="avatar-stack" onClick={() => setShowModal(true)}>
        {visibleUsers.map((u, i) => (
          <div 
            key={i} 
            className="avatar-circle" 
            style={{ backgroundColor: u.color, zIndex: 10 - i }}
            title={u.name}
          >
            {u.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="avatar-chip">
            +{remainingCount}
          </div>
        )}
      </div>
      
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card presence-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Users Online</h2>
              <p>{users.length} active on this board</p>
            </div>
            <div className="user-list-detailed">
              {users.map((u, i) => (
                <div key={i} className="user-detail-row">
                  <div className="avatar-circle large" style={{ backgroundColor: u.color }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-detail-info">
                    <span className="user-detail-name">{u.name} {u.id === currentUserId && '(You)'}</span>
                    <span className="user-detail-status">Currently editing</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="primary-btn" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const { user, loading, login, logout } = useAuth();
  const [boardId, setBoardId] = useState(() => {
    // URL hash takes priority (for shareable links), then localStorage
    const hash = window.location.hash.slice(1);
    return hash || localStorage.getItem('collaboard_boardId') || null;
  });
  const [boardName, setBoardName] = useState(() => localStorage.getItem('collaboard_boardName') || '');
  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const stageRef = useRef(null);
  const frameDragRef = useRef({ frameId: null, dx: 0, dy: 0 });

  useEffect(() => {
    if (boardId) {
      localStorage.setItem('collaboard_boardId', boardId);
      localStorage.setItem('collaboard_boardName', boardName);
      window.location.hash = boardId;
    } else {
      localStorage.removeItem('collaboard_boardId');
      localStorage.removeItem('collaboard_boardName');
      history.pushState('', document.title, window.location.pathname);
    }
  }, [boardId, boardName]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  // Conditionally call hooks only when boardId is present
  const presence = usePresence(boardId, user);
  const rawBoard = useBoard(boardId);
  const board = useUndoStack(rawBoard);
  const { boards: allBoards, createBoard: createNewBoard } = useBoardsList();

  // When loading from a shared URL hash, look up the board name from the boards list
  useEffect(() => {
    if (boardId && !boardName && allBoards.length > 0) {
      const found = allBoards.find(b => b.id === boardId);
      if (found) setBoardName(found.name);
    }
  }, [boardId, boardName, allBoards]);

  const aiCreateBoard = async (name, group) => {
    const ref = await createNewBoard(name, group);
    setBoardId(ref.id);
    setBoardName(name);
    // Small delay to let board subscription initialize
    await new Promise(r => setTimeout(r, 500));
  };

  const ai = useAI(boardId, {
    addObject: rawBoard?.addObject,
    updateObject: rawBoard?.updateObject,
    deleteObject: rawBoard?.deleteObject,
    createBoard: aiCreateBoard,
    getBoards: () => allBoards
  }, board?.objects);

  const [selectedId, setSelectedId] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [stagePos, setStagePos] = useState(() => {
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) { const v = JSON.parse(saved); return { x: v.x ?? 0, y: v.y ?? 0 }; }
    } catch {}
    return { x: 0, y: 0 };
  });
  const [stageScale, setStageScale] = useState(() => {
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) { const v = JSON.parse(saved); return v.scale ?? 1; }
    } catch {}
    return 1;
  });
  const [shapeColors, setShapeColors] = useState(() => {
    const saved = localStorage.getItem(`shapeColors_${boardId}`);
    const defaults = {
      sticky: { active: '#fef08a', history: [] },
      rectangle: { active: '#bfdbfe', history: [] },
      circle: { active: '#fbcfe8', history: [] },
      triangle: { active: '#e9d5ff', history: [] },
      line: { active: '#3b82f6', history: [] }
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
    return defaults;
  });
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showSelectedColorPicker, setShowSelectedColorPicker] = useState(false);
  const [dragState, setDragState] = useState({ draggingId: null, overFrameId: null, action: null });
  const [snapToGrid, setSnapToGrid] = useState(() => localStorage.getItem('snapToGrid') === 'true');
  const [showTutorial, setShowTutorial] = useState(() => Tutorial.shouldShow());
  const [resizeTooltip, setResizeTooltip] = useState(null); // { x, y, msg }
  const resizeTooltipTimer = useRef(null);
  const GRID_SIZE = 50;
  const snap = (val) => snapToGrid ? Math.round(val / GRID_SIZE) * GRID_SIZE : val;
  const snapSize = (val, min) => snapToGrid ? Math.max(min, Math.round(val / GRID_SIZE) * GRID_SIZE) : val;

  useEffect(() => {
    if (!showColorPicker) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tool-split-button')) {
        setShowColorPicker(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowColorPicker(null);
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showColorPicker]);

  // Reset selected-object color picker when selection changes
  useEffect(() => {
    setShowSelectedColorPicker(false);
  }, [selectedId]);

  useEffect(() => {
    if (!showSelectedColorPicker) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.selected-color-picker-wrapper')) {
        setShowSelectedColorPicker(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowSelectedColorPicker(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showSelectedColorPicker]);

  // Ctrl/Cmd+Z undo shortcut
  useEffect(() => {
    const handleUndo = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (board.canUndo) board.undo();
      }
    };
    window.addEventListener('keydown', handleUndo);
    return () => window.removeEventListener('keydown', handleUndo);
  }, [board.canUndo, board.undo]);

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`shapeColors_${boardId}`, JSON.stringify(shapeColors));
    }
  }, [shapeColors, boardId]);

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`collaboard_view_${boardId}`, JSON.stringify({ x: stagePos.x, y: stagePos.y, scale: stageScale }));
    }
  }, [stagePos, stageScale, boardId]);

  useEffect(() => {
    if (!boardId) return;
    try {
      const saved = localStorage.getItem(`collaboard_view_${boardId}`);
      if (saved) {
        const v = JSON.parse(saved);
        setStagePos({ x: v.x ?? 0, y: v.y ?? 0 });
        setStageScale(v.scale ?? 1);
        return;
      }
    } catch {}
    setStagePos({ x: 0, y: 0 });
    setStageScale(1);
  }, [boardId]);

  const updateActiveColor = (type, color) => {
    setShapeColors(prev => {
      // If the color is already the active one and we're just picking it again, don't update history
      if (prev[type].active === color) return prev;

      const history = [...prev[type].history];
      // Only add to history if it's not already at the front
      if (history[0] !== color) {
        // Remove color if it exists elsewhere in history to avoid duplicates
        const filteredHistory = history.filter(c => c !== color);
        return {
          ...prev,
          [type]: {
            active: color,
            history: [color, ...filteredHistory].slice(0, 10)
          }
        };
      }
      return {
        ...prev,
        [type]: {
          ...prev[type],
          active: color
        }
      };
    });
  };

  // Recursively collect all descendant IDs of a frame (to prevent circular nesting)
  const getDescendantIds = (frameId) => {
    const ids = new Set();
    const collect = (fid) => {
      for (const o of Object.values(board.objects)) {
        if (o.frameId === fid && !ids.has(o.id)) {
          ids.add(o.id);
          if (o.type === 'frame') collect(o.id);
        }
      }
    };
    collect(frameId);
    return ids;
  };

  const handleDragMove = (id, pos) => {
    const obj = board.objects[id];
    if (!obj) return;
    const tempObj = { ...obj, ...pos };
    // For frames, exclude self and descendants from candidate parent frames
    let candidates = board.objects;
    if (obj.type === 'frame') {
      const excluded = getDescendantIds(id);
      excluded.add(id);
      candidates = Object.fromEntries(Object.entries(board.objects).filter(([k]) => !excluded.has(k)));
    }
    const overFrame = findOverlappingFrame(tempObj, candidates);
    const currentFrameId = obj.frameId || null;
    let action = null;
    let overFrameId = null;
    if (overFrame) {
      overFrameId = overFrame.id;
      if (currentFrameId !== overFrame.id) {
        action = 'add';
      }
    } else if (currentFrameId) {
      overFrameId = currentFrameId;
      action = 'remove';
    }
    setDragState({ draggingId: id, overFrameId, action });
  };

  const FRAME_MARGIN = 20;

  const handleContainedDragEnd = (id, updates) => {
    const obj = board.objects[id];
    if (!obj) return;
    let snapped = { ...updates, x: snap(updates.x), y: snap(updates.y) };
    const tempObj = { ...obj, ...snapped };
    const overFrame = findOverlappingFrame(tempObj, board.objects);
    const newFrameId = overFrame ? overFrame.id : null;

    // Clamp inside frame with margin
    if (overFrame) {
      const ow = obj.width || 150;
      const oh = obj.height || 150;
      const titleBar = Math.max(32, Math.min(52, overFrame.height * 0.12));
      const minX = overFrame.x + FRAME_MARGIN;
      const minY = overFrame.y + titleBar + FRAME_MARGIN;
      const maxX = overFrame.x + overFrame.width - ow - FRAME_MARGIN;
      const maxY = overFrame.y + overFrame.height - oh - FRAME_MARGIN;
      snapped.x = Math.max(minX, Math.min(maxX, snapped.x));
      snapped.y = Math.max(minY, Math.min(maxY, snapped.y));
    }

    board.updateObject(id, { ...snapped, frameId: newFrameId || null });
    setDragState({ draggingId: null, overFrameId: null, action: null });
  };

  const handleFrameDragMove = (id, pos) => {
    const frame = board.objects[id];
    if (!frame) return;
    const dx = pos.x - frame.x;
    const dy = pos.y - frame.y;
    frameDragRef.current = { frameId: id, dx, dy };
    const stage = stageRef.current;
    if (!stage) return;
    // Recursively move all descendants
    const descendants = getDescendantIds(id);
    for (const childId of descendants) {
      const child = board.objects[childId];
      if (!child) continue;
      const node = stage.findOne('.' + childId);
      if (node) {
        node.x(child.x + dx);
        node.y(child.y + dy);
      }
    }
    stage.batchDraw();
    // Show drag indicator for frame-in-frame
    handleDragMove(id, pos);
  };

  const handleFrameDragEnd = (id, updates) => {
    const frame = board.objects[id];
    if (!frame) return;
    let snapped = { ...updates, x: snap(updates.x), y: snap(updates.y) };

    // Check if this frame is being dropped inside another frame (excluding self & descendants)
    const excluded = getDescendantIds(id);
    excluded.add(id);
    const candidates = Object.fromEntries(Object.entries(board.objects).filter(([k]) => !excluded.has(k)));
    const tempObj = { ...frame, ...snapped };
    const overFrame = findOverlappingFrame(tempObj, candidates);
    const newFrameId = overFrame ? overFrame.id : null;

    // Snap outside parent when a child frame is removed from its parent
    const wasRemoved = frame.frameId && !newFrameId;
    if (wasRemoved) {
      const oldParent = board.objects[frame.frameId];
      if (oldParent) {
        const childW = frame.width || 400;
        const childH = frame.height || 300;
        const parentCX = oldParent.x + oldParent.width / 2;
        const parentCY = oldParent.y + oldParent.height / 2;
        const childCX = snapped.x + childW / 2;
        const childCY = snapped.y + childH / 2;
        const dirX = childCX - parentCX;
        const dirY = childCY - parentCY;

        let snapX, snapY;
        if (Math.abs(dirX) >= Math.abs(dirY)) {
          // Horizontal exit
          snapX = dirX >= 0
            ? oldParent.x + oldParent.width + FRAME_MARGIN
            : oldParent.x - childW - FRAME_MARGIN;
          snapY = snapped.y;
        } else {
          // Vertical exit
          snapX = snapped.x;
          snapY = dirY >= 0
            ? oldParent.y + oldParent.height + FRAME_MARGIN
            : oldParent.y - childH - FRAME_MARGIN;
        }

        const snappedRect = { x: snapX, y: snapY, width: childW, height: childH };
        const descendantIds = getDescendantIds(id);
        const hasOverlap = Object.values(board.objects).some(o => {
          if (o.id === id || o.id === frame.frameId || descendantIds.has(o.id)) return false;
          return rectsOverlap(snappedRect, o);
        });

        if (!hasOverlap) {
          snapped.x = snap(snapX);
          snapped.y = snap(snapY);
        }
      }
    }

    // When dropping inside a parent frame: clamp top-left edge (below title bar),
    // then recursively expand all ancestor frames that need to grow to fit.
    let ancestorExpansions = [];
    if (overFrame) {
      const ow = frame.width || 400;
      const oh = frame.height || 300;
      const titleBar = Math.max(32, Math.min(52, overFrame.height * 0.12));
      const minX = overFrame.x + FRAME_MARGIN;
      const minY = overFrame.y + titleBar + FRAME_MARGIN;
      // Only clamp top-left so child stays below title bar / inside left edge
      snapped.x = Math.max(minX, snapped.x);
      snapped.y = Math.max(minY, snapped.y);

      ancestorExpansions = computeAncestorExpansions(
        snapped.x, snapped.y, ow, oh, overFrame.id, board.objects, FRAME_MARGIN
      );
    }

    const dx = snapped.x - frame.x;
    const dy = snapped.y - frame.y;
    // Recursively move all descendants
    const descendants = getDescendantIds(id);
    const batchUpdates = [];
    for (const childId of descendants) {
      const child = board.objects[childId];
      if (child) {
        batchUpdates.push({ id: childId, data: { x: child.x + dx, y: child.y + dy } });
      }
    }
    for (const exp of ancestorExpansions) batchUpdates.push(exp);
    board.updateObject(id, { ...snapped, frameId: newFrameId || null });
    if (batchUpdates.length > 0) {
      board.batchUpdateObjects(batchUpdates);
    }
    frameDragRef.current = { frameId: null, dx: 0, dy: 0 };
    setDragState({ draggingId: null, overFrameId: null, action: null });
  };

  const handleTransformEnd = (id, updates) => {
    const obj = board.objects[id];
    board.updateObject(id, updates);
    if (!obj || !obj.frameId) return;
    const childX = updates.x ?? obj.x;
    const childY = updates.y ?? obj.y;
    const childW = updates.width ?? obj.width ?? 150;
    const childH = updates.height ?? obj.height ?? 150;
    const expansions = computeAncestorExpansions(
      childX, childY, childW, childH, obj.frameId, board.objects, FRAME_MARGIN
    );
    if (expansions.length > 0) {
      board.batchUpdateObjects(expansions);
    }
  };

  const handleResizeClamped = (id) => {
    const obj = board.objects[id];
    if (!obj) return;
    const stage = stageRef.current;
    if (stage) {
      const frameScreenX = obj.x * stageScale + stagePos.x;
      const frameScreenY = obj.y * stageScale + stagePos.y;
      const frameScreenW = (obj.width || 400) * stageScale;
      clearTimeout(resizeTooltipTimer.current);
      setResizeTooltip({
        x: frameScreenX + frameScreenW / 2,
        y: frameScreenY - 12,
        msg: 'Parent cannot be smaller than child. Remove child first.',
      });
      resizeTooltipTimer.current = setTimeout(() => setResizeTooltip(null), 2500);
    }
  };

  const handleDeleteWithCleanup = (id) => {
    const obj = board.objects[id];
    if (obj && obj.type === 'frame') {
      const children = Object.values(board.objects).filter(o => o.frameId === id);
      if (children.length > 0) {
        board.batchUpdateObjects(children.map(c => ({ id: c.id, data: { frameId: null } })));
      }
    }
    board.deleteObject(id);
    setSelectedId(null);
  };

  const handleBringToFront = (id) => {
    const maxZ = Math.max(0, ...Object.values(board.objects).map(o => o.zIndex || 0));
    board.updateObject(id, { zIndex: maxZ + 1 });
  };

  const handleSendToBack = (id) => {
    const minZ = Math.min(0, ...Object.values(board.objects).map(o => o.zIndex || 0));
    board.updateObject(id, { zIndex: minZ - 1 });
  };

  const findOpenSpot = (w, h, isFrame = false) => {
    const cx = (window.innerWidth / 2 - stagePos.x) / stageScale;
    const cy = ((window.innerHeight - 50) / 2 - stagePos.y) / stageScale;
    const allObjs = Object.values(board.objects);
    const objs = isFrame ? allObjs : allObjs.filter(o => o.type !== 'frame');
    const overlaps = (x, y) => objs.some(o => {
      const ow = o.width || 100;
      const oh = o.height || 100;
      return x < o.x + ow && x + w > o.x && y < o.y + oh && y + h > o.y;
    });
    // Try center first, then spiral outward
    if (!overlaps(cx - w / 2, cy - h / 2)) return { x: cx - w / 2, y: cy - h / 2 };
    const step = 50;
    for (let dist = step; dist < 2000; dist += step) {
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        const tx = cx - w / 2 + Math.cos(rad) * dist;
        const ty = cy - h / 2 + Math.sin(rad) * dist;
        if (!overlaps(tx, ty)) return { x: tx, y: ty };
      }
    }
    return { x: cx - w / 2, y: cy - h / 2 };
  };

  const handleMouseMove = (e) => {
    if (!presence.updateCursor) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (pointer) {
      // Correct for panning and zooming
      const pos = {
        x: (pointer.x - stage.x()) / stage.scaleX(),
        y: (pointer.y - stage.y()) / stage.scaleY(),
      };
      presence.updateCursor(pos.x, pos.y);
    }
  };

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const scaleBy = 1.05; // Reduced sensitivity from 1.1
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  };

  const handleStageClick = (e) => {
    if (e.target === e.target.getStage() || e.target.name() === 'bg-rect') {
      setSelectedId(null);
    }
  };

  const handleAddSticky = () => {
    const pos = findOpenSpot(150, 150);
    board.addObject({
      type: 'sticky',
      text: 'New Sticky Note',
      x: pos.x,
      y: pos.y,
      color: shapeColors.sticky.active,
      userId: user.uid
    });
  };

  const handleAddShape = (type) => {
    const pos = findOpenSpot(100, 100);
    board.addObject({
      type,
      x: pos.x,
      y: pos.y,
      width: 100,
      height: 100,
      color: shapeColors[type].active,
      userId: user.uid
    });
  };

  const handleAddFrame = () => {
    const fw = Math.round(window.innerWidth * 0.55 / stageScale);
    const fh = Math.round((window.innerHeight - 50) * 0.55 / stageScale);
    const pos = findOpenSpot(fw, fh, true);
    board.addObject({
      type: 'frame',
      x: pos.x,
      y: pos.y,
      width: fw,
      height: fh,
      title: 'Frame',
      color: '#6366f1',
      userId: user.uid
    });
  };

  const handleAddLine = () => {
    board.addObject({
      type: 'line',
      x: (window.innerWidth / 2 - stagePos.x) / stageScale,
      y: (window.innerHeight / 2 - stagePos.y) / stageScale,
      points: [0, 0, 200, 0],
      color: shapeColors.line.active,
      strokeWidth: 3,
      userId: user.uid
    });
  };

  const handleAISubmit = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    const prompt = aiPrompt;
    setAiPrompt('');
    await ai.sendCommand(prompt);
  };

  const handleRecenter = () => {
    setStagePos({ x: 0, y: 0 });
    setStageScale(1);
  };

  const isOffCenter = stagePos.x !== 0 || stagePos.y !== 0 || stageScale !== 1;

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <div className="login-container">
        <h1>CollabBoard</h1>
        <p>Real-time collaborative whiteboard with AI agent</p>
        <button onClick={() => login()}>Sign in with Google</button>
      </div>
    );
  }

  if (!boardId) {
    return <BoardSelector onSelectBoard={(id, name) => { setBoardId(id); setBoardName(name || id); }} darkMode={darkMode} setDarkMode={setDarkMode} user={user} logout={logout} />;
  }

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-left">
          <span className="logo-text" onClick={() => { setBoardId(null); setBoardName(''); }} style={{cursor: 'pointer'}}>
            CollabBoard
          </span>
          <span className="board-badge">/ {boardName}</span>
          <div className="toolbar">
            <div className="tool-split-button no-outline">
              <button onClick={handleAddSticky} title="Add Sticky Note">
                <Square size={18} fill={shapeColors.sticky.active} stroke={darkenHex(shapeColors.sticky.active, 0.2)} />
              </button>
              <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'sticky' ? null : 'sticky')}>
                <ChevronDown size={14} />
              </button>
              {showColorPicker === 'sticky' && (
                <ColorPickerMenu
                  type="sticky"
                  data={shapeColors.sticky}
                  onSelect={updateActiveColor}
                />
              )}
            </div>

            <div className="tool-split-button no-outline">
              <button onClick={() => handleAddShape('rectangle')} title="Add Square">
                <Square size={18} fill={shapeColors.rectangle.active} stroke={shapeColors.rectangle.active} />
              </button>
              <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'rectangle' ? null : 'rectangle')}>
                <ChevronDown size={14} />
              </button>
              {showColorPicker === 'rectangle' && (
                <ColorPickerMenu 
                  type="rectangle" 
                  data={shapeColors.rectangle} 
                  onSelect={updateActiveColor} 
                />
              )}
            </div>

            <div className="tool-split-button no-outline">
              <button onClick={() => handleAddShape('circle')} title="Add Circle">
                <Circle size={18} fill={shapeColors.circle.active} stroke={shapeColors.circle.active} />
              </button>
              <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'circle' ? null : 'circle')}>
                <ChevronDown size={14} />
              </button>
              {showColorPicker === 'circle' && (
                <ColorPickerMenu 
                  type="circle" 
                  data={shapeColors.circle} 
                  onSelect={updateActiveColor} 
                />
              )}
            </div>

            <div className="tool-split-button no-outline">
              <button onClick={() => handleAddShape('triangle')} title="Add Triangle">
                <Triangle size={18} fill={shapeColors.triangle.active} stroke={shapeColors.triangle.active} />
              </button>
              <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'triangle' ? null : 'triangle')}>
                <ChevronDown size={14} />
              </button>
              {showColorPicker === 'triangle' && (
                <ColorPickerMenu
                  type="triangle"
                  data={shapeColors.triangle}
                  onSelect={updateActiveColor}
                />
              )}
            </div>

            <div className="tool-split-button no-outline">
              <button onClick={handleAddLine} title="Add Line">
                <Minus size={18} stroke={shapeColors.line.active} />
              </button>
              <button className="dropdown-arrow" onClick={() => setShowColorPicker(showColorPicker === 'line' ? null : 'line')}>
                <ChevronDown size={14} />
              </button>
              {showColorPicker === 'line' && (
                <ColorPickerMenu
                  type="line"
                  data={shapeColors.line}
                  onSelect={updateActiveColor}
                />
              )}
            </div>

            <div className="tool-split-button no-outline">
              <button onClick={handleAddFrame} title="Add Frame">
                <AppWindow size={18} />
              </button>
            </div>

            <button
              className={`snap-toggle ${snapToGrid ? 'active' : ''}`}
              onClick={() => { const next = !snapToGrid; setSnapToGrid(next); localStorage.setItem('snapToGrid', next); }}
              title={snapToGrid ? "Disable Snap to Grid" : "Enable Snap to Grid"}
            >
              <Grid3x3 size={18} />
            </button>

            <button
              className={`snap-toggle ${board.canUndo ? '' : 'disabled'}`}
              onClick={() => board.canUndo && board.undo()}
              title="Undo (Ctrl+Z)"
              disabled={!board.canUndo}
            >
              <Undo2 size={18} />
            </button>
          </div>
        </div>
        <div className="header-right">
          <PresenceAvatars presentUsers={presence.presentUsers} currentUserId={user.uid} />
          <button
            className="help-btn"
            onClick={() => setShowTutorial(true)}
            title="Show Tutorial"
          >
            <HelpCircle size={18} />
          </button>
          <UserAvatarMenu user={user} logout={logout} />
        </div>
      </div>
      <div className="board-wrapper">
        {board.loading && (
          <div className="board-loading">
            <div className="board-loading-spinner" />
          </div>
        )}
        <Stage
          ref={stageRef}
          width={window.innerWidth}
          height={window.innerHeight - 50}
          onMouseMove={handleMouseMove}
          onClick={handleStageClick}
          draggable={!selectedId} // Panning bug fix: only draggable when nothing is selected
          x={stagePos.x}
          y={stagePos.y}
          scaleX={stageScale}
          scaleY={stageScale}
          onDragEnd={(e) => {
            // Only update stage pos if the stage itself was dragged
            if (e.target === e.target.getStage()) {
              setStagePos({
                x: e.target.x(),
                y: e.target.y()
              });
            }
          }}
          onWheel={handleWheel}
        >
          <Layer>
            <Rect
              name="bg-rect"
              x={-stagePos.x / stageScale}
              y={-stagePos.y / stageScale}
              width={window.innerWidth / stageScale}
              height={(window.innerHeight - 50) / stageScale}
              fill={darkMode ? '#111827' : '#ffffff'}
            />
            {snapToGrid && (() => {
              const left = -stagePos.x / stageScale;
              const top = -stagePos.y / stageScale;
              const right = left + window.innerWidth / stageScale;
              const bottom = top + (window.innerHeight - 50) / stageScale;
              const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
              const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;
              const cols = Math.ceil((right - startX) / GRID_SIZE) + 1;
              const rows = Math.ceil((bottom - startY) / GRID_SIZE) + 1;
              if (cols * rows > 5000) return null;
              const fill = darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
              const dotSize = 2 / stageScale;
              const dots = [];
              for (let xi = 0; xi < cols; xi++) {
                for (let yi = 0; yi < rows; yi++) {
                  const px = startX + xi * GRID_SIZE;
                  const py = startY + yi * GRID_SIZE;
                  dots.push(
                    <Rect
                      key={`gd${xi}_${yi}`}
                      x={px - dotSize / 2}
                      y={py - dotSize / 2}
                      width={dotSize}
                      height={dotSize}
                      fill={fill}
                      cornerRadius={dotSize / 2}
                      listening={false}
                    />
                  );
                }
              }
              return dots;
            })()}
            {Object.keys(board.objects).length === 0 && (() => {
              const cx = window.innerWidth / 2;
              const cy = (window.innerHeight - 50) / 2;
              const boldColor = darkMode ? '#d1d5db' : '#374151';
              const textColor = darkMode ? '#9ca3af' : '#6b7280';
              const dimColor = darkMode ? '#6b7280' : '#9ca3af';
              const font = 'system-ui, sans-serif';
              const tips = [
                { key: 'Drag', desc: ' to pan' },
                { key: 'Scroll', desc: ' to zoom' },
                { key: 'Click', desc: ' to select' },
              ];
              // Measure widths with canvas for accurate positioning
              const mc = document.createElement('canvas').getContext('2d');
              const fontSize = 13;
              const segments = tips.map(tip => {
                mc.font = `bold ${fontSize}px ${font}`;
                const boldW = mc.measureText(tip.key).width;
                mc.font = `${fontSize}px ${font}`;
                const normalW = mc.measureText(tip.desc).width;
                mc.font = `${fontSize}px ${font}`;
                const sepW = mc.measureText('  ·  ').width;
                return { ...tip, boldW, normalW, sepW };
              });
              const totalLineW = segments.reduce((sum, s, i) =>
                sum + s.boldW + s.normalW + (i < segments.length - 1 ? s.sepW : 0), 0);
              let curX = cx - totalLineW / 2;
              const tipsY = cy + 38;
              return (
                <>
                  <Text
                    x={cx - 260}
                    y={cy - 20}
                    width={520}
                    text="Your board is empty"
                    fontSize={22}
                    fontStyle="bold"
                    fontFamily={font}
                    fill={boldColor}
                    align="center"
                    listening={false}
                  />
                  <Text
                    x={cx - 260}
                    y={cy + 14}
                    width={520}
                    text="Pick a tool from the toolbar above to get started"
                    fontSize={14}
                    fontFamily={font}
                    fill={textColor}
                    align="center"
                    listening={false}
                  />
                  {segments.map((s, i) => {
                    const boldX = curX;
                    const normalX = curX + s.boldW;
                    const sepX = normalX + s.normalW;
                    curX = sepX + s.sepW;
                    return [
                      <Text key={`b${i}`} x={boldX} y={tipsY} text={s.key} fontSize={fontSize} fontStyle="bold" fontFamily={font} fill={boldColor} listening={false} />,
                      <Text key={`n${i}`} x={normalX} y={tipsY} text={s.desc} fontSize={fontSize} fontFamily={font} fill={dimColor} listening={false} />,
                      i < segments.length - 1 && <Text key={`sep${i}`} x={sepX} y={tipsY} text="  ·  " fontSize={fontSize} fontFamily={font} fill={dimColor} listening={false} />,
                    ];
                  })}
                </>
              );
            })()}
            {Object.values(board.objects)
              .sort((a, b) => {
                // Frames always render behind non-frames
                const aFrame = a.type === 'frame' ? 0 : 1;
                const bFrame = b.type === 'frame' ? 0 : 1;
                if (aFrame !== bFrame) return aFrame - bFrame;
                // Among frames: parent frames before child frames so children are clickable on top
                if (a.type === 'frame' && b.type === 'frame') {
                  const aDepth = a.frameId ? 1 : 0;
                  const bDepth = b.frameId ? 1 : 0;
                  if (aDepth !== bDepth) return aDepth - bDepth;
                }
                return (a.zIndex || 0) - (b.zIndex || 0);
              })
              .map((obj) => {
              if (obj.type === 'frame') {
                // Compute minimum size to contain all direct children
                const frameChildren = Object.values(board.objects).filter(o => o.frameId === obj.id);
                let frameMinW = 100;
                let frameMinH = 80;
                for (const child of frameChildren) {
                  const cr = (child.x - obj.x) + (child.width || 150) + FRAME_MARGIN;
                  const cb = (child.y - obj.y) + (child.height || 150) + FRAME_MARGIN;
                  if (cr > frameMinW) frameMinW = cr;
                  if (cb > frameMinH) frameMinH = cb;
                }
                return (
                  <Frame
                    key={obj.id}
                    {...obj}
                    isSelected={obj.id === selectedId}
                    onSelect={setSelectedId}
                    onDragEnd={handleFrameDragEnd}
                    onDragMove={handleFrameDragMove}
                    onTransformEnd={handleTransformEnd}
                    onUpdate={board.updateObject}
                    onDelete={handleDeleteWithCleanup}
                    dragState={dragState}
                    snapToGrid={snapToGrid}
                    gridSize={GRID_SIZE}
                    minWidth={frameMinW}
                    minHeight={frameMinH}
                    onResizeClamped={handleResizeClamped}
                  />
                );
              }
              if (obj.type === 'sticky') {
                return (
                  <StickyNote
                    key={obj.id}
                    {...obj}
                    isSelected={obj.id === selectedId}
                    onSelect={setSelectedId}
                    onDragEnd={handleContainedDragEnd}
                    onTransformEnd={handleTransformEnd}
                    onUpdate={board.updateObject}
                    onDelete={handleDeleteWithCleanup}
                    onDragMove={handleDragMove}
                    snapToGrid={snapToGrid}
                    gridSize={GRID_SIZE}
                  />
                );
              }
              if (obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'triangle') {
                return (
                  <Shape
                    key={obj.id}
                    {...obj}
                    isSelected={obj.id === selectedId}
                    onSelect={setSelectedId}
                    onDragEnd={handleContainedDragEnd}
                    onTransformEnd={handleTransformEnd}
                    onUpdate={board.updateObject}
                    onDelete={handleDeleteWithCleanup}
                    onDragMove={handleDragMove}
                    snapToGrid={snapToGrid}
                    gridSize={GRID_SIZE}
                  />
                );
              }
              if (obj.type === 'line') {
                return (
                  <LineShape
                    key={obj.id}
                    {...obj}
                    isSelected={obj.id === selectedId}
                    onSelect={setSelectedId}
                    onDragEnd={handleContainedDragEnd}
                    onTransformEnd={handleTransformEnd}
                    onDelete={handleDeleteWithCleanup}
                    onDragMove={handleDragMove}
                  />
                );
              }
              return null;
            })}
            <Cursors presentUsers={presence.presentUsers} userId={user.uid} />
          </Layer>
        </Stage>

        <button 
          className={`ai-fab ${showAI ? 'active' : ''}`}
          onClick={() => setShowAI(!showAI)}
          title="AI Agent"
        >
          <MessageSquare size={24} />
        </button>

        <button 
          className="theme-fab"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {darkMode ? <Sun size={24} /> : <Moon size={24} />}
        </button>

        {isOffCenter && (
          <button
            className="recenter-fab"
            onClick={handleRecenter}
            title="Recenter Board"
          >
            <Maximize size={24} />
          </button>
        )}

        {resizeTooltip && (
          <div
            className="resize-tooltip"
            style={{
              position: 'fixed',
              left: resizeTooltip.x,
              top: resizeTooltip.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 2000,
            }}
          >
            {resizeTooltip.msg}
          </div>
        )}

        {selectedId && board.objects[selectedId] && (
          <div className="selected-actions">
            {board.objects[selectedId].type !== 'frame' && (
              <div className="selected-color-picker-wrapper">
                <button
                  className="action-fab"
                  style={{ background: board.objects[selectedId].color || '#3b82f6' }}
                  onClick={() => setShowSelectedColorPicker(!showSelectedColorPicker)}
                  title="Change Color"
                >
                  <Palette size={20} color="#fff" />
                </button>
                {showSelectedColorPicker && (
                  <div className="selected-color-dropdown">
                    <div className="suggestions-grid">
                      {SUGGESTED_COLORS.map((c) => (
                        <div
                          key={c}
                          className="color-swatch"
                          style={{ background: c }}
                          onClick={() => board.updateObject(selectedId, { color: c })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              className="action-fab"
              onClick={() => handleBringToFront(selectedId)}
              title="Bring to Front"
            >
              <ArrowUpToLine size={20} />
            </button>
            <button
              className="action-fab"
              onClick={() => handleSendToBack(selectedId)}
              title="Send to Back"
            >
              <ArrowDownToLine size={20} />
            </button>
            <button
              className="action-fab delete-action"
              onClick={() => handleDeleteWithCleanup(selectedId)}
              title="Delete Selected"
            >
              <Trash2 size={20} />
            </button>
          </div>
        )}

        {selectedId && board.objects[selectedId] && board.objects[selectedId].type === 'frame' && (
          <div className="frame-props-panel">
            <label>Frame Color</label>
            <div className="frame-props-row">
              <input
                type="color"
                value={board.objects[selectedId].color || '#6366f1'}
                onChange={(e) => board.updateObject(selectedId, { color: e.target.value })}
                className="native-picker"
              />
            </div>
            <div className="frame-color-swatches">
              {['#6366f1', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#ec4899', '#f97316', '#374151'].map(c => (
                <div
                  key={c}
                  className="color-swatch"
                  style={{ background: c }}
                  onClick={() => board.updateObject(selectedId, { color: c })}
                />
              ))}
            </div>
          </div>
        )}

        {showAI && (
          <div className="ai-panel">
            <div className="ai-header">AI Board Agent</div>
            <form onSubmit={handleAISubmit} className="ai-input-area">
              <input
                type="text"
                placeholder="Ask AI to draw something..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                autoFocus
                disabled={ai.isTyping}
              />
              <button type="submit" disabled={ai.isTyping}>
                <Send size={16} />
              </button>
            </form>
            {ai.isTyping && <div className="ai-status">AI is thinking...</div>}
            {ai.error && (
              <div className="ai-error" onClick={() => ai.clearError()}>
                {ai.error}
                <span className="ai-error-dismiss">dismiss</span>
              </div>
            )}
          </div>
        )}

        {showTutorial && (
          <Tutorial onComplete={() => setShowTutorial(false)} />
        )}
      </div>
    </div>
  );
}

export default App;
