import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import './AIPanel.css';

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AIPanelInner({ state, handlers }) {
  const { showAI, aiPrompt, isTyping, error, chatHistory, isHistoryLoading } = state;
  const { handleAISubmit, setAiPrompt, clearError } = handlers;
  const historyEndRef = useRef(null);
  const inputRef = useRef(null);

  async function handleSubmitAndRefocus(e) {
    await handleAISubmit(e);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (showAI && historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, showAI]);

  if (!showAI) return null;

  return (
    <div className="ai-panel">
      <div className="ai-header">AI Board Agent</div>
      {isHistoryLoading ? (
        <div className="ai-history-loading">Loading history...</div>
      ) : (
        chatHistory && chatHistory.length > 0 && (
          <div className="ai-chat-history">
            {chatHistory.map((entry, i) => (
              <div key={i} className={`ai-message ai-message--${entry.role}`}>
                <span className="ai-message-role">{entry.role === 'user' ? 'You' : 'AI'}</span>
                <span className="ai-message-timestamp">{formatTimestamp(entry.timestamp)}</span>
                <p className="ai-message-text">{entry.message}</p>
              </div>
            ))}
            <div ref={historyEndRef} />
          </div>
        )
      )}
      <form onSubmit={handleSubmitAndRefocus} className="ai-input-area">
        <input
          ref={inputRef}
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
    ps.error === ns.error &&
    ps.chatHistory === ns.chatHistory &&
    ps.isHistoryLoading === ns.isHistoryLoading
  );
}

export const AIPanel = React.memo(AIPanelInner, areEqual);
