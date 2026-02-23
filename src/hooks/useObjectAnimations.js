import { useRef, useCallback, useState } from 'react';

export function useObjectAnimations() {
  // Map<id, { state: 'spawning' | 'idle' | 'dying', onComplete?: () => void }>
  const registryRef = useRef(new Map());
  // Increment to signal components that registry changed
  const [version, setVersion] = useState(0);

  const bumpVersion = () => setVersion(v => v + 1);

  const isReducedMotion = () =>
    document.documentElement.dataset.reducedMotion !== undefined;

  const markSpawning = useCallback((id) => {
    if (isReducedMotion()) {
      registryRef.current.set(id, { state: 'idle' });
      return;
    }
    registryRef.current.set(id, { state: 'spawning' });
    bumpVersion();
  }, []);

  const markDying = useCallback((id, onComplete) => {
    if (isReducedMotion()) {
      onComplete?.();
      return;
    }
    registryRef.current.set(id, { state: 'dying', onComplete });
    bumpVersion();
  }, []);

  const getAnimationState = useCallback((id) => {
    return registryRef.current.get(id)?.state ?? 'idle';
  }, []);

  const getOnComplete = useCallback((id) => {
    return registryRef.current.get(id)?.onComplete ?? null;
  }, []);

  const clearAnimation = useCallback((id) => {
    registryRef.current.set(id, { state: 'idle' });
  }, []);

  return { markSpawning, markDying, getAnimationState, getOnComplete, clearAnimation, registryRef, version };
}
