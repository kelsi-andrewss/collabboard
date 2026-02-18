import React, { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    target: '.toolbar',
    title: 'Create Objects',
    description: 'Use these tools to add sticky notes, shapes, lines, and frames to your board. Click the arrow to change colors.',
    position: 'below',
  },
  {
    target: '.board-wrapper',
    title: 'Navigate Your Board',
    description: 'Drag the canvas to pan around. Scroll to zoom in and out. Click any object to select it.',
    position: 'center',
  },
  {
    target: '.ai-fab',
    title: 'AI Assistant',
    description: 'Click here to open the AI panel. Ask it to create boards, arrange objects, or generate layouts for you.',
    position: 'left',
  },
  {
    target: '.snap-toggle',
    title: 'Snap to Grid',
    description: 'Toggle this to enable grid snapping. Objects will align to a grid when you drag or resize them.',
    position: 'below',
  },
];

const STORAGE_KEY = 'collaboard_tutorial_done';

export function Tutorial({ onComplete }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    const el = document.querySelector(STEPS[step].target);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setRect(null);
      setStep(step + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  };

  const current = STEPS[step];
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
          {step + 1} / {STEPS.length}
        </div>
        <h3 className="tutorial-title">{current.title}</h3>
        <p className="tutorial-desc">{current.description}</p>
        <div className="tutorial-actions">
          <button className="tutorial-skip" onClick={handleSkip}>Skip</button>
          <button className="tutorial-next" onClick={handleNext}>
            {step < STEPS.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </>
  );
}

Tutorial.shouldShow = () => !localStorage.getItem(STORAGE_KEY);
