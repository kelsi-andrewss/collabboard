import React from 'react';
import { MessageSquare, Sun, Moon, Maximize } from 'lucide-react';
import './FABButtons.css';

function FABButtonsInner({ state, handlers }) {
  const { showAI, darkMode, isOffCenter } = state;
  const { setShowAI, setDarkMode, handleRecenter } = handlers;

  return (
    <>
      <div className="fab-cluster">
        <button
          className="ai-fab"
          onClick={() => setShowAI(!showAI)}
          title="Toggle AI Assistant"
          style={{ position: 'static' }}
        >
          <MessageSquare size={24} />
        </button>
      </div>

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
    </>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.showAI === ns.showAI &&
    ps.darkMode === ns.darkMode &&
    ps.isOffCenter === ns.isOffCenter
  );
}

export const FABButtons = React.memo(FABButtonsInner, areEqual);
