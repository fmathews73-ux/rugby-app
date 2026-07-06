/**
 * Explainer copy for the analysis cards' section info icons — every
 * dropdown category carries an info icon whose popup teaches what the
 * metric IS and why it matters (the Rugby IQ rule: meaning, not just
 * numbers). Axis entries are shared by the match and pre-match cards,
 * which use the same eight-axis taxonomy (spec §11/§12).
 */

export interface SectionInfo {
  title: string;
  paragraphs: readonly string[];
}

export const AXIS_INFO: Record<string, SectionInfo> = {
  attack: {
    title: 'Attack',
    paragraphs: [
      'The scoreboard end of the game: points and tries per game, carry metres and line breaks — how efficiently a side turns opportunity into scores.',
      'Attack efficiency is the single strongest driver of results at Test level. A side can dominate everything else and still lose to a team that converts its few visits better.',
    ],
  },
  defence: {
    title: 'Defence',
    paragraphs: [
      'What a side gives up: points and tries conceded per game, behind the tackle-completion rate that holds the line together.',
      'Tight Test matches are usually lost by the leakier defence rather than won by the sharper attack — a tackle success rate below ~85% almost always shows up on the scoreboard.',
    ],
  },
  'set-piece': {
    title: 'Set Piece',
    paragraphs: [
      'Scrum and lineout success — the platforms the game restarts from. Winning your own ball is expected; losing it is a turnover in prime position.',
      'Most Test tries trace back to set-piece launch. A creaking lineout or scrum leaks both possession and penalties, so a set-piece edge tends to compound across 80 minutes.',
    ],
  },
  discipline: {
    title: 'Discipline',
    paragraphs: [
      'Penalties conceded and cards. The cheapest gifts in rugby: three points, forty metres of territory, or ten minutes a man down.',
      'Sides conceding 12+ penalties a game hand opponents a steady drip of scoreboard and field position — indiscipline converts directly into opposition points.',
    ],
  },
  kicking: {
    title: 'Kicking',
    paragraphs: [
      'The kicking game in open play: how often a side kicks and how much ground those kicks win.',
      'Kicking is the field-position lever — it trades possession for territory without the risk of carrying through traffic. A strong kicking game forces opponents to play from deep.',
    ],
  },
  territory: {
    title: 'Territory',
    paragraphs: [
      'The share of the match played in the opposition half.',
      'Territory is pressure made visible: defending sides concede more penalties and eventually points. Living in the right half of the pitch makes everything else cheaper.',
    ],
  },
  possession: {
    title: 'Possession',
    paragraphs: [
      'The share of the ball a side holds across the match.',
      'Possession is control — but only converted possession wins games. Read it against the scoreboard: heavy possession without points is wasted ball, and a warning sign.',
    ],
  },
  turnovers: {
    title: 'Turnovers',
    paragraphs: [
      'Ball won and lost in contact — steals at the breakdown against handling errors and holding on.',
      'Turnover ball is the most dangerous attacking platform in rugby: the defence is unset and broken-field space opens up. A negative turnover ledger bleeds momentum.',
    ],
  },
};

export const MATCH_SECTION_INFO: Record<string, SectionInfo> = {
  'Coming in': {
    title: 'Coming in',
    paragraphs: [
      'The backdrop at kickoff: each side’s recent form and season baseline as they stood walking into this match — frozen, so the read never changes after the fact.',
      'Context is what separates a shock from a script. Knowing what both sides brought in tells you whether the match confirmed the pattern or broke it.',
    ],
  },
  Commentary: {
    title: 'Commentary',
    paragraphs: [
      'The analyst’s read of how the match actually unfolded — its shape, the attacking edge, and the platform battle — written from the live data and settled at full-time.',
      'This is the narrative spine of the card: the numbers elsewhere are evidence, the commentary is what they add up to.',
    ],
  },
  Variance: {
    title: 'Variance',
    paragraphs: [
      'The axes where the two performances genuinely separated — the two or three dimensions that decided the contest, ranked by the size of the gap.',
      'Most matches are level on most numbers. The variance read filters the noise down to where the match was actually won and lost.',
    ],
  },
  Outlook: {
    title: 'Outlook',
    paragraphs: [
      'What each side takes forward from this performance — the area most in need of sharpening before the next outing.',
      'One match is a data point, not a verdict; the outlook frames what this result suggests about the work-ons.',
    ],
  },
};

