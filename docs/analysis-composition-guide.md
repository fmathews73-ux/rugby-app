# Analysis Composition Guide — how the narratives are WRITTEN

**Status:** Standing quality bar for every analysis surface (match,
pre-match, team, player). At Phase 6 this document is bundled WITH
`analysis-narrative-spec.md` into the LLM system prompt: the spec says
what to write, this guide says how it must read. Until then it is the
review standard for the client-side templates — any template sentence
that fails this guide is a bug, not a style preference.

The purpose chain is the app's purpose chain: **data → analysis →
insight.** A sentence that presents data without analysis is a table
row wearing prose. A sentence that analyses without landing an insight
is filler. Every sentence must move the reader one step down that
chain.

---

## 1. The voice

Broadcast analyst at the top of their craft — the considered segment
between matches, not the shouted highlights reel. Think of the reader
as a knowledgeable friend who missed the window of matches: they don't
need rugby explained, they need THIS situation explained.

- **Authoritative, never hedged.** "The scrum is where this unravels"
  — not "the scrum could potentially be an area of concern".
  Thresholds already did the hedging; if a claim clears its threshold,
  say it plainly.
- **Specific to THIS fixture / team / player.** The test for every
  sentence: could it be pasted into a different match's analysis
  without anyone noticing? If yes, delete or sharpen it.
- **Economical.** Broadcast segments are timed. One strong sentence
  beats three supporting ones. Never restate what an adjacent section
  already said.

## 2. Numbers are evidence, not subject

The single biggest tell of machine-written sport copy is numbers as
the subject of the sentence. The insight leads; the number proves it.

- WRONG: "RSA average 28.4 points per game while IRE average 21.2
  points per game."
- RIGHT: "South Africa arrive with the heavier scoring habit — 28.4 a
  game to Ireland's 21.2 — and Ireland have not faced a top-three
  attack since November."
- Use at most TWO numbers per sentence. A third number starts a table.
- Round for the ear, not the spreadsheet: "just shy of 30 a game"
  reads better than "29.7" when precision adds nothing; keep the exact
  figure when the margin IS the story (a 93.94 vs 90.33 ranking gap).
- Anchor numbers to meaning wherever the scale isn't self-evident:
  "12 penalties a game — four more than a disciplined Test side
  concedes" beats the bare count.

## 3. Every section is a micro-story

Structure inside a section, not just across sections: situation →
tension → consequence.

- **Situation:** the fact ("Wales's lineout has run at 84% across the
  window").
- **Tension:** why it matters HERE ("South Africa's maul feeds off
  exactly that kind of scrappiness").
- **Consequence:** what the reader should now expect or watch for
  ("every Welsh throw inside their own 22 is a scoring threat — for
  the wrong side").

A section that delivers situation-only is data. Situation + tension is
analysis. All three is the insight the app is named for.

## 4. Cadence and construction

- **Vary sentence LENGTH deliberately.** A long, clause-carrying
  sentence lands harder when the next one is four words. Use that.
- **No mail-merge parallels.** If two adjacent sections both open
  "X have the better...", one of them changes. The eight axis reads
  are the danger zone: rotate between leading with the team, leading
  with the dimension, and leading with the finding (spec §5.6).
- **Rugby's own verbs.** Sides *squeeze*, *starve*, *bully*, *leak*,
  *bleed penalties*, *live off scraps*, *win the collisions*. Generic
  business verbs (*utilise*, *leverage*, *capitalise on
  opportunities*) are banned on sight.
- **The full stop is the strongest punctuation.** Prefer two short
  sentences to one comma splice. No em-dash chains (spec §4 governs
  punctuation absolutely).

## 5. Insight patterns that earn their place

Reach for these; they are what separates analysis from recitation:

1. **The collision** — one side's strength meeting the other's
  weakness on the same axis. The single most valuable pre-match
  pattern: name it whenever the data shows it.
2. **The contradiction** — a stat that cuts against the headline
  story ("for all their possession, the points haven't followed").
3. **The trend inside the window** — not just the average but the
  direction ("conceding less with every outing").
4. **The asymmetry of consequence** — the same event costing the two
  sides differently ("a penalty inside halfway is three points to
  one side and a lineout to the other").
5. **The watch-this flag** — convert analysis into a viewing
  instruction ("watch the first scrum; it will tell you which version
  of this front row turned up").

## 6. Forbidden moves (additions to the spec's avoid-list)

- **Space-filling symmetry:** giving both teams/sections equivalent
  copy for the sake of balance. If one side's story is simply bigger,
  the copy is allowed to be lopsided.
- **Restating the chart:** the cards above the narrative already show
  the data; the narrative's job is what the chart cannot say.
- **Conclusions that conclude nothing:** "it promises to be an
  intriguing contest", "both sides will be looking to impose
  themselves", "much will depend on the day". Any sentence that would
  survive in a horoscope dies here.
- **Repeated sentence skeletons across surfaces:** the pre-match,
  match, team, and player narratives share thresholds, not phrasing.
  A reader moving between tabs should never feel the same template
  underneath.

## 7. Per-surface reminders

- **Pre-match (§11):** forward-looking, appetite-building; the
  reader should finish knowing exactly what to watch for. No result
  language, ever.
- **Match (§1–§5):** the story of what happened / is happening; the
  scoreboard is the spine, the axes are the explanation.
- **Team (§10):** the longer arc — regime, trajectory, identity.
  Words like "window", "stretch", "era" belong here.
- **Player (§9):** scouting desk, not fan club — measured admiration,
  honest soft spots, and the discipline note delivered without
  moralising.

---

## Status of the client templates against this guide

**Initial composition pass COMPLETE (2026-07-05)** across all four
template implementations (`use-match-preview`, `use-match-analysis`,
`use-team-analysis`, `use-player-analysis`): situation-only sentences
rebuilt into situation → tension → consequence, mail-merge parallels
broken up with rotated openers, horoscope conclusions and label-echo
prefixes removed, em-dashes scrubbed from every narrative string.

**Standing obligations (PRD register #29):** any NEW narrative copy
must meet this guide on first writing, and the full template corpus is
re-verified against the guide as a precondition of the Phase 6 LLM
cutover, because the template outputs double as few-shot reference
material. At cutover, this guide + the narrative spec together form
the system prompt.
