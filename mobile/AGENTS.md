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

All three are wired at project scope in `mobile/` — **launch Claude Code from `mobile/`** so they are discovered:

- **Expo plugin + Skills** (`expo@claude-plugins-official`) — enabled in `mobile/.claude/settings.json` by the scaffold. Use it to confirm current, version-matched Expo APIs and EAS workflows instead of relying on memory.
- **Expo MCP Server** — remote HTTP MCP at `https://mcp.expo.dev/mcp`, registered in `mobile/.mcp.json`. Gives live access to Expo docs + EAS for the installed SDK. **Auth on first use:** run `/mcp` inside the Claude Code session and complete the OAuth flow with a personal Expo access token (from `expo.dev` under the personal identity, never a work-org token — see root CLAUDE.md §1).
- **iOS Simulator MCP** (`ios-simulator-mcp@^1.6.0`) — local stdio MCP for visual verification. Screenshots and videos are the primary tools; the interactive UI-manipulation tools are filtered out via env so the agent cannot silently drive the simulator. Captures write to `mobile/tmp/simulator-captures/` (gitignored).
- Pin floor for `ios-simulator-mcp` is `^1.6.0`; must NOT drop below 1.3.3 (pre-1.3.3 had a command-injection CVE — see `infra/CLAUDE.md`).

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
