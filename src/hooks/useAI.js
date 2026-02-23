import { getGenerativeModel } from "firebase/ai";
import { ai, db } from "../firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useState, useMemo, useRef, useEffect } from "react";
import { toolDeclarations, buildSystemPrompt } from "../ai/toolDeclarations";
import { executeToolCall } from "../ai/toolExecutors";
import { findNonOverlappingPosition } from "../utils/frameUtils";

const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_KEY = 'ai_request_timestamps';
const MAX_CHAT_HISTORY = 100;
const MAX_PERSISTED_MESSAGES = 50;
const MAX_MESSAGE_TEXT_LENGTH = 2000;

function loadTimestamps() {
  try {
    const raw = sessionStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveTimestamps(timestamps) {
  try {
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps));
  } catch {
    // sessionStorage quota exceeded — proceed without persisting
  }
}

function getRecentTimestamps(timestamps) {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  return timestamps.filter(ts => ts > cutoff);
}

function createMutationTracker(rawActions, currentObjects) {
  const created = [];
  const updated = [];
  const deleted = [];

  const addObject = async (data) => {
    const ref = await rawActions.addObject(data);
    if (ref) {
      created.push({ id: ref.id, snapshot: { ...data } });
    }
    return ref;
  };

  const updateObject = async (objectId, updates) => {
    const current = currentObjects[objectId];
    if (current) {
      const rollback = {};
      for (const key of Object.keys(updates)) {
        rollback[key] = current[key] !== undefined ? JSON.parse(JSON.stringify(current[key])) : null;
      }
      updated.push({ id: objectId, rollback });
    }
    return rawActions.updateObject(objectId, updates);
  };

  const deleteObject = async (objectId) => {
    const current = currentObjects[objectId];
    if (current) {
      const { id, ...snapshot } = JSON.parse(JSON.stringify(current));
      deleted.push({ id: objectId, snapshot });
    }
    return rawActions.deleteObject(objectId);
  };

  const getMutations = () => ({ created, updated, deleted });

  return { addObject, updateObject, deleteObject, getMutations };
}

