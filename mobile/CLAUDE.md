@AGENTS.md

# CLAUDE.md — Mobile app (Expo / React Native, iOS + Android)

**Scope:** the Expo mobile client. Inherits every rule in the root `/CLAUDE.md` (operating contract, separation, gates). Expo technical conventions are imported from `AGENTS.md` (the `@AGENTS.md` line above).

Reference pattern is a **data app, not a media app** (PRD §1) — no live video, no AR.

---

## Framework (locked — v0.2)

- **Expo, managed workflow**, React Native. Created with `create-expo-app`. **Installed SDK: 57** (pinned in `package.json`).
- **Expo Router** for navigation — file-based routing under `src/app/` (Expo now uses `src/app/`, not the older top-level `app/`); screen files map to the IA below.
- **Native iOS + Android only. Web is OUT for v1** (register #18 resolved: OUT). The scaffold's default web target, `react-native-web`, `react-dom`, and `web` script were removed on merge. Do not re-add.
- Expo **SDK version** is whatever `create-expo-app` installed (currently 57), pinned in `package.json` and tracked by `AGENTS.md`'s Expo docs pointer. Use the Expo plugin/skills + Expo MCP for version-matched APIs rather than guessing.

---

## Preview / dev loop

- Claude Code edits files → **Metro** (run separately via `npx expo start`) hot-reloads via **Fast Refresh**. There is no direct phone↔agent link; the shared filesystem + Metro is the bridge.
- **Default inner loop: iOS Simulator** (`npx expo start` then `i`) — fastest, no Apple account, and screenshottable by the iOS Simulator MCP so the agent can visually verify its own render.
- **Real-feel checks: physical iPhone dev build** (`npx expo run:ios --device`) — real touch/scroll/performance; needs Xcode + provisioning.
- Run `expo start` in a separate terminal pane from the `claude` session (both are long-running).

---

## Information architecture (confirmed — PRD §4)

- **Footer tabs:** Home · Fixtures · Standings · Teams · Stats · Power Rankings.
- **Header:** Profile (contents TBD #15) · Fantasy (**entry point only — deferred**, do not build) · Logo/brand (**none yet**).
- **Fixtures drill-down:** Overview · Line-Up · Stats · Power Rankings · News.

---

## Build rules

- **Brand is undefined** (PRD §10). Use neutral placeholders for name, logo, colour palette, typography. **Do not invent a visual identity.** A design-system decision precedes UI build.
- **Phase 5 MVP scope only:** Home, Fixtures, Standings, Teams, basic Stats, plus Power Rankings, with FCM push. Nothing beyond Tier-1 screens.
- **Render only what the feed supplies.** For Fixtures sub-tabs (Line-Up, per-match Stats, News) and Teams (coaching staff), render only sections the chosen feed actually provides (Phase 1 research, register #7). If a section isn't supplied, hide or gate it; **never fabricate data**.
- **Stats screen is premium-gated** (PRD §8). The client enforces UI gating but always trusts the server's entitlement decision — never assume access.
- **Home content blocks are undefined** (`[INPUT NEEDED #19]`) — placeholder until confirmed.
- **Consume our own APIs only.** The client never calls a data feed directly and never holds a feed key. Same rule extends to any LLM key — see the analysis-narrative spec below.
- **Match analysis narrative is a client-side template pending Phase 6 LLM cutover.** The Analysis sub-tab on fixture-drill (`mobile/src/hooks/use-match-analysis.ts` + `mobile/src/components/match-analysis-card.tsx`) reads structured, BI-style prose from a template that implements `docs/analysis-narrative-spec.md`. That spec doc IS the LLM's future system prompt — do not let structure, tone, or style rules drift between the template and the spec. When the real LLM path lands at Phase 6, follow the cutover checklist in the spec §7 (server-side inference in personal GCP project, key in Secret Manager, delete the client-side template helpers).
- **Predictor tab is a Phase 0 stub pending Phase 6 ML cutover.** The Predictor tab (`mobile/src/app/(tabs)/predictor.tsx`) is deliberately a placeholder — real match / tournament win-probability predictions require a trained ML model, feature pipeline, and server-side inference route, all deferred to Phase 6. Full brief pinned at `docs/predictor-phase-spec.md`. Same guardrails as the analysis path: client never holds model weights or an inference key. Do not attempt to build the real feature in earlier phases.

---

## Not in v1

Live video, AR, betting/odds, ads, a Fantasy build, and **web** are all out. Fantasy is a header entry point only.

---

## Scaffold state at Phase 0 end

- `app.json`: `name`/`slug` = `mobile` (placeholder — will change with brand decision, register #23). `ios.bundleIdentifier` / `android.package` not yet set — depend on register #26 (neutral domain for reverse-DNS bundle IDs).
- `LICENSE` was deleted on scaffold merge — the template's default Expo-copyright MIT is misleading for a repo we own, and the actual licence decision is tied to register #26. Add back at Phase 6 when the publisher entity is decided.
- Default two-tab starter screens (`src/app/index.tsx`, `src/app/explore.tsx`) are placeholders; will be replaced by the real IA when Phase 5 begins.
- `node_modules/` not installed yet — run `npm install` inside `mobile/` before first `expo start`.
