# _merge-after-expo — mobile guardrails (place AFTER scaffolding)

These two files must NOT be dropped into `/mobile` before `create-expo-app` runs —
the scaffold generates its own `CLAUDE.md` and `AGENTS.md`, and they would collide.
Do this **after** step 3 in the root README.

## Steps

1. Run the scaffold (from repo root):
   ```
   npx create-expo-app@latest mobile
   ```
   It creates `/mobile/CLAUDE.md` (one line: `@AGENTS.md`), `/mobile/AGENTS.md`
   (with an Expo docs pointer for the installed SDK), and
   `/mobile/.claude/settings.json` (Expo plugin enabled).

2. **`/mobile/CLAUDE.md`** — replace the thin scaffolded file with this folder's
   `CLAUDE.md`. Keep the `@AGENTS.md` import line (it's already at the top of ours).

3. **`/mobile/AGENTS.md`** — merge this folder's `AGENTS.md` INTO the scaffolded one:
   - **Keep** the scaffold's Expo SDK docs pointer (it tracks the installed SDK).
   - **Add** our conventions (framework lock, native-only/web-out, correctness
     tooling, dev/build, data & UI rules) alongside it.

4. **`/mobile/.claude/settings.json`** — leave the Expo plugin enabled. Add the
   iOS Simulator MCP (project scope) and connect the Expo MCP per `/infra/CLAUDE.md`.

5. **Delete `_merge-after-expo/`** once merged.

## Why

The root `CLAUDE.md` (§6, "create-expo-app reconciliation") is the authority on this.
Net effect: operating contract + separation live in `CLAUDE.md`; Expo technical
conventions live in `AGENTS.md`; the scaffold's SDK pointer is preserved so generated
code stays version-matched.
