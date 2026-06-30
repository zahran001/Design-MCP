# Prod web service: Express API (POST /api/generate) + built SPA, single origin.
# NOT the crawler image — the root Dockerfile installs Playwright/Chromium for the
# step-0 crawl; this one ships NO Chromium because the render-check is off in prod
# (RENDER_CHECK=false; Sandpack renders client-side, tsc stays the objective gate).
# Point Render at this file (Dockerfile path = deploy/Dockerfile, context = repo root).

# Stage 1: build API + SPA
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build                            # API -> dist/ (includes dist/server)
RUN cd web && npm install && npm run build   # SPA -> web/dist
# Slim node_modules for the prod copy: drop dev/test-only tooling (jest, tsx,
# ts-node, @types/node|express|jest). The tsc validator's real runtime deps
# (typescript, @chakra-ui/react, react(+dom) + their @types, esbuild) live in
# "dependencies", so prune keeps them; playwright stays too. Run AFTER the builds,
# which need the devDeps (@types/node, etc.).
RUN npm prune --omit=dev

# Stage 2: prod (no Chromium — render-check is off in prod)
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
# Pruned node_modules from the builder (npm prune --omit=dev): keeps the tsc
# validator's runtime deps (now in "dependencies") + playwright; drops jest/tsx/etc.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/web/dist ./web/dist
# gen-sandbox holds the tsconfig the tsc validator points at (comment on its own
# line — Dockerfile COPY does NOT support trailing inline comments; they parse as
# extra source args).
COPY --from=builder /app/gen-sandbox ./gen-sandbox
ENV NODE_ENV=production RENDER_CHECK=false DEBUG=false
CMD ["npm", "run", "start:server"]
