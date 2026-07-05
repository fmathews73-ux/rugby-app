import type { TeamId } from '@rugby-app/shared';

/**
 * Real current World Rugby men's rankings for the 28 v1 nations —
 * scraped 2026-07-05 from World Rugby's PUBLIC rankings API
 * (effective date 2026-06-29). Internationals use World Rugby's stored
 * public rankings per PRD register #14; this seed anchors the synthetic
 * snapshot series so the LATEST snapshot matches the real table.
 *
 * `pos` is the team's REAL global position — gaps are deliberate
 * (e.g. 21 Belgium, 28–32, 34–35 are nations outside v1 scope), so a
 * row like Brazil #33 reads truthfully against the public table.
 *
 * Refresh by re-scraping when the dataset is regenerated; this is a
 * one-time-seed pattern, never a runtime feed call.
 */
export const MENS_RANKING_SEED: readonly { teamId: TeamId; pos: number; pts: number }[] = [
  { teamId: 'rsa', pos: 1, pts: 93.94 },
  { teamId: 'nzl', pos: 2, pts: 90.33 },
  { teamId: 'ire', pos: 3, pts: 89.07 },
  { teamId: 'fra', pos: 4, pts: 87.46 },
  { teamId: 'arg', pos: 5, pts: 84.97 },
  { teamId: 'eng', pos: 6, pts: 83.91 },
  { teamId: 'sco', pos: 7, pts: 82.9 },
  { teamId: 'aus', pos: 8, pts: 81.53 },
  { teamId: 'fij', pos: 9, pts: 81.14 },
  { teamId: 'ita', pos: 10, pts: 79.64 },
  { teamId: 'wal', pos: 11, pts: 75.07 },
  { teamId: 'jpn', pos: 12, pts: 74.09 },
  { teamId: 'geo', pos: 13, pts: 71.94 },
  { teamId: 'por', pos: 14, pts: 69.64 },
  { teamId: 'uru', pos: 15, pts: 69.19 },
  { teamId: 'usa', pos: 16, pts: 68.26 },
  { teamId: 'esp', pos: 17, pts: 67.51 },
  { teamId: 'chi', pos: 18, pts: 66.72 },
  { teamId: 'tga', pos: 19, pts: 66.66 },
  { teamId: 'sam', pos: 20, pts: 66.43 },
  { teamId: 'rou', pos: 22, pts: 60.67 },
  { teamId: 'hkg', pos: 23, pts: 59.61 },
  { teamId: 'zim', pos: 24, pts: 58.8 },
  { teamId: 'can', pos: 25, pts: 58.75 },
  { teamId: 'nam', pos: 26, pts: 56.96 },
  { teamId: 'ned', pos: 27, pts: 56.44 },
  { teamId: 'bra', pos: 33, pts: 51.5 },
  { teamId: 'ken', pos: 36, pts: 50.09 },
];
