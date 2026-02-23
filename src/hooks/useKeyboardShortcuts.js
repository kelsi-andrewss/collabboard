import { useEffect } from 'react';
import { MIN_SCALE, MAX_SCALE } from '../handlers/stageHandlers.js';

export function useKeyboardShortcuts({
  canEditRef,
  boardRef,
  selectedIdRef,
  selectedIdsRef,
  objectsRef,
  konamiSequenceRef,
  canvasWrapperRef,
  stageRef,
  isFollowingRef,
  handleExitFollowRef,
  connectorFirstPointRef,
  pendingToolRef,
  clipboardRef,
  trackedAddObjectRef,
  handleDeleteRef,
  handleDeleteMultipleRef,
  handleDuplicateRef,
  handleDuplicateMultipleRef,
  setSelectedId,
  setSelectedIds,
  setConnectorFirstPoint,
  setPendingTool,
  setPendingToolCount,
  setStageScale,
  setStagePos,
  setShowShortcutsModal,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable;

      const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
      const seq = konamiSequenceRef.current;
      seq.push(e.key);
      if (seq.length > 10) seq.splice(0, seq.length - 10);
      if (seq.length === 10 && seq.every((k, i) => k === KONAMI[i])) {
        konamiSequenceRef.current = [];
        const wrapper = canvasWrapperRef.current;
        if (wrapper) {
          wrapper.classList.add('konami-spin');
          setTimeout(() => wrapper.classList.remove('konami-spin'), 700);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (!canEditRef.current) return;
        e.preventDefault();
        const b = boardRef.current;
        if (b.canUndo) b.undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const b = boardRef.current;
        if (b.canRedo) b.redo();
        return;
      }

      if (isEditing) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal(v => !v);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!canEditRef.current) return;
        const ids = selectedIdsRef.current;
        if (ids.size > 0) {
          e.preventDefault();
          handleDeleteMultipleRef.current?.(ids);
          setSelectedIds(new Set());
          return;
        }
        const id = selectedIdRef.current;
        if (id) {
          e.preventDefault();
          handleDeleteRef.current?.(id);
        }
        return;
      }

      if (e.key === 'Escape') {
        if (isFollowingRef.current) {
          e.preventDefault();
          handleExitFollowRef.current();
          return;
        }
        if (connectorFirstPointRef.current !== null) {
          e.preventDefault();
          setConnectorFirstPoint(null);
          return;
        }
        if (pendingToolRef.current) {
          e.preventDefault();
          setPendingTool(null);
          setPendingToolCount(0);
          return;
        }
        if (selectedIdsRef.current.size > 0) {
          e.preventDefault();
          setSelectedIds(new Set());
          return;
        }
        const id = selectedIdRef.current;
        if (id) {
          e.preventDefault();
          setSelectedId(null);
          const stage = stageRef.current;
          stage?.findOne('Transformer')?.nodes([]);
          stage?.batchDraw();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const ids = selectedIdsRef.current;
        const snapshots = [];
        if (ids.size > 0) {
          for (const id of ids) {
            const obj = objectsRef.current[id];
            if (!obj) continue;
            const { id: _id, createdAt, updatedAt, ...rest } = obj;
            snapshots.push(rest);
          }
        } else {
          const id = selectedIdRef.current;
          if (id) {
            const obj = objectsRef.current[id];
            if (obj) {
              const { id: _id, createdAt, updatedAt, ...rest } = obj;
              snapshots.push(rest);
            }
          }
        }
        clipboardRef.current = snapshots;
        if (snapshots.length > 0 && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const ids = selectedIdsRef.current;
        const snapshots = [];
        if (ids.size > 0) {
          for (const id of ids) {
            const obj = objectsRef.current[id];
            if (!obj) continue;
            const { id: _id, createdAt, updatedAt, ...rest } = obj;
            snapshots.push(rest);
          }
          clipboardRef.current = snapshots;
          if (snapshots.length > 0 && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
          }
          handleDeleteMultipleRef.current?.(ids);
          setSelectedIds(new Set());
        } else {
          const id = selectedIdRef.current;
          if (id) {
            const obj = objectsRef.current[id];
            if (obj) {
              const { id: _id, createdAt, updatedAt, ...rest } = obj;
              snapshots.push(rest);
            }
            clipboardRef.current = snapshots;
            if (snapshots.length > 0 && navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(JSON.stringify({ collabboard: true, objects: snapshots })).catch(() => {});
            }
            handleDeleteRef.current?.(id);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const doPaste = async () => {
          let items = clipboardRef.current;
          if (navigator.clipboard?.readText) {
            try {
              const text = await navigator.clipboard.readText();
              const parsed = JSON.parse(text);
              if (parsed?.collabboard === true && Array.isArray(parsed.objects) && parsed.objects.length > 0) {
                items = parsed.objects;
                clipboardRef.current = items;
              }
            } catch {
            }
          }
          if (items.length === 0) return;
          const OFFSET = 20;
          const refs = await Promise.all(
            items.map((snapshot, i) =>
              trackedAddObjectRef.current({ ...snapshot, x: snapshot.x + (i + 1) * OFFSET, y: snapshot.y + (i + 1) * OFFSET })
            )
          );
          const newIds = refs.map(r => r.id);
          setSelectedIds(new Set(newIds));
        };
        doPaste();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (!canEditRef.current) return;
        e.preventDefault();
        const ids = selectedIdsRef.current;
        if (ids.size > 1) {
          handleDuplicateMultipleRef.current?.(ids);
        } else {
          const id = selectedIdRef.current;
          if (id) handleDuplicateRef.current?.(id);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allIds = new Set(Object.keys(objectsRef.current));
        setSelectedIds(allIds);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const newScale = Math.min(MAX_SCALE, oldScale * 1.15);
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pointX = (centerX - stage.x()) / oldScale;
        const pointY = (centerY - stage.y()) / oldScale;
        setStageScale(newScale);
        setStagePos({ x: centerX - pointX * newScale, y: centerY - pointY * newScale });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const newScale = Math.max(MIN_SCALE, oldScale / 1.15);
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pointX = (centerX - stage.x()) / oldScale;
        const pointY = (centerY - stage.y()) / oldScale;
        setStageScale(newScale);
        setStagePos({ x: centerX - pointX * newScale, y: centerY - pointY * newScale });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const newScale = 1;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const pointX = (centerX - stage.x()) / oldScale;
        const pointY = (centerY - stage.y()) / oldScale;
        setStageScale(newScale);
        setStagePos({ x: centerX - pointX * newScale, y: centerY - pointY * newScale });
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
