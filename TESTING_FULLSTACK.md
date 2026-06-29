# Manual E2E Test — Full-Stack UI

> **Status:** API + UI CHECKS CONFIRMED — 2026-06-29. Step-by-step end-to-end test for the MVP
> built per [README_FULLSTACK.md](README_FULLSTACK.md) (Express API + Vite/Chakra-v3 SPA). Section 2
> (API-only) and Section 3 (browser UI, 3.1–3.5 — automated via `web/e2e/ui-smoke.mjs` plus a manual
> pass) were run against a live stack on 2026-06-29 and **pass**; 3.6 (backend-down) is operator-run.
> Two follow-ups surfaced by the run are tracked under **Open issues** below.

## Automated UI run

`web/e2e/ui-smoke.mjs` drives the running Vite dev server with Playwright (chromium) for cases
3.1–3.5 — soft assertions, screenshots to `web/e2e/screenshots/` (gitignored). With both servers up:

```bash
node web/e2e/ui-smoke.mjs        # from the repo root; HEADED=1 to watch it
```

These steps need real credentials and infra (the generate path spends OpenAI + queries Qdrant), so
they can't be exercised in CI without secrets. Do them locally.

---

## 0. Prerequisites

| Requirement | How to satisfy / verify |
|---|---|
| Node 20+ | `node -v` |
| Root deps installed | `npm install` (repo root) |
| Web deps installed | `cd web && npm install` |
| `OPENAI_API_KEY` set | a real key in `.env` (the server fails fast at boot without it) |
| `DEBUG=false` | set in `.env` — else the OpenAI SDK floods stdout |
| Qdrant up | `docker run -p 6333:6333 qdrant/qdrant` (or your instance at `QDRANT_URL`) |
| Corpus embedded | the `chakra-ui-docs` collection has points (see check below) |

**Verify Qdrant + corpus** (the generate path retrieves from it):

```bash
curl -s http://localhost:6333/collections/chakra-ui-docs | grep -o '"points_count":[0-9]*'
# expect a non-zero count. If the collection is missing/empty, embed first:
#   npm run cli -- 2-embed
```

**Sanity-check generation works at all** (bypasses the UI — isolates infra from the web layer):

```bash
npm run cli -- 4-generate "a green submit button"
# expect a tsc=ok | v2-smells=... | composition=... | render=... line and a written .tsx
```

If this CLI line fails, fix infra here before touching the UI — the API calls the exact same pipeline.

---

## 1. Start the two processes

**Terminal A — backend API** (repo root):

```bash
npm run serve            # -> 🚀 generation API listening on http://localhost:3001
# override port with: npm run serve -- -p 4000   (or PORT=4000 npm run serve)
```

**Terminal B — frontend** (`web/`):

```bash
cd web && npm run dev    # -> Vite on http://localhost:5173, proxies /api -> :3001
```

