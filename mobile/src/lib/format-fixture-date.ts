import type { Fixture } from '@rugby-app/shared';

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
 *   - **Scheduled** fixtures relative to today: `Today`, `Yesterday`,
 *     `Tomorrow`. Anything further out: `Sun 28 June` (weekday + day +
 *     full month, no year — the year is implicit within the season).
 *   - Any other status (live / half-time / postponed / cancelled) falls
 *     through the scheduled path, since those states rely on the same
 *     kickoff-relative anchoring.
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
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((dDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}
