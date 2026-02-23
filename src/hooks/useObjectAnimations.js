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

  // markAISpawning orchestrates a wave entrance for AI batch-created objects.
  // frameIds: array of IDs for Pass-1 frames (animate immediately).
  // childrenByFrame: { [frameId]: [childId, ...] } for Pass-2 objects.
  // Top-level non-frame objects from Pass 2 should be passed with a null/undefined key:
  //   childrenByFrame[null] = [id, id, ...]  — they stagger after all frame-children.
  const markAISpawning = useCallback((frameIds, childrenByFrame) => {
    if (isReducedMotion()) {
      for (const id of frameIds) {
        registryRef.current.set(id, { state: 'spawning' });
      }
      const allChildren = Object.values(childrenByFrame).flat();
      for (const id of allChildren) {
        registryRef.current.set(id, { state: 'spawning' });
      }
      bumpVersion();
      return;
    }

    // Mark all frames immediately
    for (const id of frameIds) {
      registryRef.current.set(id, { state: 'spawning' });
    }
    if (frameIds.length > 0) {
      bumpVersion();
    }

    // Flatten all children into a single stagger sequence:
    // iterate through each frame's children in order, then any top-level children (null key).
    const childSequence = [];
    for (const id of frameIds) {
      const children = childrenByFrame[id];
      if (children && children.length > 0) {
        childSequence.push(...children);
      }
    }
    // Top-level non-frame objects (keyed by null or undefined)
    const topLevel = childrenByFrame[null] ?? childrenByFrame[undefined] ?? [];
    childSequence.push(...topLevel);

    if (childSequence.length === 0) return;

    // Stagger children: first child fires after 250ms, each subsequent child 80ms later.
    // Uses setTimeout chains so each fires relative to the previous markSpawning call.
    const scheduleChild = (index, delay) => {
      setTimeout(() => {
        const id = childSequence[index];
        registryRef.current.set(id, { state: 'spawning' });
        bumpVersion();
        if (index + 1 < childSequence.length) {
          scheduleChild(index + 1, 80);
        }
      }, delay);
    };

    scheduleChild(0, 250);
  }, []);

  return { markSpawning, markDying, getAnimationState, getOnComplete, clearAnimation, registryRef, version, markAISpawning };
}
