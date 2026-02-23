import { useRef } from 'react';

export function useClipboard({ objectsRef, selectedIdRef, selectedIdsRef, canEditRef, trackedAddObjectRef, setSelectedIds }) {
  const clipboardRef = useRef([]);

  const copyObjects = (ids) => {
    const snapshots = [];
    if (ids && ids.size > 0) {
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
    return snapshots;
  };

  const cutObjects = (ids, deleteMultiple, deleteSingle) => {
    if (ids && ids.size > 0) {
      const snapshots = copyObjects(ids);
      if (snapshots.length > 0) {
        deleteMultiple?.(ids);
        setSelectedIds(new Set());
      }
    } else {
      const id = selectedIdRef.current;
      if (id) {
        copyObjects(null);
        deleteSingle?.(id);
      }
    }
  };

  const pasteObjects = async (offsetX, offsetY) => {
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

  const pasteObjectsAt = async (canvasX, canvasY) => {
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
    const firstX = items[0].x + OFFSET;
    const firstY = items[0].y + OFFSET;
    const dx = canvasX - firstX;
    const dy = canvasY - firstY;
    const pasteRefs = await Promise.all(
      items.map((snapshot, i) => {
        const x = (i === 0 ? canvasX : snapshot.x + OFFSET + dx) + i * OFFSET;
        const y = (i === 0 ? canvasY : snapshot.y + OFFSET + dy) + i * OFFSET;
        return trackedAddObjectRef.current({ ...snapshot, x, y });
      })
    );
    const pasteIds = pasteRefs.map(r => r.id);
    setSelectedIds(new Set(pasteIds));
  };

  return { clipboardRef, copyObjects, cutObjects, pasteObjects, pasteObjectsAt };
}
