# Deploy — single container (Cloud Run · Render), Qdrant Cloud, DeepSeek V4

> **Status:** 2026-07-01 — **LIVE on Google Cloud Run:**
> **https://spec-to-component-986872156950.us-central1.run.app** (`/api/health` → `deepseek-v4-pro`).
> Phases 1 & 2 done and merged, Phase B prod-parity Docker smoke passed, prod image slimmed
> (539→462 MB); **Phase C (deploy) and Phase D (post-deploy smoke) complete.** Deploy steps in §8,
> smoke in §9, follow-ups in §11. Volatile numbers (tsc-pass rates, chunk counts) live in
> `GENERATION_EXPERIMENT.md` / Qdrant; verify there, don't copy them here.

This is the checked-in runbook for deploying `spec-driven-generator` (Vite SPA + Express generation API)
to the cloud **without breaking the validated generation path**. It supersedes the "ad-hoc Vercel both
ends" idea — see *Why not Vercel serverless*.

---

## 0. Handoff — read this first

### What is already DONE (committed `74d4da5`, do NOT redo)
- **DeepSeek dual-client generation.** `src/config/vectorConfig.ts` has `getGenerationBaseUrl` /
  `getGenerationApiKey` / `getGenerateThinking` / `getRepairThinking`; `src/steps/4-generate/generator.ts`
  builds the generation client from them and emits the thinking param when enabled. Embeddings stay on
  OpenAI. With `GEN_BASE_URL` unset, the gpt-4o path is byte-identical.
- **Render validator is export-shape agnostic** (`src/steps/4-generate/validators/renderValidator.ts`,
  `resolveEntry`) — mirrors `web/src/lib/sandbox.ts`, so a bare `const Demo` (no export, common from
  DeepSeek) renders fine.
- **Verified (thinking off, single run):** `deepseek-v4-pro` beats the gpt-4o Pass-F baseline — grounded
  tsc **93%→100% single-shot** (0 repairs, closes `password-input`), render 100%, held-out 100%.
  Recorded in `GENERATION_EXPERIMENT.md`. `tsc --noEmit` clean; 629 unit tests pass.

### Environment facts (verified locally 2026-06-29)
- Local Qdrant is **up, green, 897 points** in `chakra-ui-docs`. `OPENAI_API_KEY` + `DEEPSEEK_API_KEY`
  are set in `.env`; `QDRANT_API_KEY` is a placeholder (fine for local; **needed for Qdrant Cloud**).
- Shell is **Windows PowerShell** — set env inline as `$env:VAR='x'; <cmd>` (not `VAR=x cmd`).
- Always run generation/eval with `DEBUG=false` (else the OpenAI SDK floods stdout).
- DeepSeek accepts `temperature`/`seed` without 400ing, but its docs don't list them → treat as
  best-effort (reproducibility/variance caveat). `GEN_THINKING` defaults **false** (already clears the bar).

### Status — DEPLOYED (Phases C + D done)
Phase 2 (the "render-check off in prod" feature + serving + container, **file-by-file in §6**) shipped
and merged, followed by the slim image and the Cloud Run path. The service is now **live** (see the
status header); `/api/health`, `/api/examples`, and a v2-landmine generation were smoke-tested against
the live URL. What's left is optional hardening in **§11 (Beyond)**: keep-warm, custom domain, further
image slim.

---

## 1. Target architecture

```
             [ ONE container — Cloud Run / Render (deploy/Dockerfile) ]
  browser  --->  Express:  GET  /            -> static web/dist (SPA)
                           POST /api/generate -> runGenerationPipeline()
                                                  ├─ retrieve -> OpenAI embeddings + Qdrant Cloud
                                                  ├─ generate -> DeepSeek V4 (chat)
                                                  ├─ tsc self-heal (npx tsc child process)
                                                  └─ render-check: SKIPPED in prod (RENDER_CHECK=false)
```

