/**
 * Men's Rugby World Cup winners → number of titles per team. Hard-coded
 * against historical fact; a follow-up could source this from the pipeline
 * once we ingest World Rugby's honours dataset. Team ids are the 3-letter
 * lowercase codes used in `services/pipeline/data/teams.json`.
 *
 * Every unlisted team returns 0 via `worldCupTitles`.
 */
const TITLES: Record<string, number> = {
  rsa: 4, // 1995, 2007, 2019, 2023
  nzl: 3, // 1987, 2011, 2015
  aus: 2, // 1991, 1999
  eng: 1, // 2003
};

export function worldCupTitles(teamId: string): number {
  return TITLES[teamId] ?? 0;
}
