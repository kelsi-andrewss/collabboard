import React from 'react';
import { MessageSquare, Sun, Moon, Maximize } from 'lucide-react';

function FABButtonsInner({ state, handlers }) {
  const { showAI, darkMode, isOffCenter } = state;
  const { setShowAI, setDarkMode, handleRecenter } = handlers;

  return (
    <>
      <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <button
          className="ai-fab"
          disabled
          style={{ opacity: 0.45, cursor: 'not-allowed', position: 'static' }}
        >
          <MessageSquare size={24} />
        </button>
        <div style={{
          maxWidth: 220,
          fontSize: '0.75rem',
          lineHeight: '1.4',
          color: '#fca5a5',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          padding: '8px 15px',
          textAlign: 'right',
          pointerEvents: 'none',
          wordBreak: 'break-word',
        }}>
          AI Currently Disabled Due to Billing Issues: Firebase Doesn't Like Virtual Cards :(
        </div>
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
