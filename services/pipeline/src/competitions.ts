/**
 * Fixture calendars for the four Tier-1 competitions in scope for v1
 * (PRD §3.4). Real dates and venues are used — both are public record —
 * but the entire dataset is synthetic and MUST be labelled as such at UI
 * level per PRD §5.5.
 *
 * "Today" for status calculation is 2026-07-01, matching the project date
 * at the time this generator was written. When the current date is past
 * a fixture's kickoff, its status is 'completed'; otherwise 'scheduled'.
 */

import type {
  Bracket,
  Competition,
  CompetitionId,
  Fixture,
  Season,
  SeasonId,
  TeamId,
} from '@rugby-app/shared/types';

import { HOME_VENUE, RWC_2027_VENUES } from './registry.js';

export const TODAY_ISO = '2026-07-01';

export interface CompetitionBundle {
  competition: Competition;
  season: Season;
  fixtures: Fixture[];
  /** Team ids playing in this season — used for squad + standings scoping. */
  team_ids: readonly TeamId[];
  /** Optional pool assignment for pool-and-knockout competitions. Group id → team ids. */
  pools?: Record<string, readonly TeamId[]>;
  /** Optional knockout tree for pool-and-knockout competitions. */
  bracket?: Bracket;
}

/** Helper: derive fixture status from kickoff vs. TODAY_ISO. */
function statusFor(kickoff: string): Fixture['status'] {
  return kickoff < TODAY_ISO ? 'completed' : 'scheduled';
}

/** Helper: build a Fixture with the venue defaulted to the home team's home. */
function fx(
  id: string,
  compId: CompetitionId,
  seasonId: SeasonId,
  round: string | null,
  home: TeamId,
  away: TeamId,
  kickoff: string,
  venue?: string,
): Fixture {
  return {
    id,
    competition_id: compId,
    season_id: seasonId,
    round,
    home_team_id: home,
    away_team_id: away,
    kickoff_utc: kickoff,
    venue: venue ?? HOME_VENUE[home] ?? 'TBC',
    status: statusFor(kickoff),
  };
}

// ─── Six Nations 2025 ────────────────────────────────────────────────────────
// Prior season, all in the past. Home/away pairings are flipped vs. SN 2026
// (real Six Nations alternates home ties year-to-year), giving 2025 standings
// a distinct shape from 2026. Fully completed relative to TODAY_ISO.

const SIX_NATIONS_2025: CompetitionBundle = (() => {
  const cid: CompetitionId = 'six-nations';
  const sid: SeasonId = 'six-nations-2025';
  return {
    competition: {
      id: cid,
      name: 'Six Nations Championship',
      short_name: 'Six Nations',
      format: 'round-robin',
      governing_body: 'Six Nations Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2025',
      start_date: '2025-01-31', end_date: '2025-03-15', status: 'completed',
    },
    team_ids: ['eng', 'fra', 'ire', 'ita', 'sco', 'wal'],
    fixtures: [
      // Round 1
      fx('sn25-r1-fra-wal', cid, sid, 'Round 1', 'fra', 'wal', '2025-01-31T20:15:00Z'),
      fx('sn25-r1-sco-ita', cid, sid, 'Round 1', 'sco', 'ita', '2025-02-01T14:15:00Z'),
      fx('sn25-r1-ire-eng', cid, sid, 'Round 1', 'ire', 'eng', '2025-02-01T16:45:00Z'),
      // Round 2
      fx('sn25-r2-eng-fra', cid, sid, 'Round 2', 'eng', 'fra', '2025-02-08T16:45:00Z'),
      fx('sn25-r2-sco-ire', cid, sid, 'Round 2', 'sco', 'ire', '2025-02-09T15:00:00Z'),
      fx('sn25-r2-ita-wal', cid, sid, 'Round 2', 'ita', 'wal', '2025-02-08T14:15:00Z'),
      // Round 3
      fx('sn25-r3-wal-ire', cid, sid, 'Round 3', 'wal', 'ire', '2025-02-22T14:15:00Z'),
      fx('sn25-r3-eng-sco', cid, sid, 'Round 3', 'eng', 'sco', '2025-02-22T16:45:00Z'),
      fx('sn25-r3-ita-fra', cid, sid, 'Round 3', 'ita', 'fra', '2025-02-23T15:00:00Z'),
      // Round 4
      fx('sn25-r4-ita-ire', cid, sid, 'Round 4', 'ita', 'ire', '2025-03-08T14:15:00Z'),
      fx('sn25-r4-wal-eng', cid, sid, 'Round 4', 'wal', 'eng', '2025-03-08T16:45:00Z'),
      fx('sn25-r4-fra-sco', cid, sid, 'Round 4', 'fra', 'sco', '2025-03-08T20:00:00Z'),
      // Round 5 — Super Saturday
      fx('sn25-r5-ita-eng', cid, sid, 'Round 5', 'ita', 'eng', '2025-03-15T14:15:00Z'),
      fx('sn25-r5-wal-sco', cid, sid, 'Round 5', 'wal', 'sco', '2025-03-15T16:45:00Z'),
      fx('sn25-r5-fra-ire', cid, sid, 'Round 5', 'fra', 'ire', '2025-03-15T20:00:00Z'),
    ],
  };
})();

