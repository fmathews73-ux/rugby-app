import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

/**
 * Tracks whether the user has passed the welcome screen — same
 * file-backed singleton pattern as use-my-team-id (its own file so
 * the two writers can't clobber each other's JSON).
 *
 * When Firebase Auth lands (Phase 5/6), "seen" naturally folds into
 * the auth state: a signed-in user never sees the welcome gate again.
 */
const FLAG_FILE = new File(Paths.document, 'onboarding.json');

let seen: boolean | undefined;
const listeners = new Set<(v: boolean) => void>();

void (async () => {
  try {
    seen = FLAG_FILE.exists && JSON.parse(await FLAG_FILE.text()).welcomeSeen === true;
  } catch {
    seen = false;
  }
  for (const fn of listeners) fn(seen);
})();

export function markWelcomeSeen(): void {
  setSeen(true);
}

/** "Sign out" (Phase 0: no real session — just re-gates the welcome). */
export function resetWelcomeSeen(): void {
  setSeen(false);
}

function setSeen(value: boolean): void {
  seen = value;
  try {
    if (!FLAG_FILE.exists) FLAG_FILE.create();
    FLAG_FILE.write(JSON.stringify({ welcomeSeen: value }));
  } catch {
    // Best-effort — worst case the welcome shows again next launch.
  }
  for (const fn of listeners) fn(value);
}

/** `undefined` while hydrating from disk; then the persisted flag. */
export function useWelcomeSeen(): boolean | undefined {
  const [value, setValue] = useState(seen);
  useEffect(() => {
    const fn = (v: boolean) => setValue(v);
    listeners.add(fn);
    if (seen !== undefined) setValue(seen);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return value;
}
