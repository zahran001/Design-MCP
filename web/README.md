# web — Chakra v3 Component Generator UI

Vite + React + **Chakra UI v3** SPA over the generation API. Built in Chakra v3 to
dogfood the system it generates for. See [`../README_FULLSTACK.md`](../README_FULLSTACK.md)
for the plan.

## Run

The UI needs the backend API running:

```bash
# in the repo root — long-lived API (OPENAI_API_KEY + Qdrant + DEBUG=false)
npm run serve            # -> http://localhost:3001

# here
npm install
npm run dev              # -> http://localhost:5173, proxies /api to :3001
```

Point at a different API with `API_URL=http://host:port npm run dev`.

## What it does

- **Prompt box** — free text + `Cmd/Ctrl+Enter`; the held-out prompts as one-click
  examples; a grounding toggle that ablates retrieval (demonstrates its value).
- **Live preview** — renders the generated component in a Sandpack sandbox inside a
  `ChakraProvider value={defaultSystem}`. The headline accessibility feature.
- **Code view** — Prism-highlighted TSX + copy.
- **Report badges** — the objective `tsc` / `v2-smell` / composition / render report
  from the server, distinguishing "generated clean" from "self-healed".
- **Grounded in** — collapsible list of the retrieved chunks (component / type /
  score) the generation was grounded in.

## Layout

```
src/
  api.ts                 # typed client; mirrors the server PipelineReport contract
  App.tsx                # state + orchestration
  components/
    PromptBox.tsx        # input, grounding toggle, example chips
    LivePreview.tsx      # Sandpack render
    CodeView.tsx         # highlighted TSX + copy
    ReportBadges.tsx     # objective report badges + details
    GroundedPanel.tsx    # retrieval transparency
  lib/sandbox.ts         # normalise the component's export shape for Sandpack
```
