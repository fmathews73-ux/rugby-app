import type { Fixture } from '@rugby-app/shared';

/**
 * Kickoff clock in the DEVICE's local timezone — every surface that
 * shows a bare "15:00" must use this (never `kickoff_utc.slice(11, 16)`,
 * which silently shows UTC and disagrees with the drill hero).
 */
export function formatKickoffTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Shared "date label" formatter used across every surface that surfaces a
 * fixture's date at-a-glance (Home fixture carousel, My-Team matches card,
 * anywhere else that needs a single-line "when" label).
 *
 * Rules:
 *   - **Completed** fixtures render `1 Feb 2025 · 15:00` — day + time,
 *     matching the fixture-drill hero. A played match is a historical
 *     event, so the temporal-relative framing (Today / Tomorrow) is
 *     dropped; the calendar date + kickoff time is the meaningful anchor.
 *   - **Everything else** (scheduled / live / postponed / cancelled)
 *     renders the plain calendar date `8 Aug 2026` — no Today/Tomorrow
 *     relative labels. Surfaces append their own state suffix (e.g.
 *     ` · Upcoming`).
 */
export function formatFixtureDate(fx: Fixture): string {
  const d = new Date(fx.kickoff_utc);
  if (fx.status === 'completed') {
    const dayStr = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${dayStr} · ${timeStr}`;
  }
  // Upcoming (and every other non-completed state): plain calendar
  // date, same register as the completed line — no Today/Tomorrow
  // relative labels (owner call 2026-07-07). Surfaces append the
  // ' · Upcoming' state suffix themselves.
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
