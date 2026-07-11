/**
 * The fixture player drill, hosted INSIDE the Teams stack — reached
 * from a match page that was itself opened via a team hub, so back
 * walks player → match → hub → directory without ever jumping to the
 * Fixtures tab. Distinct segment from `teams/player/[id]` (the squad
 * player card — a different screen). Same component; only the host
 * stack differs.
 */
export { default } from '../../fixtures/player/[pid]';