export function useAI(boardId, boardActions, objects, user, isAdmin, stagePos, stageScale, setStagePos, setStageScale, aiResponseMode) {
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState(null);
  const [pendingBoardDeletion, setPendingBoardDeletion] = useState(null);

  const requestTimestampsRef = useRef(getRecentTimestamps(loadTimestamps()));

  // Refs to always access the latest boardActions, objects, and chat history during async operations
  const boardActionsRef = useRef(boardActions);
  const objectsRef = useRef(objects);
  const userRef = useRef(user);
  useEffect(() => { boardActionsRef.current = boardActions; }, [boardActions]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { userRef.current = user; }, [user]);

  const viewportRef = useRef({ stagePos, stageScale, setStagePos, setStageScale });
  useEffect(() => { viewportRef.current = { stagePos, stageScale, setStagePos, setStageScale }; }, [stagePos, stageScale, setStagePos, setStageScale]);

  // Load persisted history on board switch; clear immediately so stale history is never shown
  useEffect(() => {
    let cancelled = false;
    setChatHistory([]);
    if (!boardId) return () => { cancelled = true; };

    setIsHistoryLoading(true);
    getDoc(doc(db, 'boards', boardId, 'aiHistory', 'messages'))
      .then((snap) => {
        if (cancelled) return;
        if (snap.exists()) {
          const msgs = snap.data().messages || [];
          setChatHistory(msgs.slice(-MAX_CHAT_HISTORY));
        }
      })
      .finally(() => {
        if (!cancelled) setIsHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [boardId]);

  // Define tools for the model
  const tools = useMemo(() => ({
    functionDeclarations: toolDeclarations,
  }), []);

  const userIdentityLine = useMemo(() => {
    if (!user) return '';
    const name = user.displayName || user.uid;
    return `\n\nYou are acting as the logged-in user: ${name} (uid: ${user.uid}). All actions you take are performed on behalf of this user.`;
  }, [user]);

  const model = useMemo(() => {
    if (!boardId) return null;
    return getGenerativeModel(ai, {
      model: "gemini-2.0-flash",
      tools: [tools],
      systemInstruction: buildSystemPrompt(aiResponseMode) + userIdentityLine,
    });
  }, [boardId, tools, userIdentityLine, aiResponseMode]);

  const chat = useMemo(() => {
    if (!model) return null;
    return model.startChat();
  }, [model]);

  const buildBoardContext = () => {
    if (!objects || Object.keys(objects).length === 0) return '';
    const allObjs = Object.values(objects);
    const total = allObjs.length;
    const minX = allObjs.length > 0 ? Math.min(...allObjs.map(o => o.x ?? 0)) : 0;
    const leftAnchor = allObjs.length > 0 ? Math.max(0, minX - 600) : 100;
    const anchorLine = `Suggested placement anchor for new items: x=${leftAnchor}, y=100 (left of existing content).\n`;
    const selectedColor = boardActionsRef.current?.getSelectedColor?.();
    const selectedColorLine = selectedColor ? `Active selection color: ${selectedColor}. Prefer this color when creating new objects unless the user specifies otherwise.\n` : '';

    const typeCounts = {};
    for (const obj of allObjs) {
      typeCounts[obj.type] = (typeCounts[obj.type] || 0) + 1;
    }
    const summaryParts = Object.entries(typeCounts).map(([type, count]) => `${count} ${type}${count !== 1 ? 's' : ''}`);
    const summaryLine = `Board has ${total} object${total !== 1 ? 's' : ''}: ${summaryParts.join(', ')}.`;

    const MAX_OBJECTS = 50;
    let truncationNote = '';
    let displayObjs = allObjs;

    if (total > MAX_OBJECTS) {
      const frames = allObjs.filter(o => o.type === 'frame');
      const nonFrames = allObjs.filter(o => o.type !== 'frame');
      const sortedNonFrames = [...nonFrames].sort((a, b) => {
        const ta = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt || 0);
        const tb = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt || 0);
        return tb - ta;
      });
      const remaining = MAX_OBJECTS - frames.length;
      displayObjs = [...frames, ...sortedNonFrames.slice(0, Math.max(0, remaining))];
      truncationNote = ` (showing ${displayObjs.length} of ${total} objects — frames always included, others by recency)`;
    }

    const summaries = displayObjs.map(obj => {
      const hasText = obj.text && obj.text.trim().length > 0;
      const hasTitle = obj.title && obj.title.trim().length > 0;
      if (hasText || hasTitle) {
        let desc = `id:${obj.id}, type:${obj.type}, pos:(${Math.round(obj.x || 0)},${Math.round(obj.y || 0)})`;
        if (hasText) {
          const truncated = obj.text.length > 200 ? obj.text.slice(0, 200) + '...' : obj.text;
          desc += `, text:"${truncated}"`;
        }
        if (hasTitle) {
          const truncatedTitle = obj.title.length > 200 ? obj.title.slice(0, 200) + '...' : obj.title;
          desc += `, title:"${truncatedTitle}"`;
        }
        if (obj.color) desc += `, color:${obj.color}`;
        if (obj.width) desc += `, size:${Math.round(obj.width)}x${Math.round(obj.height || obj.width)}`;
        if (obj.rotation) desc += `, rotation:${Math.round(obj.rotation)}`;
        if (obj.frameId) desc += `, frameId:${obj.frameId}`;
        return desc;
      }
      return `id:${obj.id}, type:${obj.type}, pos:(${Math.round(obj.x || 0)},${Math.round(obj.y || 0)})`;
    });

    return `${anchorLine}${selectedColorLine}[${summaryLine}${truncationNote} Objects: ${summaries.join(' | ')}]\n\n`;
  };

  // Wrapper: find non-overlapping position using the latest objects snapshot.
  // extraObstacles allows pass-1 frame data (not yet in Firestore) to be considered.
  const findNonOverlappingPos = (x, y, w, h, isFrame = false, extraObstacles = []) => {
    const baseObjects = objectsRef.current || {};
    // Merge extra obstacles (locally-created frames) into a temporary objects map
    const allObjects = extraObstacles.length
      ? { ...baseObjects, ...Object.fromEntries(extraObstacles.map(o => [o.id, o])) }
      : baseObjects;
    // The shared utility takes a center point; pass (x, y) as the center
    // (caller convention in useAI passes top-left, so shift by half-size first)
    const pos = findNonOverlappingPosition(x + w / 2, y + h / 2, w, h, isFrame, allObjects);
    return pos;
  };

  // Helper to get latest actions (may change after createBoard navigates)
  const act = () => boardActionsRef.current;
  const objs = () => objectsRef.current || {};

  const persistHistory = (currentBoardId, messages) => {
    if (!currentBoardId || !messages || !Array.isArray(messages)) return;
    const capped = messages.length > MAX_PERSISTED_MESSAGES
      ? messages.slice(messages.length - MAX_PERSISTED_MESSAGES)
      : messages;
    const serialized = capped.map(m => ({
      role: m.role,
      message: m.message.length > MAX_MESSAGE_TEXT_LENGTH
        ? m.message.slice(0, MAX_MESSAGE_TEXT_LENGTH)
        : m.message,
      timestamp: m.timestamp,
    }));
    const historyDocRef = doc(db, 'boards', currentBoardId, 'aiHistory', 'messages');
    setDoc(historyDocRef, { messages: serialized }, { merge: false }).catch((err) => {
      console.warn('[useAI] Failed to persist chat history:', err.message);
    });
  };

  const sendCommand = async (prompt) => {
    if (!chat) return "AI is not initialized.";

    // Capture boardId before any await so it cannot change mid-execution
    const currentBoardId = boardId;

    // Rate limit: max 50 requests per 24-hour window, tracked in sessionStorage
    if (!isAdmin) {
      const now = Date.now();
      const recent = getRecentTimestamps(requestTimestampsRef.current);
      if (recent.length >= RATE_LIMIT_MAX) {
        const oldestTs = Math.min(...recent);
        const resetMs = RATE_LIMIT_WINDOW_MS - (now - oldestTs);
        const resetHours = Math.ceil(resetMs / (60 * 60 * 1000));
        const msg = `Rate limit reached: ${RATE_LIMIT_MAX} requests per 24 hours. Resets in approximately ${resetHours} hour${resetHours !== 1 ? 's' : ''}.`;
        setError(msg);
        return msg;
      }
      const updated = [...recent, now];
      requestTimestampsRef.current = updated;
      saveTimestamps(updated);
    }

    const contextPrompt = buildBoardContext() + prompt;
    const userEntry = { role: 'user', message: prompt, timestamp: Date.now() };
    let historyWithUser;
    setChatHistory(prev => {
      const next = [...prev, userEntry];
      historyWithUser = next.length > MAX_CHAT_HISTORY ? next.slice(next.length - MAX_CHAT_HISTORY) : next;
      return historyWithUser;
    });
    setIsTyping(true);
    setError(null);
    try {
      const result = await chat.sendMessage(contextPrompt);
      let calls = null;
      try {
        calls = result.response.functionCalls();
      } catch (e) {
        if (result.response.candidates?.[0]?.content?.parts) {
          calls = result.response.candidates[0].content.parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);
        }
      }

      if (calls && calls.length > 0) {
        const currentActions = act();
        const currentObjs = objs();
        const tracker = createMutationTracker(
          { addObject: currentActions.addObject, updateObject: currentActions.updateObject, deleteObject: currentActions.deleteObject },
          currentObjs
        );
        const trackedAct = () => ({
          addObject: tracker.addObject,
          updateObject: tracker.updateObject,
          deleteObject: tracker.deleteObject,
          createBoard: currentActions.createBoard,
          getBoards: currentActions.getBoards,
          createGroup: currentActions.createGroup,
          setViewport: ({ stagePos: newPos, stageScale: newScale }) => {
            const { setStagePos: ssp, setStageScale: sss } = viewportRef.current;
            if (newScale !== undefined) sss(newScale);
            if (newPos !== undefined) ssp(newPos);
          },
        });

        const localFrames = [];
        const frameIndexMap = {}; // frameIndex → { id, x, y, width, height }

        // Helper: find the containing frame for a position (checks both existing and locally-created frames)
        const findContainingFrame = (x, y, w, h) => {
          const cx = x + w / 2;
          const cy = y + h / 2;
          let best = null;
          let bestArea = Infinity;
          for (const o of Object.values(objs())) {
            if (o.type !== 'frame') continue;
            if (cx >= o.x && cx <= o.x + o.width && cy >= o.y && cy <= o.y + o.height) {
              const area = o.width * o.height;
              if (area < bestArea) { best = o.id; bestArea = area; }
            }
          }
          for (const f of localFrames) {
            if (cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height) {
              const area = f.width * f.height;
              if (area < bestArea) { best = f.id; bestArea = area; }
            }
          }
          return best;
        };

        // --- Two-pass processing: frames first, then everything else ---
        const frameCalls = [];
        const otherCalls = [];
        for (const call of calls) {
          if (call.name === 'createFrame') frameCalls.push(call);
          else otherCalls.push(call);
        }

        // Count items per frameIndex to auto-calculate frame sizes
        const itemsByFrame = {};
        for (const call of otherCalls) {
          const fi = call.args?.frameIndex;
          if (fi !== undefined && fi !== null) {
            if (!itemsByFrame[fi]) itemsByFrame[fi] = [];
            itemsByFrame[fi].push(call);
          }
        }
        // Count child frames per parent frameIndex for auto-sizing
        for (const call of frameCalls) {
          const pfi = call.args?.parentFrameIndex;
          if (pfi !== undefined && pfi !== null) {
            if (!itemsByFrame[pfi]) itemsByFrame[pfi] = [];
            itemsByFrame[pfi].push(call);
          }
        }

        // Layout constants
        const ITEM_W = 150, ITEM_H = 150, ITEM_GAP = 15, FRAME_PAD = 25, TITLE_H = 50;

        // Sort frames: parent-less frames first, then children (so parents exist when children are created)
        const sortedFrameCalls = [...frameCalls].sort((a, b) => {
          const aHasParent = a.args?.parentFrameIndex !== undefined && a.args?.parentFrameIndex !== null;
          const bHasParent = b.args?.parentFrameIndex !== undefined && b.args?.parentFrameIndex !== null;
          if (aHasParent === bHasParent) return 0;
          return aHasParent ? 1 : -1;
        });

        // --- Pass 1: Create frames (with auto-sizing) ---
        for (let i = 0; i < sortedFrameCalls.length; i++) {
          const call = sortedFrameCalls[i];
          const fi = call.args.frameIndex ?? i;
          const items = itemsByFrame[fi] || [];
          const itemCount = items.length;

          let w, h;
          if (itemCount > 0) {
            const cols = Math.max(1, Math.ceil(Math.sqrt(itemCount)));
            const rows = Math.max(1, Math.ceil(itemCount / cols));
            w = Math.max(300, cols * (ITEM_W + ITEM_GAP) - ITEM_GAP + FRAME_PAD * 2);
            h = Math.max(200, rows * (ITEM_H + ITEM_GAP) - ITEM_GAP + FRAME_PAD * 2 + TITLE_H);
          } else {
            w = call.args.width || 400;
            h = call.args.height || 300;
          }

          const { frameIndex: _fi, parentFrameIndex: pfi, ...frameArgs } = call.args;
          let frameId = null;
          let posX, posY;

          // Check if this frame should be nested inside a parent frame
          if (pfi !== undefined && pfi !== null && frameIndexMap[pfi]) {
            const parent = frameIndexMap[pfi];
            frameId = parent.id;
            // Auto-position inside parent
            const parentItems = itemsByFrame[pfi] || [];
            const idx = parentItems.indexOf(call);
            const cols = Math.max(1, Math.ceil(Math.sqrt(parentItems.length)));
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            posX = parent.x + FRAME_PAD + col * (w + ITEM_GAP);
            posY = parent.y + TITLE_H + FRAME_PAD + row * (h + ITEM_GAP);
          } else {
            const pos = findNonOverlappingPos(call.args.x || 50, call.args.y || 50, w, h, true, localFrames);
            posX = pos.x;
            posY = pos.y;
          }

          const ref = await trackedAct().addObject({
            type: 'frame', color: '#6366f1',
            ...frameArgs, x: posX, y: posY, width: w, height: h,
            ...(frameId ? { frameId } : {})
          });
          if (ref) {
            const frameData = { id: ref.id, x: posX, y: posY, width: w, height: h };
            localFrames.push(frameData);
            frameIndexMap[fi] = frameData;
          }
        }

        // --- Pass 2: Process all other calls (intercept deleteObject) ---
        const collectedDeletions = [];
        const sharedContext = {
          act: trackedAct, objs,
          frameIndexMap, itemsByFrame,
          findNonOverlappingPos, findContainingFrame,
          localFrames,
          ITEM_W, ITEM_H, ITEM_GAP, FRAME_PAD, TITLE_H,
          getViewport: () => viewportRef.current,
        };
        for (const call of otherCalls) {
          if (call.name === 'deleteObject') {
            const objectId = call.args?.objectId;
            if (objectId) {
              const obj = objs()[objectId];
              const label = obj?.text || obj?.title || obj?.type || objectId;
              collectedDeletions.push({ objectId, label });
            }
          } else if (call.name === 'deleteBoard') {
            const { boardId: delBoardId, boardName: delBoardName } = call.args || {};
            if (delBoardId) {
              setPendingBoardDeletion({ boardId: delBoardId, boardName: delBoardName });
            }
          } else {
            await executeToolCall(call.name, call.args, { ...sharedContext, _call: call });
          }
        }

        const mutations = tracker.getMutations();

        if (mutations.created.length > 0 || mutations.updated.length > 0 || mutations.deleted.length > 0) {
          boardActionsRef.current.pushCompoundEntry(mutations);
          boardActionsRef.current.onAIToolSuccess?.();
        }

        if (collectedDeletions.length > 0) {
          setPendingDeletions(collectedDeletions);
        }
      }

      let responseText = result.response.text();
      if (!responseText && calls && calls.length > 0) {
        responseText = 'Done.';
      }
      const aiEntry = { role: 'ai', message: responseText, timestamp: Date.now() };
      let newHistoryAfterAi;
      setChatHistory(prev => {
        const next = [...prev, aiEntry];
        newHistoryAfterAi = next.length > MAX_CHAT_HISTORY ? next.slice(next.length - MAX_CHAT_HISTORY) : next;
        return newHistoryAfterAi;
      });
      persistHistory(currentBoardId, newHistoryAfterAi);
      return responseText;
    } catch (err) {
      const msg = err?.message || "Unknown error occurred";
      setError(msg);
      const errEntry = { role: 'ai', message: `Error: ${msg}`, timestamp: Date.now() };
      let newHistoryAfterErr;
      setChatHistory(prev => {
        const next = [...prev, errEntry];
        newHistoryAfterErr = next.length > MAX_CHAT_HISTORY ? next.slice(next.length - MAX_CHAT_HISTORY) : next;
        return newHistoryAfterErr;
      });
      persistHistory(currentBoardId, newHistoryAfterErr);
      return `Error: ${msg}`;
    } finally {
      setIsTyping(false);
    }
  };

  const confirmDeletions = () => {
    if (!pendingDeletions) return;
    for (const { objectId } of pendingDeletions) {
      boardActionsRef.current.deleteObject(objectId);
    }
    setPendingDeletions(null);
  };

  const cancelDeletions = () => {
    setPendingDeletions(null);
  };

  const confirmBoardDeletion = () => {
    if (!pendingBoardDeletion) return;
    boardActionsRef.current.deleteBoard?.(pendingBoardDeletion.boardId);
    setPendingBoardDeletion(null);
  };

  const cancelBoardDeletion = () => {
    setPendingBoardDeletion(null);
  };

  return { sendCommand, isTyping, error, clearError: () => setError(null), chatHistory, isHistoryLoading, pendingDeletions, confirmDeletions, cancelDeletions, pendingBoardDeletion, confirmBoardDeletion, cancelBoardDeletion };
}
