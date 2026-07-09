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
  'defensive-integrity': {
    title: 'Defensive Integrity',
    paragraphs: [
      'Tackle completion set against the line breaks it prevents — missed tackles are the proximate cause of breaks, so the two travel together almost mechanically.',
      'A completion rate below ~85% almost always shows up on the scoreboard; a side completing its tackles yet still conceding breaks has a structural problem, not an effort problem.',
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
  'aerial-delivered': {
    title: 'Aerial (kicked)',
    paragraphs: [
      'Contestable kicks the team puts up (box kicks, bombs, cross-kicks) and the share it regathers. A high regather rate makes kicking a possession weapon rather than a giveaway.',
    ],
  },
  'aerial-received': {
    title: 'Aerial (received)',
    paragraphs: [
      'Contestable kicks that come down on the team and the share it secures. A calm back field turns the opposition kicking game into a free exit.',
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
  // Aerial rides directly behind Kicking & Territory — it is that
  // card's detail view (the contestable slice of the kicking game).
  { title: 'Aerial Contest', keys: ['aerial-delivered', 'aerial-received'] },
  { title: 'Possession & Turnovers', keys: ['possession', 'turnovers'] },
];

/**
 * Per-pair About copy for the axis-pair card backs — every card's
 * About must account for ITS departments (owner rule 2026-07-08), not
 * a shared "per-game averages" boilerplate. Preview = coming-in
 * last-10 framing; match = this-match framing.
 */
export const PAIR_PURPOSES: Record<string, { preview: string; match: string }> = {
  'Attack & Defence': {
    preview:
      'What each side scores and what it lets in, from the last 10: strike output a game against tackle work and points conceded. Each bar is one side\u2019s average; the dark tick is the rival\u2019s number to beat.',
    match:
      'This match\u2019s strike ledger: attacking output against tackle work, live while the game runs and settled at full-time. Each bar is the toggled side\u2019s number against the other side\u2019s dark tick.',
  },
  'Set Piece & Discipline': {
    preview:
      'The platform game coming in: scrum and lineout returns set against the penalty ledger, from the last 10. A side that wins its own ball but keeps conceding penalties hands the platform straight back.',
    match:
      'The platform battle in this match: set-piece returns against the penalty count as they stand. Live it shows whose game is built on solid ball; at full-time, whose held up.',
  },
  'Kicking & Territory': {
    preview:
      'The kicking exchange coming in: boot volume and territory share from the last 10. The side that wins this line gets to play the match in the right half of the pitch.',
    match:
      'Tonight\u2019s kicking exchange: kick volume and territory share as they stand. The side winning this line is choosing where the match is played.',
  },
  'Aerial Contest': {
    preview:
      'The contestable slice of the kicking game, from the last 10: how often each side puts the ball up to compete, how much of it they get back, and how safe the back field has been under the high ball.',
    match:
      'The aerial exchange in this match: contestables delivered and regathered against receptions secured under pressure.',
  },
  'Possession & Turnovers': {
    preview:
      'Who keeps the ball and who gives it back, from the last 10: possession share against the turnover ledger. Control here sets the terms every other department works under.',
    match:
      'Ball ownership in this match: possession share against turnovers, live to the minute. Control here is what every other card has to work with.',
  },
};

