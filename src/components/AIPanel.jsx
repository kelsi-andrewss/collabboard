import React from 'react';
import { Send } from 'lucide-react';

function AIPanelInner({ state, handlers }) {
  const { showAI, aiPrompt, isTyping, error } = state;
  const { handleAISubmit, setAiPrompt, clearError } = handlers;

  if (!showAI) return null;

  return (
    <div className="ai-panel">
      <div className="ai-header">AI Board Agent</div>
      <form onSubmit={handleAISubmit} className="ai-input-area">
        <input
          type="text"
          placeholder="Ask AI to draw something..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          autoFocus
          disabled={isTyping}
        />
        <button type="submit" disabled={isTyping}>
          <Send size={16} />
        </button>
      </form>
      {isTyping && <div className="ai-status">AI is thinking...</div>}
      {error && (
        <div className="ai-error" onClick={() => clearError()}>
          {error}
          <span className="ai-error-dismiss">dismiss</span>
        </div>
      )}
    </div>
  );
}

// Update this comparator if new state props are added
function areEqual(prev, next) {
  const ps = prev.state, ns = next.state;
  return (
    ps.showAI === ns.showAI &&
    ps.aiPrompt === ns.aiPrompt &&
    ps.isTyping === ns.isTyping &&
    ps.error === ns.error
  );
}

export const AIPanel = React.memo(AIPanelInner, areEqual);