// ─── Rugby Championship 2025 ─────────────────────────────────────────────────
// Prior season, fully completed. Same double round-robin format as RC 2026,
// dates shifted back a year. Gives NZL/RSA/AUS/ARG a full recent history.

const RUGBY_CHAMPIONSHIP_2025: CompetitionBundle = (() => {
  const cid: CompetitionId = 'rugby-championship';
  const sid: SeasonId = 'rugby-championship-2025';
  return {
    competition: {
      id: cid,
      name: 'The Rugby Championship',
      short_name: 'Rugby Championship',
      format: 'round-robin',
      governing_body: 'SANZAAR',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2025',
      start_date: '2025-08-16', end_date: '2025-09-27', status: 'completed',
    },
    team_ids: ['arg', 'aus', 'nzl', 'rsa'],
    fixtures: [
      // Round 1 (Aug 16)
      fx('rc25-r1-arg-nzl', cid, sid, 'Round 1', 'arg', 'nzl', '2025-08-16T20:10:00Z'),
      fx('rc25-r1-aus-rsa', cid, sid, 'Round 1', 'aus', 'rsa', '2025-08-16T09:45:00Z'),
      // Round 2 (Aug 23)
      fx('rc25-r2-arg-nzl-2', cid, sid, 'Round 2', 'arg', 'nzl', '2025-08-23T20:10:00Z'),
      fx('rc25-r2-aus-rsa-2', cid, sid, 'Round 2', 'aus', 'rsa', '2025-08-23T09:45:00Z'),
      // Round 3 (Sep 6)
      fx('rc25-r3-arg-aus', cid, sid, 'Round 3', 'arg', 'aus', '2025-09-06T20:10:00Z'),
      fx('rc25-r3-rsa-nzl', cid, sid, 'Round 3', 'rsa', 'nzl', '2025-09-06T15:00:00Z'),
      // Round 4 (Sep 13)
      fx('rc25-r4-arg-aus-2', cid, sid, 'Round 4', 'arg', 'aus', '2025-09-13T20:10:00Z'),
      fx('rc25-r4-rsa-nzl-2', cid, sid, 'Round 4', 'rsa', 'nzl', '2025-09-13T15:00:00Z'),
      // Round 5 (Sep 20)
      fx('rc25-r5-nzl-arg', cid, sid, 'Round 5', 'nzl', 'arg', '2025-09-20T07:05:00Z'),
      fx('rc25-r5-rsa-aus', cid, sid, 'Round 5', 'rsa', 'aus', '2025-09-20T15:00:00Z'),
      // Round 6 (Sep 27)
      fx('rc25-r6-nzl-arg-2', cid, sid, 'Round 6', 'nzl', 'arg', '2025-09-27T07:05:00Z'),
      fx('rc25-r6-rsa-aus-2', cid, sid, 'Round 6', 'rsa', 'aus', '2025-09-27T15:00:00Z'),
    ],
  };
})();

// ─── Summer Tests 2025 (fully completed) ─────────────────────────────────────
// Prior mid-year test window. All fixtures in the past. Gives every T1 team
// 2 more completed matches feeding form + rankings history.

const SUMMER_TESTS_2025: CompetitionBundle = (() => {
  const cid: CompetitionId = 'summer-tests';
  const sid: SeasonId = 'summer-tests-2025';
  return {
    competition: {
      id: cid,
      name: 'Summer Test Series',
      short_name: 'Summer Tests',
      format: 'test-window',
      governing_body: 'World Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2025',
      start_date: '2025-06-21', end_date: '2025-07-19', status: 'completed',
    },
    team_ids: ['eng', 'fra', 'ire', 'nzl', 'aus', 'rsa', 'arg', 'wal', 'sco', 'ita'],
    fixtures: [
      // Weekend 1 (Jun 21)
      fx('st25-01', cid, sid, null, 'nzl', 'eng', '2025-06-21T07:05:00Z'),
      fx('st25-02', cid, sid, null, 'rsa', 'ita', '2025-06-21T15:00:00Z'),
      fx('st25-03', cid, sid, null, 'aus', 'fra', '2025-06-21T09:45:00Z'),
      fx('st25-04', cid, sid, null, 'arg', 'ire', '2025-06-21T20:10:00Z'),
      // Weekend 2 (Jun 28)
      fx('st25-05', cid, sid, null, 'nzl', 'eng', '2025-06-28T07:05:00Z'),
      fx('st25-06', cid, sid, null, 'rsa', 'ita', '2025-06-28T15:00:00Z'),
      fx('st25-07', cid, sid, null, 'aus', 'fra', '2025-06-28T09:45:00Z'),
      fx('st25-08', cid, sid, null, 'arg', 'ire', '2025-06-28T20:10:00Z'),
      // Weekend 3 (Jul 5)
      fx('st25-09', cid, sid, null, 'nzl', 'wal', '2025-07-05T07:05:00Z'),
      fx('st25-10', cid, sid, null, 'aus', 'sco', '2025-07-05T09:45:00Z'),
    ],
  };
})();

