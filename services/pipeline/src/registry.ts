/**
 * Fixed registry data: the seed, the 10 Tier-1 national teams, their home
 * venues, and the name pools used to synthesize plausibly-fake player names.
 *
 * None of this is licensable content: team names are public identifiers, the
 * stadium names are widely-known public facts, and the name pool is a
 * curated set of common English-language given / family names deliberately
 * chosen to be generic. Any resemblance to a real player is coincidental —
 * per PRD §5.5 rule 3.
 */

import type { Team, TeamId } from '@rugby-app/shared/types';

/** Master seed for the generator. Bump only when a shape change makes a full
 * regeneration acceptable — never rotate silently. */
export const RUGBY_APP_SEED = 20260701;

/** Ten Tier-1 Men's national teams (PRD §3.4). Colours are NEUTRAL grays —
 * NOT the real kit palettes (register #23 resolved: neutral placeholders). */
export const TIER_1_TEAMS: readonly Team[] = [
  { id: 'eng', name: 'England', short_name: 'ENG', primary_color: '#4A4A4A', flag_code: 'gb-eng' },
  { id: 'fra', name: 'France', short_name: 'FRA', primary_color: '#4A4A4A', flag_code: 'fr' },
  { id: 'ire', name: 'Ireland', short_name: 'IRE', primary_color: '#4A4A4A', flag_code: 'ie' },
  { id: 'ita', name: 'Italy', short_name: 'ITA', primary_color: '#4A4A4A', flag_code: 'it' },
  { id: 'sco', name: 'Scotland', short_name: 'SCO', primary_color: '#4A4A4A', flag_code: 'gb-sct' },
  { id: 'wal', name: 'Wales', short_name: 'WAL', primary_color: '#4A4A4A', flag_code: 'gb-wls' },
  { id: 'arg', name: 'Argentina', short_name: 'ARG', primary_color: '#4A4A4A', flag_code: 'ar' },
  { id: 'aus', name: 'Australia', short_name: 'AUS', primary_color: '#4A4A4A', flag_code: 'au' },
  { id: 'nzl', name: 'New Zealand', short_name: 'NZL', primary_color: '#4A4A4A', flag_code: 'nz' },
  { id: 'rsa', name: 'South Africa', short_name: 'RSA', primary_color: '#4A4A4A', flag_code: 'za' },
];

/** Eighteen Tier-2 Men's national teams (PRD §3.4 broadened v0.5). 14 of
 * these qualify for RWC 2027 pools; all 18 appear in the Power Rankings
 * surface. Colours are the SAME neutral grey placeholder — a design-system
 * decision (register #23) will later distinguish teams properly. */
export const TIER_2_TEAMS: readonly Team[] = [
  { id: 'fij', name: 'Fiji', short_name: 'FIJ', primary_color: '#4A4A4A', flag_code: 'fj' },
  { id: 'geo', name: 'Georgia', short_name: 'GEO', primary_color: '#4A4A4A', flag_code: 'ge' },
  { id: 'jpn', name: 'Japan', short_name: 'JPN', primary_color: '#4A4A4A', flag_code: 'jp' },
  { id: 'sam', name: 'Samoa', short_name: 'SAM', primary_color: '#4A4A4A', flag_code: 'ws' },
  { id: 'tga', name: 'Tonga', short_name: 'TGA', primary_color: '#4A4A4A', flag_code: 'to' },
  { id: 'usa', name: 'United States', short_name: 'USA', primary_color: '#4A4A4A', flag_code: 'us' },
  { id: 'uru', name: 'Uruguay', short_name: 'URU', primary_color: '#4A4A4A', flag_code: 'uy' },
  { id: 'chi', name: 'Chile', short_name: 'CHI', primary_color: '#4A4A4A', flag_code: 'cl' },
  { id: 'nam', name: 'Namibia', short_name: 'NAM', primary_color: '#4A4A4A', flag_code: 'na' },
  { id: 'por', name: 'Portugal', short_name: 'POR', primary_color: '#4A4A4A', flag_code: 'pt' },
  { id: 'rou', name: 'Romania', short_name: 'ROU', primary_color: '#4A4A4A', flag_code: 'ro' },
  { id: 'esp', name: 'Spain', short_name: 'ESP', primary_color: '#4A4A4A', flag_code: 'es' },
  { id: 'zim', name: 'Zimbabwe', short_name: 'ZIM', primary_color: '#4A4A4A', flag_code: 'zw' },
  { id: 'hkg', name: 'Hong Kong China', short_name: 'HKG', primary_color: '#4A4A4A', flag_code: 'hk' },
  { id: 'can', name: 'Canada', short_name: 'CAN', primary_color: '#4A4A4A', flag_code: 'ca' },
  { id: 'bra', name: 'Brazil', short_name: 'BRA', primary_color: '#4A4A4A', flag_code: 'br' },
  { id: 'ned', name: 'Netherlands', short_name: 'NED', primary_color: '#4A4A4A', flag_code: 'nl' },
  { id: 'ken', name: 'Kenya', short_name: 'KEN', primary_color: '#4A4A4A', flag_code: 'ke' },
];

