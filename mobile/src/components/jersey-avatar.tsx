import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import type { JerseyColors } from '@/lib/team-colors';

/**
 * Jersey avatar — the SAME person-circle-outline glyph as the app
 * header's profile entry, simply TINTED the team's jersey colour: no
 * fills, no extra chrome, the familiar outline face in team dress
 * (colours are factual identifiers, safe under the crest ban; the
 * glyph stays the anonymous placeholder until the image-rights tier,
 * register #5/#28). Teams without a colour entry fall back to the
 * neutral grey. White-shirted teams (ENG, FIJ) use their accent tone
 * instead — a white outline would vanish on white cards.
 */
export function JerseyAvatar({
  jersey,
  size = 40,
}: {
  jersey?: JerseyColors;
  size?: number;
}) {
  // Light shirts can't carry a white outline on a white card — tint
  // with the accent (secondary) tone instead.
  const tint =
    jersey === undefined
      ? Colors.light.textSecondary
      : isLight(jersey.primary)
        ? jersey.secondary
        : jersey.primary;
  return <Ionicons name="person-circle-outline" size={size} color={tint} />;
}

/** Crude relative-luminance check — good enough to catch white/near-
 *  white shirts. */
function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}