// ─── Autumn Nations Series 2025 (fully completed) ────────────────────────────
// Prior autumn window. All fixtures in the past. Mirrors 2026 shape but with
// flipped North↔South pairings so 2025 standings differ from 2026.

const AUTUMN_TESTS_2025: CompetitionBundle = (() => {
  const cid: CompetitionId = 'autumn-tests';
  const sid: SeasonId = 'autumn-tests-2025';
  return {
    competition: {
      id: cid,
      name: 'Autumn Nations Series',
      short_name: 'Autumn Nations',
      format: 'test-window',
      governing_body: 'World Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2025',
      start_date: '2025-11-08', end_date: '2025-11-29', status: 'completed',
    },
    team_ids: ['eng', 'fra', 'ire', 'sco', 'wal', 'ita', 'nzl', 'aus', 'rsa', 'arg'],
    fixtures: [
      // Nov 8
      fx('at25-01', cid, sid, null, 'ire', 'nzl', '2025-11-08T20:10:00Z'),
      fx('at25-02', cid, sid, null, 'eng', 'aus', '2025-11-08T17:40:00Z'),
      fx('at25-03', cid, sid, null, 'sco', 'rsa', '2025-11-08T15:15:00Z'),
      // Nov 15
      fx('at25-04', cid, sid, null, 'wal', 'nzl', '2025-11-15T17:40:00Z'),
      fx('at25-05', cid, sid, null, 'fra', 'arg', '2025-11-15T20:10:00Z'),
      fx('at25-06', cid, sid, null, 'ita', 'rsa', '2025-11-15T14:10:00Z'),
      // Nov 22
      fx('at25-07', cid, sid, null, 'eng', 'nzl', '2025-11-22T17:40:00Z'),
      fx('at25-08', cid, sid, null, 'ire', 'aus', '2025-11-22T20:10:00Z'),
      fx('at25-09', cid, sid, null, 'sco', 'arg', '2025-11-22T15:15:00Z'),
      // Nov 29
      fx('at25-10', cid, sid, null, 'fra', 'nzl', '2025-11-29T20:10:00Z'),
      fx('at25-11', cid, sid, null, 'wal', 'rsa', '2025-11-29T17:40:00Z'),
      fx('at25-12', cid, sid, null, 'ita', 'arg', '2025-11-29T14:10:00Z'),
    ],
  };
})();

// ─── Six Nations 2026 ────────────────────────────────────────────────────────
// Format: single round-robin, 6 teams, 15 fixtures over 5 rounds.
// Real calendar: Feb-Mar 2026. Fully in the past relative to TODAY_ISO — every
// fixture is 'completed'.

const SIX_NATIONS_2026: CompetitionBundle = (() => {
  const cid: CompetitionId = 'six-nations';
  const sid: SeasonId = 'six-nations-2026';
  return {
    competition: {
      id: cid,
      name: 'Six Nations Championship',
      short_name: 'Six Nations',
      format: 'round-robin',
      governing_body: 'Six Nations Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2026',
      start_date: '2026-02-06', end_date: '2026-03-15', status: 'completed',
    },
    team_ids: ['eng', 'fra', 'ire', 'ita', 'sco', 'wal'],
    fixtures: [
      // Round 1 (Feb 6-8)
      fx('sn26-r1-fra-ita', cid, sid, 'Round 1', 'fra', 'ita', '2026-02-06T20:15:00Z'),
      fx('sn26-r1-sco-eng', cid, sid, 'Round 1', 'sco', 'eng', '2026-02-07T16:45:00Z'),
      fx('sn26-r1-ire-wal', cid, sid, 'Round 1', 'ire', 'wal', '2026-02-08T15:00:00Z'),
      // Round 2 (Feb 13-15)
      fx('sn26-r2-ita-eng', cid, sid, 'Round 2', 'ita', 'eng', '2026-02-13T20:15:00Z'),
      fx('sn26-r2-wal-sco', cid, sid, 'Round 2', 'wal', 'sco', '2026-02-14T14:15:00Z'),
      fx('sn26-r2-fra-ire', cid, sid, 'Round 2', 'fra', 'ire', '2026-02-14T20:00:00Z'),
      // Round 3 (Feb 21-22)
      fx('sn26-r3-eng-ire', cid, sid, 'Round 3', 'eng', 'ire', '2026-02-21T16:45:00Z'),
      fx('sn26-r3-ita-sco', cid, sid, 'Round 3', 'ita', 'sco', '2026-02-22T15:15:00Z'),
      fx('sn26-r3-wal-fra', cid, sid, 'Round 3', 'wal', 'fra', '2026-02-22T20:00:00Z'),
      // Round 4 (Mar 7-8)
      fx('sn26-r4-ire-ita', cid, sid, 'Round 4', 'ire', 'ita', '2026-03-07T14:15:00Z'),
      fx('sn26-r4-fra-eng', cid, sid, 'Round 4', 'fra', 'eng', '2026-03-07T20:00:00Z'),
      fx('sn26-r4-sco-wal', cid, sid, 'Round 4', 'sco', 'wal', '2026-03-08T15:00:00Z'),
      // Round 5 — Super Saturday (Mar 14)
      fx('sn26-r5-wal-ita', cid, sid, 'Round 5', 'wal', 'ita', '2026-03-14T14:15:00Z'),
      fx('sn26-r5-ire-sco', cid, sid, 'Round 5', 'ire', 'sco', '2026-03-14T16:45:00Z'),
      fx('sn26-r5-eng-fra', cid, sid, 'Round 5', 'eng', 'fra', '2026-03-14T20:00:00Z'),
    ],
  };
})();

