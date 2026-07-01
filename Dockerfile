# syntax=docker/dockerfile:1
#
# Container for @rugby-app/api. Deployed to Cloud Run in the personal GCP
# project `rugby-mobile-app` (root CLAUDE.md §1 separation rule). Serves the
# synthetic dev dataset — must always be launched with ALLOW_SYNTHETIC_DATA=1
# until the licensing gate reactivates (PRD §5.5).

# ─── Stage 1: install workspace deps ─────────────────────────────────────────
FROM node:22-slim AS deps
WORKDIR /app

# Copy workspace manifests first so `npm ci` output is cached when only source
# changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/
COPY services/pipeline/package.json services/pipeline/

# --omit=dev keeps the image lean; tsx is a runtime dep of the api workspace.
RUN npm ci --omit=dev

# ─── Stage 2: runtime image ──────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

# Non-root user (Cloud Run doesn't require this but it's best practice).
USER node

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/shared ./packages/shared
COPY --chown=node:node services/api ./services/api
# Only the JSON dataset is needed at runtime, not the generator source.
COPY --chown=node:node services/pipeline/package.json ./services/pipeline/package.json
COPY --chown=node:node services/pipeline/data ./services/pipeline/data

# Cloud Run injects PORT; default 8080 works if run outside Cloud Run too.
ENV PORT=8080
ENV NODE_ENV=production
# Explicit opt-in to synthetic data — required by config.ts guardrail.
# REMOVE before real-data cutover.
ENV ALLOW_SYNTHETIC_DATA=1

EXPOSE 8080
CMD ["npm", "start", "--workspace=@rugby-app/api"]
