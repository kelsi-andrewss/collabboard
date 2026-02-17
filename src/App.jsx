import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useAuth } from './hooks/useAuth';
import { usePresence } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { useBoardsList } from './hooks/useBoardsList';
import { useGlobalPresence } from './hooks/useGlobalPresence';
import { useAI } from './hooks/useAI';
import { Cursors } from './components/Cursors';
import { StickyNote } from './components/StickyNote';
import { Shape } from './components/Shape';
import { LineShape } from './components/LineShape';
import { Frame } from './components/Frame';
import { Square, Circle, Plus, MousePointer2, MessageSquare, Send, Layout, Folder, Users, Sun, Moon, Maximize, ChevronDown, Triangle, Trash2, Minus, Frame as FrameIcon } from 'lucide-react';
import './App.css';

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
      <div className="color-history">
        <label>History</label>
        <div className="history-grid">
          {data.history.map((c, i) => (
            <div
              key={`${c}-${i}`}
              className="color-swatch"
              style={{backgroundColor: c}}
              onClick={() => {
                setOpacity(parseOpacity(c));
                onSelect(type, c);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function BoardSelector({ onSelectBoard, darkMode, setDarkMode }) {
  const { boards, loading, createBoard } = useBoardsList();
  const globalPresence = useGlobalPresence();
  const [showModal, setShowModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newGroupName, setNewGroupName] = useState('General');
  
  const handleAddBoard = (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    createBoard(newBoardName.trim(), newGroupName.trim() || 'General');
    setNewBoardName('');
    setNewGroupName('General');
    setShowModal(false);
  };

  if (loading) return <div className="loading">Loading boards...</div>;

  // Group boards
  const groups = boards.reduce((acc, board) => {
    const g = board.group || 'General';
    if (!acc[g]) acc[g] = [];
    acc[g].push(board);
    return acc;
  }, {});

  return (
    <div className="board-selector-container">
      <div className="selector-header">
        <div className="dashboard-top">
          <h1>Global Boards</h1>
          <button 
            className="theme-toggle-inline"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <p>Everyone can see and edit all boards</p>
      </div>
      
      <div className="groups-list">
        {Object.entries(groups).map(([groupName, groupBoards]) => (
          <div key={groupName} className="board-group">
            <h2 className="group-title"><Folder size={20} /> {groupName}</h2>
            <div className="boards-grid">
              {groupBoards.map(board => (
                <div 
                  key={board.id} 
                  className="board-card"
                  onClick={() => onSelectBoard(board.id)}
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
            <p>No global boards found. Create the first one!</p>
          </div>
        )}
      </div>

      <button className="create-board-fab" onClick={() => setShowModal(true)} title="Create New Global Board">
        <Plus size={32} />
      </button>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Create New Board</h2>
            <form onSubmit={handleAddBoard}>
              <div className="form-group">
                <label>Board Name</label>
                <input 
                  type="text" 
                  value={newBoardName} 
                  onChange={(e) => setNewBoardName(e.target.value)} 
                  placeholder="My Creative Board"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Group (optional)</label>
                <input 
                  type="text" 
                  value={newGroupName} 
                  onChange={(e) => setNewGroupName(e.target.value)} 
                  placeholder="General"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>Cancel</button>
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
  const [boardId, setBoardId] = useState(null);
  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

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
  const board = useBoard(boardId);
  const ai = useAI(boardId, {
    addObject: board?.addObject,
    updateObject: board?.updateObject
  }, board?.objects);

  const [selectedId, setSelectedId] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [shapeColors, setShapeColors] = useState(() => {
    const saved = localStorage.getItem(`shapeColors_${boardId}`);
    return saved ? JSON.parse(saved) : {
      rectangle: { active: '#bfdbfe', history: ['#bfdbfe', '#fbcfe8', '#e9d5ff', '#fef08a', '#bbf7d0'] },
      circle: { active: '#fbcfe8', history: ['#bfdbfe', '#fbcfe8', '#e9d5ff', '#fef08a', '#bbf7d0'] },
      triangle: { active: '#e9d5ff', history: ['#bfdbfe', '#fbcfe8', '#e9d5ff', '#fef08a', '#bbf7d0'] },
      line: { active: '#3b82f6', history: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'] }
    };
  });
  const [showColorPicker, setShowColorPicker] = useState(null);

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

  useEffect(() => {
    if (boardId) {
      localStorage.setItem(`shapeColors_${boardId}`, JSON.stringify(shapeColors));
    }
  }, [shapeColors, boardId]);

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
    board.addObject({
      type: 'sticky',
      text: 'New Sticky Note',
      x: (window.innerWidth / 2 - stagePos.x) / stageScale,
      y: (window.innerHeight / 2 - stagePos.y) / stageScale,
      color: '#fef08a', // Always pastel yellow for sticky notes
      userId: user.uid
    });
  };

  const handleAddShape = (type) => {
    board.addObject({
      type,
      x: (window.innerWidth / 2 - stagePos.x) / stageScale,
      y: (window.innerHeight / 2 - stagePos.y) / stageScale,
      width: 100,
      height: 100,
      color: shapeColors[type].active,
      userId: user.uid
    });
  };

  const handleAddFrame = () => {
    board.addObject({
      type: 'frame',
      x: (window.innerWidth / 2 - stagePos.x) / stageScale - 200,
      y: (window.innerHeight / 2 - stagePos.y) / stageScale - 150,
      width: 400,
      height: 300,
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
    return <BoardSelector onSelectBoard={setBoardId} darkMode={darkMode} setDarkMode={setDarkMode} />;
  }

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-left">
          <span className="logo-text" onClick={() => setBoardId(null)} style={{cursor: 'pointer'}}>
            CollabBoard
          </span>
          <span className="board-badge">/{boardId}</span>
          <div className="toolbar">
            <button 
              className={!selectedId ? 'active' : ''} 
              onClick={() => setSelectedId(null)}
              title="Select"
            >
              <MousePointer2 size={18} />
            </button>
            
            <div className="tool-split-button">
              <button onClick={handleAddSticky} title="Add Sticky Note">
                <Plus size={14} />
                <Square size={18} fill="#fef08a" stroke="#ca8a04" />
              </button>
            </div>

            <div className="tool-split-button">
              <button onClick={() => handleAddShape('rectangle')} title="Add Square">
                <Square size={18} fill={shapeColors.rectangle.active} stroke="currentColor" />
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

            <div className="tool-split-button">
              <button onClick={() => handleAddShape('circle')} title="Add Circle">
                <Circle size={18} fill={shapeColors.circle.active} stroke="currentColor" />
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

            <div className="tool-split-button">
              <button onClick={() => handleAddShape('triangle')} title="Add Triangle">
                <Triangle size={18} fill={shapeColors.triangle.active} stroke="currentColor" />
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

            <div className="tool-split-button">
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

            <button onClick={handleAddFrame} title="Add Frame">
              <FrameIcon size={18} />
            </button>
          </div>
        </div>
        <div className="header-right">
          <PresenceAvatars presentUsers={presence.presentUsers} currentUserId={user.uid} />
          <button onClick={() => setBoardId(null)} className="change-board-btn" title="Global Dashboard">
            <Layout size={18} />
          </button>
          <span className="user-name">{user.displayName}</span>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </div>
      <div className="board-wrapper">
        <Stage
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
              fill={darkMode ? '#030712' : '#f9fafb'}
            />
            {Object.values(board.objects)
              .sort((a, b) => (a.type === 'frame' ? -1 : 0) - (b.type === 'frame' ? -1 : 0))
              .map((obj) => {
              if (obj.type === 'frame') {
                return (
                  <Frame
                    key={obj.id}
                    {...obj}
                    isSelected={obj.id === selectedId}
                    onSelect={setSelectedId}
                    onDragEnd={board.updateObject}
                    onTransformEnd={board.updateObject}
                    onUpdate={board.updateObject}
                    onDelete={board.deleteObject}
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
                    onDragEnd={board.updateObject}
                    onTransformEnd={board.updateObject}
                    onUpdate={board.updateObject}
                    onDelete={board.deleteObject}
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
                    onDragEnd={board.updateObject}
                    onTransformEnd={board.updateObject}
                    onUpdate={board.updateObject}
                    onDelete={board.deleteObject}
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
                    onDragEnd={board.updateObject}
                    onTransformEnd={board.updateObject}
                    onDelete={board.deleteObject}
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

        {selectedId && board.objects[selectedId] && (
          <button 
            className="delete-fab"
            onClick={() => {
              board.deleteObject(selectedId);
              setSelectedId(null);
            }}
            title="Delete Selected"
          >
            <Trash2 size={24} />
          </button>
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
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