// ─── Rugby Championship 2026 ─────────────────────────────────────────────────
// Format: double round-robin, 4 teams, 12 fixtures over 6 rounds.
// Real calendar: Aug-Sep 2026. All fixtures are AFTER TODAY_ISO — every fixture
// is 'scheduled', standings empty until it runs.

const RUGBY_CHAMPIONSHIP_2026: CompetitionBundle = (() => {
  const cid: CompetitionId = 'rugby-championship';
  const sid: SeasonId = 'rugby-championship-2026';
  return {
    competition: {
      id: cid,
      name: 'The Rugby Championship',
      short_name: 'Rugby Championship',
      format: 'round-robin',
      governing_body: 'SANZAAR',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2026',
      start_date: '2026-08-08', end_date: '2026-09-26', status: 'upcoming',
    },
    team_ids: ['arg', 'aus', 'nzl', 'rsa'],
    fixtures: [
      // Round 1 (Aug 8)
      fx('rc26-r1-nzl-arg', cid, sid, 'Round 1', 'nzl', 'arg', '2026-08-08T07:05:00Z'),
      fx('rc26-r1-rsa-aus', cid, sid, 'Round 1', 'rsa', 'aus', '2026-08-08T15:00:00Z'),
      // Round 2 (Aug 15)
      fx('rc26-r2-nzl-arg-2', cid, sid, 'Round 2', 'nzl', 'arg', '2026-08-15T07:05:00Z'),
      fx('rc26-r2-rsa-aus-2', cid, sid, 'Round 2', 'rsa', 'aus', '2026-08-15T15:00:00Z'),
      // Round 3 (Aug 29)
      fx('rc26-r3-aus-arg', cid, sid, 'Round 3', 'aus', 'arg', '2026-08-29T09:45:00Z'),
      fx('rc26-r3-nzl-rsa', cid, sid, 'Round 3', 'nzl', 'rsa', '2026-08-29T07:05:00Z'),
      // Round 4 (Sep 5)
      fx('rc26-r4-aus-arg-2', cid, sid, 'Round 4', 'aus', 'arg', '2026-09-05T09:45:00Z'),
      fx('rc26-r4-nzl-rsa-2', cid, sid, 'Round 4', 'nzl', 'rsa', '2026-09-05T07:05:00Z'),
      // Round 5 (Sep 19)
      fx('rc26-r5-arg-nzl', cid, sid, 'Round 5', 'arg', 'nzl', '2026-09-19T20:10:00Z'),
      fx('rc26-r5-aus-rsa', cid, sid, 'Round 5', 'aus', 'rsa', '2026-09-19T09:45:00Z'),
      // Round 6 (Sep 26)
      fx('rc26-r6-arg-nzl-2', cid, sid, 'Round 6', 'arg', 'nzl', '2026-09-26T20:10:00Z'),
      fx('rc26-r6-aus-rsa-2', cid, sid, 'Round 6', 'aus', 'rsa', '2026-09-26T09:45:00Z'),
    ],
  };
})();

// ─── Summer Tests 2026 (test window, half completed) ─────────────────────────
// Format: test-window. Individual tests between Tier-1 sides in June-July 2026.
// TODAY_ISO = 2026-07-01, so June fixtures are 'completed' and July fixtures
// are still 'scheduled'. This mixed state is deliberate — exercises UI state
// handling.

