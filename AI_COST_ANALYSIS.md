# AI Cost Analysis — CollabBoard

## Development Spend

| Phase | Actual Cost | Projected (full week) |
|---|---|---|
| Claude Code API usage | $0.09 | ~$0.25 |

Development used Claude Sonnet 4.6 as the primary model (orchestrator, planner, and most coders), with Haiku for trivial tasks and Opus reserved for escalations. The $0.09 actual spend covers approximately 4 days of active development; $0.25 is the projected cost had all 7 days been equally active.

---

## Production Cost Model

### Assumptions

| Variable | Value | Basis |
|---|---|---|
| AI sessions per user per month | 8 | ~2 sessions/week |
| Commands per session | 5 | Observed usage in testing |
| Input tokens per command | ~2,500 | System prompt (1,800) + board context (700) |
| Output tokens per command | ~350 | Tool call JSON + brief response |
| Blended cost per 1K input tokens | $0.000075 | Gemini 2.0 Flash (Vertex AI) |
| Blended cost per 1K output tokens | $0.000300 | Gemini 2.0 Flash (Vertex AI) |

### Cost Per User Per Month

| Component | Calculation | Cost |
|---|---|---|
| Input tokens | 8 sessions × 5 commands × 2,500 tokens = 100,000 tokens | $0.0075 |
| Output tokens | 8 sessions × 5 commands × 350 tokens = 14,000 tokens | $0.0042 |
| **Total AI cost** | | **~$0.012/user/month** |

---

## Scale Projections

| Users | Monthly AI Cost | Firebase (est.) | Total Monthly |
|---|---|---|---|
| 100 | $1.20 | ~$0 (free tier) | ~$1.20 |
| 1,000 | $12 | ~$25 | ~$37 |
| 10,000 | $120 | ~$200 | ~$320 |
| 100,000 | $1,200 | ~$1,500 | ~$2,700 |

### Firebase Cost Breakdown (at 10,000 MAU)

| Service | Usage Estimate | Cost |
|---|---|---|
| Firestore reads | ~5M reads/month | ~$90 |
| Firestore writes | ~1M writes/month | ~$54 |
| Realtime Database | ~50 GB bandwidth/month | ~$30 |
| Authentication | Unlimited (free) | $0 |
| Hosting | ~10 GB bandwidth/month | ~$10 |
| **Firebase total** | | **~$184/month** |

---

## Cost Optimization Levers

1. **Shrink the system prompt**: The 1,800-token system prompt dominates per-command cost. A 50% reduction would cut AI costs by ~37%.
2. **Board context truncation**: Send only visible/recently-modified objects rather than the full board. Boards with 50+ objects inflate input tokens significantly.
3. **Client-side caching**: Cache unchanged board context between commands in the same session. Avoids re-sending stable object data.
4. **Model tiering**: Route simple commands ("change color", "move object") to Gemini Flash Lite or a smaller model. Reserve full Flash for multi-step operations.
5. **Session batching**: Group multiple user commands into a single multi-turn API call where possible, amortizing the fixed system prompt cost.

At 10,000 MAU, applying optimizations 1–3 could reduce the AI component from ~$120/month to ~$50–70/month.
