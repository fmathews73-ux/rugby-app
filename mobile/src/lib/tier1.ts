/**
 * Canonical Tier-1 international men's team ids (PRD §3.4). Used anywhere
 * the UI needs to scope a control or query to "the Six Nations + Rugby
 * Championship pool" — the Insights canvas team picker, the compare-team
 * pool on the drill-in page, etc.
 */

export const TIER_1_TEAM_IDS = [
  'nzl', 'rsa', 'ire', 'fra', 'sco', 'eng', 'arg', 'aus', 'ita', 'wal',
] as const;
export type Tier1TeamId = (typeof TIER_1_TEAM_IDS)[number];
