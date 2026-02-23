import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import './AIPanel.css';

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AIPanelInner({ state, handlers }) {
  const { showAI, aiPrompt, isTyping, error, chatHistory, isHistoryLoading, pendingDeletions, pendingBoardDeletion, suggestedPrompts } = state;
  const { handleAISubmit, setAiPrompt, clearError, confirmDeletions, cancelDeletions, confirmBoardDeletion, cancelBoardDeletion } = handlers;
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

  const hasPendingDeletions = pendingDeletions && pendingDeletions.length > 0;
  const hasPendingBoardDeletion = !!pendingBoardDeletion;

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
      {hasPendingDeletions && (
        <div className="ai-delete-confirm">
          <p className="ai-delete-confirm-title">
            The AI wants to delete {pendingDeletions.length} object{pendingDeletions.length !== 1 ? 's' : ''}:
          </p>
          <ul className="ai-delete-confirm-list">
            {pendingDeletions.map(({ objectId, label }) => (
              <li key={objectId}>{label}</li>
            ))}
          </ul>
          <div className="ai-delete-confirm-actions">
            <button className="ai-delete-confirm-btn ai-delete-confirm-btn--cancel" onClick={cancelDeletions}>
              Cancel
            </button>
            <button className="ai-delete-confirm-btn ai-delete-confirm-btn--delete" onClick={confirmDeletions}>
              Delete
            </button>
          </div>
        </div>
      )}
      {hasPendingBoardDeletion && (
        <div className="ai-delete-confirm">
          <p className="ai-delete-confirm-title">
            The AI wants to delete the board: <strong>{pendingBoardDeletion.boardName}</strong>
          </p>
          <div className="ai-delete-confirm-actions">
            <button className="ai-delete-confirm-btn ai-delete-confirm-btn--cancel" onClick={cancelBoardDeletion}>
              Cancel
            </button>
            <button className="ai-delete-confirm-btn ai-delete-confirm-btn--delete" onClick={confirmBoardDeletion}>
              Delete Board
            </button>
          </div>
        </div>
      )}
      {suggestedPrompts && suggestedPrompts.length > 0 && !isTyping && (
        <div className="ai-suggested-prompts">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="ai-suggested-chip"
              onClick={() => setAiPrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmitAndRefocus} className="ai-input-area">
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask AI to draw something..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          autoFocus
          disabled={isTyping || hasPendingDeletions || hasPendingBoardDeletion}
        />
        <button type="submit" disabled={isTyping || hasPendingDeletions || hasPendingBoardDeletion}>
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
    ps.isHistoryLoading === ns.isHistoryLoading &&
    ps.pendingDeletions === ns.pendingDeletions &&
    ps.pendingBoardDeletion === ns.pendingBoardDeletion &&
    ps.suggestedPrompts === ns.suggestedPrompts
  );
}

export const AIPanel = React.memo(AIPanelInner, areEqual);
