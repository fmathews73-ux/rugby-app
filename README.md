# Rugby App — repo skeleton (v0.2)

This is the Phase 0 skeleton for the Rugby mobile app. Everything here is already
named and placed correctly **except the mobile app**, which `create-expo-app` must
generate — so its two guardrail files are staged in `_merge-after-expo/` to keep the
scaffold order foolproof.

> Placing this tree answers the repo-layout `[CONFIRM]` as **monorepo**. If you'd
> rather split into separate repos, restructure before scaffolding.

## What's here

```
/CLAUDE.md                        operating contract (loaded every session)
/docs/Rugby-App-PRD-v0.2.md       source of truth — product scope
/infra/CLAUDE.md                  GCP/Firebase + agent tooling (MCP) setup
/services/api/CLAUDE.md           Cloud Run read-API guardrails
/services/pipeline/CLAUDE.md      ingestion/normalisation/rankings guardrails
/_merge-after-expo/               mobile files staged for AFTER scaffolding
    ├── CLAUDE.md                 -> becomes /mobile/CLAUDE.md
    ├── AGENTS.md                 -> becomes /mobile/AGENTS.md
    └── README.md                 merge steps
```

`/mobile/` is intentionally absent. Do **not** create it by hand — `create-expo-app`
owns it.

## Setup order (Phase 0)

1. **Git identity first (separation rule).** Set a personal identity for this repo
   before the first commit:
   ```
   git init
   git config user.name  "<personal name>"
   git config user.email "<personal email>"
   ```
   Verify it is NOT a work account. Create the remote on your **personal GitHub**.

2. **Commit this skeleton** as-is.

3. **Scaffold the Expo app** into `/mobile`:
   ```
   npx create-expo-app@latest mobile
   ```
   This generates `/mobile/CLAUDE.md` (a thin `@AGENTS.md` pointer), `/mobile/AGENTS.md`,
   and `/mobile/.claude/settings.json` (Expo plugin enabled).

4. **Merge the staged mobile files** (see `_merge-after-expo/README.md`), then delete
   the `_merge-after-expo/` folder.

5. **Wire agent tooling** per `/infra/CLAUDE.md` (Expo plugin + Skills, Expo MCP,
   iOS Simulator MCP — project scope). Confirm exact commands at
   `docs.expo.dev/agents/claude`.

6. **Run the dev loop in two panes:** `npx expo start` in one, `claude` in another.

## Phase 0 `[CONFIRM]` items to have ready

Claude Code will ask for these before scaffolding beyond the shell:

- Personal GitHub handle
- GCP / Firebase project id (personal)
- Repo layout confirmation (monorepo — this tree)
- TypeScript across mobile + services? (assumed yes)
- IaC tool (Terraform assumed)
- Geography (register #10) — answer: **global by default**
- Brand (register #23) — answer: **neutral placeholders, do not invent**

## Opening prompt for Claude Code

Run this from the repo root once files are placed:

```
Read docs/Rugby-App-PRD-v0.2.md and every CLAUDE.md and AGENTS.md in this repo,
top to bottom, before doing anything else. Then, without writing code or files:

1. Confirm your understanding of the operating contract: the golden rule
   (no silent assumptions), the tag protocol (INPUT NEEDED / RESEARCH REQUIRED /
   GATE / DEFERRED), the separation/privacy rules, and that we are in Phase 0.
2. Produce a Phase 0 readiness report: what Phase 0 requires, what's decided,
   and every open [CONFIRM]/[INPUT NEEDED] item you need from me before
   scaffolding — especially repo layout, personal GitHub handle, GCP/Firebase
   project id, TypeScript, IaC tool.
3. Flag any conflict between the CLAUDE.md/AGENTS.md files and the PRD.
4. Propose a Phase 0 plan: repo + git-identity separation, create-expo-app
   scaffold, merging the staged mobile files without overwriting the contract,
   and wiring the Expo plugin/Skills/MCP + iOS Simulator MCP.

Then stop and wait. Do not begin building, and do not touch anything gated to
Phase 1+ (feed licensing, code/competition scope).
```

Expect it to **pause at the Phase 1 GATES** and **ask about the `[CONFIRM]` items**
rather than inventing them — that is the contract working.
