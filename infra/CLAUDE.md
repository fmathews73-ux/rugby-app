<!-- Destination: /infra/CLAUDE.md -->
<!-- Draft v0.2 — Inherits root /CLAUDE.md. Adds Expo agent tooling + MCP setup. -->

# CLAUDE.md — Infrastructure (GCP + Firebase) + agent tooling

**Scope:** infrastructure-as-code for the personal GCP project and Firebase, plus the Claude Code agent-tooling/MCP setup. Inherits every rule in the root `/CLAUDE.md`.

---

## Separation is the top rule here

Personal GCP project + Firebase only `[CONFIRM project id]`. Resource names, project IDs, service accounts, and labels must be **neutral and personal** — no employer, group, or company reference anywhere (root §1). Infra config is where org names leak most easily; check every name.

---

## Cloud conventions

- **IaC preferred** (Terraform) `[CONFIRM tool]`. No secrets in state files or the repo. Feed API keys and all credentials → Secret Manager only.
- **Least-privilege service accounts**, one per service.
- **Provision per phase — not ahead of it:**
  - API Gateway + Cloud Run · Cloud SQL (Postgres) · Cloud Scheduler · BigQuery · Cloud CDN · Firebase Auth + FCM.
  - **Memorystore (Redis) is deferred** — do not provision until a real-time tier is justified (register #17).
- **Cost discipline.** Launch-cheap sequencing (PRD §12): subscriber numbers unlock each next cost tier, not enthusiasm. Do not provision premium-feed or real-time infra early.
- **Store developer accounts** (Apple / Google) under the personal identity. For the iPhone dev-build path, a free personal Apple ID gives 7-day provisioning; the Apple Developer Program ($99/yr) is needed for TestFlight/longer provisioning — take it when Phase 5/6 requires it. Verify current fees at build time (register #21).

---

## Agent tooling & MCP (Expo, mobile)

Goal: Claude Code writes **version-matched Expo code** and can **see its own render**. Register all of this at **project scope** (this repo's `.mcp.json` / project `.claude`) so it never bleeds into other repos or work accounts. Keep the visual loop on **localhost with throwaway data** — simulator/browser MCPs send what they see to the API. Confirm exact commands against `docs.expo.dev/agents/claude` at setup.

- **Expo plugin + Skills** — install `expo@claude-plugins-official` from the Claude Code plugin marketplace; it writes `.claude/settings.json` in the Expo app. Teaches known-good, version-matched Expo patterns.
- **Expo MCP Server (remote)** — connect for live Expo documentation + EAS access for the installed SDK.
- **iOS Simulator MCP (`ios-simulator-mcp`)** — the visual self-QA tool for a native target. Screenshots/inspects the running Simulator so the agent can verify layout and fix it.
  - **Pin ≥ v1.3.3** (earlier versions had a command-injection vulnerability).
  - Project-scoped; suggested env limits tools to `screenshot,record_video` and sets an output dir under the repo.
- **Web-browser MCP (Playwright/Chrome) — not needed.** Web is out of scope for v1 (register #18 OUT); only revisit if a web dev-preview is ever reintroduced.

Builds: **EAS** for cloud dev-client/production builds under the personal Apple ID; `npx expo run:ios --device` for local device installs.
