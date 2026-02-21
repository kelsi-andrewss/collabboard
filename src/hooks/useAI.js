import { getGenerativeModel } from "firebase/ai";
import { ai } from "../firebase/config";
import { useState, useMemo, useRef, useEffect } from "react";
import { toolDeclarations, systemPrompt } from "../ai/toolDeclarations";
import { executeToolCall } from "../ai/toolExecutors";
import { findNonOverlappingPosition } from "../utils/frameUtils";

const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_KEY = 'ai_request_timestamps';

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

export function useAI(boardId, boardActions, objects, user) {
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);

  const requestTimestampsRef = useRef(getRecentTimestamps(loadTimestamps()));

  // Refs to always access the latest boardActions and objects during async operations
  const boardActionsRef = useRef(boardActions);
  const objectsRef = useRef(objects);
  const userRef = useRef(user);
  useEffect(() => { boardActionsRef.current = boardActions; }, [boardActions]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { userRef.current = user; }, [user]);

  // Define tools for the model
  const tools = useMemo(() => ({
    functionDeclarations: toolDeclarations,
  }), []);

  const model = useMemo(() => {
    if (!boardId) return null;
    const currentUser = userRef.current;
    const userIdentityLine = currentUser
      ? `\n\nYou are acting as the logged-in user: ${currentUser.displayName || currentUser.email || currentUser.uid} (uid: ${currentUser.uid}). All actions you take are performed on behalf of this user.`
      : '';
    return getGenerativeModel(ai, {
      model: "gemini-2.0-flash",
      tools: [tools],
      systemInstruction: systemPrompt + userIdentityLine,
    });
  }, [boardId, tools]);

  const chat = useMemo(() => {
    if (!model) return null;
    return model.startChat();
  }, [model]);

  const buildBoardContext = () => {
    if (!objects || Object.keys(objects).length === 0) return '';
    const summaries = Object.values(objects).map(obj => {
      let desc = `id:${obj.id}, type:${obj.type}, pos:(${Math.round(obj.x || 0)},${Math.round(obj.y || 0)})`;
      if (obj.text) {
        const truncated = obj.text.length > 500 ? obj.text.slice(0, 500) + '...' : obj.text;
        desc += `, text:"${truncated}"`;
      }
      if (obj.title) desc += `, title:"${obj.title}"`;
      if (obj.color) desc += `, color:${obj.color}`;
      if (obj.width) desc += `, size:${Math.round(obj.width)}x${Math.round(obj.height || obj.width)}`;
      if (obj.rotation) desc += `, rotation:${Math.round(obj.rotation)}`;
      if (obj.frameId) desc += `, frameId:${obj.frameId}`;
      return desc;
    });
    return `[Current board objects: ${summaries.join(' | ')}]\n\n`;
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

  const sendCommand = async (prompt) => {
    if (!chat) return "AI is not initialized.";

    // Rate limit: max 50 requests per 24-hour window, tracked in sessionStorage
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

    const contextPrompt = buildBoardContext() + prompt;
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

          const ref = await act().addObject({
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

        // --- Pass 2: Process all other calls ---
        const sharedContext = {
          act, objs,
          frameIndexMap, itemsByFrame,
          findNonOverlappingPos, findContainingFrame,
          localFrames,
          ITEM_W, ITEM_H, ITEM_GAP, FRAME_PAD, TITLE_H,
        };
        for (const call of otherCalls) {
          await executeToolCall(call.name, call.args, { ...sharedContext, _call: call });
        }
      } else {
      }

      return result.response.text();
    } catch (err) {
      const msg = err?.message || "Unknown error occurred";
      setError(msg);
      return `Error: ${msg}`;
    } finally {
      setIsTyping(false);
    }
  };

  return { sendCommand, isTyping, error, clearError: () => setError(null) };
}
