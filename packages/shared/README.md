# `@rugby-app/shared`

Canonical TypeScript types shared by every part of the app.

## What lives here

- `src/types/canonical.ts` — the app's internal data model. Feed-agnostic; the
  same shapes are emitted by the synthetic dev adapter (PRD §5.5), the future
  aggregator adapter, and the eventual premium adapter.

## What does NOT live here

- Any vendor-specific shapes or adapter code. Those stay behind the adapter
  boundary in `services/pipeline/`.
- Any runtime code with side effects, network calls, or business rules. This
  package is pure types + eventually pure schema validators.
- Anything client-only (React components, hooks) — those stay in `mobile/`.

## Consumption

- `services/pipeline/` — imports the types to shape its generator output.
- `services/api/` — imports the types to shape response payloads.
- `mobile/` — imports the types to type-check `fetch` results.

Resolution strategy is decided per consumer:

- **Server-side (Node)**: relative import from `packages/shared/src/types` is
  the simplest path; add a workspace or path alias when the repo needs it.
- **Client-side (Metro / Expo)**: because Metro does not honour `tsconfig`
  paths by default, either use a relative import or wire
  `babel-plugin-module-resolver` when we import from `mobile/`. This is a
  stage-5 concern; no imports from `mobile/` exist yet.

## PRD anchors

- v1 scope: Men's Tier 1 Internationals, current season only (PRD §3.4).
- Data strategy: synthetic → aggregator → premium (PRD §5.1).
- Synthetic-data rules: PRD §5.5. **Never ship synthetic data to a production
  build** — root `CLAUDE.md` §9.
