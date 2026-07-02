import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

/**
 * Persists the user's selected "My Team" across app launches.
 *
 * Storage: a small JSON file in the app's document directory. This uses
 * `expo-file-system` which ships as part of every Expo dev client — no
 * native rebuild required to add persistence.
 *
 * Storage layer is deliberately synchronous+best-effort:
 * - reads on mount, writes on every change
 * - swallows I/O errors (persistence is a nice-to-have, not a correctness
 *   requirement — worst case the user re-picks their team next launch)
 *
 * When Firebase Auth lands (Phase 4), this becomes an authenticated
 * server-side preference. Interface (`[teamId, setTeamId]`) stays the same
 * so call sites don't churn.
 */
const PREF_FILE = new File(Paths.document, 'preferences.json');

interface Preferences {
  myTeamId?: string;
}

async function readPrefs(): Promise<Preferences> {
  try {
    if (!PREF_FILE.exists) return {};
    const raw = await PREF_FILE.text();
    return JSON.parse(raw) as Preferences;
  } catch {
    return {};
  }
}

function writePrefs(prefs: Preferences): void {
  try {
    if (!PREF_FILE.exists) PREF_FILE.create();
    PREF_FILE.write(JSON.stringify(prefs));
  } catch {
    // Silent — persistence is best-effort.
  }
}

export function useMyTeamId(): [string | null, (id: string | null) => void] {
  const [teamId, setTeamIdState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readPrefs().then((prefs) => {
      if (!cancelled) setTeamIdState(prefs.myTeamId ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTeamId = (id: string | null): void => {
    // Optimistic UI update — write is fire-and-forget.
    setTeamIdState(id);
    readPrefs().then((prefs) => {
      if (id === null) delete prefs.myTeamId;
      else prefs.myTeamId = id;
      writePrefs(prefs);
    });
  };

  return [teamId, setTeamId];
}
