# CLAUDE.md — CollabBoard

## CRITICAL WORKFLOW MANDATE

You are a pipeline orchestrator. You MUST NOT edit, write, or create any source code files directly.

ALL code changes — no matter how small — MUST go through the pipeline:
- To fix a bug or add a feature: use `/todo "description of the change"`
- Do NOT call Edit or Write on any file under `src/` directly

Direct edits to project files are blocked by the system. The only correct path is the pipeline.

---

## Orchestration
Before answering any workflow or pipeline question — including hypotheticals — read `~/.claude/ORCHESTRATION.md` first. Never answer from general knowledge when user-specific rules exist.

---

## Project Overview
Real-time collaborative infinite whiteboard built with React 19, Konva.js, and Firebase. Supports multiplayer cursors, sticky notes, shapes, frames, lines, and an AI agent (Gemini 2.0 Flash via Vertex AI) that can manipulate board objects via function calling.

---

## Tech Stack
- **React 19** + **Vite 7** — UI and build
- **Konva.js 10 / react-konva 19** — infinite canvas rendering
- **Firebase 12**: Auth (Google), Firestore (objects), Realtime Database (presence/cursors), Vertex AI (Gemini)
- **lucide-react** — icons
- No Redux or global state library; state lives in custom hooks + Firebase

---

## Directory Layout
```
src/
  ai/               # Gemini tool declarations + executors
  components/       # React + Konva UI components
  handlers/         # Pure-logic factory functions (no React)
  hooks/            # Custom hooks (auth, board, AI, presence, undo)
  utils/            # colorUtils.js, frameUtils.js
  firebase/config.js
  App.jsx           # Root orchestrator — wires all hooks together
  main.jsx
```

---

## Architecture Rules

### State management
- All board data is the Firestore `boards/{boardId}/objects` collection; hooks subscribe via `onSnapshot`.
- Use `useUndoStack` (wraps `useBoard`) when you need add/update/delete with undo support. Never call `useBoard` methods directly from components; go through the undo stack.
- Refs (`useRef`) are used for imperative access inside async callbacks. When a hook needs fresh state inside an async function, store it in a ref and read `.current`.

### Handler factories
Handlers are **not** hooks. Each factory (`makeObjectHandlers`, `makeFrameDragHandlers`, `makeTransformHandlers`, `makeStageHandlers`) accepts a config object and returns plain functions. Keep them free of React imports. Wire them in `App.jsx`.

### Konva / canvas
- All canvas elements are rendered inside `<BoardCanvas>` which is `React.memo`-wrapped with a custom equality check. Be careful: adding new props that change on every render will defeat memoization.
- Objects are sorted before rendering: frames first (by zIndex), then non-frames (by zIndex). Maintain this sort when adding new object types.
- The dot grid (`snapToGrid`) renders one `<Rect>` per grid intersection. If `cols * rows > 5000` it skips rendering entirely — keep this guard.

### Frame system
Frames are the most complex part of the codebase. Key invariants to preserve:
- A frame's `childIds` array must stay in sync with each child's `frameId` field. Always update both atomically via `writeBatch`.
- When a child grows or moves, ancestors must auto-expand (`expandAncestors` in `frameUtils.js`).
- Overlap detection prevents siblings from colliding inside a frame.
- Minimum frame size is constrained by the union of its children's bounding boxes.

### AI system (src/ai/)
- `toolDeclarations.js` — Gemini tool schemas + system prompt. Edit here to add/remove AI capabilities.
- `toolExecutors.js` — Maps tool names to board mutation logic.
- `useAI.js` — Stateful Gemini chat session. Executes a **2-pass** strategy: frames are created first (pass 1), then all other objects (pass 2), so that `frameIndex` references resolve correctly.
- The system prompt instructs the model to **never ask for clarification**; it acts immediately. Preserve this behavior.

---

## Firestore Object Schema
```js
// boards/{boardId}/objects/{objectId}
{
  type: 'sticky' | 'rectangle' | 'circle' | 'triangle' | 'line' | 'frame',
  x: number, y: number,
  width: number, height: number,
  color: string,           // hex
  text: string,            // sticky content or frame title
  rotation: number,
  zIndex: number,
  frameId: string | null,  // parent frame ID
  childIds: string[],      // only meaningful for frames
  strokeWidth: number,     // lines/shapes
  points: number[],        // lines: [x1,y1,x2,y2,...]
  userId: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
}
```

