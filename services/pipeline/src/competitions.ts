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

export const ALL_COMPETITIONS: readonly CompetitionBundle[] = [
  SIX_NATIONS_2026,
  RUGBY_CHAMPIONSHIP_2026,
  SUMMER_TESTS_2026,
  AUTUMN_TESTS_2026,
  WORLD_CUP_2027,
];
