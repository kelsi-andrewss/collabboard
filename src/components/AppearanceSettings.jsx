import React, { useState } from 'react';
import { X, Check, Palette } from 'lucide-react';
import './AppearanceSettings.css';

const THEME_COLORS = [
  { name: 'indigo', hex: '#4355b9' },
  { name: 'teal',   hex: '#006a6a' },
  { name: 'rose',   hex: '#b5416a' },
  { name: 'amber',  hex: '#8b5000' },
  { name: 'violet', hex: '#7b4ea0' },
  { name: 'sage',   hex: '#4e6355' },
];

export function AppearanceSettings({ preferences, updatePreference, onClose }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
  };

  return (
    <div
      className={`modal-overlay${isExiting ? ' is-exiting' : ''}`}
      onClick={handleClose}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && isExiting) {
          setIsExiting(false);
          onClose();
        }
      }}
    >
      <div className="modal-card appearance-settings" onClick={e => e.stopPropagation()}>
        <div className="appearance-header">
          <h2>Appearance</h2>
          <button className="appearance-close" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="appearance-section">
          <h3>Theme Color</h3>
          <div className="theme-grid">
            {THEME_COLORS.map(({ name, hex }) => (
              <button
                key={name}
                className={`theme-swatch${preferences.themeColor === name ? ' theme-swatch--active' : ''}`}
                style={{ '--swatch-color': hex }}
                onClick={() => updatePreference('themeColor', name)}
                aria-label={`${name} theme`}
                aria-pressed={preferences.themeColor === name}
              >
                {preferences.themeColor === name && <Check size={18} className="swatch-check" />}
              </button>
            ))}
          </div>
        </div>

        <div className="appearance-section">
          <h3>Dark Mode</h3>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Dark Mode</span>
              <span className="toggle-description">Switch between light and dark interface</span>
            </div>
            <button
              className={`toggle-switch${preferences.darkMode ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.darkMode}
              aria-label="Dark mode"
              onClick={() => updatePreference('darkMode', !preferences.darkMode)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </div>

        <div className="appearance-section">
          <h3>Accessibility</h3>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">High Contrast</span>
              <span className="toggle-description">Increases text contrast for better readability</span>
            </div>
            <button
              className={`toggle-switch${preferences.highContrast ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.highContrast}
              aria-label="High contrast"
              onClick={() => updatePreference('highContrast', !preferences.highContrast)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Reduced Motion</span>
              <span className="toggle-description">Disables animations and transitions</span>
            </div>
            <button
              className={`toggle-switch${preferences.reducedMotion ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.reducedMotion}
              aria-label="Reduced motion"
              onClick={() => updatePreference('reducedMotion', !preferences.reducedMotion)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Large Text</span>
              <span className="toggle-description">Increases text size by ~20%</span>
            </div>
            <button
              className={`toggle-switch${preferences.largeText ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.largeText}
              aria-label="Large text"
              onClick={() => updatePreference('largeText', !preferences.largeText)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
        </div>

        <div className="appearance-section">
          <h3>Features</h3>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Confetti &amp; Achievements</span>
              <span className="toggle-description">Show confetti and unlock achievements on the board</span>
            </div>
            <button
              className={`toggle-switch${preferences.enableConfetti ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.enableConfetti}
              aria-label="Confetti and achievements"
              onClick={() => updatePreference('enableConfetti', !preferences.enableConfetti)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Emoji Reactions</span>
              <span className="toggle-description">Double-click the canvas to send emoji reactions</span>
            </div>
            <button
              className={`toggle-switch${preferences.enableReactions ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.enableReactions}
              aria-label="Emoji reactions"
              onClick={() => updatePreference('enableReactions', !preferences.enableReactions)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Follow Mode</span>
              <span className="toggle-description">Follow another user's viewport by clicking their avatar</span>
            </div>
            <button
              className={`toggle-switch${preferences.enableFollowMode ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.enableFollowMode}
              aria-label="Follow mode"
              onClick={() => updatePreference('enableFollowMode', !preferences.enableFollowMode)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Vibe Check</span>
              <span className="toggle-description">AI-powered mood analysis of your board</span>
            </div>
            <button
              className={`toggle-switch${preferences.enableVibeCheck ? ' toggle-switch--on' : ''}`}
              role="switch"
              aria-checked={preferences.enableVibeCheck}
              aria-label="Vibe check"
              onClick={() => updatePreference('enableVibeCheck', !preferences.enableVibeCheck)}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="toggle-row">
            <div className="toggle-label-group">
              <span className="toggle-label">Default Tool</span>
              <span className="toggle-description">Tool selected when opening a board</span>
            </div>
            <div className="segmented-control" role="group" aria-label="Default tool">
              <button
                className={`segmented-btn${preferences.defaultToolMode === 'pan' ? ' segmented-btn--active' : ''}`}
                aria-pressed={preferences.defaultToolMode === 'pan'}
                onClick={() => updatePreference('defaultToolMode', 'pan')}
              >
                Pan
              </button>
              <button
                className={`segmented-btn${preferences.defaultToolMode === 'select' ? ' segmented-btn--active' : ''}`}
                aria-pressed={preferences.defaultToolMode === 'select'}
                onClick={() => updatePreference('defaultToolMode', 'select')}
              >
                Select
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