/** All Men's international teams — Tier 1 + Tier 2. Used by Power Rankings. */
export const ALL_TEAMS: readonly Team[] = [...TIER_1_TEAMS, ...TIER_2_TEAMS];

export const SIX_NATIONS_TEAM_IDS: readonly TeamId[] = ['eng', 'fra', 'ire', 'ita', 'sco', 'wal'];
export const RUGBY_CHAMPIONSHIP_TEAM_IDS: readonly TeamId[] = ['arg', 'aus', 'nzl', 'rsa'];

/** Primary home stadium per team. All are publicly known real stadiums —
 * public facts, not licensable content. Tier-2 entries may be sport-neutral
 * multi-use venues where the team plays home tests. */
export const HOME_VENUE: Record<TeamId, string> = {
  eng: 'Twickenham Stadium',
  fra: 'Stade de France',
  ire: 'Aviva Stadium',
  ita: 'Stadio Olimpico',
  sco: 'Murrayfield Stadium',
  wal: 'Principality Stadium',
  arg: 'Estadio Único Madre de Ciudades',
  aus: 'Allianz Stadium',
  nzl: 'Eden Park',
  rsa: 'Emirates Airline Park',
  fij: 'HFC Bank Stadium',
  geo: 'Boris Paichadze Dinamo Arena',
  jpn: 'National Stadium',
  sam: 'Apia Park',
  tga: 'Teufaiva Sport Stadium',
  usa: 'Q2 Stadium',
  uru: 'Estadio Charrúa',
  chi: 'Estadio San Carlos de Apoquindo',
  nam: 'Hage Geingob Rugby Stadium',
  por: 'Estádio Universitário de Lisboa',
  rou: 'Stadionul Arcul de Triumf',
  esp: 'Estadio Nacional Complutense',
  zim: 'Harare Sports Club',
  hkg: 'Hong Kong Stadium',
  can: 'Starlight Stadium',
  bra: 'Estádio Nicolau Alayon',
  ned: 'Nationaal Rugbycentrum Amsterdam',
  ken: 'Nyayo National Stadium',
};

/** Australian venues hosting Rugby World Cup 2027 matches. Public info,
 * plausibly-real venue list — the tournament runs in Australia. */
export const RWC_2027_VENUES: readonly string[] = [
  'Stadium Australia (Sydney)',
  'Marvel Stadium (Melbourne)',
  'Suncorp Stadium (Brisbane)',
  'Optus Stadium (Perth)',
  'Adelaide Oval',
  'Allianz Stadium (Sydney)',
  'CommBank Stadium (Sydney)',
  'Cbus Super Stadium (Gold Coast)',
];

/** Deliberately generic given-name pool. */
export const FIRST_NAMES: readonly string[] = [
  'Alex', 'Ben', 'Callum', 'Daniel', 'Ethan', 'Finn', 'George', 'Harry',
  'Ivan', 'Jack', 'Kieran', 'Liam', 'Mason', 'Nathan', 'Oliver', 'Patrick',
  'Quinn', 'Ryan', 'Samuel', 'Thomas', 'Ulrich', 'Vincent', 'William',
  'Xavier', 'Yannick', 'Zac', 'Adrian', 'Bruno', 'Cameron', 'Damian',
  'Elliot', 'Felix', 'Gareth', 'Henri', 'Isaac', 'Julian', 'Kyle', 'Lucas',
  'Marcus', 'Noah',
];

/** Deliberately generic family-name pool. */
export const LAST_NAMES: readonly string[] = [
  'Ashford', 'Bramley', 'Cartwright', 'Denholm', 'Everley', 'Fairhurst',
  'Gainsborough', 'Halliwell', 'Ingleby', 'Jarrow', 'Kingsford', 'Leighton',
  'Merrick', 'Northwood', 'Oakden', 'Pemberton', 'Quenton', 'Ravenscroft',
  'Sinclair', 'Thornton', 'Underhill', 'Vance', 'Winford', 'Yardley',
  'Ashcombe', 'Blackmore', 'Crestwood', 'Danforth', 'Elsworth', 'Farraday',
  'Grayling', 'Harwood', 'Ivory', 'Jennings', 'Kilbride', 'Langford',
  'Milburn', 'Norwood', 'Ormsby', 'Portway',
];
