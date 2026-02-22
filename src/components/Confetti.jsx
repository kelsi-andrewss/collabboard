import React, { useEffect, useRef, useMemo } from 'react';

const COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
const PARTICLE_COUNT = 24;

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
    const distance = 60 + Math.random() * 80;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const color = COLORS[i % COLORS.length];
    const size = 6 + Math.floor(Math.random() * 6);
    const delay = Math.random() * 0.15;
    const rotate = Math.floor(Math.random() * 360);
    const isRect = Math.random() > 0.5;
    return { dx, dy, color, size, delay, rotate, isRect, key: i };
  });
}

export function Confetti({ x, y, onDone }) {
  const timerRef = useRef(null);
  const particles = useMemo(() => generateParticles(), []);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      onDone();
    }, 1500);
    return () => {
      clearTimeout(timerRef.current);
    };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <style>{`
        @keyframes confetti-burst {
          0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate(var(--dx), var(--dy)) rotate(var(--rotate));
            opacity: 0;
          }
        }
      `}</style>
      {particles.map(({ dx, dy, color, size, delay, rotate, isRect, key }) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            width: isRect ? size : size * 0.7,
            height: isRect ? size * 0.5 : size * 0.7,
            borderRadius: isRect ? '2px' : '50%',
            backgroundColor: color,
            left: -size / 2,
            top: -size / 2,
            '--dx': `${dx}px`,
            '--dy': `${dy}px`,
            '--rotate': `${rotate}deg`,
            animation: `confetti-burst 1.5s ease-out ${delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
