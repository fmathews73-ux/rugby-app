/** The 10 Tier-1 nations (PRD §3.4). Everything else in the 28-team
 *  roster is Tier 2. Shared by the Teams directory and the Team Picker
 *  so the two groupings can never drift. */
export const TIER_1_IDS: ReadonlySet<string> = new Set([
  'eng', 'fra', 'ire', 'ita', 'sco', 'wal', 'arg', 'aus', 'nzl', 'rsa',
]);
