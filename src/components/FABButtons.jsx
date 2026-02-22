import React, { useState, useEffect } from 'react';
import { MessageSquare, Maximize } from 'lucide-react';
import './FABButtons.css';

function FABButtonsInner({ state, handlers }) {
  const { showAI, isOffCenter, canEdit } = state;
  const { setShowAI, handleRecenter } = handlers;
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    const hasClicked = sessionStorage.getItem('aiClicked');
    setPulseActive(!hasClicked);
  }, []);

  const handleAIClick = () => {
    if (!sessionStorage.getItem('aiClicked')) {
      sessionStorage.setItem('aiClicked', '1');
      setPulseActive(false);
    }
    setShowAI(!showAI);
  };

  return (
    <>
      {canEdit !== false && (
        <button
          data-fab-item="ai"
          className={`ai-fab${showAI ? ' active' : ''}${pulseActive ? ' pulse-active' : ''}`}
          onClick={handleAIClick}
          title="Toggle AI Assistant"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {isOffCenter && (
        <button
          data-fab-item="recenter"
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
    ps.isOffCenter === ns.isOffCenter &&
    ps.canEdit === ns.canEdit
  );
}

export const FABButtons = React.memo(FABButtonsInner, areEqual);
