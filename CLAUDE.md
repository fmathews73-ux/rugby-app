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

## 3. Active blockers — nothing is unblocked yet

Phase 1 holds the decisions everything else depends on. Until these land, there is **no feed integration, no data-model finalisation, and no paid commitment.**

- **[GATE] Commercial redistribution licence** (register #5). Must be confirmed **in writing** before any paid feed commitment or any build against a feed. Blocks Phases 3+.
- **[GATE] Code & competition scope** (PRD §3.4) — which code(s), which competitions, men's / women's / both, historical depth. Blocks feed selection.
- **[RESEARCH] Provider selection + coverage validation** (register #6, #7).

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

- Never invent: app name, brand, colours, geography, competitions, pricing, the stats/KPI field list, or power-ranking weights. All are open items.
- Never target **web** in v1 (register #18 resolved OUT) — native iOS + Android only.
- Never sign up for or call a **paid** feed before the licensing GATE clears.
- Never pre-emptively build the real-time (Redis / WebSocket) tier — deferred behind a latency decision (#17) and real demand. Poll-refresh is fine for MVP.
- Never add betting/odds, ads, live video, AR, or Fantasy in v1.
- Never commit under a work identity or reference an employer anywhere.