const SUMMER_TESTS_2026: CompetitionBundle = (() => {
  const cid: CompetitionId = 'summer-tests';
  const sid: SeasonId = 'summer-tests-2026';
  return {
    competition: {
      id: cid,
      name: 'Summer Test Series',
      short_name: 'Summer Tests',
      format: 'test-window',
      governing_body: 'World Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2026',
      start_date: '2026-06-20', end_date: '2026-07-25', status: 'live',
    },
    team_ids: ['eng', 'fra', 'ire', 'nzl', 'aus', 'rsa', 'arg', 'wal', 'sco', 'ita'],
    fixtures: [
      // June — completed
      fx('st26-01', cid, sid, null, 'aus', 'eng', '2026-06-20T09:45:00Z'),
      fx('st26-02', cid, sid, null, 'nzl', 'fra', '2026-06-20T07:05:00Z'),
      fx('st26-03', cid, sid, null, 'rsa', 'ire', '2026-06-27T15:00:00Z'),
      fx('st26-04', cid, sid, null, 'arg', 'wal', '2026-06-27T20:10:00Z'),
      fx('st26-05', cid, sid, null, 'aus', 'eng', '2026-06-27T09:45:00Z'),
      // July — scheduled
      fx('st26-06', cid, sid, null, 'nzl', 'fra', '2026-07-04T07:05:00Z'),
      fx('st26-07', cid, sid, null, 'rsa', 'ire', '2026-07-04T15:00:00Z'),
      fx('st26-08', cid, sid, null, 'arg', 'wal', '2026-07-11T20:10:00Z'),
      fx('st26-09', cid, sid, null, 'aus', 'sco', '2026-07-11T09:45:00Z'),
      fx('st26-10', cid, sid, null, 'nzl', 'ita', '2026-07-18T07:05:00Z'),
    ],
  };
})();

// ─── Autumn Nations Series 2026 (upcoming) ───────────────────────────────────

const AUTUMN_TESTS_2026: CompetitionBundle = (() => {
  const cid: CompetitionId = 'autumn-tests';
  const sid: SeasonId = 'autumn-tests-2026';
  return {
    competition: {
      id: cid,
      name: 'Autumn Nations Series',
      short_name: 'Autumn Nations',
      format: 'test-window',
      governing_body: 'World Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2026',
      start_date: '2026-11-07', end_date: '2026-11-28', status: 'upcoming',
    },
    team_ids: ['eng', 'fra', 'ire', 'sco', 'wal', 'ita', 'nzl', 'aus', 'rsa', 'arg'],
    fixtures: [
      // Nov 7
      fx('at26-01', cid, sid, null, 'eng', 'nzl', '2026-11-07T17:40:00Z'),
      fx('at26-02', cid, sid, null, 'ire', 'aus', '2026-11-07T20:10:00Z'),
      fx('at26-03', cid, sid, null, 'wal', 'rsa', '2026-11-07T15:15:00Z'),
      // Nov 14
      fx('at26-04', cid, sid, null, 'fra', 'nzl', '2026-11-14T20:10:00Z'),
      fx('at26-05', cid, sid, null, 'eng', 'arg', '2026-11-14T17:40:00Z'),
      fx('at26-06', cid, sid, null, 'sco', 'rsa', '2026-11-14T15:15:00Z'),
      // Nov 21
      fx('at26-07', cid, sid, null, 'ire', 'nzl', '2026-11-21T20:10:00Z'),
      fx('at26-08', cid, sid, null, 'wal', 'aus', '2026-11-21T15:15:00Z'),
      fx('at26-09', cid, sid, null, 'ita', 'arg', '2026-11-21T14:10:00Z'),
      // Nov 28
      fx('at26-10', cid, sid, null, 'fra', 'rsa', '2026-11-28T20:10:00Z'),
      fx('at26-11', cid, sid, null, 'eng', 'aus', '2026-11-28T17:40:00Z'),
      fx('at26-12', cid, sid, null, 'sco', 'nzl', '2026-11-28T15:15:00Z'),
    ],
  };
})();

// ─── Rugby World Cup 2027 (upcoming — Tier 1 + Tier 2, per PRD §3.4 v0.5) ───
// Fully modelled after the v0.5 scope broadening. 24 teams / 6 pools of 4 /
// pool stage (36 matches) → Round of 16 (12 pool winners+runners-up + 4 best
// third-placed) → QF → SF → Bronze + Final.
//
// Knockout fixture assignments depend on pool outcomes and are unknown until
// the tournament runs. The Bracket entity carries the round structure with
// empty fixture_ids arrays — populated by a real-data cutover or a downstream
// simulation, not synthesised here.
//
// Pool seeding follows standard World Rugby practice: each pool contains one
// team from each of four bands. Bands here approximate current-year rankings.

