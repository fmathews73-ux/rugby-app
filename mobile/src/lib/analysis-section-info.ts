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

