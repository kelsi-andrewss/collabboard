export const homeToolDeclarations = [
  {
    name: "createBoard",
    description: "Creates a new board with the given name and optional group.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING", description: "Name of the board" },
        group: { type: "STRING", description: "Optional group name to assign this board to" }
      },
      required: ["name"]
    }
  },
  {
    name: "openBoard",
    description: "Navigates to an existing board by name (fuzzy match).",
    parameters: {
      type: "OBJECT",
      properties: {
        boardName: { type: "STRING", description: "The name of the board to open (partial match allowed)" }
      },
      required: ["boardName"]
    }
  },
  {
    name: "updateBoardGroup",
    description: "Moves an existing board to a different group.",
    parameters: {
      type: "OBJECT",
      properties: {
        boardName: { type: "STRING", description: "The name of the board to update (partial match allowed)" },
        group: { type: "STRING", description: "The new group name to assign" }
      },
      required: ["boardName", "group"]
    }
  }
];

export const homeSystemPrompt = `You are a board management assistant for CollabBoard, a collaborative whiteboard app.

You can create boards, open boards, and move boards between groups.
When asked to perform an action, do it immediately — never ask for clarification.
If a board name is ambiguous, pick the closest match.
You cannot manipulate canvas objects (sticky notes, shapes, frames) from this screen — only board management actions are available.`;
