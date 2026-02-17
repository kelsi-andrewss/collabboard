import { getGenerativeModel } from "firebase/ai";
import { ai } from "../firebase/config";
import { useState, useMemo } from "react";

export function useAI(boardId, boardActions, objects) {
  const [isTyping, setIsTyping] = useState(false);

  // Define tools for the model
  const tools = useMemo(() => ({
    functionDeclarations: [
      {
        name: "createStickyNote",
        description: "Creates a new sticky note on the board.",
        parameters: {
          type: "OBJECT",
          properties: {
            text: { type: "STRING", description: "The content of the sticky note" },
            x: { type: "NUMBER", description: "X coordinate (0-1000)" },
            y: { type: "NUMBER", description: "Y coordinate (0-1000)" },
            color: { type: "STRING", description: "Hex color code" }
          },
          required: ["text", "x", "y"]
        }
      },
      {
        name: "createShape",
        description: "Creates a shape (rectangle, circle, triangle, or line) on the board.",
        parameters: {
          type: "OBJECT",
          properties: {
            type: { type: "STRING", enum: ["rectangle", "circle", "triangle", "line"] },
            x: { type: "NUMBER" },
            y: { type: "NUMBER" },
            width: { type: "NUMBER" },
            height: { type: "NUMBER" },
            color: { type: "STRING" }
          },
          required: ["type", "x", "y"]
        }
      },
      {
        name: "createFrame",
        description: "Creates a frame (visual container with title) on the board.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Title of the frame" },
            x: { type: "NUMBER" },
            y: { type: "NUMBER" },
            width: { type: "NUMBER", description: "Width (default 400)" },
            height: { type: "NUMBER", description: "Height (default 300)" },
            color: { type: "STRING", description: "Hex color code" }
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
      }
    ]
  }), []);

  const model = useMemo(() => {
    if (!boardId) return null;
    return getGenerativeModel(ai, {
      model: "gemini-2.0-flash",
      tools: [tools],
      systemInstruction: `You are a whiteboard assistant. You can create, move, resize, and recolor objects on the board.

When asked to create an object, ALWAYS use the provided tools. If coordinates (x, y) are not provided, use x: 500 and y: 500 as defaults. If colors are not provided, use '#fef08a' for sticky notes and '#3b82f6' for shapes.

DO NOT ask the user for coordinates, just create the object.

You can also move, resize, and change colors of existing objects. The user's message will include a summary of current board objects with their IDs, types, positions, and text. Use the object IDs from that context to target operations. Match objects by their text content, type, or position when the user refers to them.

When asked to create a grid, table, matrix, or organized layout of multiple objects, use the createGrid tool instead of creating objects individually. Provide labels when the user specifies text for each cell.`
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
      return desc;
    });
    return `[Current board objects: ${summaries.join(' | ')}]\n\n`;
  };

  const sendCommand = async (prompt) => {
    if (!chat) return "AI is not initialized.";
    const contextPrompt = buildBoardContext() + prompt;
    console.log("AI Prompt Sent:", contextPrompt);
    setIsTyping(true);
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
        for (const call of calls) {
          console.log("Executing Tool:", call.name, call.args);
          if (call.name === "createStickyNote") {
            await boardActions.addObject({ type: 'sticky', ...call.args });
          } else if (call.name === "createShape") {
            await boardActions.addObject({ ...call.args });
          } else if (call.name === "createFrame") {
            await boardActions.addObject({ type: 'frame', width: 400, height: 300, color: '#6366f1', ...call.args });
          } else if (call.name === "moveObject") {
            const { objectId, ...updates } = call.args;
            await boardActions.updateObject(objectId, updates);
          } else if (call.name === "resizeObject") {
            const { objectId, ...updates } = call.args;
            await boardActions.updateObject(objectId, updates);
          } else if (call.name === "changeObjectColor") {
            const { objectId, color } = call.args;
            await boardActions.updateObject(objectId, { color });
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
                await boardActions.addObject(objData);
                idx++;
              }
            }
          }
        }
      } else {
        const textResponse = result.response.text();
        console.log("AI returned text instead of tool call:", textResponse);
      }

      return result.response.text();
    } catch (error) {
      console.error("AI Error:", error);
      return "Sorry, I had trouble processing that command.";
    } finally {
      setIsTyping(false);
    }
  };

  return { sendCommand, isTyping };
}
