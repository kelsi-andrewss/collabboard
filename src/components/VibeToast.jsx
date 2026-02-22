import { useState, useEffect } from 'react';

export function VibeToast({ vibe, onDone }) {
  const [phase, setPhase] = useState('in');

  useEffect(() => {
    const fadeIn = setTimeout(() => setPhase('visible'), 50);
    const startFadeOut = setTimeout(() => setPhase('out'), 2700);
    const done = setTimeout(() => { onDone(); }, 3200);
    return () => {
      clearTimeout(fadeIn);
      clearTimeout(startFadeOut);
      clearTimeout(done);
    };
  }, [onDone]);

  const isFading = phase === 'in' || phase === 'out';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--md-sys-spacing-6, 24px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: isFading ? 'none' : 'auto',
        opacity: phase === 'visible' ? 1 : 0,
        transition: 'opacity 250ms var(--md-sys-motion-easing-standard, ease)',
        background: 'var(--md-sys-color-inverse-surface)',
        color: 'var(--md-sys-color-inverse-on-surface)',
        padding: 'var(--md-sys-spacing-3, 12px) var(--md-sys-spacing-5, 20px)',
        borderRadius: 'var(--md-sys-shape-corner-medium, 12px)',
        boxShadow: 'var(--md-sys-elevation-3)',
        fontSize: 'var(--md-sys-typescale-body-large-size, 1rem)',
        lineHeight: 'var(--md-sys-typescale-body-large-line-height, 1.5)',
        whiteSpace: 'nowrap',
      }}
    >
      Board vibe: <strong>{vibe}</strong>
    </div>
  );
}
