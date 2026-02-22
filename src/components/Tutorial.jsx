import React, { useState, useEffect, useCallback } from 'react';
import './Tutorial.css';

const STEPS = [
  {
    target: '.toolbar',
    title: 'Create Objects',
    description: 'Add sticky notes, shapes, frames, text, and connectors to your board. Each tool has a color picker — click the arrow next to it to change colors.',
    position: 'below',
  },
  {
    target: '.board-wrapper',
    title: 'Navigate Your Board',
    description: 'Drag the canvas to pan around. Scroll or pinch to zoom. Click any object to select it, then drag to move or use the handles to resize.',
    position: 'center',
  },
  {
    target: '.snap-toggle',
    title: 'Select & Grid Tools',
    description: 'Switch between select and pan modes. Toggle snap-to-grid to align objects to a grid as you drag or resize them.',
    position: 'below',
  },
  {
    target: '.ai-fab',
    title: 'AI Assistant',
    description: 'Click here to open the AI panel. Ask it to create boards, arrange objects, or generate layouts for you.',
    position: 'left',
  },
];

const HOME_STEPS = [
  {
    target: '.controls-bar',
    title: 'Your Boards',
    description: 'This is your home page. All your boards appear here. Click any board to open it, or use the filters to sort and search.',
    position: 'below',
  },
  {
    target: '.new-board-btn',
    title: 'Create a Board',
    description: 'Click here to create a new board. Give it a name and start collaborating.',
    position: 'below',
  },
  {
    target: '.new-group-btn',
    title: 'Organize with Groups',
    description: 'Groups let you organize boards together. Drag boards into groups, create subgroups, and share access with teammates.',
    position: 'below',
  },
];

const STORAGE_KEY = 'collaboard_tutorial_done';
const HOME_STORAGE_KEY = 'collaboard_home_tutorial_done';

export function Tutorial({ onComplete, steps = STEPS, storageKey = STORAGE_KEY }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    const el = document.querySelector(steps[step].target);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step, steps]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const handleNext = () => {
    if (step < steps.length - 1) {
      setRect(null);
      setStep(step + 1);
    } else {
      localStorage.setItem(storageKey, 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem(storageKey, 'true');
    onComplete();
  };

  const current = steps[step];
  const isCenter = current.position === 'center';
  const pad = 8;

  // Spotlight style
  const spotlightStyle = rect && !isCenter ? {
    position: 'fixed',
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 8,
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
    zIndex: 9998,
    pointerEvents: 'none',
  } : null;

  // Tooltip positioning
  let tooltipStyle = { position: 'fixed', zIndex: 9999, maxWidth: 300 };
  if (isCenter) {
    tooltipStyle.top = '50%';
    tooltipStyle.left = '50%';
    tooltipStyle.transform = 'translate(-50%, -50%)';
  } else if (rect) {
    if (current.position === 'below') {
      tooltipStyle.top = rect.bottom + pad + 12;
      // Clamp horizontally so tooltip doesn't go off right edge
      tooltipStyle.left = Math.max(8, Math.min(rect.left, window.innerWidth - 316));
    } else if (current.position === 'left') {
      // Anchor tooltip's bottom to element's bottom so it grows upward, staying in viewport
      tooltipStyle.bottom = Math.max(8, window.innerHeight - rect.bottom);
      tooltipStyle.right = window.innerWidth - rect.left + 12;
    }
  }

  return (
    <>
      {/* Single persistent full-screen backdrop */}
      <div style={{
        position: 'fixed', inset: 0,
        background: (!spotlightStyle) ? 'rgba(0,0,0,0.6)' : 'transparent',
        zIndex: 9997,
      }} />

      {/* Spotlight — only when rect is known and not center */}
      {spotlightStyle && <div style={spotlightStyle} />}

      {/* Click blocker */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={handleNext} />

      {/* Tooltip */}
      <div className="tutorial-tooltip" style={tooltipStyle}>
        <div className="tutorial-step-indicator">
          {step + 1} / {steps.length}
        </div>
        <h3 className="tutorial-title">{current.title}</h3>
        <p className="tutorial-desc">{current.description}</p>
        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={handleSkip}>Skip</button>
          <button className="tutorial-next" onClick={handleNext}>
            {step < steps.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </>
  );
}

Tutorial.shouldShow = () => !localStorage.getItem(STORAGE_KEY);
Tutorial.shouldShowHome = () => !localStorage.getItem(HOME_STORAGE_KEY);

export { HOME_STEPS };
