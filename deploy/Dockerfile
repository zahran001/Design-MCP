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

# Stage 2: prod (no Chromium — render-check is off in prod)
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
# Full node_modules on purpose: the tsc validator needs typescript + @chakra-ui/react
# (both devDeps) at runtime. Never prune to --omit=dev here.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/web/dist ./web/dist
# gen-sandbox holds the tsconfig the tsc validator points at (comment on its own
# line — Dockerfile COPY does NOT support trailing inline comments; they parse as
# extra source args).
COPY --from=builder /app/gen-sandbox ./gen-sandbox
ENV NODE_ENV=production RENDER_CHECK=false DEBUG=false
CMD ["npm", "run", "start:server"]
