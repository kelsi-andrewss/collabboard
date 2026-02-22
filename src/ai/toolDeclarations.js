export const toolDeclarations = [
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
    description: "Creates a shape (rectangle, circle, triangle, line, or arrow) on the board. Use frameIndex to place it inside a frame created in the same batch.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING", enum: ["rectangle", "circle", "triangle", "line", "arrow"] },
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
  },
  {
    name: "createTextElement",
    description: "Creates a standalone text element on the board. Use for labels, headings, annotations, or any freeform text that does not need a sticky note background.",
    parameters: {
      type: "OBJECT",
      properties: {
        x: { type: "NUMBER", description: "X coordinate" },
        y: { type: "NUMBER", description: "Y coordinate" },
        text: { type: "STRING", description: "The text content" },
        width: { type: "NUMBER", description: "Width of the text block (default 200)" },
        fontSize: { type: "NUMBER", description: "Font size in pixels (default 16)" },
        color: { type: "STRING", description: "Hex color code for the text (default '#1a1a1a')" }
      },
      required: ["x", "y", "text"]
    }
  },
  {
    name: "drawCircle",
    description: "Draws a circle on the board centered at (cx, cy) with the given radius. Use for Euclidean geometry constructions.",
    parameters: {
      type: "OBJECT",
      properties: {
        cx: { type: "NUMBER", description: "X coordinate of the center" },
        cy: { type: "NUMBER", description: "Y coordinate of the center" },
        radius: { type: "NUMBER", description: "Radius of the circle" },
        color: { type: "STRING", description: "Hex color code (default '#3b82f6')" }
      },
      required: ["cx", "cy", "radius"]
    }
  },
  {
    name: "drawRegularPolygon",
    description: "Draws a regular polygon (equilateral triangle, square, pentagon, hexagon, etc.) as a series of connected line segments. Use for Euclidean geometry constructions.",
    parameters: {
      type: "OBJECT",
      properties: {
        cx: { type: "NUMBER", description: "X coordinate of the center" },
        cy: { type: "NUMBER", description: "Y coordinate of the center" },
        radius: { type: "NUMBER", description: "Circumradius — distance from center to each vertex" },
        sides: { type: "NUMBER", description: "Number of sides (integer between 3 and 12)" },
        color: { type: "STRING", description: "Hex color code (default '#333333')" }
      },
      required: ["cx", "cy", "radius", "sides"]
    }
  },
  {
    name: "drawPerpendicularBisector",
    description: "Draws the perpendicular bisector of a line segment defined by two endpoints. The bisector passes through the midpoint and is perpendicular to the segment.",
    parameters: {
      type: "OBJECT",
      properties: {
        x1: { type: "NUMBER", description: "X coordinate of the first endpoint" },
        y1: { type: "NUMBER", description: "Y coordinate of the first endpoint" },
        x2: { type: "NUMBER", description: "X coordinate of the second endpoint" },
        y2: { type: "NUMBER", description: "Y coordinate of the second endpoint" },
        length: { type: "NUMBER", description: "Total length of the bisector line to draw" },
        color: { type: "STRING", description: "Hex color code (default '#333333')" }
      },
      required: ["x1", "y1", "x2", "y2", "length"]
    }
  },
  {
    name: "drawAngleBisector",
    description: "Draws the bisector of the angle formed at a vertex by two rays. The bisector ray starts at the vertex and bisects the angle between the two rays.",
    parameters: {
      type: "OBJECT",
      properties: {
        vx: { type: "NUMBER", description: "X coordinate of the vertex (angle point)" },
        vy: { type: "NUMBER", description: "Y coordinate of the vertex (angle point)" },
        ax: { type: "NUMBER", description: "X coordinate of a point on ray A" },
        ay: { type: "NUMBER", description: "Y coordinate of a point on ray A" },
        bx: { type: "NUMBER", description: "X coordinate of a point on ray B" },
        by: { type: "NUMBER", description: "Y coordinate of a point on ray B" },
        length: { type: "NUMBER", description: "Length of the bisector ray to draw from the vertex" },
        color: { type: "STRING", description: "Hex color code (default '#333333')" }
      },
      required: ["vx", "vy", "ax", "ay", "bx", "by", "length"]
    }
  },
  {
    name: "drawTangentLine",
    description: "Draws the tangent lines from an external point to a circle. Draws both tangent lines if the point is outside the circle.",
    parameters: {
      type: "OBJECT",
      properties: {
        cx: { type: "NUMBER", description: "X coordinate of the circle center" },
        cy: { type: "NUMBER", description: "Y coordinate of the circle center" },
        radius: { type: "NUMBER", description: "Radius of the circle" },
        px: { type: "NUMBER", description: "X coordinate of the external point" },
        py: { type: "NUMBER", description: "Y coordinate of the external point" },
        color: { type: "STRING", description: "Hex color code (default '#333333')" }
      },
      required: ["cx", "cy", "radius", "px", "py"]
    }
  },
  {
    name: "drawDistanceLabel",
    description: "Places a text label at the midpoint of a segment showing the distance between two points. If no label is provided, the computed pixel distance is used.",
    parameters: {
      type: "OBJECT",
      properties: {
        x1: { type: "NUMBER", description: "X coordinate of the first point" },
        y1: { type: "NUMBER", description: "Y coordinate of the first point" },
        x2: { type: "NUMBER", description: "X coordinate of the second point" },
        y2: { type: "NUMBER", description: "Y coordinate of the second point" },
        label: { type: "STRING", description: "Text to display. Defaults to the computed integer distance." }
      },
      required: ["x1", "y1", "x2", "y2"]
    }
  },
  {
    name: "editText",
    description: "Edit the text content of a sticky note or the title of a frame",
    parameters: {
      type: "OBJECT",
      properties: {
        objectId: { type: "STRING", description: "ID of the object to edit" },
        text: { type: "STRING", description: "New text content" }
      },
      required: ["objectId", "text"]
    }
  },
  {
    name: "duplicateObject",
    description: "Duplicate an existing object with an optional position offset",
    parameters: {
      type: "OBJECT",
      properties: {
        objectId: { type: "STRING", description: "ID of the object to duplicate" },
        offsetX: { type: "NUMBER", description: "X offset for the clone (default 20)" },
        offsetY: { type: "NUMBER", description: "Y offset for the clone (default 20)" }
      },
      required: ["objectId"]
    }
  },
  {
    name: "changeMultipleColors",
    description: "Change the color of multiple objects at once",
    parameters: {
      type: "OBJECT",
      properties: {
        objectIds: { type: "ARRAY", items: { type: "STRING" }, description: "IDs of objects to recolor" },
        color: { type: "STRING", description: "New hex color value" }
      },
      required: ["objectIds", "color"]
    }
  },
  {
    name: "createConnector",
    description: "Creates a connector (line or arrow) anchored between two existing objects at specific ports. Use this instead of createShape when the user asks to connect, link, or draw an arrow between two objects.",
    parameters: {
      type: "OBJECT",
      properties: {
        startObjectId: { type: "STRING", description: "ID of the object to connect from" },
        startPort: { type: "STRING", enum: ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-left", "bottom-right"], description: "Anchor port on the start object" },
        endObjectId: { type: "STRING", description: "ID of the object to connect to" },
        endPort: { type: "STRING", enum: ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-left", "bottom-right"], description: "Anchor port on the end object" },
        color: { type: "STRING", description: "Hex color code (default '#6366f1')" },
        arrowhead: { type: "BOOLEAN", description: "Whether to show an arrowhead (default true)" }
      },
      required: ["startObjectId", "startPort", "endObjectId", "endPort"]
    }
  }
];

export function buildSystemPrompt(aiResponseMode) {
  const responseModeInstruction = aiResponseMode === 'full'
    ? 'After executing any tool, provide a detailed, conversational response explaining what you did and why.'
    : 'After executing any tool, always respond with a brief confirmation message summarizing what was done — one sentence maximum.';
  return buildSystemPromptText(responseModeInstruction);
}

function buildSystemPromptText(responseModeInstruction) {
  return `You are a whiteboard assistant acting on behalf of the logged-in user. You can create, move, resize, recolor, delete, and arrange objects on the board. You can also create boards.

CRITICAL RULE: NEVER ask the user for clarification. ALWAYS use your best judgment and act immediately.

RESPONSE RULE: ${responseModeInstruction}

DUPLICATES ARE ALLOWED: Objects are identified by unique IDs, not by title or text. Always create requested objects even if similar ones exist. Board name deduplication is handled automatically.

PLACEMENT DEFAULTS: Place objects at the top level (no parentGroupId) unless the user explicitly names a group.

TOOL SELECTION:
- "fix overlaps" / "make items not overlap" → resolveOverlaps
- "arrange by type" / "group by type" → arrangeByType (includes ALL object types: frames, shapes, stickies, lines)
- "arrange in a grid" → arrangeInGrid (moves existing objects; does NOT create new ones)
- "space evenly" / "distribute" → spaceEvenly
- "fit frame to contents" / "resize frame to fit" → fitFrameToContents (not resizeObject + moveObject)
- Frames are fully transformable: moveObject and resizeObject both work on frames.
- For structured boards (kanban, SWOT, retrospective, sprint planning, etc.): create frames for each section and use frameIndex to place items inside them.

FRAME-ITEM ASSOCIATION (frameIndex):
- Give each createFrame a unique frameIndex (0, 1, 2, ...)
- Give each createStickyNote/createShape a matching frameIndex to auto-place it inside that frame
- Items with frameIndex are AUTO-POSITIONED — do NOT specify x/y for them
- Frame sizes are AUTO-CALCULATED from item count — do NOT specify width/height for frames with items

FRAME NESTING (parentFrameIndex):
- Set parentFrameIndex on a child frame to nest it inside the parent frame's frameIndex
- Parent frames must be created in the same batch and auto-size to include child frames and items

DEFAULTS:
- Coordinates: x: 500, y: 500 if not specified
- Colors: '#fef08a' for sticky notes, '#3b82f6' for shapes, '#6366f1' for frames
- Always provide sensible labels — never leave cells empty

The user's message includes a summary of current board objects with their IDs, types, positions, sizes, and text. Use those IDs. Match objects by text, type, or position.`;
}
