# AGENTS.md — Expo technical conventions (mobile app)

## Expo has changed — read the versioned docs first

**Installed SDK: 57.** Read `https://docs.expo.dev/versions/v57.0.0/` before writing any Expo code; APIs shift between SDKs and memory is unreliable.

---

This file carries **Expo/React Native technical conventions** for the mobile app. It is imported into the app's Claude Code context via the `@AGENTS.md` line in `CLAUDE.md`.

**Precedence:** the operating contract, separation rules, gap-resolution protocol, and gates live in `CLAUDE.md` (root and app-level). Those override anything here on *process*. This file governs only *how Expo code is written*.

---

## Framework

- **Expo, managed workflow.** React Native under the hood. Created with `create-expo-app`.
- **Expo Router** — file-based routing under `src/app/` (current Expo convention; older docs may say `app/` at the project root). Screens map to the IA in the app `CLAUDE.md` (tabs: Home, Fixtures, Standings, Teams, Stats, Power Rankings; Fixtures drill-down; header Profile / Fantasy-entry-only / brand-placeholder).
- **SDK version:** SDK 57 (whatever `create-expo-app` installed at Phase 0), pinned in `package.json`. Do not silently bump the SDK or add native deps that force a new dev-client build without flagging it.

---

## Targets & scope

- **Native iOS + Android only.** **Web is OUT for v1** (PRD register #18 resolved OUT). The scaffold's default web target, `react-native-web`, `react-dom`, `web` script, and `*.web.tsx` variant files were removed on merge — do not re-add them or reintroduce a `web` block in `app.json`.
- Use **Expo SDK modules** (e.g. expo-router, expo-image, expo-notifications for FCM) in preference to unmanaged native modules. Adding a module outside the Expo SDK means a development build and native config — flag it before doing so.

---

## Correctness tooling (use, don't guess)

- **Expo plugin + Skills** (`expo@claude-plugins-official`) — already enabled in `.claude/settings.json` by the scaffold. Use it to confirm current, version-matched Expo APIs and EAS workflows instead of relying on memory.
- **Expo MCP Server** and **iOS Simulator MCP** — to be wired at Phase 0 close per `/infra/CLAUDE.md`. iOS Simulator MCP is the visual verification tool for screens.

---

## Dev & build

- **First run:** `cd mobile && npm install` (node_modules not committed).
- **Inner loop:** `npx expo start` → press `i` for the **iOS Simulator** (default). Metro + Fast Refresh apply edits live.
- **Real-device check:** `npx expo run:ios --device` for a **dev build on a physical iPhone**.
- **Cloud builds / dev client / releases:** **EAS**, under the owner's personal Apple ID (separation rule).
- Run `expo start` in a terminal pane separate from the `claude` session.

---

## Data & UI rules (mirror app CLAUDE.md — do not violate)

- Client **consumes our own cached APIs only**; never calls a data feed directly; never holds a feed key.
- **Render only feed-supplied sections**; never fabricate data.
- **Stats screen is premium-gated** server-side; the client only reflects entitlement.
- **No invented brand** — neutral placeholders until the design-system decision.
- Not in v1: live video, AR, betting/odds, ads, Fantasy build, web.