export const PRE_MATCH_SECTION_INFO: Record<string, SectionInfo> = {
  Shape: {
    title: 'Shape',
    paragraphs: [
      'The two or three axes where the sides’ recent profiles genuinely diverge — the likely battlegrounds of this fixture, named with the numbers behind them.',
      'When profiles don’t meaningfully diverge, the preview says so: a match between balanced sides is decided by execution, and pretending otherwise would be filler.',
    ],
  },
  'Danger periods': {
    title: 'Danger periods',
    paragraphs: [
      'Quarters of the match where one side has historically scored or conceded well above its share — the windows where swings are most likely.',
      'Teams have scoring habits: fast starters, second-half sides, closers. Knowing the danger windows tells you when a lead is safe and when it isn’t.',
    ],
  },
  Keys: {
    title: 'Keys',
    paragraphs: [
      'One condition per side, derived from this fixture’s biggest profile gaps: the side ahead on an axis gets the exploit — how to press its weapon — and the side behind gets the neutralise — the survival job.',
      'Keys are conditions, never predictions: what each side must make true to win, not a call on who will.',
    ],
  },
};

export const TEAM_SECTION_INFO: Record<string, SectionInfo> = {
  Form: {
    title: 'Form',
    paragraphs: [
      'The recent results read: streaks and the average points margin across the last ten completed matches.',
      'Margins carry more information than results — a run of one-score wins and a run of thirty-point wins are both "five from five", but they are not the same team.',
    ],
  },
  Ranking: {
    title: 'Ranking',
    paragraphs: [
      'The trajectory across the last twelve monthly World Rugby ranking snapshots: climbed, slipped, or held.',
      'World Rugby’s rankings weight results by opponent strength, so sustained movement reflects genuine trajectory — beating better sides moves you further than beating up on weaker ones.',
    ],
  },
  Season: {
    title: 'Season',
    paragraphs: [
      'The per-game statistical profile across the analytical window: attack output, defensive record, then set piece and discipline where they cross reporting thresholds.',
      'This is the team’s statistical identity — the baseline every match performance gets measured against.',
    ],
  },
  Outlook: {
    title: 'Outlook',
    paragraphs: [
      'The single most pressing repair job in the profile, picked in priority order: discipline first, then the weaker set piece, then defensive leakage.',
      'That order follows cost: penalties are the cheapest points given away, set-piece leaks surrender platform, and defensive gaps are the most expensive to fix mid-season.',
    ],
  },
};

export const PLAYER_SECTION_INFO: Record<string, SectionInfo> = {
  Scouting: {
    title: 'Scouting',
    paragraphs: [
      'The percentile profile against positional peers, built on per-80-minute rates: genuine strengths sit at the 70th percentile or better, soft spots at the 30th or below.',
      'Per-80 rates strip out minutes played, so a high-impact bench player reads honestly against a starter — the profile measures output per time on the pitch.',
    ],
  },
  Form: {
    title: 'Form',
    paragraphs: [
      'The recent half of the appearance window compared against the earlier half: the key metric for the player’s role, plus the minutes trend.',
      'Direction beats level for selection reads — a player trending up from a modest base is often a better pick than a big name trending down. Moves under 15% are reported as steady.',
    ],
  },
  Outlook: {
    title: 'Outlook',
    paragraphs: [
      'The forward look built from the profile: what to lift, and what to protect while lifting it.',
      'Development framing, not judgement — the soft spot named here is the highest-leverage improvement available to this player’s game.',
    ],
  },
};

/** Pre-match axis pairings — four dense cards/sections instead of
 *  eight thin ones (fewer carousel dots, more data points per card).
 *  Same coupling logic as the Stats category pairings. */
export const PRE_MATCH_AXIS_PAIRS: readonly {
  title: string;
  keys: readonly [string, string];
}[] = [
  { title: 'Attack & Defence', keys: ['attack', 'defence'] },
  { title: 'Set Piece & Discipline', keys: ['set-piece', 'discipline'] },
  { title: 'Kicking & Territory', keys: ['kicking', 'territory'] },
  { title: 'Possession & Turnovers', keys: ['possession', 'turnovers'] },
];

/** Combined explainer for a paired section: both axes' paragraphs
 *  under the pair title. */
export function pairInfo(pair: { title: string; keys: readonly [string, string] }): SectionInfo {
  return {
    title: pair.title,
    paragraphs: [
      ...(AXIS_INFO[pair.keys[0]]?.paragraphs ?? []),
      ...(AXIS_INFO[pair.keys[1]]?.paragraphs ?? []),
    ],
  };
}
