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
  Momentum: {
    title: 'Momentum',
    paragraphs: [
      'The initiative read: who has held the whip hand and when, written from the match shape — halves compared, swings named. Its chart is the zero-sum momentum curve above.',
      'Momentum is the story between the scores: a side can trail on the scoreboard while the curve says the match is turning.',
    ],
  },
  'Scoring Progression': {
    title: 'Scoring Progression',
    paragraphs: [
      'The scoreboard story: lead changes, the minute the lead was taken for good, and the largest unanswered run — the worm chart above in words.',
      'Matches are remembered by their swings; this read names them, or says plainly when there were none.',
    ],
  },
  'Match Gaps': {
    title: 'Match Gaps',
    paragraphs: [
      'The axes where the two performances genuinely separated, biggest gap first — the same ranking the chart draws, so the prose and the bars cannot disagree.',
      'Most matches are level on most numbers. This read filters the noise down to where the match was actually won and lost.',
    ],
  },
  'Pitch Heatmap': {
    title: 'Pitch Heatmap',
    paragraphs: [
      'Where the match has been played: the territory share behind the heat map, and what the pressure produced in the 22.',
      'Territory is pressure made visible — but only converted pressure wins matches, so the read always pairs the ground held with the points it yielded.',
    ],
  },
  'Control vs Conversion': {
    title: 'Control vs Conversion',
    paragraphs: [
      'The match sealed in one read: who held the ball and the ground, who turned that control into points, and which of the two settled it.',
      'Control and conversion are the two ways to win a rugby match — most are won by converting control, and the memorable upsets by conversion beating it.',
    ],
  },
};

export const PRE_MATCH_SECTION_INFO: Record<string, SectionInfo> = {
  'Profile H2H': {
    title: 'Profile H2H',
    paragraphs: [
      'The two last-10 profiles compared axis by axis, biggest gap first — the chart above ranks them, and this read names the battlegrounds and then each side\u2019s key: the exploit for the side ahead, the survival job for the side behind.',
      'Keys are conditions, never predictions: what each side must make true to win, not a call on who will. When the profiles refuse to separate, the preview says so — balanced fixtures are decided by execution.',
    ],
  },
  'Danger Windows': {
    title: 'Danger Windows',
    paragraphs: [
      'Quarters where one side has historically scored or conceded well above its share — the windows where swings are most likely, drawn side by side in the chart above.',
      'Teams have scoring habits: fast starters, second-half sides, closers. Knowing the danger windows tells you when a lead is safe and when it isn\u2019t.',
    ],
  },
};

export const TEAM_SECTION_INFO: Record<string, SectionInfo> = {
  'Team Form': {
    title: 'Team Form',
    paragraphs: [
      'The recent results read: streaks and the average points margin across the last ten completed matches — the margin bars above are its picture.',
      'Margins carry more information than results — a run of one-score wins and a run of thirty-point wins are both "five from five", but they are not the same team.',
    ],
  },
  'Team World Ranking': {
    title: 'Team World Ranking',
    paragraphs: [
      'The trajectory across the last twelve monthly World Rugby ranking snapshots: climbed, slipped, or held.',
      'World Rugby\u2019s rankings weight results by opponent strength, so sustained movement reflects genuine trajectory — beating better sides moves you further than beating up on weaker ones.',
    ],
  },
  'Team Landscape': {
    title: 'Team Landscape',
    paragraphs: [
      'Where the team sits on the pool map: points scored and conceded per game measured against the medians of every side in the competition set — the crosshairs on the chart.',
      'The quadrants carry the verdict: complete sides beat the median at both ends, grinders defend without scoring, entertainers score without defending, and exposed sides trail on both.',
    ],
  },
  'Team Efficiency KPIs': {
    title: 'Team Efficiency KPIs',
    paragraphs: [
      'The per-game statistical profile across the analytical window: attack output, carry game, and the defensive ledger — the KPI bars above with their tier-average ticks.',
      'This is the team\u2019s statistical identity: the baseline every match performance gets measured against.',
    ],
  },
  'Scoring Rhythm': {
    title: 'Scoring Rhythm',
    paragraphs: [
      'The match split into its four 20-minute quarters: when the points arrive (green, above the line) and when they leak (red, below), averaged across the window.',
      'Teams have scoring habits — fast starters, second-half sides, closers. A quarter carrying 35% or more of the points is a habit worth planning around; an even spread is consistency.',
    ],
  },
  'Possession vs Outcome': {
    title: 'Possession vs Outcome',
    paragraphs: [
      'How the wins have actually arrived: each of the last ten matches plotted by possession share against the points margin.',
      'Winning with the ball is control; winning without it is counter-punching; losing with the ball is the warning sign — possession that doesn\u2019t convert is the most fixable failure mode in rugby.',
    ],
  },
  'Set Piece & Discipline': {
    title: 'Set Piece & Discipline',
    paragraphs: [
      'The platform and the whistle in one read: scrum and lineout success against penalties conceded — the quadrant chart above places the team against the pool on both.',
      'The narrative closes with the most pressing repair job, in priority order: discipline first (the cheapest points given away), then the weaker set piece, then defensive leakage.',
    ],
  },
  'Discipline Trend': {
    title: 'Discipline Trend',
    paragraphs: [
      'Penalties conceded in each match of the window against the bands the analysis judges by: 9 or fewer a game is disciplined, 12 or more is a problem.',
      'The read is level AND direction — a rising count usually reaches the scoreboard within a match or two, while a falling one is a side cleaning its game up.',
    ],
  },
};

export const PLAYER_SECTION_INFO: Record<string, SectionInfo> = {
  Form: {
    title: 'Form',
    paragraphs: [
      'The recent half of the appearance window compared against the earlier half: the key metric for the player\u2019s role, plus the minutes trend — the trend chart above is its picture.',
      'Direction beats level for selection reads — a player trending up from a modest base is often a better pick than a big name trending down. Moves under 15% are reported as steady.',
    ],
  },
  Season: {
    title: 'Season',
    paragraphs: [
      'The record card in words: appearances and starts, the minutes workload, and the scoreboard contribution across the window.',
      'Volume is context for everything else — per-80 rates strip minutes out of the profile, but selection and durability live here.',
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
