# AI Development Log — CollabBoard

## Tools & Workflow

**Primary tool**: Claude Code (CLI) — used for the majority of the development lifecycle from architecture planning through final polish. Every feature, bug fix, and refactor was implemented via the Claude Code pipeline: a planning phase (plan mode) producing an approved specification, followed by background coder agents executing in isolated git worktrees.

**Initial tool**: JetBrains Junie — used at the start of the project for early scaffolding and initial feature exploration. Switched to Claude Code once the pipeline-based workflow (plan → worktree → background coder) proved more effective for managing a complex, multi-epic codebase at scale.

**Secondary tool**: MCP integrations — a Slack MCP for async collaboration and a Puppeteer-based script for exporting tracking charts to PDF/PNG.

**Workflow pattern**: AI-first, plan-then-execute. Each session began with a planning conversation to produce a complete spec (file targets, root causes, pitfalls, sequencing), then the spec was passed verbatim to background coder agents. Coders never designed — they only executed approved plans. This separation produced a near-zero reviewer round-trip rate: the majority of stories passed on the first coder attempt.

---

## MCP Usage

| MCP | What it enabled |
|---|---|
| Slack MCP | Sent async messages to collaborators without leaving the terminal; posted milestone updates |
| Puppeteer (custom script) | Exported the token-usage Chart.js dashboard to full-page PNG + PDF for submission artifacts |

---

## Effective Prompts

### 1. Vague complaint that unlocked a 30k-char system audit
> "The moving of frames, stickies, and shapes, the snapping of them, the nesting of them, the functionality overall is not very robust and still rather glitchy."

**Why it worked**: Deliberately vague. Covering the whole system rather than one bug let Claude spawn a sub-agent to do a comprehensive static analysis across all drag/snap/nesting code. The result was a 30k-char analysis identifying 8+ distinct bugs with file paths and line numbers. A specific bug report would have produced a specific fix; the vague complaint produced a system-level audit.

### 2. Two words after a complete analysis
> "fix all"

**Why it worked**: The preceding 30k-char analysis fully specified every bug — root cause, file, line, fix. "Fix all" was a pure execution trigger. Extreme concision is correct when specification work is already done. This is the complement to the vague-complaint pattern: vague when you need diagnosis, minimal when the diagnosis is complete.

### 3. Providing the complete causal chain before asking for a fix
> "Bug fix: useBoard subscribes to Firestore before auth is ready on direct link navigation. Problem: When a user navigates directly to a board URL, boardId is initialized synchronously from the URL hash before Firebase Auth has resolved. The Firestore subscription starts before `user` is non-null, gets a permission error, and never retries."

**Why it worked**: The complete event sequence was provided (direct URL → sync boardId init → auth not yet resolved → subscription starts → permission error → no retry). Claude could implement the exact fix without any investigation.

### 4. Architectural reset via meta-question
> "Are we overcomplicating this? How do other whiteboard apps handle this? Should we refactor?"

**Why it worked**: "Are we overcomplicating this?" authorized Claude to recommend a simpler design rather than just patching the current one. "How do other whiteboard apps handle this?" explicitly invited external research (Figma, Miro, Excalidraw). The combination produced a simplification plan that removed ~200 lines of resize complexity.

### 5. Isolating a directional bug with a contrast statement
> "Dragging a child frame to the left of a parent frame, the parent frame does not resize. The other anchors work."

**Why it worked**: "The other anchors work" narrowed the search space from the entire resize system to the left/top expansion path in `computeAncestorExpansions`. Without it, Claude would have audited the whole system.

---

## Code Analysis

| Category | Estimate |
|---|---|
| AI-generated code | ~92% |
| Hand-written code | ~8% |

The hand-written 8% was primarily: initial Firebase config and environment setup, manual conflict resolution during epic merges, and a few targeted one-line hotfixes applied directly after build failures.

The AI-generated 92% includes all feature implementation, refactors, CSS, tests, and Firestore security rules. The planning and specification work (deciding what to build and how) was collaborative — roughly 50/50 between human direction and AI research/suggestions.

---

## Strengths & Limitations

**Where AI excelled**:
- Mechanical implementation from detailed specs — near-zero error rate when the plan was complete
- Cross-file refactors (e.g., App.jsx decomposition from 1,800 lines into handler modules)
- Security rule generation that mirrored client-side logic exactly
- Finding non-obvious root causes in async/closure bugs (stale refs, auth race conditions)
- Batch feature implementation — 14 independent todos in a single session with no regressions

**Where AI struggled**:
- Scope creep — agents occasionally added unrequested "improvements" to protected files, requiring diff-gate restoration
- Async interaction bugs — a recurring class of bugs involving React state captured in event handlers or Firebase callbacks required multiple attempts before the ref-based fix pattern was established
- Recenter button — required 3 attempts and an explicit "ask clarifying questions" meta-instruction before the viewport semantics were resolved correctly
- Nested dependency ordering — in a few multi-file stories, the agent wrote a consumer before writing the thing it consumed, causing transient build failures

---

## Key Learnings

1. **Plan first, always.** Prompts that included file paths, root causes, and edge cases produced first-pass implementations. Prompts that described only symptoms required multiple round-trips. The specification is the highest-leverage investment.

2. **Vague when diagnosing, minimal when executing.** A deliberately broad complaint ("the whole feature is broken") is more useful than a specific guess when the root cause is unknown. Once the diagnosis is complete, two words can trigger the fix.

3. **History of failed attempts prevents re-suggestion.** Including "we already tried X and it broke Y" in a bug fix prompt reliably prevented Claude from re-suggesting the already-failed approach.

4. **Ask for opinions, not options.** "What do you suggest?" produces a concrete recommendation. "What are the tradeoffs?" produces a neutral list. The former is more useful when you need a decision.

5. **The ref pattern is load-bearing.** More than a dozen bugs in this project traced to the same root cause: React state read inside an async callback (setTimeout, Firestore listener, event handler) that captured a stale value. Once `useRef` + `.current` was established as the invariant for async state access, this entire class of bugs stopped appearing.

6. **Structured tracking compounds.** Recording effective prompts and their context in a per-day log made it possible to reuse patterns across sessions. The tracking system itself became a forcing function for reflecting on what worked — which improved prompt quality over the course of the week.
