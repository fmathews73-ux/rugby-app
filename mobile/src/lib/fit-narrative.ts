/**
 * Card-fit assembly for COMPOSITE reads (narrative spec §5.7).
 *
 * Individual template fields are written under the 450-character cap,
 * but several cards join multiple fields (pair cards: opener + two
 * axis narratives + optional heatmap; ladder: shape + keys; player
 * profile: summary + scouting + outlook) — raw joins ran to ~1600
 * characters and clipped below the card.
 *
 * This assembles the parts as ONE paragraph, sentence by sentence in
 * the order given (priority order — put the sharpest part first), and
 * stops before the first sentence that would break the budget. Whole
 * sentences only, trimmed from the tail: the §5.7 contract.
 */
const NARRATIVE_CAP = 450;

/**
 * Split prose into trimmed sentences. An ender only closes a sentence
 * when followed by whitespace or end-of-text, so decimals ("+8.5")
 * never split mid-number — the old pattern orphaned fragments like
 * "5." out of "+8.5. Their…". Lazy match + lookahead (lookAHEAD is
 * Hermes-safe; lookbehind is not). Any un-terminated tail is kept as
 * a final sentence rather than dropped.
 */
export function splitSentences(text: string): string[] {
  const re = /.+?[.!?]+(?=\s|$)/g;
  const out: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].trim());
    last = re.lastIndex;
  }
  const rest = text.slice(last).trim();
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/**
 * Final display fit: pack whole sentences into a MEASURED capacity —
 * the card's available line count at a conservative characters-per-
 * line estimate — so every card carries as much prose as it can hold
 * and never clips. The measured fit supersedes the flat cap for
 * display; the 450 cap remains the GENERATION contract (spec §5.7).
 */
export function fitToLines(
  text: string,
  lines: number,
  charsPerLine: number = 52,
): string {
  const capacity = Math.max(1, lines) * charsPerLine;
  let out = '';
  for (const sentence of splitSentences(text)) {
    const candidate = out ? `${out} ${sentence}` : sentence;
    if (candidate.length > capacity) break;
    out = candidate;
  }
  return out || text;
}

/**
 * Shown on any card back whose numbers cannot support prose —
 * missing data, or a mostly-zero metric set (owner rule 2026-07-14).
 * Distinct from the `null` loading state, which renders "Analysing…".
 */
export const INSUFFICIENT_INSIGHT =
  'Not enough data yet to generate an insight here — this read fills in as matches are played.';

/**
 * True when a metric set cannot support prose: no finite values, or
 * more than half of them round to zero (the displayed whole numbers
 * are what the reader sees — see the no-decimals law).
 */
export function insufficientData(
  values: readonly (number | null | undefined)[],
): boolean {
  const nums = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  if (nums.length === 0) return true;
  const zeros = nums.filter((v) => Math.round(v) === 0).length;
  return zeros > nums.length / 2;
}

export function fitNarrative(
  parts: readonly (string | null | undefined)[],
  cap: number = NARRATIVE_CAP,
): string | null {
  const sentences = parts
    .filter((p): p is string => Boolean(p))
    .flatMap(splitSentences);

  let out = '';
  for (const sentence of sentences) {
    const candidate = out ? `${out} ${sentence}` : sentence;
    if (candidate.length > cap) break;
    out = candidate;
  }
  // Degenerate case: a single sentence over cap — pass it through and
  // let the card's line-clamp failsafe ellipsize rather than render an
  // empty read (also trips the dev length warning for a rewrite).
  return out || (sentences[0] ?? null);
}
