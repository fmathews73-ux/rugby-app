import type { FastifyInstance, FastifyReply } from 'fastify';

import type { Position } from '@rugby-app/shared';

import type { Store } from './store.js';

function notFound(reply: FastifyReply, message: string): FastifyReply {
  return reply.code(404).send({ error: 'not_found', message });
}

// ─── Percentile read-model config ────────────────────────────────────────────

/** Numeric PlayerMatchStats fields ranked in the percentile read-model.
 *  Matches the mobile aggregate's field list. */
const PERCENTILE_FIELDS = [
  'tries',
  'try_assists',
  'points',
  'carries',
  'metres_carried',
  'clean_breaks',
  'defenders_beaten',
  'offloads',
  'passes',
  'handling_errors',
  'conversions',
  'penalty_goals',
  'drop_goals',
  'kicks_from_hand',
  'kick_metres',
  'tackles_made',
  'missed_tackles',
  'turnovers_won',
  'rucks_hit',
  'lineout_takes',
  'lineout_steals',
  'penalties_conceded',
  'yellow_cards',
  'red_cards',
] as const;

/** Peer pools for percentile comparison. A prop's numbers are only
 *  meaningful against other front-rowers, a fly-half's against other
 *  half-backs — cross-position comparison is noise. */
const POSITION_GROUP_MEMBERS: Record<string, readonly Position[]> = {
  'front-row': ['loose-head-prop', 'hooker', 'tight-head-prop'],
  locks: ['lock'],
  'back-row': ['blindside-flanker', 'openside-flanker', 'number-8'],
  'half-backs': ['scrum-half', 'fly-half'],
  centres: ['inside-centre', 'outside-centre'],
  'back-three': ['left-wing', 'right-wing', 'fullback'],
};

function positionGroupOf(position: Position): string {
  for (const [group, members] of Object.entries(POSITION_GROUP_MEMBERS)) {
    if (members.includes(position)) return group;
  }
  return 'back-three';
}

