<!-- Destination: /mobile/CLAUDE.md  (the Expo app root — sits alongside AGENTS.md) -->
<!-- Draft v0.2 — Inherits root /CLAUDE.md. Imports AGENTS.md for Expo technical conventions. -->

@AGENTS.md

# CLAUDE.md — Mobile app (Expo / React Native, iOS + Android)

**Scope:** the Expo mobile client. Inherits every rule in the root `/CLAUDE.md` (operating contract, separation, gates). Expo technical conventions are imported from `AGENTS.md` (the `@AGENTS.md` line above).

Reference pattern is a **data app, not a media app** (PRD §1) — no live video, no AR.

---

## Framework (locked — v0.2)

- **Expo, managed workflow**, React Native. Created with `create-expo-app`.
- **Expo Router** for navigation — file-based routing under `app/`; screen files map to the IA below.
- **Native iOS + Android only. Web is OUT for v1** (register #18 resolved: OUT). Do not add `react-native-web`, web targets, or web-only dependencies.
- Expo **SDK version** is whatever `create-expo-app` installs (latest stable); it is pinned in `package.json` and tracked by `AGENTS.md`'s Expo docs pointer. Use the Expo plugin/skills + Expo MCP for version-matched APIs rather than guessing.

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
- **Consume our own APIs only.** The client never calls a data feed directly and never holds a feed key.

---

## Not in v1

Live video, AR, betting/odds, ads, a Fantasy build, and **web** are all out. Fantasy is a header entry point only.
