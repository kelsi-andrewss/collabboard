import React from 'react';
import { X, Trophy } from 'lucide-react';
import './AchievementsPanel.css';

function formatDate(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AchievementsPanel({ achievements, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card achievements-panel" onClick={e => e.stopPropagation()}>
        <div className="achievements-header">
          <div className="achievements-title">
            <Trophy size={20} className="achievements-title-icon" />
            <h2>Achievements</h2>
          </div>
          <button className="achievements-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {achievements.length === 0 ? (
          <div className="achievements-empty">
            <Trophy size={40} className="achievements-empty-icon" />
            <p>No achievements yet — start creating!</p>
          </div>
        ) : (
          <ul className="achievements-list">
            {achievements.map(a => (
              <li key={a.id} className="achievement-card">
                <div className="achievement-icon">
                  <Trophy size={22} />
                </div>
                <div className="achievement-body">
                  <span className="achievement-title">{a.title || a.id}</span>
                  {a.description && (
                    <span className="achievement-description">{a.description}</span>
                  )}
                  <div className="achievement-meta">
                    {a.unlockedAt && (
                      <span className="achievement-date">{formatDate(a.unlockedAt)}</span>
                    )}
                    {a.count > 1 && (
                      <span className="achievement-count">x{a.count}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