export function registerRoutes(app: FastifyInstance, store: Store): void {
  // ─── Root / health ────────────────────────────────────────────────────────
  app.get('/', async () => ({
    service: '@rugby-app/api',
    status: 'ok',
    entities: {
      competitions: store.competitions.length,
      seasons: store.seasons.length,
      teams: store.teams.length,
      players: store.players.length,
      squads: store.squads.length,
      fixtures: store.fixtures.length,
      results: store.results.length,
      lineups: store.lineups.length,
      standings: store.standings.length,
      brackets: store.brackets.length,
      rankings: store.rankings.length,
    },
  }));

  // ─── Competitions ─────────────────────────────────────────────────────────
  app.get('/competitions', async () => store.competitions);

  app.get<{ Params: { id: string } }>('/competitions/:id', async (req, reply) => {
    const c = store.competitionById.get(req.params.id);
    return c ?? notFound(reply, `competition ${req.params.id} not found`);
  });

  // ─── Seasons ──────────────────────────────────────────────────────────────
  app.get<{ Querystring: { competition_id?: string } }>('/seasons', async (req) => {
    if (req.query.competition_id) {
      return store.seasonsByCompetition.get(req.query.competition_id) ?? [];
    }
    return store.seasons;
  });

  app.get<{ Params: { id: string } }>('/seasons/:id', async (req, reply) => {
    const s = store.seasonById.get(req.params.id);
    return s ?? notFound(reply, `season ${req.params.id} not found`);
  });

  app.get<{ Params: { id: string } }>('/seasons/:id/fixtures', async (req, reply) => {
    if (!store.seasonById.has(req.params.id)) {
      return notFound(reply, `season ${req.params.id} not found`);
    }
    return store.fixturesBySeason.get(req.params.id) ?? [];
  });

  app.get<{ Params: { id: string } }>('/seasons/:id/standings', async (req, reply) => {
    if (!store.seasonById.has(req.params.id)) {
      return notFound(reply, `season ${req.params.id} not found`);
    }
    return store.standingsBySeason.get(req.params.id) ?? [];
  });

  app.get<{ Params: { id: string } }>('/seasons/:id/bracket', async (req, reply) => {
    if (!store.seasonById.has(req.params.id)) {
      return notFound(reply, `season ${req.params.id} not found`);
    }
    const b = store.bracketBySeason.get(req.params.id);
    return b ?? notFound(reply, `no bracket for season ${req.params.id}`);
  });

  // ─── Fixtures ─────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/fixtures/:id', async (req, reply) => {
    const f = store.fixtureById.get(req.params.id);
    return f ?? notFound(reply, `fixture ${req.params.id} not found`);
  });

  app.get<{ Params: { id: string } }>('/fixtures/:id/result', async (req, reply) => {
    if (!store.fixtureById.has(req.params.id)) {
      return notFound(reply, `fixture ${req.params.id} not found`);
    }
    const r = store.resultByFixture.get(req.params.id);
    return r ?? notFound(reply, `no result for fixture ${req.params.id} yet`);
  });

  app.get<{ Params: { id: string } }>('/fixtures/:id/lineups', async (req, reply) => {
    if (!store.fixtureById.has(req.params.id)) {
      return notFound(reply, `fixture ${req.params.id} not found`);
    }
    return store.lineupsByFixture.get(req.params.id) ?? [];
  });

  // Chronological match-event timeline for a fixture. Empty array (not 404)
  // when the fixture has no events yet — scheduled fixtures, or completed
  // ones missing from the synthetic dataset. Consumers can treat empty as
  // "no data yet" without a special error branch.
  app.get<{ Params: { id: string } }>('/fixtures/:id/events', async (req, reply) => {
    if (!store.fixtureById.has(req.params.id)) {
      return notFound(reply, `fixture ${req.params.id} not found`);
    }
    return store.eventsByFixture.get(req.params.id) ?? [];
  });

  // Per-player per-match stat sheets for a fixture — one per matchday-23
  // member of both sides. Only completed fixtures have sheets; empty array
  // (not 404) otherwise, matching the lineups route's empty behaviour.
  app.get<{ Params: { id: string } }>('/fixtures/:id/player-stats', async (req, reply) => {
    if (!store.fixtureById.has(req.params.id)) {
      return notFound(reply, `fixture ${req.params.id} not found`);
    }
    return store.playerStatsByFixture.get(req.params.id) ?? [];
  });

  // Match officials for a fixture — referee, two assistant referees
  // (sideline), and the TMO. Announced pre-match so this endpoint returns
  // a full slate even for scheduled fixtures. Empty array (not 404) when
  // the assignment isn't recorded, so the UI can hide the section cleanly.
  app.get<{ Params: { id: string } }>('/fixtures/:id/officials', async (req, reply) => {
    if (!store.fixtureById.has(req.params.id)) {
      return notFound(reply, `fixture ${req.params.id} not found`);
    }
    return store.officialsByFixture.get(req.params.id) ?? [];
  });

  // Players relevant to a fixture — the union of both teams' lineup entries
  // (starting XV + bench) and every player_id / related_player_id referenced
  // by any of that fixture's events. Lets the client resolve player names
  // for the Line-Up and Overview timelines in a single round trip.
  app.get<{ Params: { id: string } }>('/fixtures/:id/players', async (req, reply) => {
    const fixtureId = req.params.id;
    if (!store.fixtureById.has(fixtureId)) {
      return notFound(reply, `fixture ${fixtureId} not found`);
    }
    const ids = new Set<string>();
    for (const lu of store.lineupsByFixture.get(fixtureId) ?? []) {
      for (const e of lu.starting_xv) ids.add(e.player_id);
      for (const e of lu.bench) ids.add(e.player_id);
    }
    for (const ev of store.eventsByFixture.get(fixtureId) ?? []) {
      if (ev.player_id) ids.add(ev.player_id);
      if (ev.related_player_id) ids.add(ev.related_player_id);
    }
    const players = [];
    for (const pid of ids) {
      const p = store.playerById.get(pid);
      if (p) players.push(p);
    }
    return players;
  });

  // ─── Teams ────────────────────────────────────────────────────────────────
  app.get('/teams', async () => store.teams);

  // Per-team prev-10 per-game read-model — one response for the whole
  // pool so landscape-style charts (all 28 teams on one canvas) don't
  // fan out hundreds of per-fixture requests from the client. Fields
  // cover the Team Landscape axes plus the likely next axis pairs
  // (set-piece, discipline, possession).
  app.get('/teams/form-summary', async () => {
    const LOOKBACK = 10;
    return store.teams.map((team) => {
      const completed = (store.fixturesByTeam.get(team.id) ?? [])
        .filter((f) => f.status === 'completed')
        .slice()
        .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
        .slice(0, LOOKBACK);

      let ptsFor = 0, ptsAgainst = 0, triesFor = 0, triesAgainst = 0;
      let scrumWon = 0, scrumLost = 0, lineoutWon = 0, lineoutLost = 0;
      let pens = 0, poss = 0, terr = 0, meters = 0, lineBreaks = 0;
      let kicksInPlay = 0, kickMeters = 0, tacklePct = 0;
      let toWon = 0, toConceded = 0, errors = 0, yellows = 0, reds = 0;
      let entries22 = 0, pointsFrom22 = 0;
      let goalKicksMade = 0, goalKicksAttempted = 0;
      let firstHalfFor = 0, secondHalfFor = 0;
      let firstHalfAgainst = 0, secondHalfAgainst = 0;
      let lineBreaksConceded = 0;
      let scrumPens = 0, breakdownPens = 0, offsidePens = 0;
      // Full-parity extension (owner call 2026-07-09): the team Stats
      // pane mirrors the fixture Stats row set, so every fixture-pane
      // metric needs a per-game twin here.
      let conversions = 0, penaltyGoals = 0, dropGoals = 0;
      let postContact = 0, defendersBeaten = 0, gainlinePct = 0;
      let carries = 0, passes = 0, offloads = 0;
      let kicksToTouch = 0, fiftyTwentyTwos = 0;
      let contestables = 0, contestablesWon = 0, receptionsSecured = 0;
      let rucksWon = 0, rucksLost = 0, quickBallPct = 0;
      let maulsWon = 0, maulsLost = 0;
      let tacklesMade = 0, dominantTackles = 0;
      let games = 0;
      for (const fx of completed) {
        const r = store.resultByFixture.get(fx.id);
        if (!r) continue;
        const isHome = fx.home_team_id === team.id;
        games++;
        ptsFor += isHome ? r.home_score : r.away_score;
        {
          // Half splits from the half-time line — first-half points
          // are the HT score, second-half the remainder.
          const ht = isHome ? r.half_time_home : r.half_time_away;
          const ft = isHome ? r.home_score : r.away_score;
          firstHalfFor += ht;
          secondHalfFor += ft - ht;
          const htA = isHome ? r.half_time_away : r.half_time_home;
          const ftA = isHome ? r.away_score : r.home_score;
          firstHalfAgainst += htA;
          secondHalfAgainst += ftA - htA;
        }
        conversions += isHome ? r.home_conversions : r.away_conversions;
        penaltyGoals += isHome ? r.home_penalties : r.away_penalties;
        dropGoals += isHome ? r.home_drop_goals : r.away_drop_goals;
        postContact += isHome ? r.home_post_contact_metres : r.away_post_contact_metres;
        defendersBeaten += isHome ? r.home_defenders_beaten : r.away_defenders_beaten;
        gainlinePct += isHome ? r.home_gainline_success_percent : r.away_gainline_success_percent;
        carries += isHome ? r.home_carries : r.away_carries;
        passes += isHome ? r.home_passes : r.away_passes;
        offloads += isHome ? r.home_offloads : r.away_offloads;
        kicksToTouch += isHome ? r.home_kicks_to_touch : r.away_kicks_to_touch;
        fiftyTwentyTwos += isHome ? r.home_fifty_twenty_twos : r.away_fifty_twenty_twos;
        contestables += isHome ? r.home_contestable_kicks : r.away_contestable_kicks;
        contestablesWon += isHome ? r.home_contestable_kicks_won : r.away_contestable_kicks_won;
        // Opponent-derived (reconciliation principle), mirroring the
        // fixture pane's Receptions secured row.
        receptionsSecured += isHome
          ? r.away_contestable_kicks - r.away_contestable_kicks_won
          : r.home_contestable_kicks - r.home_contestable_kicks_won;
        rucksWon += isHome ? r.home_rucks_won : r.away_rucks_won;
        rucksLost += isHome ? r.home_rucks_lost : r.away_rucks_lost;
        quickBallPct += isHome ? r.home_ruck_speed_0_3s_percent : r.away_ruck_speed_0_3s_percent;
        maulsWon += isHome ? r.home_mauls_won : r.away_mauls_won;
        maulsLost += isHome ? r.home_mauls_lost : r.away_mauls_lost;
        tacklesMade += isHome ? r.home_tackles_made : r.away_tackles_made;
        dominantTackles += isHome ? r.home_dominant_tackles : r.away_dominant_tackles;
        offsidePens += isHome
          ? r.home_offside_penalties_conceded
          : r.away_offside_penalties_conceded;
        ptsAgainst += isHome ? r.away_score : r.home_score;
        triesFor += isHome ? r.home_tries : r.away_tries;
        triesAgainst += isHome ? r.away_tries : r.home_tries;
        scrumWon += isHome ? r.home_scrums_won : r.away_scrums_won;
        scrumLost += isHome ? r.home_scrums_lost : r.away_scrums_lost;
        lineoutWon += isHome ? r.home_lineouts_won : r.away_lineouts_won;
        lineoutLost += isHome ? r.home_lineouts_lost : r.away_lineouts_lost;
        pens += isHome ? r.home_penalties_conceded : r.away_penalties_conceded;
        scrumPens += isHome ? r.home_scrum_penalties_conceded : r.away_scrum_penalties_conceded;
        breakdownPens += isHome
          ? r.home_breakdown_penalties_conceded
          : r.away_breakdown_penalties_conceded;
        poss += isHome ? r.home_possession_percent : r.away_possession_percent;
        terr += isHome ? r.home_territory_percent : r.away_territory_percent;
        meters += isHome ? r.home_meters : r.away_meters;
        lineBreaks += isHome ? r.home_line_breaks : r.away_line_breaks;
        // Derived from the opponent's row (reconciliation principle):
        // a team's breaks conceded ARE the other side's breaks.
        lineBreaksConceded += isHome ? r.away_line_breaks : r.home_line_breaks;
        kicksInPlay += isHome ? r.home_kicks_in_play : r.away_kicks_in_play;
        kickMeters += isHome ? r.home_kick_meters : r.away_kick_meters;
        tacklePct += isHome ? r.home_tackle_success_percent : r.away_tackle_success_percent;
        toWon += isHome ? r.home_turnovers_won : r.away_turnovers_won;
        toConceded += isHome ? r.home_turnovers_conceded : r.away_turnovers_conceded;
        errors += isHome ? r.home_handling_errors : r.away_handling_errors;
        yellows += isHome ? r.home_yellow_cards : r.away_yellow_cards;
        reds += isHome ? r.home_red_cards : r.away_red_cards;
        entries22 += isHome ? r.home_twenty_two_entries : r.away_twenty_two_entries;
        pointsFrom22 += isHome
          ? r.home_points_from_twenty_two_entries
          : r.away_points_from_twenty_two_entries;
        goalKicksMade += isHome
          ? r.home_conversions + r.home_penalties
          : r.away_conversions + r.away_penalties;
        goalKicksAttempted += isHome
          ? r.home_conversion_attempts + r.home_penalty_goal_attempts
          : r.away_conversion_attempts + r.away_penalty_goal_attempts;
      }
      const scrumTotal = scrumWon + scrumLost;
      const lineoutTotal = lineoutWon + lineoutLost;
      const g = Math.max(1, games);
      return {
        team_id: team.id,
        games_played: games,
        points_scored_per_game: games > 0 ? ptsFor / g : 0,
        points_conceded_per_game: games > 0 ? ptsAgainst / g : 0,
        scrum_success_percent: scrumTotal > 0 ? (scrumWon / scrumTotal) * 100 : 0,
        lineout_success_percent: lineoutTotal > 0 ? (lineoutWon / lineoutTotal) * 100 : 0,
        penalties_conceded_per_game: games > 0 ? pens / g : 0,
        possession_percent: games > 0 ? poss / g : 0,
        // Full per-game stat sheet — keys deliberately mirror the
        // client's TeamAggregate.perGame shape so the Stats table can
        // average tiers without a field-name crosswalk.
        per_game: {
          pointsScored: ptsFor / g,
          pointsConceded: ptsAgainst / g,
          tries: triesFor / g,
          triesConceded: triesAgainst / g,
          possessionPercent: poss / g,
          territoryPercent: terr / g,
          metersMade: meters / g,
          lineBreaks: lineBreaks / g,
          kicksInPlay: kicksInPlay / g,
          kickMeters: kickMeters / g,
          scrumSuccessPercent: scrumTotal > 0 ? (scrumWon / scrumTotal) * 100 : 0,
          lineoutSuccessPercent: lineoutTotal > 0 ? (lineoutWon / lineoutTotal) * 100 : 0,
          tackleSuccessPercent: tacklePct / g,
          turnoversWon: toWon / g,
          turnoversConceded: toConceded / g,
          penaltiesConceded: pens / g,
          scrumPenaltiesConceded: scrumPens / g,
          breakdownPenaltiesConceded: breakdownPens / g,
          handlingErrors: errors / g,
          yellowCards: yellows / g,
          redCards: reds / g,
          twentyTwoEntries: entries22 / g,
          // Ratio-of-sums, not average-of-ratios — a 2-entry game
          // shouldn't weigh as much as a 15-entry game.
          pointsPerTwentyTwoEntry: entries22 > 0 ? pointsFrom22 / entries22 : 0,
          lineBreaksConceded: lineBreaksConceded / g,
          firstHalfPointsScored: firstHalfFor / g,
          secondHalfPointsScored: secondHalfFor / g,
          goalKickingPercent:
            goalKicksAttempted > 0 ? (goalKicksMade / goalKicksAttempted) * 100 : 0,
          firstHalfPointsConceded: firstHalfAgainst / g,
          secondHalfPointsConceded: secondHalfAgainst / g,
          conversions: conversions / g,
          penaltyGoals: penaltyGoals / g,
          dropGoals: dropGoals / g,
          postContactMetres: postContact / g,
          defendersBeaten: defendersBeaten / g,
          gainlineSuccessPercent: gainlinePct / g,
          carries: carries / g,
          passes: passes / g,
          offloads: offloads / g,
          kicksToTouch: kicksToTouch / g,
          fiftyTwentyTwos: fiftyTwentyTwos / g,
          contestableKicks: contestables / g,
          contestableKicksWon: contestablesWon / g,
          receptionsSecured: receptionsSecured / g,
          rucksWon: rucksWon / g,
          rucksLost: rucksLost / g,
          ruckSpeed0to3sPercent: quickBallPct / g,
          maulsWon: maulsWon / g,
          maulsLost: maulsLost / g,
          tacklesMade: tacklesMade / g,
          dominantTackles: dominantTackles / g,
          scrumsWon: scrumWon / g,
          scrumsLost: scrumLost / g,
          lineoutsWon: lineoutWon / g,
          lineoutsLost: lineoutLost / g,
          offsidePenaltiesConceded: offsidePens / g,
        },
      };
    });
  });

  app.get<{ Params: { id: string } }>('/teams/:id', async (req, reply) => {
    const t = store.teamById.get(req.params.id);
    if (!t) return notFound(reply, `team ${req.params.id} not found`);
    const teamFixtures = store.fixturesByTeam.get(req.params.id) ?? [];
    return {
      ...t,
      fixtures: teamFixtures.slice().sort((a, b) => a.kickoff_utc.localeCompare(b.kickoff_utc)),
    };
  });

  // Full player pool for a team — the "current roster" surface for the
  // Teams hub. Squads stay per-season (see /teams/:id/squad for a
  // season-scoped selection); this is the season-agnostic pool.
  app.get<{ Params: { id: string } }>('/teams/:id/players', async (req, reply) => {
    if (!store.teamById.has(req.params.id)) {
      return notFound(reply, `team ${req.params.id} not found`);
    }
    return store.playersByTeam.get(req.params.id) ?? [];
  });

  // Coaching staff for a team — synthetic in dev (PRD §5.5). Empty array
  // when unavailable rather than 404 so the client can treat "no data" as a
  // hide-the-section signal without a special error branch. Availability
  // from real feeds is still a Phase 6 research item (register #7).
  app.get<{ Params: { id: string } }>('/teams/:id/coaching-staff', async (req, reply) => {
    if (!store.teamById.has(req.params.id)) {
      return notFound(reply, `team ${req.params.id} not found`);
    }
    return store.coachesByTeam.get(req.params.id) ?? [];
  });

  app.get<{ Params: { id: string }; Querystring: { season_id?: string } }>(
    '/teams/:id/squad',
    async (req, reply) => {
      if (!store.teamById.has(req.params.id)) {
        return notFound(reply, `team ${req.params.id} not found`);
      }
      const season_id = req.query.season_id;
      if (!season_id) {
        return reply
          .code(400)
          .send({ error: 'bad_request', message: 'season_id query param required' });
      }
      const key = `${req.params.id}::${season_id}`;
      const squad = store.squadByTeamSeason.get(key);
      if (!squad) {
        return notFound(reply, `no squad for team ${req.params.id} in season ${season_id}`);
      }
      const players = squad.player_ids
        .map((pid) => store.playerById.get(pid))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);
      return { squad, players };
    },
  );

  // ─── Players ──────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/players/:id', async (req, reply) => {
    const p = store.playerById.get(req.params.id);
    return p ?? notFound(reply, `player ${req.params.id} not found`);
  });

  // All per-match stat sheets for a player, most recent fixture first
  // (kickoff DESC). Empty array when the player has no completed fixtures
  // yet — consumers treat empty as "no data" without an error branch.
  app.get<{ Params: { id: string } }>('/players/:id/match-stats', async (req, reply) => {
    if (!store.playerById.has(req.params.id)) {
      return notFound(reply, `player ${req.params.id} not found`);
    }
    const sheets = store.playerStatsByPlayer.get(req.params.id) ?? [];
    return sheets.slice().sort((a, b) => {
      const ka = store.fixtureById.get(a.fixture_id)?.kickoff_utc ?? '';
      const kb = store.fixtureById.get(b.fixture_id)?.kickoff_utc ?? '';
      return kb.localeCompare(ka);
    });
  });

  // Percentiles vs position-group peers — the scouting-bar read-model
  // for the player card. Computed here because ranking one player needs
  // EVERY peer's sheets; they're all in memory server-side, absurd to
  // fan out to the client. Percentiles are neutral (share of peers at
  // or below the subject's per-80 rate) — the client flips presentation
  // for lower-is-better metrics.
  app.get<{ Params: { id: string }; Querystring: { lookback?: string } }>(
    '/players/:id/percentiles',
    async (req, reply) => {
      const subject = store.playerById.get(req.params.id);
      if (!subject) return notFound(reply, `player ${req.params.id} not found`);

      const lookback = Math.max(1, Number(req.query.lookback) || 10);
      const group = positionGroupOf(subject.primary_position);
      const groupPositions = POSITION_GROUP_MEMBERS[group] ?? [];

      // Per-80 rates over each peer's own window. Peers need at least
      // MIN_PEER_APPEARANCES inside the window to qualify — a player
      // with one 12-minute cameo shouldn't set the distribution's tail.
      const MIN_PEER_APPEARANCES = 3;
      const ratesByPlayer = new Map<string, Record<string, number>>();
      // Per-GAME averages alongside the per-80 rates — the profile
      // bars read per-game vs the average peer (owner call 2026-07-09:
      // per-80/percentile framing was analyst-grade mental fatigue).
      const gameRatesByPlayer = new Map<string, Record<string, number>>();
      const minutesByPlayer = new Map<string, number>();
      let subjectAppearances = 0;

      for (const p of store.players) {
        if (!groupPositions.includes(p.primary_position)) continue;
        const sheets = (store.playerStatsByPlayer.get(p.id) ?? [])
          .filter((s) => s.minutes_played > 0)
          .sort((a, b) => {
            const ka = store.fixtureById.get(a.fixture_id)?.kickoff_utc ?? '';
            const kb = store.fixtureById.get(b.fixture_id)?.kickoff_utc ?? '';
            return kb.localeCompare(ka);
          })
          .slice(0, lookback);
        if (p.id === subject.id) subjectAppearances = sheets.length;
        if (sheets.length < MIN_PEER_APPEARANCES && p.id !== subject.id) continue;
        if (sheets.length === 0) continue;

        let minutes = 0;
        const totals: Record<string, number> = {};
        for (const f of PERCENTILE_FIELDS) totals[f] = 0;
        for (const s of sheets) {
          minutes += s.minutes_played;
          for (const f of PERCENTILE_FIELDS) {
            totals[f]! += s[f as keyof typeof s] as number;
          }
        }
        const rates: Record<string, number> = {};
        const gameRates: Record<string, number> = {};
        for (const f of PERCENTILE_FIELDS) {
          rates[f] = minutes > 0 ? (totals[f]! * 80) / minutes : 0;
          gameRates[f] = totals[f]! / sheets.length;
        }
        ratesByPlayer.set(p.id, rates);
        gameRatesByPlayer.set(p.id, gameRates);
        minutesByPlayer.set(p.id, minutes);
      }

      const subjectRates = ratesByPlayer.get(subject.id);
      if (!subjectRates) {
        // No appearances at all — empty metrics, zero peers context.
        return {
          player_id: subject.id,
          position_group: group,
          lookback,
          appearances: 0,
          peers: ratesByPlayer.size,
          metrics: [],
          pool: [],
        };
      }

      const peerRates = [...ratesByPlayer.values()];
      const peerGameRates = [...gameRatesByPlayer.values()];
      const subjectGameRates = gameRatesByPlayer.get(subject.id)!;
      const metrics = PERCENTILE_FIELDS.map((field) => {
        const mine = subjectRates[field]!;
        const atOrBelow = peerRates.filter((r) => r[field]! <= mine).length;
        const peerAvg =
          peerGameRates.reduce((sum, r) => sum + r[field]!, 0) / peerGameRates.length;
        return {
          field,
          per80: Number(mine.toFixed(2)),
          percentile: Math.round((atOrBelow / peerRates.length) * 100),
          per_game: Number(subjectGameRates[field]!.toFixed(2)),
          peer_avg: Number(peerAvg.toFixed(2)),
        };
      });

      return {
        player_id: subject.id,
        position_group: group,
        lookback,
        appearances: subjectAppearances,
        peers: peerRates.length,
        metrics,
        // Per-GAME pool rates — the matrix dot cloud (per-game keeps
        // the fan framing; minutes carry fairness via dot size).
        pool: [...gameRatesByPlayer.entries()].map(([playerId, rates]) => ({
          player_id: playerId,
          minutes: minutesByPlayer.get(playerId) ?? 0,
          rates,
        })),
      };
    },
  );

  // ─── Rankings ─────────────────────────────────────────────────────────────
  // `/rankings` = latest men's snapshot (kept for backward compatibility with
  // the existing `useLatestRanking` client hook). Prefer `/rankings/mens` or
  // `/rankings/womens` in any new call site.
  app.get('/rankings', async () => {
    const latest = store.mensRankings[store.mensRankings.length - 1];
    return latest ?? {};
  });

  app.get('/rankings/mens', async () => {
    const latest = store.mensRankings[store.mensRankings.length - 1];
    return latest ?? {};
  });

  app.get('/rankings/history', async () => store.rankings);
  app.get('/rankings/mens/history', async () => store.mensRankings);

  // ─── Predictor (synthetic until Phase 6 BigQuery ML cutover) ─────────────
  //
  // Deterministic, ranking-derived probabilities matching the contract in
  // docs/predictor-phase-spec.md §4 — the client built against these routes
  // must not change at cutover (spec §2d). Same synthetic-data posture as
  // the rest of this stub API: dev only, behind the app's DEV banner.

  /** Deterministic 0..1 hash — stable predictions per fixture. */
  const hash01 = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 10_000) / 10_000;
  };

  const rankPoints = (): Map<string, number> => {
    const latest = store.mensRankings[store.mensRankings.length - 1];
    return new Map((latest?.rows ?? []).map((r) => [r.team_id, r.points]));
  };

  /** Prev-5 completed-match win rate for a team (0..1). */
  const recentWinRate = (teamId: string): number => {
    const resultByFixture = new Map(store.results.map((r) => [r.fixture_id, r]));
    const played = store.fixtures
      .filter(
        (f) =>
          f.status === 'completed' &&
          (f.home_team_id === teamId || f.away_team_id === teamId) &&
          resultByFixture.has(f.id),
      )
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
      .slice(0, 5);
    if (played.length === 0) return 0.5;
    const wins = played.filter((f) => {
      const r = resultByFixture.get(f.id)!;
      const my = f.home_team_id === teamId ? r.home_score : r.away_score;
      const opp = f.home_team_id === teamId ? r.away_score : r.home_score;
      return my > opp;
    }).length;
    return wins / played.length;
  };

  /** Net wins for the home side over the last 3 head-to-head meetings. */
  const headToHead = (homeId: string, awayId: string): number => {
    const resultByFixture = new Map(store.results.map((r) => [r.fixture_id, r]));
    const meetings = store.fixtures
      .filter(
        (f) =>
          f.status === 'completed' &&
          ((f.home_team_id === homeId && f.away_team_id === awayId) ||
            (f.home_team_id === awayId && f.away_team_id === homeId)) &&
          resultByFixture.has(f.id),
      )
      .sort((a, b) => b.kickoff_utc.localeCompare(a.kickoff_utc))
      .slice(0, 3);
    let net = 0;
    for (const f of meetings) {
      const r = resultByFixture.get(f.id)!;
      const homeSideScore = f.home_team_id === homeId ? r.home_score : r.away_score;
      const awaySideScore = f.home_team_id === homeId ? r.away_score : r.home_score;
      net += homeSideScore > awaySideScore ? 1 : homeSideScore < awaySideScore ? -1 : 0;
    }
    return net;
  };

  app.get<{ Params: { id: string } }>('/predictor/match/:id', async (req, reply) => {
    const fx = store.fixtures.find((f) => f.id === req.params.id);
    if (!fx) return notFound(reply, `fixture ${req.params.id} not found`);

    const pts = rankPoints();
    const homePts = pts.get(fx.home_team_id) ?? 75;
    const awayPts = pts.get(fx.away_team_id) ?? 75;

    // Ranking-implied logistic with a home bump — the naive baseline the
    // real model must beat (spec §5); jitter keeps rows from reading
    // formulaic while staying deterministic per fixture.
    const HOME_BUMP = 2.0;
    const jitter = (hash01(fx.id) - 0.5) * 1.6;
    const formDiff = recentWinRate(fx.home_team_id) - recentWinRate(fx.away_team_id);
    const h2h = headToHead(fx.home_team_id, fx.away_team_id);
    const d = homePts - awayPts + HOME_BUMP + formDiff * 2.5 + h2h * 0.8 + jitter;

    // Scale 6.5: a 12-point WR gap ≈ 86% favourite — heavy but not
    // certain; 4.5 read implausibly hot (98%).
    const pHome = 1 / (1 + Math.exp(-d / 6.5));
    const draw = 0.045 * Math.exp(-Math.abs(d) / 6);
    const iqrSpread = 7 + Math.round(hash01(fx.id + 'iqr') * 4);

    const features = [
      { label: 'Ranking gap', impact_pp: (homePts - awayPts) * 1.6 },
      { label: 'Home advantage', impact_pp: HOME_BUMP * 1.8 },
      { label: 'Recent form', impact_pp: formDiff * 22 },
      { label: 'Head-to-head', impact_pp: h2h * 2.4 },
    ]
      // Whole points only — the app shows no decimals anywhere
      // (owner rule 2026-07-14).
      .map((f) => ({ ...f, impact_pp: Math.round(f.impact_pp) }))
      .sort((a, b) => Math.abs(b.impact_pp) - Math.abs(a.impact_pp));

    return {
      fixture_id: fx.id,
      generated_at: new Date().toISOString(),
      model_version: 'synthetic-dev-0.1',
      home_win_prob: Math.round(pHome * (1 - draw) * 1000) / 1000,
      away_win_prob: Math.round((1 - pHome) * (1 - draw) * 1000) / 1000,
      draw_prob: Math.round(draw * 1000) / 1000,
      confidence_band_pp: 4 + Math.round(hash01(fx.id + 'ci') * 5),
      predicted_margin: {
        median: Math.round(d * 1.35),
        iqr_lower: Math.round(d * 1.35) - iqrSpread,
        iqr_upper: Math.round(d * 1.35) + iqrSpread,
      },
      top_features: features,
    };
  });

  // Tournament/champion predictions DESCOPED (owner decision
  // 2026-07-13): they're derivatives of match predictions and work
  // themselves out as the competition unfolds. The predictor serves
  // NEXT-match predictions only.
}
