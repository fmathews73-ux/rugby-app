# `@rugby-app/api` — read-side HTTP API

Fastify service. Loads canonical JSON at startup and serves it to the mobile
client over HTTP. Same shapes downstream — the client cannot tell whether it
is talking to the synthetic dev dataset or, later, a real-feed pipeline.

## Run locally

    npm install                          # from repo root — sets up workspaces
    npm start --workspace=@rugby-app/api

Serves on `http://localhost:3000` by default. Override with `PORT`.

## Endpoints (v0.5 surface)

Every response carries `X-Data-Source: synthetic` while this service runs
against the dev dataset. The mobile client reads that header to switch on the
persistent dev-mode banner (PRD §5.5).

Top-level:

- `GET /`                                 health + metadata
- `GET /competitions`                     all competitions
- `GET /competitions/:id`                 one competition
- `GET /seasons`                          all seasons (`?competition_id=` filter)
- `GET /seasons/:id`                      one season
- `GET /seasons/:id/fixtures`             fixtures for a season
- `GET /seasons/:id/standings`            standings (single or per-pool array)
- `GET /seasons/:id/bracket`              knockout bracket (404 if none)
- `GET /fixtures/:id`                     one fixture
- `GET /fixtures/:id/result`              match-level result (404 if not completed)
- `GET /fixtures/:id/lineups`             both teams' lineups
- `GET /teams`                            all teams (Tier 1 + Tier 2)
- `GET /teams/:id`                        team details + upcoming/recent fixtures
- `GET /teams/:id/squad?season_id=`       squad for a team + season
- `GET /players/:id`                      player details
- `GET /rankings`                         latest ranking snapshot (all 28 teams)
- `GET /rankings/history`                 all ranking snapshots (movement history)

## Configuration

- `PORT` — HTTP port (default `3000`).
- `DATA_DIR` — path to the JSON dataset (default: `../pipeline/data` relative
  to `services/api/`).

## Guardrails

- **Never let this service serve real data under a production flag while
  reading from `services/pipeline/data/`.** A future runtime check in
  `src/config.ts` will refuse to start in production mode against synthetic
  data (release blocker — root CLAUDE.md §9).
- No auth in v0.5. Stats-screen premium gating (PRD §8) is a Phase 6 concern.
- No CORS — mobile client is a native HTTP consumer, not a browser. Add a
  CORS plugin only if a web preview reappears.