- **One Render Docker service** serves the built SPA **and** `POST /api/generate` — single origin, so no
  CORS and no proxy timeout, and zero frontend code change (the SPA's relative `/api` is same-origin).
- **Generation on DeepSeek V4** (`deepseek-v4-pro`); **OpenAI for embeddings only**.
- **Render-check OFF in prod** → **no Chromium at runtime**, small image, cheap tier. Sandpack renders
  the component client-side; `tsc` stays the objective gate.
- **Qdrant Cloud** is the external vector store (Render is stateless).

## 2. Why not Vercel serverless

Every `POST /api/generate` spawns `npx tsc` as a child process, writes temp files to `gen-sandbox/`, and
(when enabled) launches Chromium. Vercel serverless is read-only except `/tmp`, ships no system Chromium,
caps bundle size well below this `node_modules`, and times out long before a ~15–25 s generation. The
stack needs a long-lived Node process — see `README_FULLSTACK.md`. Render (Docker) gives us that.

## 3. Why DeepSeek for generation but OpenAI for embeddings

The `chakra-ui-docs` collection is **1536-dim `text-embedding-3-small`**. The query embedding at retrieval
time **must** match the corpus vectors, so embeddings stay on OpenAI. DeepSeek is OpenAI-API compatible,
so generation/repair just point the same OpenAI SDK client at `https://api.deepseek.com`. A genuine
dual-client setup: **OpenAI embeddings + DeepSeek generation**.

> **DeepSeek model names:** use `deepseek-v4-pro` (prod) / `deepseek-v4-flash`. Legacy `deepseek-chat` /
> `deepseek-reasoner` retire **2026-07-24** — do not use them.

## 4. Two Docker images (do NOT merge them)

The **existing root `Dockerfile` is the crawler image** (CLAUDE.md §9): it installs Playwright/Chromium
and runs the step-0 CLI crawl. The prod web service has the opposite needs (no Chromium, builds `web/`,
runs `4-serve`). Merging them would either break the documented crawl or ship unused Chromium. So:

- **Leave `Dockerfile` (root) untouched** — crawler.
- **Add `deploy/Dockerfile`** — the prod web service. Point Render at it (Dockerfile path = `deploy/Dockerfile`).

## 5. Environment variables (Cloud Run or Render dashboard)

| Var | Value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | Embeddings (required). |
| `DEEPSEEK_API_KEY` | `sk-...` | Generation (required). |
| `GEN_BASE_URL` | `https://api.deepseek.com` | Routes generation to DeepSeek; unset ⇒ OpenAI. |
| `GEN_MODEL` | `deepseek-v4-pro` | |
| `GEN_THINKING` | `false` | Verified off clears the bar; flip only with a measured reason. |
| `REPAIR_THINKING` | `false` | Same. |
| `QDRANT_URL` | Qdrant Cloud URL | |
| `QDRANT_API_KEY` | Qdrant Cloud key | Required for Cloud (local Qdrant needs none). |
| `RENDER_CHECK` | `false` | Skips the Chromium render-check in prod. |
| `NODE_ENV` | `production` | Generic client error messages. |
| `DEBUG` | `false` | Else the OpenAI SDK floods stdout. |
| `WEB_DIST` | (optional) | Override the static dir; defaults to `web/dist`. |
| `PORT` | (injected by Render) | `startServer()` already reads it. |

---

## 6. Implementation (file-by-file — shipped in Phase 2)

All edits are additive and env-gated. After each, run `npx tsc --noEmit`.

### 6a. Render gate + `renderChecked` flag — `src/steps/4-generate/pipeline.ts`
Replace the unconditional `const render = await renderValidate(component);`:
```ts
// Render-check is OFF in prod (no Chromium); Sandpack renders client-side instead.
const renderChecked = process.env.RENDER_CHECK !== 'false';
const render = renderChecked
  ? await renderValidate(component)
  : { ok: true as const, error: undefined };
```
Add `renderChecked: boolean;` to the `PipelineReport` interface (near `renderOk`/`renderError`) and
`renderChecked,` to the returned report object.

### 6b. Qdrant API key — `src/services/VectorStoreService.ts` (constructor, ~L15)
```ts
this.client = new QdrantClient({
  url,
  ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
});
```
(Conditional keeps local docker-compose Qdrant working.)

### 6c. Serve the SPA — `src/server/server.ts`
Add `import path from 'path';`. In `createServer`, **after** the `/api/*` routes and **before**
`return app`:
```ts
// Serve the built SPA (single-origin with the API). Catch-all AFTER /api so API routes win.
const webDist = process.env.WEB_DIST || path.resolve(process.cwd(), 'web/dist');
app.use(express.static(webDist));
app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
```
(express is v4 — the `'*'` catch-all is valid. No frontend change: relative `/api` is now same-origin.)

### 6d. Omit the render badge when not checked — frontend
- `web/src/api.ts` `PipelineReport`: add `renderChecked: boolean;`.
- `web/src/components/ReportBadges.tsx`: wrap the render badge in `{report.renderChecked && ( … )}` so it
  is **omitted** (not shown as a false green / confusing "n/a") when prod skips the check.

### 6e. `package.json`
Add to `scripts`: `"start:server": "node dist/index.js 4-serve"`.

### 6f. `deploy/Dockerfile` (new)
Multi-stage; builds **both** the API and `web/`; **no Chromium**. The `tsc` validator's runtime deps
(`typescript`, `@chakra-ui/react`, `react`+`react-dom` and their `@types`, `esbuild`) live in
`dependencies` (not devDeps), so the builder can `npm prune --omit=dev` after the builds to drop pure
test tooling (`jest`/`tsx`/`ts-node`/`@types/node|express|jest`) — the prod copy shrinks ~539→~460 MB
while still type-checking. `playwright` stays (imported at load). Also copy `gen-sandbox/` (the
validator type-checks against `gen-sandbox/tsconfig.json`).
```dockerfile
# Stage 1: build API + SPA
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build                      # API -> dist/ (includes dist/server)
RUN cd web && npm install && npm run build   # SPA -> web/dist

# Stage 2: prod (no Chromium — render-check is off in prod)
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules   # full deps: tsc validator needs devDeps
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/gen-sandbox ./gen-sandbox      # tsconfig the tsc validator points at
ENV NODE_ENV=production RENDER_CHECK=false DEBUG=false
CMD ["npm", "run", "start:server"]
```
Verify `.dockerignore` excludes `node_modules`, `dist`, `artifacts` so `COPY . .` stays clean.

### 6g. Docs
- `.env.example`: add commented `GEN_BASE_URL`, `GEN_THINKING`, `REPAIR_THINKING`, `DEEPSEEK_API_KEY`,
  `QDRANT_API_KEY`, `RENDER_CHECK`, `WEB_DIST`.
- `README_FULLSTACK.md`: bump Status; record the single-Render topology + DeepSeek + render-off.
- `CLAUDE.md` §12: link `README_DEPLOY.md`; note generation can run on DeepSeek via `GEN_BASE_URL`.

---

## 7. One-time data setup (local)

1. Create a free **Qdrant Cloud** cluster; copy its URL + API key.
2. Locally set `QDRANT_URL`, `QDRANT_API_KEY`, `OPENAI_API_KEY`, `DEBUG=false`.
3. Ingest: `npm run cli -- 2-embed` (embeddings stay `text-embedding-3-small`). This also creates the
   **payload indexes** (`componentName`, `chunkType`, keyword) that reserved-slot retrieval filters on.
   **Required for Qdrant Cloud:** unlike local Qdrant (which full-scans an unindexed field), Cloud
   rejects a filter on an unindexed field with a 400 — grounded generation 500s until the indexes
   exist. `2-embed` now does this automatically (`VectorStoreService.ensurePayloadIndexes`); on a
   collection embedded **before** this fix, create them once via the REST API:
   `PUT {QDRANT_URL}:6333/collections/chakra-ui-docs/index` with body
   `{"field_name":"componentName","field_schema":"keyword"}` (repeat for `chunkType`), `api-key` header.
4. Verify the live point count (Qdrant `points/count`) — don't assume a number.

## 8. Phase C — deploy to the cloud

**Recommended: Google Cloud Run (§8b)** — it allocates CPU *during request processing* (exactly when
`tsc` runs), **injects `PORT`** (the server already reads it, zero config), and **scales to zero** inside
a generous free tier; the slim image keeps cold starts down. **Render (§8a)** is the simpler,
dashboard-driven alternative. Either way: same `deploy/Dockerfile`, the §5 env vars, health-check
`/api/health`.

### 8a. Render (simple alternative)

1. Push to GitHub; on Render create a **Web Service** → **Docker** runtime, **Dockerfile path =
   `deploy/Dockerfile`**, repo root as context.
2. Set the §5 env vars. Health-check path: `/api/health`.
3. Render builds the image (API + `web/`), runs `npm run start:server`. The server serves `web/dist` at
   `/` and the API at `/api/*`.
4. **Sizing — mind the `tsc` cost.** No Chromium keeps RAM modest, but every `/api/generate` spawns
   `npx tsc` (CPU-bound, runs up to ~3× per request via the self-heal loop). Render's micro tiers
   (e.g. **0.1 CPU / 512 MB**) will *run* but generation feels sluggish and 512 MB risks an OOM during
   a type-check. Prefer **≥0.5 vCPU / 1 GB** (comfortable: 1 vCPU / 2 GB). Free tier also **sleeps when
   idle** → cold start on first request; use a small paid always-on instance or a keep-warm ping for demos.

### 8b. Google Cloud Run — recommended

Cloud Run fits this workload better than a Render micro tier: **CPU is allocated during request
processing** (exactly when `tsc` runs), it **injects `PORT`** (the server already reads `process.env.PORT`,
so zero config), and **scale-to-zero** keeps it inside the free tier (~3,000 generations/month free at
2 vCPU / 2 GiB). Trade-off: scale-to-zero means a **cold start on the first request after idle** (image
pull + boot, then the ~20 s generation) — the slim image (§6f, ~460 MB) is the main mitigation.

> **The two-Dockerfile trap:** `gcloud run deploy --source` / `gcloud builds submit --tag` auto-detect
> the **root** `Dockerfile`, which is the step-0 **crawler** (Chromium). Always build with
> `-f deploy/Dockerfile`. `cloudbuild.yaml` (repo root) does exactly this.

**One-time setup** (replace `PROJECT`/region as needed):
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
gcloud artifacts repositories create spec-gen --repository-format=docker --location=us-central1
# Secrets (recommended over plaintext env): create one per key, grant the runtime SA access.
printf '%s' "$OPENAI_API_KEY"   | gcloud secrets create openai-key   --data-file=-
printf '%s' "$DEEPSEEK_API_KEY" | gcloud secrets create deepseek-key --data-file=-
printf '%s' "$QDRANT_API_KEY"   | gcloud secrets create qdrant-key   --data-file=-
# Configure the service env ONCE (re-deploys keep it). Non-secret config via --set-env-vars,
# keys via --set-secrets. (Run after the first deploy below, or set on the deploy command.)
gcloud run services update spec-to-component --region us-central1 \
  --set-env-vars GEN_BASE_URL=https://api.deepseek.com,GEN_MODEL=deepseek-v4-pro,GEN_THINKING=false,REPAIR_THINKING=false,RENDER_CHECK=false,NODE_ENV=production,DEBUG=false,QDRANT_URL=...,QDRANT_COLLECTION_NAME=chakra-ui-docs \
  --set-secrets OPENAI_API_KEY=openai-key:latest,DEEPSEEK_API_KEY=deepseek-key:latest,QDRANT_API_KEY=qdrant-key:latest
```
**Build + deploy** (repeatable; `cloudbuild.yaml` pins `-f deploy/Dockerfile`):
```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=us-central1,_REPO=spec-gen,_SERVICE=spec-to-component
```
**Notes:** don't set `PORT` (Cloud Run owns it); `--timeout 300` covers generation; the §7 Qdrant
payload indexes are still required. Then run the §9 post-deploy smoke against the service URL.

## 9. Phase D — verification

**Model-swap gate — DONE** (Phase 1, recorded in `GENERATION_EXPERIMENT.md`): DeepSeek beats the gpt-4o
baseline on tsc/smell/composition; render 100% (with the export-tolerance fix); held-out 100%.

**Local pre-deploy gate:**
1. `npx tsc --noEmit` — repo type-checks.
2. `npm test` — 629 unit tests pass.
3. **Local prod-parity smoke** — build `deploy/Dockerfile`, run it with `RENDER_CHECK=false` + DeepSeek
   env against Qdrant Cloud; hit `/` (SPA loads) and `POST /api/generate` (works with **no Chromium**).
   Confirm the response includes `renderChecked: false` and the UI omits the render badge.

**Post-deploy smoke (live URL — the Phase D acceptance check):**
- `GET /api/health` → `{ ok: true, model: "deepseek-v4-pro" }`.
- `GET /api/examples` → 5 prompts.
- `POST /api/generate {"query":"a stat card showing revenue"}` → `tscOk: true` within timeout.
- `POST {"query":"a green submit button"}` (v2 landmine) → `colorPalette` not `colorScheme`; badges
  reflect the server report.
- Open the SPA → run a held-out example → **Sandpack preview renders** + green tsc/smell/composition
  badges; "Grounded in" panel populated; the render badge is **omitted** (check skipped in prod).

## 10. Risks / caveats

- **DeepSeek baseline** — passed thinking-off in a single run; seed/temperature likely best-effort, so
  variance isn't fully controlled. Re-run the harness for bands before any stronger claim. The lone v2
  smell is `button-loading` (a v2 loading prop the smell-repair didn't heal). **Thinking mode stays
  off:** a 2026-06-30 A/B measured no objective-gate gain and +46% latency (see
  `GENERATION_EXPERIMENT.md`), so `GEN_THINKING`/`REPAIR_THINKING` default `false`.
- **`renderOk` unavailable in prod by design** — Sandpack covers live preview; server sends
  `renderChecked: false`, UI omits the badge. Still measured locally by the eval harness.
- **Validator deps at runtime** — the `tsc` validator needs `typescript` + `@chakra-ui/react` +
  `react`(+dom)/`@types` + `esbuild` at runtime; these now live in `dependencies` (not devDeps) so the
  builder can `npm prune --omit=dev` and the prod image still type-checks. If you move any of them back
  to devDeps, the pruned prod image will fail generation (`tsc` can't resolve the types).
- **Cold start** on Render's free tier (idle sleep) — small paid instance or keep-warm ping for demos.
- **Qdrant payload indexes** — Cloud needs a keyword index on every FILTERED field (`componentName`,
  `chunkType`); `2-embed` now creates them, but a pre-fix collection must be patched once (see §7).
- **Qdrant client/server version skew** — the pinned JS client (`@qdrant/js-client-rest@1.16.x`) logs
  an "incompatible with server version" warning against a newer Cloud cluster (e.g. 1.18.x). Verified
  **benign** in the Phase-B smoke (search/filter work); bump the client if it ever turns into a hard error.

## 11. Beyond Phase C

After a live URL exists:

- **Cold start / keep-warm** — Cloud Run scale-to-zero means the first request after idle pays an
  image-pull + boot before the ~20 s generation. For a demo, slim the image further (below) or add a
  keep-warm ping (cron hitting `/api/health`); avoid `--min-instances=1` on the free tier (it blows the
  grant). Render's free tier idles the same way.
- **Custom domain + monitoring** — map a domain to the service; watch Cloud Run request logs + latency
  (and the cold-start tail).
- **Further image slim** — lazy-import `playwright`/`esbuild` in `renderValidator` so the prod image can
  drop them too (render is off in prod). Touches the render path → re-validate local render first.
- **Corpus expansion** — ~50 more components are staged; re-embed (the §7 Qdrant payload indexes
  auto-create now, so a fresh embed is self-sufficient).
- **MCP server** — expose generation as an MCP tool (planned; see `README_FULLSTACK.md` non-goals).

## 12. Related docs

- `README.md` — the project overview + engineering showcase (problem, architecture, decisions) this
  deploy serves.
- `README_FULLSTACK.md` — the UI/serving MVP this deploys.
- `GENERATION_EXPERIMENT.md` — the objective baseline, the DeepSeek swap, and the thinking-mode A/B.
- `CLAUDE.md` — conventions, objective-signal rules, cost discipline.
