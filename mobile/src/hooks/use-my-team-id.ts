import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

/**
 * Persists the user's selected "My Team" across app launches AND keeps
 * every mounted consumer in sync within a session.
 *
 * Storage: a small JSON file in the app's document directory via
 * `expo-file-system` (bundled with every Expo dev client — no native
 * rebuild required).
 *
 * State model: a module-level singleton (`currentId`) with a set of
 * subscribers. Every `useMyTeamId` call subscribes on mount and re-
 * renders when the singleton updates, so all consumers (the team
 * selector card, the my-team matches card, the my-team preview cards)
 * observe the same value at the same time. Without this, each hook
 * kept its own local `useState` copy — clearing or changing the team
 * in one component left the others stuck on the previous value.
 *
 * When Firebase Auth lands (Phase 4), this becomes an authenticated
 * server-side preference. The `[teamId, setTeamId]` interface stays
 * the same so call sites don't churn.
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

// ─── Singleton store ────────────────────────────────────────────────────────
//
// One shared source of truth. Every `useMyTeamId` hook subscribes here
// and re-renders when the value changes.

type Listener = (id: string | null) => void;
let currentId: string | null = null;
const listeners = new Set<Listener>();
let hydrated = false;

/** Notify every subscriber of the current value. */
function emit(): void {
  for (const fn of listeners) fn(currentId);
}

/** Hydrate the singleton from disk on first import. Fires once — after
 *  that, the value is source-of-truth in-memory. */
void readPrefs().then((prefs) => {
  currentId = prefs.myTeamId ?? null;
  hydrated = true;
  emit();
});

export function useMyTeamId(): [string | null, (id: string | null) => void] {
  const [teamId, setLocal] = useState<string | null>(currentId);

  useEffect(() => {
    // Subscribe and (in case hydration finished between render + effect)
    // re-sync to the latest singleton value.
    listeners.add(setLocal);
    if (hydrated) setLocal(currentId);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  const setTeamId = (id: string | null): void => {
    currentId = id;
    // Persist (fire-and-forget) and notify every mounted consumer.
    writePrefs({ myTeamId: id ?? undefined });
    emit();
  };

  return [teamId, setTeamId];
}
