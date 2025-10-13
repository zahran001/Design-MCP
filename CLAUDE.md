# CLAUDE.md

## 1) Project quick facts

* **Name:** `spec-driven-generator`
* **Goal:** Crawl Chakra UI docs and extract structured JSON artifacts (per component) for downstream spec/codegen.
* **Primary command:** `npm run cli -- 0-extract-docs [-s <START_URL>] [-m <MAX_PAGES>]`
* **Artifacts:** `artifacts/raw-json/*.json`
* **Key tech:** TypeScript (NodeNext), Playwright, Commander, Zod, Docker

```
src/
  index.ts                     # CLI entrypoint
  steps/0-extract-docs/
    crawler.ts                 # BFS crawler + enqueue rules
    extractors.ts              # Chakra-specific selectors
  schemas/RAGResultSchema.ts   # Zod schema for extracted docs
  utils/textProcessor.ts       # Structured chunking helpers
artifacts/raw-json/            # Output
```

## 2) How to run locally (for Claude to suggest)

```bash
# one-time
npm install
npx playwright install
cp .env.example .env   # edit START_URL / MAX_PAGES

# compile & run
npm run build
npm run cli -- 0-extract-docs -m 10
```

**ENV:**

* `START_URL` (default: `https://chakra-ui.com/docs/components/concepts/overview`)
* `MAX_PAGES` (default: `20`)

## 3) Style & code conventions

* **Module system:** ESM, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`
* **Target:** ES2022
* **Type safety:** `strict: true`
* **Imports:** Named imports, no default‐export utils unless ergonomic
* **Errors:** Throw with actionable messages; log with concise context (`url`, `selector`, `componentName`)
* **File naming:** `kebab-case.ts` for modules, `PascalCase` for types
* **Lint preferences:** Prefer readable explicitness over clever one-liners

## 4) Contribution rules for Claude

* **Never invent:** commands, file paths, or public APIs. If unsure, ask.
* **Small, surgical diffs:** Prefer focused PRs. Include rationale in the diff header comment.
* **Idempotent changes:** Re-runs should not duplicate work or corrupt artifacts.
* **Guardrails:**

  * Do not hit non-`/docs/components/` pages (except the hub).
  * Strip hash fragments when enqueueing (avoid duplicates).
  * Be resilient to selector drift (fallbacks, optional chaining).
* **Security:** Never commit secrets. `.env` is ignored. Reference `.env.example` only.

## 5) Common tasks (Claude, do these)

> Claude: When I ask you to perform one of these tasks, produce the exact code diff (unified), mention files created/updated, and include test/run steps.

### A) Add polite throttling to crawler

* Random delay 200–650 ms between pages
* Short-circuit if `visited.size > 1000`
* End summary log: processed/queued/visited

### B) Improve extractor robustness

* Prefer semantic queries: `main h1`, `main pre code`, `table thead/tbody`
* Props table detection: header includes `prop|name` and `type`
* Accessibility section: next block after heading “Accessibility”

### C) Validation and error handling

* Wrap output with `RAGResultSchema.safeParse`
* On failure: log compact zod error + `url`, skip write

### D) New helper: `saveJsonArtifact(name, data)`

* Sanitize filename: `[A-Za-z0-9_.-]`
* Ensure dir: `artifacts/raw-json`
* Pretty JSON; return path

## 6) Test/verify flow (Claude can suggest/automate)

```bash
# smoke run with low page cap
npm run cli -- 0-extract-docs -m 5

# validate JSON shape
node -e "const f=require('fs'); const p='./artifacts/raw-json'; for (const x of f.readdirSync(p)) { JSON.parse(f.readFileSync(p+'/'+x,'utf8')); console.log('OK', x); }"
```

**Success criteria:**

* ≥1 JSON per component (e.g., `Button.json`)
* Includes `componentName`, `sourceUrl`, and at least one of `description`/`codeExamples`/`props`

## 7) Docker (for reproducible runs)

**Build & run:**

```bash
docker build -t component-generator .
docker run --rm \
  -e START_URL="https://chakra-ui.com/docs/components/concepts/overview" \
  -e MAX_PAGES=20 \
  component-generator
```

**Notes for Claude:**

* Use Node 20 base
* Install Playwright deps via `npx playwright install --with-deps`
* Keep image small; multi-stage build

## 8) Claude response format (strict)

When I ask for code changes, **respond with**:

1. **Summary (1–3 bullets)** why/what
2. **Diffs** in unified format per file, e.g.

   ```
   --- a/src/steps/0-extract-docs/crawler.ts
   +++ b/src/steps/0-extract-docs/crawler.ts
   @@
   - old line
   + new line
   ```
3. **New files**: full contents in code blocks
4. **Run/test instructions**
5. **Fallbacks** if a selector or step might be flaky

Avoid extra commentary outside those sections.

## 9) High-value prompts I’ll use with you

> **Bootstrap a resilient extractor**
> “Update `extractors.ts` so `extractComponent()` tolerates missing headings, multiple props tables, and nested MDX. Prefer semantic selectors. Return `null` if not a component page. Add compact error messages, and show a diff.”

> **Throttle + log instrumentation**
> “Add randomized 200–650ms delay between navigations, track counts for `processed`, `queued`, `visited`, and print a final summary. Show diff and how to toggle throttle with an env var `CRAWL_THROTTLE_MS_MIN/MAX`.”

> **Artifact writer helper**
> “Create `src/utils/saveJsonArtifact.ts` with a `saveJsonArtifact(name, data)` function (safe filename, ensure dir, pretty JSON). Replace duplicate write logic in `crawler.ts`. Show the diff.”

> **Dockerfile refinement**
> “Refactor Dockerfile to multi-stage: deps (npm ci + playwright deps), build (tsc), runtime (copy dist + node_modules). Add `.dockerignore`. Provide full files.”

> **Schema tightening**
> “Strengthen `RAGResultSchema` to require PascalCase `componentName` and a valid `https://chakra-ui.com/...` `sourceUrl`. Use `safeParse` in crawler and log errors with a compact formatter.”

## 10) Known gotchas (read before coding)

* Chakra’s site structure varies across versions; **do not** hardcode brittle classnames if a semantic alternative exists.
* Some component pages lack props tables or code samples—**that’s OK**; don’t fail the run.
* Internal navigation often uses hash fragments (e.g., `#usage`, `#props`)—**strip them** when enqueueing.
* Markdown/MDX code fences may render as nested nodes; **grab inner `<code>` text** (not prettified markup).

## 11) Performance knobs (safe to tweak)

* `MAX_PAGES` for breadth vs. time
* `CRAWL_CONCURRENCY` (if added later)—start with `1` to be polite
* `CRAWL_THROTTLE_MS_MIN/MAX` random delay window

## 12) Non-goals (don’t “optimize” these yet)

* Parallel browser contexts
* Headless false / screenshotting
* Persisted checkpointing across runs
* Writing to vector stores (Week 2+)

## 13) Definition of Done (Week 1)

* `npm run cli -- 0-extract-docs -m 10` produces well-formed JSON in `artifacts/raw-json/`
* Docker image runs the same workflow with env overrides
* Extractor tolerates missing sections without crashing
* Schema validation + useful logs on failures

---

### TL;DR for Claude

* Focus diffs on `src/steps/0-extract-docs/*`, `src/utils/*`, or Docker.
* Keep changes small, explain why, show how to run.
* Be robust to Chakra’s markup drift.
* Never invent commands or paths; ask if uncertain.