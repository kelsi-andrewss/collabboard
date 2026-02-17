import { getGenerativeModel } from "firebase/ai";
import { ai } from "../firebase/config";
import { useState, useMemo, useRef, useEffect } from "react";

export function useAI(boardId, boardActions, objects) {
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);

  // Refs to always access the latest boardActions and objects during async operations
  const boardActionsRef = useRef(boardActions);
  const objectsRef = useRef(objects);
  useEffect(() => { boardActionsRef.current = boardActions; }, [boardActions]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);

  // Define tools for the model
  const tools = useMemo(() => ({
    functionDeclarations: [
      {
        name: "createStickyNote",
        description: "Creates a new sticky note on the board. Use frameIndex to place it inside a frame created in the same batch.",
        parameters: {
          type: "OBJECT",
          properties: {
            text: { type: "STRING", description: "The content of the sticky note" },
            x: { type: "NUMBER", description: "X coordinate — ignored if frameIndex is set (auto-positioned)" },
            y: { type: "NUMBER", description: "Y coordinate — ignored if frameIndex is set (auto-positioned)" },
            color: { type: "STRING", description: "Hex color code" },
            frameIndex: { type: "NUMBER", description: "Index of the frame (from createFrame calls) to place this inside. Items are auto-positioned and the frame auto-sizes." }
          },
          required: ["text", "x", "y"]
        }
      },
      {
        name: "createShape",
        description: "Creates a shape (rectangle, circle, triangle, or line) on the board. Use frameIndex to place it inside a frame created in the same batch.",
        parameters: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", enum: ["rectangle", "circle", "triangle", "line"] },
            x: { type: "NUMBER" },
            y: { type: "NUMBER" },
            width: { type: "NUMBER" },
            height: { type: "NUMBER" },
            color: { type: "STRING" },
            frameIndex: { type: "NUMBER", description: "Index of the frame to place this inside" }
          },
          required: ["type", "x", "y"]
        }
      },
      {
        name: "createFrame",
        description: "Creates a frame (visual container with title) on the board. Size is auto-calculated if items reference this frame via frameIndex.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Title of the frame" },
            x: { type: "NUMBER" },
            y: { type: "NUMBER" },
            width: { type: "NUMBER", description: "Width — auto-calculated if items use frameIndex to reference this frame" },
            height: { type: "NUMBER", description: "Height — auto-calculated if items use frameIndex to reference this frame" },
            color: { type: "STRING", description: "Hex color code" },
            frameIndex: { type: "NUMBER", description: "Unique index for this frame so items can reference it via their frameIndex" },
            parentFrameIndex: { type: "NUMBER", description: "frameIndex of the parent frame to nest this frame inside. Parent frame must also be created in the same batch." }
          },
          required: ["title", "x", "y"]
        }
      },
      {
        name: "moveObject",
        description: "Moves an existing object on the board to a new position.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectId: { type: "STRING", description: "The ID of the object to move" },
            x: { type: "NUMBER", description: "New X coordinate" },
            y: { type: "NUMBER", description: "New Y coordinate" }
          },
          required: ["objectId", "x", "y"]
        }
      },
      {
        name: "resizeObject",
        description: "Resizes an existing object on the board.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectId: { type: "STRING", description: "The ID of the object to resize" },
            width: { type: "NUMBER", description: "New width" },
            height: { type: "NUMBER", description: "New height" }
          },
          required: ["objectId", "width", "height"]
        }
      },
      {
        name: "changeObjectColor",
        description: "Changes the color of an existing object on the board.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectId: { type: "STRING", description: "The ID of the object to recolor" },
            color: { type: "STRING", description: "New hex color code" }
          },
          required: ["objectId", "color"]
        }
      },
      {
        name: "createGrid",
        description: "Creates a grid of objects on the board. Use this when the user asks for a grid, table, matrix, or organized layout of multiple objects.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectType: { type: "STRING", enum: ["sticky", "rectangle", "circle", "triangle"], description: "Type of object to create in each cell" },
            rows: { type: "NUMBER", description: "Number of rows" },
            columns: { type: "NUMBER", description: "Number of columns" },
            startX: { type: "NUMBER", description: "X coordinate of top-left cell (default 100)" },
            startY: { type: "NUMBER", description: "Y coordinate of top-left cell (default 100)" },
            cellWidth: { type: "NUMBER", description: "Width of each cell (default 150)" },
            cellHeight: { type: "NUMBER", description: "Height of each cell (default 150)" },
            gapX: { type: "NUMBER", description: "Horizontal gap between cells (default 20)" },
            gapY: { type: "NUMBER", description: "Vertical gap between cells (default 20)" },
            color: { type: "STRING", description: "Color for all objects" },
            labels: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Text labels for each cell in row-major order"
            }
          },
          required: ["objectType", "rows", "columns"]
        }
      },
      {
        name: "arrangeInGrid",
        description: "Rearranges EXISTING objects on the board into a grid layout. Use this when the user says 'arrange these in a grid', 'organize these notes', or 'lay these out'. This MOVES existing objects — it does NOT create new ones.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectIds: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "IDs of existing objects to arrange"
            },
            columns: { type: "NUMBER", description: "Number of columns (default: auto-calculated)" },
            startX: { type: "NUMBER", description: "X of top-left (default 100)" },
            startY: { type: "NUMBER", description: "Y of top-left (default 100)" },
            gapX: { type: "NUMBER", description: "Horizontal gap (default 20)" },
            gapY: { type: "NUMBER", description: "Vertical gap (default 20)" }
          },
          required: ["objectIds"]
        }
      },
      {
        name: "spaceEvenly",
        description: "Spaces existing objects evenly along a direction. Use when the user says 'space these evenly', 'distribute evenly', or 'spread out'.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectIds: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "IDs of objects to space"
            },
            direction: { type: "STRING", enum: ["horizontal", "vertical"], description: "Direction to space (default horizontal)" }
          },
          required: ["objectIds"]
        }
      },
      {
        name: "deleteObject",
        description: "Deletes an object from the board.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectId: { type: "STRING", description: "ID of the object to delete" }
          },
          required: ["objectId"]
        }
      },
      {
        name: "resolveOverlaps",
        description: "Resolves overlapping objects with MINIMAL movement. Nudges overlapping items apart with a small 15px gap — does NOT scatter them widely. Use when the user says 'make items not overlap', 'fix overlaps', 'untangle', or 'spread out a little'.",
        parameters: {
          type: "OBJECT",
          properties: {
            objectIds: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "IDs of objects to de-overlap. If empty, all non-frame objects are used."
            }
          },
          required: []
        }
      },
      {
        name: "arrangeByType",
        description: "Groups ALL objects (including frames, shapes, stickies, lines) by their type and arranges each group in a neat cluster. Resets rotation to 0 and makes non-frame objects uniform size within each type group. Use when the user says 'arrange by object', 'group by type', 'organize by kind', 'sort by shape', or 'arrange everything by type'.",
        parameters: {
          type: "OBJECT",
          properties: {
            gap: { type: "NUMBER", description: "Gap between objects within a group (default 15)" },
            groupGap: { type: "NUMBER", description: "Gap between type groups (default 60)" }
          },
          required: []
        }
      },
      {
        name: "fitFrameToContents",
        description: "Resizes AND repositions a frame to tightly fit all objects inside it with padding. Use when the user says 'resize frame to fit', 'fit frame to contents', 'shrink frame to fit'. This handles both position and size adjustment correctly.",
        parameters: {
          type: "OBJECT",
          properties: {
            frameId: { type: "STRING", description: "ID of the frame to fit" },
            padding: { type: "NUMBER", description: "Padding around contents (default 30)" }
          },
          required: ["frameId"]
        }
      },
      {
        name: "createBoard",
        description: "Creates a brand new board and navigates to it. Use when the user says 'create a board', 'make a new board', 'set up a board for...'. After creating, you can add objects to it with other tools.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Name of the new board" },
            group: { type: "STRING", description: "Optional group/folder name" }
          },
          required: ["name"]
        }
      }
    ]
  }), []);

  const model = useMemo(() => {
    if (!boardId) return null;
    return getGenerativeModel(ai, {
      model: "gemini-2.0-flash",
      tools: [tools],
      systemInstruction: `You are a whiteboard assistant. You can create, move, resize, recolor, delete, and arrange objects on the board.

CRITICAL RULE: NEVER ask the user for clarification, details, coordinates, labels, colors, sizes, or any other information. ALWAYS use your best judgment and act immediately.

DUPLICATES ARE ALLOWED: Objects are identified by their unique IDs, NOT by their title or text. If the user asks to create something that already exists on the board (same title, text, or type), ALWAYS create it anyway. Never refuse or skip creation because a similar object already exists. Board name deduplication is handled automatically — just use the requested name.

TOOLS AVAILABLE:
- createStickyNote: Create a new sticky note (auto-avoids overlaps)
- createShape: Create a shape (auto-avoids overlaps)
- createFrame: Create a frame container (auto-avoids overlaps). Frames CAN be moved and resized.
- moveObject: Move ANY object (sticky, shape, frame, line) to new coordinates
- resizeObject: Resize ANY object (sticky, shape, frame, line) — works on frames too
- changeObjectColor: Change any object's color
- createGrid: Create a NEW grid of objects from scratch
- arrangeInGrid: Rearrange EXISTING objects into a grid (does NOT create new objects)
- spaceEvenly: Space existing objects evenly (horizontal or vertical)
- deleteObject: Delete an object
- resolveOverlaps: Minimally nudge overlapping objects apart with 15px gaps
- arrangeByType: Group ALL objects (frames, shapes, stickies, lines) by type into neat clusters. Resets rotation and normalizes sizes.
- fitFrameToContents: Resize AND reposition a frame to tightly fit all objects inside it. Use this instead of manual resizeObject+moveObject for frames.
- createBoard: Create a new board and navigate to it

FRAME-ITEM ASSOCIATION (frameIndex):
When creating frames with items inside them, use frameIndex to link them by document ID:
- Give each createFrame a unique frameIndex (0, 1, 2, ...)
- Give each createStickyNote/createShape a matching frameIndex to place it in that frame
- Items with frameIndex are AUTO-POSITIONED inside the frame in a grid layout — do NOT specify x/y for them
- Frame sizes are AUTO-CALCULATED based on item count — do NOT specify width/height for frames with items
- This links items to frames by their Firestore document ID, NOT by title

FRAME NESTING (parentFrameIndex):
- To nest a frame inside another frame, set parentFrameIndex on the child frame to the parent's frameIndex
- Parent frames must be created in the same batch
- Parent frames auto-size to include both items AND child frames
- Example: parentFrameIndex: 0 nests a frame inside the frame with frameIndex: 0

CRITICAL TOOL SELECTION RULES:
- "Make items not overlap" / "fix overlaps" → use resolveOverlaps.
- "Arrange by object/type" / "group by type" / "organize by kind" → use arrangeByType. This includes ALL objects: frames, shapes, stickies, lines. Do NOT exclude any type.
- "Arrange notes in a grid" → use arrangeInGrid with existing IDs.
- "Space evenly" / "distribute" → use spaceEvenly.
- "Resize frame to fit" / "fit frame to contents" → use fitFrameToContents (NOT resizeObject + moveObject).
- Frames are fully transformable: moveObject and resizeObject both work on frames.

EXAMPLES (act immediately without asking):
- "Arrange everything by type" → use arrangeByType (includes frames, shapes, stickies, all types).
- "Make all items not overlap" → use resolveOverlaps.
- "Resize the frame to fit its contents" → use fitFrameToContents with the frame's ID.
- "Create a grid of project tasks" → Use createGrid with sensible labels.
- When the user asks to set up any structured board (retrospective, kanban, SWOT, pros/cons, sprint planning, categories, etc.), create frames for each column/section and use frameIndex to place sticky notes inside them. Choose appropriate titles, colors, and example items based on the prompt.

DEFAULTS:
- Coordinates: x: 500, y: 500 if not specified
- Colors: '#fef08a' for sticky notes, '#3b82f6' for shapes, '#6366f1' for frames
- Always provide sensible labels — never leave cells empty

The user's message includes a summary of current board objects with their IDs, types, positions, sizes, and text. Use object IDs from context. Match objects by text, type, or position.`
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
      if (obj.text) desc += `, text:"${obj.text}"`;
      if (obj.title) desc += `, title:"${obj.title}"`;
      if (obj.color) desc += `, color:${obj.color}`;
      if (obj.width) desc += `, size:${Math.round(obj.width)}x${Math.round(obj.height || obj.width)}`;
      if (obj.rotation) desc += `, rotation:${Math.round(obj.rotation)}`;
      if (obj.frameId) desc += `, frameId:${obj.frameId}`;
      return desc;
    });
    return `[Current board objects: ${summaries.join(' | ')}]\n\n`;
  };

  // Find a non-overlapping position for a new object (uses ref for latest objects)
  // isFrame=true: check against ALL objects (frames must not overlap anything)
  // isFrame=false: exclude frames (non-frames can be placed inside frames)
  const findNonOverlappingPos = (x, y, w, h, isFrame = false, extraObstacles = []) => {
    const allObjs = Object.values(objectsRef.current || {});
    const filtered = isFrame ? allObjs : allObjs.filter(o => o.type !== 'frame');
    const obstacles = [...filtered, ...extraObstacles];
    const overlaps = (px, py) => obstacles.some(o => {
      const ow = o.width || 150;
      const oh = o.height || 150;
      return px < o.x + ow && px + w > o.x && py < o.y + oh && py + h > o.y;
    });
    if (!overlaps(x, y)) return { x, y };
    // Spiral outward in small steps
    for (let dist = 20; dist < 1500; dist += 20) {
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = (angle * Math.PI) / 180;
        const tx = x + Math.cos(rad) * dist;
        const ty = y + Math.sin(rad) * dist;
        if (!overlaps(tx, ty)) return { x: tx, y: ty };
      }
    }
    return { x, y };
  };

  // Helper to get latest actions (may change after createBoard navigates)
  const act = () => boardActionsRef.current;
  const objs = () => objectsRef.current || {};

  const sendCommand = async (prompt) => {
    if (!chat) return "AI is not initialized.";
    const contextPrompt = buildBoardContext() + prompt;
    console.log("AI Prompt Sent:", contextPrompt);
    setIsTyping(true);
    setError(null);
    try {
      const result = await chat.sendMessage(contextPrompt);
      console.log("AI Response Received:", result.response);

      let calls = null;
      try {
        calls = result.response.functionCalls();
      } catch (e) {
        console.log(e);
        if (result.response.candidates?.[0]?.content?.parts) {
          calls = result.response.candidates[0].content.parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);
        }
      }

      console.log("Extracted Tool Calls:", calls);

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

          console.log("Executing Tool: createFrame", call.args);
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
        for (const call of otherCalls) {
          console.log("Executing Tool:", call.name, call.args);
          if (call.name === "createStickyNote") {
            const w = 150, h = 150;
            const { frameIndex: fi, ...stickyArgs } = call.args;
            let frameId = null;
            let posX = stickyArgs.x, posY = stickyArgs.y;

            if (fi !== undefined && fi !== null && frameIndexMap[fi]) {
              const frame = frameIndexMap[fi];
              frameId = frame.id;
              const items = itemsByFrame[fi] || [];
              const idx = items.indexOf(call);
              const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)));
              const col = idx % cols;
              const row = Math.floor(idx / cols);
              posX = frame.x + FRAME_PAD + col * (ITEM_W + ITEM_GAP);
              posY = frame.y + TITLE_H + FRAME_PAD + row * (ITEM_H + ITEM_GAP);
            } else {
              const pos = findNonOverlappingPos(posX, posY, w, h);
              posX = pos.x;
              posY = pos.y;
              frameId = findContainingFrame(posX, posY, w, h);
            }

            await act().addObject({
              type: 'sticky', ...stickyArgs, x: posX, y: posY,
              ...(frameId ? { frameId } : {})
            });
          } else if (call.name === "createShape") {
            const w = call.args.width || 100, h = call.args.height || 100;
            const { frameIndex: fi, ...shapeArgs } = call.args;
            let frameId = null;
            let posX = shapeArgs.x, posY = shapeArgs.y;

            if (fi !== undefined && fi !== null && frameIndexMap[fi]) {
              const frame = frameIndexMap[fi];
              frameId = frame.id;
              const items = itemsByFrame[fi] || [];
              const idx = items.indexOf(call);
              const cols = Math.max(1, Math.ceil(Math.sqrt(items.length)));
              const col = idx % cols;
              const row = Math.floor(idx / cols);
              posX = frame.x + FRAME_PAD + col * (w + ITEM_GAP);
              posY = frame.y + TITLE_H + FRAME_PAD + row * (h + ITEM_GAP);
            } else {
              const pos = findNonOverlappingPos(posX, posY, w, h);
              posX = pos.x;
              posY = pos.y;
              frameId = findContainingFrame(posX, posY, w, h);
            }

            await act().addObject({
              ...shapeArgs, x: posX, y: posY,
              ...(frameId ? { frameId } : {})
            });
          } else if (call.name === "moveObject") {
            const { objectId, ...updates } = call.args;
            const currentObjs = objs();
            const target = currentObjs[objectId];
            // If moving a frame, move its children by the same delta
            if (target && target.type === 'frame') {
              const dx = (updates.x !== undefined ? updates.x - target.x : 0);
              const dy = (updates.y !== undefined ? updates.y - target.y : 0);
              if (dx !== 0 || dy !== 0) {
                const children = Object.values(currentObjs).filter(o => o.frameId === objectId);
                for (const child of children) {
                  await act().updateObject(child.id, { x: child.x + dx, y: child.y + dy });
                }
              }
            }
            await act().updateObject(objectId, updates);
          } else if (call.name === "resizeObject") {
            const { objectId, ...updates } = call.args;
            await act().updateObject(objectId, updates);
          } else if (call.name === "changeObjectColor") {
            const { objectId, color } = call.args;
            await act().updateObject(objectId, { color });
          } else if (call.name === "createGrid") {
            const { objectType, rows, columns, startX = 100, startY = 100, cellWidth = 150, cellHeight = 150, gapX = 20, gapY = 20, color, labels } = call.args;
            let idx = 0;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < columns; c++) {
                const objData = {
                  type: objectType === 'sticky' ? 'sticky' : objectType,
                  x: startX + c * (cellWidth + gapX),
                  y: startY + r * (cellHeight + gapY),
                  width: cellWidth,
                  height: cellHeight,
                };
                if (color) objData.color = color;
                else if (objectType === 'sticky') objData.color = '#fef08a';
                if (labels && labels[idx]) objData.text = labels[idx];
                await act().addObject(objData);
                idx++;
              }
            }
          } else if (call.name === "arrangeInGrid") {
            const { objectIds, columns: cols, startX = 100, startY = 100, gapX = 20, gapY = 20 } = call.args;
            const currentObjs = objs();
            const numCols = cols || Math.ceil(Math.sqrt(objectIds.length));
            for (let i = 0; i < objectIds.length; i++) {
              const obj = currentObjs[objectIds[i]];
              if (!obj) continue;
              const ow = obj.width || 150;
              const oh = obj.height || 150;
              const r = Math.floor(i / numCols);
              const c = i % numCols;
              const newX = startX + c * (ow + gapX);
              const newY = startY + r * (oh + gapY);
              if (obj.type === 'frame') {
                const dx = newX - obj.x;
                const dy = newY - obj.y;
                if (dx !== 0 || dy !== 0) {
                  const children = Object.values(currentObjs).filter(o => o.frameId === obj.id);
                  for (const child of children) {
                    await act().updateObject(child.id, { x: child.x + dx, y: child.y + dy });
                  }
                }
              }
              await act().updateObject(objectIds[i], { x: newX, y: newY });
            }
          } else if (call.name === "spaceEvenly") {
            const { objectIds, direction = "horizontal" } = call.args;
            const currentObjs = objs();
            const items = objectIds.map(oid => currentObjs[oid]).filter(Boolean);
            if (items.length < 2) continue;

            // Helper: move a frame and all its children by a delta
            const moveWithChildren = async (obj, dx, dy) => {
              const updates = {};
              if (dx !== 0) updates.x = obj.x + dx;
              if (dy !== 0) updates.y = obj.y + dy;
              if (Object.keys(updates).length > 0) {
                await act().updateObject(obj.id, updates);
              }
              if (obj.type === 'frame') {
                const children = Object.values(currentObjs).filter(o => o.frameId === obj.id);
                for (const child of children) {
                  const childUpdates = {};
                  if (dx !== 0) childUpdates.x = child.x + dx;
                  if (dy !== 0) childUpdates.y = child.y + dy;
                  if (Object.keys(childUpdates).length > 0) {
                    await act().updateObject(child.id, childUpdates);
                  }
                }
              }
            };

            if (direction === "horizontal") {
              items.sort((a, b) => a.x - b.x);
              const first = items[0].x;
              const lastObj = items[items.length - 1];
              const last = lastObj.x + (lastObj.width || 150);
              const totalObjWidth = items.reduce((s, o) => s + (o.width || 150), 0);
              const totalGap = (last - first - totalObjWidth) > 0
                ? last - first - totalObjWidth
                : (items.length - 1) * 30;
              const gap = totalGap / (items.length - 1);
              let curX = first;
              for (const o of items) {
                const dx = curX - o.x;
                await moveWithChildren(o, dx, 0);
                curX += (o.width || 150) + gap;
              }
            } else {
              items.sort((a, b) => a.y - b.y);
              const first = items[0].y;
              const lastObj = items[items.length - 1];
              const last = lastObj.y + (lastObj.height || 150);
              const totalObjHeight = items.reduce((s, o) => s + (o.height || 150), 0);
              const totalGap = (last - first - totalObjHeight) > 0
                ? last - first - totalObjHeight
                : (items.length - 1) * 30;
              const gap = totalGap / (items.length - 1);
              let curY = first;
              for (const o of items) {
                const dy = curY - o.y;
                await moveWithChildren(o, 0, dy);
                curY += (o.height || 150) + gap;
              }
            }
          } else if (call.name === "deleteObject") {
            const { objectId } = call.args;
            if (act().deleteObject) {
              await act().deleteObject(objectId);
            }
          } else if (call.name === "resolveOverlaps") {
            const currentObjs = objs();
            const ids = call.args.objectIds && call.args.objectIds.length > 0
              ? call.args.objectIds
              : Object.values(currentObjs).filter(o => o.type !== 'frame' && !o.frameId).map(o => o.id);
            const items = ids.map(id => {
              const o = currentObjs[id];
              if (!o) return null;
              return { id: o.id, x: o.x, y: o.y, w: o.width || 150, h: o.height || 150 };
            }).filter(Boolean);
            const GAP = 15;
            for (let iter = 0; iter < 30; iter++) {
              let moved = false;
              for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                  const a = items[i], b = items[j];
                  if (a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x &&
                      a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y) {
                    const overlapX = Math.min(a.x + a.w + GAP - b.x, b.x + b.w + GAP - a.x);
                    const overlapY = Math.min(a.y + a.h + GAP - b.y, b.y + b.h + GAP - a.y);
                    if (overlapX < overlapY) {
                      const push = overlapX / 2;
                      if (a.x < b.x) { a.x -= push; b.x += push; }
                      else { b.x -= push; a.x += push; }
                    } else {
                      const push = overlapY / 2;
                      if (a.y < b.y) { a.y -= push; b.y += push; }
                      else { b.y -= push; a.y += push; }
                    }
                    moved = true;
                  }
                }
              }
              if (!moved) break;
            }
            for (const item of items) {
              const orig = currentObjs[item.id];
              if (orig && (Math.abs(orig.x - item.x) > 1 || Math.abs(orig.y - item.y) > 1)) {
                await act().updateObject(item.id, { x: Math.round(item.x), y: Math.round(item.y) });
              }
            }
          } else if (call.name === "arrangeByType") {
            const gap = call.args.gap || 15;
            const groupGap = call.args.groupGap || 60;
            const currentObjs = objs();
            // Only arrange top-level objects; objects inside frames stay with their frame
            const allItems = Object.values(currentObjs).filter(o => !o.frameId);
            const groups = {};
            for (const o of allItems) {
              const t = o.type || 'other';
              if (!groups[t]) groups[t] = [];
              groups[t].push(o);
            }
            const typeOrder = ['frame', 'sticky', 'rectangle', 'circle', 'triangle', 'line', 'other'];
            const sortedTypes = Object.keys(groups).sort((a, b) =>
              (typeOrder.indexOf(a) === -1 ? 99 : typeOrder.indexOf(a)) -
              (typeOrder.indexOf(b) === -1 ? 99 : typeOrder.indexOf(b))
            );
            const uniformSizes = { sticky: { w: 150, h: 150 }, rectangle: { w: 120, h: 120 }, circle: { w: 120, h: 120 }, triangle: { w: 120, h: 120 }, frame: null, line: null };
            let groupX = 50;
            for (const type of sortedTypes) {
              const typeItems = groups[type];
              const cols = Math.ceil(Math.sqrt(typeItems.length));
              const uniSize = uniformSizes[type];
              let cellW, cellH;
              if (uniSize) {
                cellW = uniSize.w;
                cellH = uniSize.h;
              } else {
                cellW = null;
                cellH = null;
              }
              let maxGroupW = 0;
              for (let i = 0; i < typeItems.length; i++) {
                const o = typeItems[i];
                const w = cellW || o.width || 150;
                const h = cellH || o.height || 150;
                const r = Math.floor(i / cols);
                const c = i % cols;
                const nx = groupX + c * (w + gap);
                const ny = 50 + r * (h + gap);
                const updates = { x: Math.round(nx), y: Math.round(ny) };
                if (o.rotation) updates.rotation = 0;
                if (cellW && (o.width !== cellW || o.height !== cellH)) {
                  updates.width = cellW;
                  updates.height = cellH;
                }
                // If moving a frame, move its children by the same delta
                if (o.type === 'frame') {
                  const dx = Math.round(nx) - o.x;
                  const dy = Math.round(ny) - o.y;
                  if (dx !== 0 || dy !== 0) {
                    const children = Object.values(currentObjs).filter(ch => ch.frameId === o.id);
                    for (const child of children) {
                      await act().updateObject(child.id, { x: child.x + dx, y: child.y + dy });
                    }
                  }
                }
                await act().updateObject(o.id, updates);
                maxGroupW = Math.max(maxGroupW, nx + w - groupX);
              }
              groupX += maxGroupW + groupGap;
            }
          } else if (call.name === "fitFrameToContents") {
            const { frameId, padding = 30 } = call.args;
            const currentObjs = objs();
            const frame = currentObjs[frameId];
            if (frame) {
              const children = Object.values(currentObjs).filter(o => {
                if (o.id === frameId) return false;
                if (o.frameId === frameId) return true;
                const cx = (o.x || 0) + (o.width || 150) / 2;
                const cy = (o.y || 0) + (o.height || 150) / 2;
                return cx >= frame.x && cx <= frame.x + frame.width &&
                       cy >= frame.y && cy <= frame.y + frame.height;
              });
              if (children.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                for (const c of children) {
                  const cx = c.x || 0;
                  const cy = c.y || 0;
                  const cw = c.width || 150;
                  const ch = c.height || 150;
                  minX = Math.min(minX, cx);
                  minY = Math.min(minY, cy);
                  maxX = Math.max(maxX, cx + cw);
                  maxY = Math.max(maxY, cy + ch);
                }
                const titleBarH = 40;
                const newX = minX - padding;
                const newY = minY - padding - titleBarH;
                const newW = maxX - minX + padding * 2;
                const newH = maxY - minY + padding * 2 + titleBarH;
                await act().updateObject(frameId, {
                  x: Math.round(newX),
                  y: Math.round(newY),
                  width: Math.round(Math.max(100, newW)),
                  height: Math.round(Math.max(80, newH))
                });
              }
            }
          } else if (call.name === "createBoard") {
            const { name, group } = call.args;
            if (act().createBoard) {
              let finalName = name;
              const existingBoards = act().getBoards ? act().getBoards() : [];
              const existingNames = new Set(existingBoards.map(b => b.name));
              if (existingNames.has(finalName)) {
                let counter = 2;
                while (existingNames.has(`${name} ${counter}`)) counter++;
                finalName = `${name} ${counter}`;
              }
              await act().createBoard(finalName, group || null);
            }
          }
        }
      } else {
        const textResponse = result.response.text();
        console.log("AI returned text instead of tool call:", textResponse);
      }

      return result.response.text();
    } catch (err) {
      console.error("AI Error:", err);
      const msg = err?.message || "Unknown error occurred";
      setError(msg);
      return `Error: ${msg}`;
    } finally {
      setIsTyping(false);
    }
  };

  return { sendCommand, isTyping, error, clearError: () => setError(null) };
}