const WORLD_CUP_2027: CompetitionBundle = (() => {
  const cid: CompetitionId = 'world-cup';
  const sid: SeasonId = 'world-cup-2027';

  const pools: Record<string, readonly TeamId[]> = {
    'Pool A': ['nzl', 'wal', 'geo', 'chi'],
    'Pool B': ['rsa', 'ita', 'sam', 'nam'],
    'Pool C': ['ire', 'jpn', 'tga', 'rou'],
    'Pool D': ['fra', 'fij', 'usa', 'zim'],
    'Pool E': ['eng', 'sco', 'uru', 'hkg'],
    'Pool F': ['aus', 'arg', 'por', 'esp'],
  };

  const allTeams: TeamId[] = Object.values(pools).flat();

  /** Round-robin match order for a pool of 4: 6 games in 3 rounds where
   * each team plays exactly once per round. */
  const POOL_ROUND_ROBIN: readonly (readonly [number, number])[] = [
    [0, 1], [2, 3], // Round 1
    [0, 2], [1, 3], // Round 2
    [0, 3], [1, 2], // Round 3
  ];

  // Pool-stage dates: three rounds spread across Oct 1-25, 2027.
  // Rounds spaced ~1 week apart; each round takes a Fri-Sun weekend.
  const POOL_ROUND_DATES: readonly [string, string][] = [
    ['2027-10-02T08:00:00Z', '2027-10-03T08:00:00Z'], // Round 1
    ['2027-10-09T08:00:00Z', '2027-10-10T08:00:00Z'], // Round 2
    ['2027-10-16T08:00:00Z', '2027-10-17T08:00:00Z'], // Round 3
  ];

  const fixtures: Fixture[] = [];
  const poolLetters = Object.keys(pools);
  poolLetters.forEach((poolName, poolIdx) => {
    const teams = pools[poolName];
    if (!teams) return;
    POOL_ROUND_ROBIN.forEach(([i, j], gameIdx) => {
      const roundIdx = Math.floor(gameIdx / 2);
      const isFirstGameOfRound = gameIdx % 2 === 0;
      const roundDates = POOL_ROUND_DATES[roundIdx];
      if (!roundDates) return;
      const kickoff = isFirstGameOfRound ? roundDates[0] : roundDates[1];
      const home = teams[i];
      const away = teams[j];
      if (!home || !away) return;
      const venue = RWC_2027_VENUES[
        (poolIdx * 6 + gameIdx) % RWC_2027_VENUES.length
      ] ?? 'TBC';
      fixtures.push(fx(
        `rwc27-${poolName.replace(' ', '').toLowerCase()}-g${gameIdx + 1}`,
        cid, sid,
        `${poolName} · Round ${roundIdx + 1}`,
        home, away, kickoff, venue,
      ));
    });
  });

  const bracket: Bracket = {
    id: `${sid}-bracket`,
    competition_id: cid,
    season_id: sid,
    rounds: [
      { name: 'Round of 16', fixture_ids: [] },
      { name: 'Quarter-final', fixture_ids: [] },
      { name: 'Semi-final', fixture_ids: [] },
      { name: 'Bronze final', fixture_ids: [] },
      { name: 'Final', fixture_ids: [] },
    ],
  };

  return {
    competition: {
      id: cid,
      name: 'Rugby World Cup',
      short_name: 'World Cup',
      format: 'pool-and-knockout',
      governing_body: 'World Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2027',
      start_date: '2027-10-01', end_date: '2027-11-13', status: 'upcoming',
    },
    team_ids: allTeams,
    pools,
    fixtures,
    bracket,
  };
})();

// ─── Pacific Nations Cup (v0.7 scope broadening) ─────────────────────────────
// The primary annual competition for six of the v1 Tier-2 nations. The real
// PNC runs two pools + a finals weekend; the synthetic dataset simplifies to
// a single round-robin table (same class of simplification as the monthly
// rankings cadence) — revisit at real-data cutover (PRD register #7).

const PNC_TEAMS: readonly TeamId[] = ['fij', 'jpn', 'sam', 'tga', 'usa', 'can'];

const PACIFIC_NATIONS_CUP_2025: CompetitionBundle = (() => {
  const cid: CompetitionId = 'pacific-nations-cup';
  const sid: SeasonId = 'pacific-nations-cup-2025';
  return {
    competition: {
      id: cid,
      name: 'Pacific Nations Cup',
      short_name: 'Pacific Nations Cup',
      format: 'round-robin',
      governing_body: 'World Rugby',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2025',
      start_date: '2025-08-23', end_date: '2025-09-20', status: 'completed',
    },
    team_ids: PNC_TEAMS,
    fixtures: [
      // Round 1 (Aug 23)
      fx('pnc25-r1-fij-can', cid, sid, 'Round 1', 'fij', 'can', '2025-08-23T03:00:00Z'),
      fx('pnc25-r1-jpn-usa', cid, sid, 'Round 1', 'jpn', 'usa', '2025-08-23T06:00:00Z'),
      fx('pnc25-r1-sam-tga', cid, sid, 'Round 1', 'sam', 'tga', '2025-08-23T01:00:00Z'),
      // Round 2 (Aug 30)
      fx('pnc25-r2-fij-usa', cid, sid, 'Round 2', 'fij', 'usa', '2025-08-30T03:00:00Z'),
      fx('pnc25-r2-tga-can', cid, sid, 'Round 2', 'tga', 'can', '2025-08-30T02:00:00Z'),
      fx('pnc25-r2-jpn-sam', cid, sid, 'Round 2', 'jpn', 'sam', '2025-08-30T06:00:00Z'),
      // Round 3 (Sep 6)
      fx('pnc25-r3-fij-tga', cid, sid, 'Round 3', 'fij', 'tga', '2025-09-06T03:00:00Z'),
      fx('pnc25-r3-usa-sam', cid, sid, 'Round 3', 'usa', 'sam', '2025-09-06T22:00:00Z'),
      fx('pnc25-r3-can-jpn', cid, sid, 'Round 3', 'can', 'jpn', '2025-09-06T21:00:00Z'),
      // Round 4 (Sep 13)
      fx('pnc25-r4-fij-sam', cid, sid, 'Round 4', 'fij', 'sam', '2025-09-13T03:00:00Z'),
      fx('pnc25-r4-tga-jpn', cid, sid, 'Round 4', 'tga', 'jpn', '2025-09-13T02:00:00Z'),
      fx('pnc25-r4-usa-can', cid, sid, 'Round 4', 'usa', 'can', '2025-09-13T22:00:00Z'),
      // Round 5 (Sep 20)
      fx('pnc25-r5-fij-jpn', cid, sid, 'Round 5', 'fij', 'jpn', '2025-09-20T03:00:00Z'),
      fx('pnc25-r5-sam-can', cid, sid, 'Round 5', 'sam', 'can', '2025-09-20T01:00:00Z'),
      fx('pnc25-r5-tga-usa', cid, sid, 'Round 5', 'tga', 'usa', '2025-09-20T02:00:00Z'),
    ],
  };
})();

