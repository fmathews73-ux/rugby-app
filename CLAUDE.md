<!-- Destination: /CLAUDE.md (repo root) -->
<!-- Draft v0.2 — accompanies Rugby App PRD (version up to v0.2 on merge). Review before scaffolding. -->
<!-- v0.2 changes: framework locked to Expo + Expo Router; web resolved OUT (reg #18); Expo agent tooling pointer; create-expo-app reconciliation. -->

# CLAUDE.md — Rugby Mobile App

Operating contract for the build agent. **Read fully before taking any action.** This file is loaded every session.

- **Product source of truth:** Rugby App PRD (`docs/Rugby-App-PRD-v0.2.md`). The PRD governs *what to build*. This file governs *how you work*.
- **On conflict:** the PRD wins on product scope; this file wins on process and guardrails. Flag the conflict to the owner — never resolve it silently.
- **Current phase: Phase 0 — Foundation & separation.** No downstream phase is authorised. See PRD §11 roadmap.

---

## 0. The golden rule

**When uncertain, ask. No silent assumptions.** You must not invent values, scope, or behaviour to fill a gap (PRD §0). A gap that is flagged in the PRD is flagged on purpose — it is not an invitation to guess.

---

## 1. Non-negotiable — privacy & separation (highest-severity rule)

This is a **standalone, private project under the owner's personal identity only.** Breaking this is the worst failure you can commit, above any bug.

- **Personal accounts only:** personal GitHub `fmathews73-ux`, personal Google Cloud + Firebase project `rugby-mobile-app` (orphan — no Workspace org parent, personal billing linked), personal Apple/Google store developer accounts `[CONFIRM at Phase 6]`. No organisational, shared, or third-party accounts.
- **Zero employer footprint.** No reference to any employer, group, company, brand, or colleague — anywhere. That explicitly includes: source code, config, comments, commit messages, git author/committer metadata, package names, bundle/app IDs, cloud resource names, labels, README, and store listings.
- **Neutral identifiers.** Bundle IDs / package names use the reverse-DNS of a *personal* domain, never an org domain.
- **Pre-commit identity check.** Before any commit, verify `git config user.name` / `user.email` resolve to the personal identity, not a work account.
- **File storage** (docs, exports, keys metadata) goes to the owner's personal Google account only.
- **Global by default.** Do **not** assume any country or region — including the owner's own location — for scope, pricing, localisation, or licensing territory. Geography is an open item (register #10).

---

## 2. Operating protocol — how to handle the PRD's tags

The PRD is deliberately incomplete. Every gap carries a tag. Your behaviour per tag is fixed:

| Tag | Meaning | Your action |
|---|---|---|
| `[INPUT NEEDED]` | An owner-only product/business decision | **Pause and ask the owner. Wait. Do not proceed on a guess.** |
| `[RESEARCH REQUIRED]` | An external fact must be verified | Research, **present findings, get confirmation, then build.** |
| `[GATE]` | A hard blocker | **Stop and escalate.** Never carry an unresolved GATE into a dependent phase. |
| `[DEFERRED]` | Out of scope for now | Do not build. Wireframe only if the PRD explicitly says so. |

Gaps are resolved **just-in-time, in phase order** (PRD §0, §13). When you reach a phase: resolve its open items → confirm with the owner → then build. The consolidated open-items register is PRD §13.

---

## 3. Active blockers — updated v0.5

Phase 1 gates that were open through v0.3 are now resolved or soft-deferred:

- **Code & competition scope (PRD §3.4) — RESOLVED v0.4, broadened v0.5.** Rugby Union only (League permanent exclusion, Sevens deferred). v1 = 5 competitions (Six Nations, Rugby Championship, Summer Tests, Autumn Nations Series, RWC 2027) covering **all Men's international teams — 10 Tier-1 + 18 Tier-2.** Six Nations and Rugby Championship rosters unchanged; Tier-2 teams enter via RWC 2027 and Power Rankings. Current season only.
- **Commercial redistribution licence (register #5) — SOFT-DEFERRED v0.4.** Dev runs on a synthetic dataset per PRD §5.5. The GATE reactivates the moment real feed data enters the pipeline (before beta / soft-launch). Not a Phase 3 blocker; a hard Phase 6 blocker.
- **Provider selection + coverage validation (register #6, #7) — moved to Phase 6.** Only matters at real-data cutover.

**New hard rules from v0.4 (see §9):**
- Never ship the synthetic dev dataset to a production build.
- Every screen rendering synthetic data must show a persistent dev-mode indicator.
- Fake player names only; real national team names OK; no team crests / logos.

---

## 4. Tech stack (quick reference — full detail in PRD §6)

**Mobile framework is LOCKED (decision recorded v0.2):**
- **Mobile:** React Native **via Expo (managed workflow)** with **Expo Router** (file-based navigation). Targets **native iOS + Android only**. **Web is OUT of scope for v1** — register #18 resolved: OUT. Do not add `react-native-web` targets or web-only dependencies.
- The mobile app is created with `create-expo-app`; its Expo-specific conventions live in the app's **`AGENTS.md`** (see §5 and the mobile CLAUDE.md).

Backend / data (unchanged from PRD §6):
- **Backend:** Cloud Run (Node) behind API Gateway.
- **Relational store:** Cloud SQL (PostgreSQL).
- **Cache / pub-sub:** Memorystore (Redis) — **deferred** until a real-time tier is justified.
- **Ingestion:** Cloud Scheduler → Cloud Run jobs. **Analytics / rankings:** BigQuery.
- **Secrets:** Secret Manager. **Auth:** Firebase Auth (methods TBD #16). **Push:** FCM. **CDN:** Cloud CDN.

---

## 5. Agent tooling (write correct, version-matched Expo code)

The mobile app is set up to use Expo's official agent tooling so generated code matches the installed SDK:
- **Expo plugin + Expo Skills** (`expo@claude-plugins-official`) — teaches known-good Expo patterns; enabled via the app's `.claude/settings.json`.
- **Expo MCP Server** (remote) — live access to Expo docs + EAS for the installed SDK version.
- **iOS Simulator MCP** (project-scoped) — lets you screenshot the running app on the iOS Simulator to visually verify your own render.

Setup and exact invocations are captured in `infra/CLAUDE.md`; confirm current commands against `docs.expo.dev/agents/claude` at setup time. Prefer these over guessing Expo API shapes from memory.

---

## 6. Proposed repo layout — `[CONFIRM — Phase 0]`

Repo structure (monorepo vs. split) is not yet decided. Confirm before scaffolding.

```
/                     root CLAUDE.md + PRD (docs/) + shared config
/mobile               Expo app (create-expo-app) — its own CLAUDE.md, AGENTS.md, .claude/settings.json
/services/api         Cloud Run read APIs
/services/pipeline    ingestion + normalisation + rankings jobs
/infra                infrastructure-as-code (GCP / Firebase) + MCP/tooling setup
/docs                 PRD and design docs
```

**create-expo-app reconciliation (important):**
1. Scaffold the Expo app **first** with `create-expo-app`. It generates a thin `CLAUDE.md` (`@AGENTS.md`), an `AGENTS.md`, and `.claude/settings.json` (Expo plugin enabled).
2. **Then** layer these drafts on top: keep the `@AGENTS.md` import and the Expo plugin; merge the Expo technical conventions into `AGENTS.md`; put the operating contract (this file's rules) into the app-level `CLAUDE.md` so the thin scaffold does **not** overwrite it.
3. Launch Claude Code from the Expo app directory for mobile work so it picks up the Expo plugin/skills/MCP; this root contract still applies as the parent (nested CLAUDE.md resolution).

---

## 7. Commands

**TBD — no scaffold exists yet.** Populate in Phase 0 after `create-expo-app` (expected: `npx expo start`, `npx expo run:ios --device`, lint, typecheck, test). Until then, there are no build or test commands to run.

---

## 8. Baseline conventions (expand as decisions land)

- TypeScript across mobile and services `[CONFIRM]`.
- Secrets and env are never committed: local via gitignored `.env`, cloud via Secret Manager.
- Conventional Commits — with **no** org/employer references in any message (see §1).
- Feed API keys live only in Secret Manager: never in the client, never in the repo.
- The mobile client never calls a data feed directly — it consumes our own cached APIs only.

---

## 9. Never do

- Never invent: app name, brand, colours, pricing, or the stats/KPI field list. All are open items. (Geography, competitions, code, and gender were resolved in v0.3–v0.4 — see PRD §3.4 and register.)
- Never build for Rugby League — it is a **permanent product exclusion** (v0.4, register #1). No League fixtures, teams, stats, or rankings anywhere.
- Never target **web** in v1 (register #18 resolved OUT) — native iOS + Android only.
- Never sign up for or call a **paid** feed before the licensing GATE reactivates for real data (register #5).
- **Never ship the synthetic dev dataset to a production build** (v0.4, register #27). Gate synthetic data to `__DEV__` / dev-client / EAS internal preview only. Any code path that could leak synthetic data into a store build is a release blocker. Store builds must fail hard if a synthetic adapter is present.
- **Never render synthetic data without a persistent dev-mode indicator** on the screen (v0.4).
- **Never fabricate stats against real player names** — use plausibly-fake names in synthetic data (v0.4). Real team names are fine.
- **Never include real crests / logos of any kind** — national team crests (Springbok, silver fern, Welsh dragon, shamrock, thistle, three feathers, etc.), **union logos** (RFU, FFR, NZR, IRFU, WRU, SRU, SARU, UAR, JRFU, World Rugby itself, etc.), and **club logos** (Premiership, Top 14, URC, Super Rugby, MLR clubs, etc.) are all trademarked and sit on the same legal footing. Neutral placeholders only until a licensed image path is established — see PRD register #28 (image-rights bundling with Phase 6 provider selection, v0.6). This rule extends to **coaching-staff photos** and **player photos** for the same reason; both are typically bundled inside a provider's image-rights licence tier separately from the data licence (register #5).
- **National / sub-national flags are OK** (v0.5). Sovereign national flags and constituent-country flags (England / Scotland / Wales / Hong Kong) are public identifiers, not trademarked, and are the standard visual for teams in international rugby. Flags may appear anywhere in the client (badges, hero balls, ranking rows). Crests remain out.
- Never pre-emptively build the real-time (Redis / WebSocket) tier — deferred behind a latency decision (#17) and real demand. Poll-refresh is fine for MVP.
- Never add betting/odds, ads, live video, AR, or Fantasy in v1.
- Never build any **club-level rankings compute path** in v1 (v0.4, register #13 deferred). Internationals use World Rugby's stored public rankings only.
- Never commit under a work identity or reference an employer anywhere.