Open the Vite URL (http://localhost:5173).

---

## 2. API-only checks (no browser)

Confirm the HTTP surface before the UI. Run these in a third terminal.

```bash
# health — no key/Qdrant needed beyond boot
curl -s http://localhost:3001/api/health
# expect: {"ok":true,"model":"gpt-4o"}

# examples — the held-out prompts that seed the UI chips
curl -s http://localhost:3001/api/examples
# expect: {"examples":[{"id":"close-button",...}, ... 5 items]}

# generate (grounded) — the real e2e call; takes a few seconds + spends OpenAI
curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"query":"a green submit button"}'
# expect JSON with: component (TSX string), tscOk, tscOkSingleShot, repairIters,
#   smells[], incomplete[], renderOk, context[] (retrieved chunks), model, grounded:true

# generate (ungrounded) — ablation; relies on model memory
curl -s -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d '{"query":"a green submit button","useContext":false}'
# expect grounded:false, context:[] — and typically WORSE objective signals
#   (more v2 smells / tsc errors) than the grounded call above

# validation: empty query -> 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" -d '{"query":""}'        # expect 400

# validation: over-long query (>500 chars) -> 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/generate \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"$(printf 'a%.0s' {1..600})\"}"              # expect 400

# rate limit: 11 calls in one minute -> the 11th returns 429
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:3001/api/generate \
    -H "Content-Type: application/json" -d '{"query":"a button"}'
done; echo
# expect ten 200s then 429 (cost guardrail; window is 60s)
```

---

## 3. UI test cases (browser)

For each: type/click the prompt, press **Generate** (or `Cmd/Ctrl+Enter`), wait for the result.

1. **Held-out prompt (happy path).** Click the example chip *"a large page heading that says
   Welcome back"* → Generate.
   - **Live preview** renders the heading (Sandpack; first load pulls Chakra into the iframe, so the
     very first preview of a session is slow — subsequent ones are fast).
   - **Badges**: `tsc ✓`, `no v2 smells`, `composition complete`, `renders ✓`, `grounded`.
   - **Code view** shows the TSX; **Copy** copies it.
   - **Grounded in** expands to a list of retrieved chunks (component / type / score).

2. **Landmine prompt.** Type *"a green submit button"* → Generate.
   - Renders a green button; badges reflect the **server** report (don't assume — read them).
   - If it self-healed you'll see `tsc ✓ (self-healed ×N)` **and** the `needed repair` badge — that's
     the honest "generated-then-fixed" signal, not a failure.

3. **Grounding toggle (ablation).** Turn the **Grounded** switch **off**, regenerate the same prompt.
   - `Grounded in` panel shows the *ungrounded* note (no chunks); the `ungrounded` badge shows.
   - Output is often visibly worse (v2 smell badge orange, or a render/tsc miss) — this is the point
     of the toggle. Turn it back **on** to contrast.

4. **Regenerate (non-determinism).** Generate the same prompt twice with grounding on.
   - Output may differ run to run (temp 0.2). Expected — not a bug.

5. **Out-of-corpus prompt.** Type something the ~50-component corpus won't cover, e.g. *"a candlestick
   stock chart"*.
   - Grounded-in scores will be low / off-topic; output quality may drop. Note the behavior.

6. **Error surfacing.** Stop the backend (Ctrl-C in Terminal A), Generate in the UI.
   - The red inline error box appears with a readable message (proxy/connection failure).

---

## Results — fill this in on a live run

Date run: `2026-06-29` (Section 2)   ·   Backend model (`/api/health`): `gpt-4o`   ·   Qdrant points_count: `897`

| # | Check | Pass? | Notes (badges seen / surprises) |
|---|---|---|---|
| 2a | `/api/health` returns ok + model | ✅ | `{"ok":true,"model":"gpt-4o"}` |
| 2b | `/api/examples` returns 5 prompts | ✅ | close-button, heading, checkbox-card, file-upload, color-picker |
| 2c | grounded `/api/generate` returns full report + context[] | ✅ | `"a green submit button"` → `colorPalette="green"` (v3), tscOk + single-shot, renders ✓, smells [], 8 context chunks (top: Button, score 0.39) |
| 2d | ungrounded call: grounded:false, context:[], worse signals | ✅ | leaked **`colorScheme`** (v2) → `smells:["colorScheme"]`; `grounded:false`, `context:[]`. Clean ablation vs 2c's `colorPalette`. (tsc still passed — colorScheme type-checks but is a v2 smell.) |
| 2e | empty / over-long query → 400 | ✅ | empty → `"Body must include a non-empty \"query\" string."`; >500 chars → `"Query too long (max 500 characters)."` |
| 2f | 11th call in a minute → 429 | ✅ | 10/60s window enforced; 11th → 429 `{"error":"Rate limit exceeded — retry in 22s."}` + `Retry-After: 22`. Counter includes validation-400 hits (limiter runs before validation). |
| 3.1 | held-out prompt: live preview + green badges | ✅ | heading + preview iframe + `tsc ✓ (clean first try) / no v2 smells / composition complete / renders ✓ / grounded` |
| 3.2 | landmine prompt renders; badges server-truthful | ✅ | **non-deterministic:** manual run leaked v2 `colorScheme` → smell badge + **black button** (green expected); automated run came back clean. Same prompt, both outcomes valid — badges were truthful each time. |
| 3.3 | grounding toggle visibly degrades output | ✅ | switch off → `ungrounded` badge + `v2-smells: 1` (the `colorScheme` leak). Reproducible ablation. |
| 3.4 | regenerate varies (non-determinism) | ✅ | grounded regen of the landmine matched the prior run this time; variation is expected, not required. |
| 3.5 | out-of-corpus: low scores / graceful | ✅ | `"a candlestick stock chart"` → top match **List @ 0.243** (vs ~0.35+ in-corpus); model fell back to v3 primitives (Box/Flex/Text), tsc ✓ + renders ✓. Grounding contributed nothing — motivates the weak-grounding warning (Open issue 2). |
| 3.6 | backend down → inline error box | ☐ | operator-run. Expected: Vite proxies to a refused `:3001` → HTTP 500 → UI shows `Request failed (500)` (or `Failed to fetch` if the socket resets). Generic message — see Open issue 3. |

**Section 2 highlights (live run, 2026-06-29):**

- **Grounding works as designed.** Same prompt `"a green submit button"`: grounded → v3 `colorPalette="green"`
  (zero smells); ungrounded → v2 `colorScheme="green"` (flagged `colorScheme`). This is the headline
  evidence that retrieval, not model memory, supplies the correct v3 API.
- **Rate-limit nuance worth knowing:** the limiter counts *every* `/api/generate` hit, including ones
  that then 400 on validation (it runs before the handler). So a burst of malformed requests can
  consume the budget — intended (it's a cost guardrail), just noted so the 400→429 transition isn't
  surprising.

**Open issues found:**

1. **v2 smells are reported but not a repair trigger.** Even *grounded*, non-determinism occasionally
   yields `colorScheme` (v2) instead of `colorPalette` (v3). It type-checks and mounts, so `tsc ✓` and
   `renders ✓` both pass — but the prop is a runtime no-op, so the button renders **black, not green**.
   Only the `v2-smell` badge catches it, and the component ships anyway. Candidate fix: feed a non-empty
   `smells[]` back into the self-heal loop as a soft repair trigger (Pass G territory). *Not done here —
   flagged for triage.*
2. **`grounded: true` is misleading on out-of-corpus requests** (3.5). When the top retrieval score is
   low (~0.24 vs ~0.35+ for real matches), the chunks are noise and the output is model-memory in
   practice, yet the badge still says "grounded." → **Follow-up implemented:** surface a weak-grounding
   warning when the top score is below a threshold.
3. **Generic network-error copy** (3.6). A backend-down failure surfaces as `Request failed (500)` /
   `Failed to fetch` — correct, but unhelpful. → **Follow-up implemented:** friendlier "backend
   unreachable" message.

**Follow-ups implemented (commit 2 — under review):**

- Weak-grounding warning banner in the UI (threshold on the top `context` score; no new backend data).
- Friendlier network/5xx error message in the API client.

---

## Known caveats (expected, not bugs)

- **Non-determinism** — gpt-4o at temp 0.2; same prompt varies. Regenerate is normal UX.
- **Sandpack first-load latency** — the first live preview of a session bundles Chakra in the iframe
  and is slow; later previews are fast.
- **Export-shape heuristic** — `web/src/lib/sandbox.ts` normalises the generated component's default /
  named / no-export shapes so the preview can mount it. If a preview is blank while `renders ✓`, the
  component likely has an export shape the heuristic missed — capture the code under **Open issues**.
- **~93% is on adversarial landmines; held-out non-trap prompts are ~100%** — real UX is closer to the
  held-out end. Trust the badges over any promise.