const PACIFIC_NATIONS_CUP_2026: CompetitionBundle = (() => {
  const cid: CompetitionId = 'pacific-nations-cup';
  const sid: SeasonId = 'pacific-nations-cup-2026';
  return {
    competition: PACIFIC_NATIONS_CUP_2025.competition,
    season: {
      id: sid, competition_id: cid, year_label: '2026',
      start_date: '2026-08-22', end_date: '2026-09-19', status: 'upcoming',
    },
    team_ids: PNC_TEAMS,
    fixtures: [
      // Home/away flipped vs 2025.
      // Round 1 (Aug 22)
      fx('pnc26-r1-can-fij', cid, sid, 'Round 1', 'can', 'fij', '2026-08-22T21:00:00Z'),
      fx('pnc26-r1-usa-jpn', cid, sid, 'Round 1', 'usa', 'jpn', '2026-08-22T22:00:00Z'),
      fx('pnc26-r1-tga-sam', cid, sid, 'Round 1', 'tga', 'sam', '2026-08-22T02:00:00Z'),
      // Round 2 (Aug 29)
      fx('pnc26-r2-usa-fij', cid, sid, 'Round 2', 'usa', 'fij', '2026-08-29T22:00:00Z'),
      fx('pnc26-r2-can-tga', cid, sid, 'Round 2', 'can', 'tga', '2026-08-29T21:00:00Z'),
      fx('pnc26-r2-sam-jpn', cid, sid, 'Round 2', 'sam', 'jpn', '2026-08-29T01:00:00Z'),
      // Round 3 (Sep 5)
      fx('pnc26-r3-tga-fij', cid, sid, 'Round 3', 'tga', 'fij', '2026-09-05T02:00:00Z'),
      fx('pnc26-r3-sam-usa', cid, sid, 'Round 3', 'sam', 'usa', '2026-09-05T01:00:00Z'),
      fx('pnc26-r3-jpn-can', cid, sid, 'Round 3', 'jpn', 'can', '2026-09-05T06:00:00Z'),
      // Round 4 (Sep 12)
      fx('pnc26-r4-sam-fij', cid, sid, 'Round 4', 'sam', 'fij', '2026-09-12T01:00:00Z'),
      fx('pnc26-r4-jpn-tga', cid, sid, 'Round 4', 'jpn', 'tga', '2026-09-12T06:00:00Z'),
      fx('pnc26-r4-can-usa', cid, sid, 'Round 4', 'can', 'usa', '2026-09-12T21:00:00Z'),
      // Round 5 (Sep 19)
      fx('pnc26-r5-jpn-fij', cid, sid, 'Round 5', 'jpn', 'fij', '2026-09-19T06:00:00Z'),
      fx('pnc26-r5-can-sam', cid, sid, 'Round 5', 'can', 'sam', '2026-09-19T21:00:00Z'),
      fx('pnc26-r5-usa-tga', cid, sid, 'Round 5', 'usa', 'tga', '2026-09-19T22:00:00Z'),
    ],
  };
})();

// ─── Rugby Europe Championship (v0.7 scope broadening) ───────────────────────
// Modelled with the FIVE of its eight real participants inside the v1
// 28-team roster (Georgia, Portugal, Spain, Romania, Netherlands). Belgium,
// Germany and Switzerland are outside team scope (PRD §3.4) and excluded
// from the synthetic table. 5-team round robin: one side rests each round.

const REC_TEAMS: readonly TeamId[] = ['geo', 'por', 'esp', 'rou', 'ned'];

