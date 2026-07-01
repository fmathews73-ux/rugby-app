# `@rugby-app/pipeline` — synthetic data generator + ingestion pipeline

Node service. Two responsibilities, sharing one adapter interface:

1. **Synthetic dev data generator** (PRD §5.5) — active now. Emits canonical
   JSON matching `@rugby-app/shared` types for the v1 scope (Men's Tier 1
   Internationals, current season only per PRD §3.4).
2. **Real feed ingestion** — Phase 6 (post-licensing gate). Future adapters
   plug in behind the same interface; the JSON shape does not change.

## Run

    npm install                       # from repo root — sets up workspaces
    npm run generate --workspace=@rugby-app/pipeline

Writes `services/pipeline/data/*.json` — one file per entity type
(competitions, seasons, teams, players, squads, fixtures, results, lineups,
standings, rankings, brackets).

## Determinism

`src/rng.ts` uses mulberry32 with a fixed seed (`RUGBY_APP_SEED` const in
`src/registry.ts`). Regenerating produces byte-identical output — safe to
diff, safe to commit.

## Guardrails (do NOT violate — root CLAUDE.md §9 / PRD §5.5)

- **Fake player names only.** The name pool in `src/registry.ts` is deliberately
  generic and unremarkable. Never wire real player rosters into this
  generator.
- **Real team names OK, no crests.** National team names are public
  identifiers; team crests and logos are trademarked and must not be
  referenced.
- **Never ship this output to a production build.** The API stub (stage 3)
  must reject requests when running under a production configuration; store
  builds must fail hard if this dataset is bundled.
