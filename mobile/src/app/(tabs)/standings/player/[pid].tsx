/**
 * The fixture player drill, hosted INSIDE the Tables stack — reached
 * from a match page that was itself opened via a standings drill, so
 * back walks player → match → team's matches → standings without ever
 * jumping to the Fixtures tab. Same screen component; only the host
 * stack differs.
 */
export { default } from '../../fixtures/player/[pid]';