const RUGBY_EUROPE_2025: CompetitionBundle = (() => {
  const cid: CompetitionId = 'rugby-europe-championship';
  const sid: SeasonId = 'rugby-europe-championship-2025';
  return {
    competition: {
      id: cid,
      name: 'Rugby Europe Championship',
      short_name: 'Rugby Europe',
      format: 'round-robin',
      governing_body: 'Rugby Europe',
    },
    season: {
      id: sid, competition_id: cid, year_label: '2025',
      start_date: '2025-02-01', end_date: '2025-03-15', status: 'completed',
    },
    team_ids: REC_TEAMS,
    fixtures: [
      // Round 1 (Feb 1) — Georgia rest
      fx('rec25-r1-por-ned', cid, sid, 'Round 1', 'por', 'ned', '2025-02-01T15:00:00Z'),
      fx('rec25-r1-esp-rou', cid, sid, 'Round 1', 'esp', 'rou', '2025-02-01T12:45:00Z'),
      // Round 2 (Feb 8) — Romania rest
      fx('rec25-r2-geo-ned', cid, sid, 'Round 2', 'geo', 'ned', '2025-02-08T13:00:00Z'),
      fx('rec25-r2-por-esp', cid, sid, 'Round 2', 'por', 'esp', '2025-02-08T15:00:00Z'),
      // Round 3 (Feb 22) — Portugal rest
      fx('rec25-r3-geo-rou', cid, sid, 'Round 3', 'geo', 'rou', '2025-02-22T13:00:00Z'),
      fx('rec25-r3-ned-esp', cid, sid, 'Round 3', 'ned', 'esp', '2025-02-22T13:30:00Z'),
      // Round 4 (Mar 8) — Netherlands rest
      fx('rec25-r4-geo-esp', cid, sid, 'Round 4', 'geo', 'esp', '2025-03-08T13:00:00Z'),
      fx('rec25-r4-rou-por', cid, sid, 'Round 4', 'rou', 'por', '2025-03-08T12:00:00Z'),
      // Round 5 (Mar 15) — Spain rest
      fx('rec25-r5-geo-por', cid, sid, 'Round 5', 'geo', 'por', '2025-03-15T13:00:00Z'),
      fx('rec25-r5-rou-ned', cid, sid, 'Round 5', 'rou', 'ned', '2025-03-15T12:00:00Z'),
    ],
  };
})();

const RUGBY_EUROPE_2026: CompetitionBundle = (() => {
  const cid: CompetitionId = 'rugby-europe-championship';
  const sid: SeasonId = 'rugby-europe-championship-2026';
  return {
    competition: RUGBY_EUROPE_2025.competition,
    season: {
      id: sid, competition_id: cid, year_label: '2026',
      start_date: '2026-02-07', end_date: '2026-03-14', status: 'completed',
    },
    team_ids: REC_TEAMS,
    fixtures: [
      // Home/away flipped vs 2025.
      // Round 1 (Feb 7) — Georgia rest
      fx('rec26-r1-ned-por', cid, sid, 'Round 1', 'ned', 'por', '2026-02-07T13:30:00Z'),
      fx('rec26-r1-rou-esp', cid, sid, 'Round 1', 'rou', 'esp', '2026-02-07T12:00:00Z'),
      // Round 2 (Feb 14) — Romania rest
      fx('rec26-r2-ned-geo', cid, sid, 'Round 2', 'ned', 'geo', '2026-02-14T13:30:00Z'),
      fx('rec26-r2-esp-por', cid, sid, 'Round 2', 'esp', 'por', '2026-02-14T12:45:00Z'),
      // Round 3 (Feb 28) — Portugal rest
      fx('rec26-r3-rou-geo', cid, sid, 'Round 3', 'rou', 'geo', '2026-02-28T12:00:00Z'),
      fx('rec26-r3-esp-ned', cid, sid, 'Round 3', 'esp', 'ned', '2026-02-28T12:45:00Z'),
      // Round 4 (Mar 7) — Netherlands rest
      fx('rec26-r4-esp-geo', cid, sid, 'Round 4', 'esp', 'geo', '2026-03-07T12:45:00Z'),
      fx('rec26-r4-por-rou', cid, sid, 'Round 4', 'por', 'rou', '2026-03-07T15:00:00Z'),
      // Round 5 (Mar 14) — Spain rest
      fx('rec26-r5-por-geo', cid, sid, 'Round 5', 'por', 'geo', '2026-03-14T15:00:00Z'),
      fx('rec26-r5-ned-rou', cid, sid, 'Round 5', 'ned', 'rou', '2026-03-14T13:30:00Z'),
    ],
  };
})();

export const ALL_COMPETITIONS: readonly CompetitionBundle[] = [
  // Prior season — fully completed, feeds form + rankings history.
  SIX_NATIONS_2025,
  RUGBY_CHAMPIONSHIP_2025,
  SUMMER_TESTS_2025,
  AUTUMN_TESTS_2025,
  PACIFIC_NATIONS_CUP_2025,
  RUGBY_EUROPE_2025,
  // Current season.
  SIX_NATIONS_2026,
  RUGBY_CHAMPIONSHIP_2026,
  SUMMER_TESTS_2026,
  AUTUMN_TESTS_2026,
  RUGBY_EUROPE_2026,
  PACIFIC_NATIONS_CUP_2026,
  WORLD_CUP_2027,
];