---

## Key Conventions

### Naming
- Components: `PascalCase.jsx`
- Hooks: `use<Name>.js`
- Handler factories: `make<Name>Handlers`
- Utilities: lowercase, verb-prefixed (`findOpenSpot`, `isInsideFrame`)

### Mutations
- Single object → `updateObject(id, patches)` (Firestore `setDoc` merge)
- Multiple related objects → `writeBatch` to keep data consistent
- Undo-tracked mutations → use the methods returned by `useUndoStack`

### Performance
- Throttle presence cursor writes (current: 50 ms minimum interval). Don't remove this throttle.
- Use `React.memo` and stable references when passing props into `BoardCanvas`.
- Prefer Firestore batch writes over sequential `updateObject` calls for related changes.

### Security (current scope)
- All authenticated users can read/write all boards. There is no per-board ACL.
- RTDB rules allow users to write only their own presence entry (`auth.uid === $userId`).
- Do not remove or weaken these rules without explicit discussion.

---

## Adding a New Object Type
1. Add the type literal to the `type` union in the schema above.
2. Create a rendering component in `src/components/`.
3. Add a creation handler in `objectHandlers.js` (`handleAdd<Type>`).
4. Wire the creation button in `HeaderLeft.jsx` and/or `FABButtons.jsx`.
5. Add a Gemini tool declaration in `src/ai/toolDeclarations.js` and an executor in `toolExecutors.js`.
6. Update the sort order in `BoardCanvas.jsx` if the type needs special z-ordering.

## Adding a New AI Tool
1. Add the tool schema to the `tools` array in `toolDeclarations.js`.
2. Add a corresponding executor function in `toolExecutors.js`.
3. Update the system prompt if the tool requires behavioral guidance.
4. Test via the AI panel — the 2-pass execution order matters if your tool creates frames.

---

## Common Gotchas
- **Konva transformer**: Always call `transformer.nodes([])` before deleting a selected object, or Konva will throw on the stale reference.
- **Frame childIds drift**: If you update `frameId` on an object without atomically updating the parent frame's `childIds`, the frame system will silently break.
- **Dot grid perf**: The grid renders N*M individual Konva `<Rect>` nodes. Adding more grid-related logic here will hurt performance at low zoom levels. Consider migrating to a single `Shape` with a `sceneFunc` loop if perf becomes an issue.
- **useAI chat state**: The Gemini `ChatSession` is per-board and held in a ref. Switching boards creates a new session; the old one is discarded (no server-side cleanup needed).
- **Undo stack max**: Capped at 50 entries. Batch operations count as one entry regardless of how many objects are affected.

## Protected Konva Files

The following files render directly to the Konva canvas and are protected from agent edits.
Agents MUST NOT edit these files without explicit user permission granted in the current session:

- `src/components/BoardCanvas.jsx`
- `src/components/StickyNote.jsx`
- `src/components/Frame.jsx`
- `src/components/Shape.jsx`
- `src/components/LineShape.jsx`
- `src/components/Cursors.jsx`

Permission denies are also enforced via `.claude/settings.local.json`.
If you need to modify one of these files, ask the user first and wait for explicit approval.

## Protected Testable Files

The following files have test coverage and are protected from agent edits. Editing them requires user permission and automatically enables the unit-tester for that story (`needsTesting: true`). The exception is stored on the story in epics.json — do NOT modify `.claude/settings.local.json` directly.

**Hooks**: `src/hooks/useBoard.js`, `src/hooks/useBoardsList.js`, `src/hooks/useRouting.js`

**Handlers**: `src/handlers/objectHandlers.js`, `src/handlers/stageHandlers.js`, `src/handlers/transformHandlers.js`

**Utils**: `src/utils/frameUtils.js`, `src/utils/connectorUtils.js`, `src/utils/colorUtils.js`, `src/utils/slugUtils.js`, `src/utils/tooltipUtils.js`

**Components**: `src/components/BoardAccessDenied.jsx`, `src/components/GroupPage.jsx`, `src/components/GroupSettings.jsx`, `src/components/GroupCard.jsx`, `src/components/BoardSelector.jsx`, `src/components/BoardSettings.jsx`

Permission denies are enforced via `.claude/settings.local.json`.
