<!-- Destination: /mobile/AGENTS.md  (Expo app root; imported by that level's CLAUDE.md via @AGENTS.md) -->
<!-- Draft v0.2 — Expo technical conventions. The operating contract lives in CLAUDE.md, which overrides this file on process/guardrails. -->

# AGENTS.md — Expo technical conventions (mobile app)

This file carries **Expo/React Native technical conventions** for the mobile app. It is imported into the app's Claude Code context via the `@AGENTS.md` line in `CLAUDE.md`.

**Precedence:** the operating contract, separation rules, gap-resolution protocol, and gates live in `CLAUDE.md` (root and app-level). Those override anything here on *process*. This file governs only *how Expo code is written*.

> Note: `create-expo-app` also generates/maintains an Expo docs pointer here for the installed SDK version. Keep that pointer; add the conventions below alongside it. Put project-level technical instructions in this file (Expo's convention), not scattered across CLAUDE.md.

---

## Framework

- **Expo, managed workflow.** React Native under the hood. Created with `create-expo-app`.
- **Expo Router** — file-based routing under `app/`. Screens map to the IA in the app `CLAUDE.md` (tabs: Home, Fixtures, Standings, Teams, Stats, Power Rankings; Fixtures drill-down; header Profile/Fantasy-entry-only/brand-placeholder).
- **SDK version:** whatever `create-expo-app` installed (latest stable), pinned in `package.json`. Do not silently bump the SDK or add native deps that force a new dev-client build without flagging it.

---

## Targets & scope

- **Native iOS + Android only.** **Web is OUT for v1** (PRD register #18 resolved OUT). Do not add `react-native-web`, web build targets, or web-only libraries.
- Use **Expo SDK modules** (e.g. expo-router, expo-image, expo-notifications for FCM) in preference to unmanaged native modules. Adding a module outside the Expo SDK means a development build and native config — flag it before doing so.

---

## Correctness tooling (use, don't guess)

- **Expo plugin + Skills** (`expo@claude-plugins-official`) and the **Expo MCP Server** are enabled for this app (see `infra/CLAUDE.md`). Use them to confirm current, version-matched Expo APIs and EAS workflows instead of relying on memory.
- **iOS Simulator MCP** is available for visual verification — screenshot the Simulator to check layout against intent before considering a screen done.

---

## Dev & build

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
