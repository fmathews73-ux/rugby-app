/**
 * Team jersey colours — primary (home) shirt colour + a contrast tone
 * for numerals/glyphs rendered on it. COLOURS ONLY: factual
 * identifiers, safe under the crest/logo ban (root CLAUDE.md §9); no
 * crests, no logos, ever. Approximations of each union's traditional
 * home shirt; refine alongside the Phase 6 image-rights work if a
 * licensed palette ever arrives.
 *
 * Contrast rule: `secondary` must stay readable on `primary` — light
 * shirts (ENG, FIJ) carry a dark numeral and rely on the avatar's
 * hairline ring to hold their shape on white cards.
 */
export interface JerseyColors {
  /** Shirt/base colour. */
  primary: string;
  /** Contrast tone for numerals/glyphs drawn on the primary. */
  secondary: string;
}

export const TEAM_JERSEY: Record<string, JerseyColors> = {
  // ── Tier 1 ──
  nzl: { primary: '#000000', secondary: '#FFFFFF' }, // all black
  rsa: { primary: '#006B3F', secondary: '#F5B335' }, // green & gold
  ire: { primary: '#009A44', secondary: '#FFFFFF' }, // emerald
  fra: { primary: '#1D2E5C', secondary: '#FFFFFF' }, // french navy
  arg: { primary: '#75AADB', secondary: '#1F2937' }, // sky blue (white hoops)
  eng: { primary: '#FFFFFF', secondary: '#DC2626' }, // white, red rose accent
  sco: { primary: '#0A2342', secondary: '#FFFFFF' }, // dark navy
  aus: { primary: '#F4C22B', secondary: '#00543D' }, // wallaby gold & green
  wal: { primary: '#C8102E', secondary: '#FFFFFF' }, // welsh red
  ita: { primary: '#0066B2', secondary: '#FFFFFF' }, // azzurri blue
  // ── Tier 2 ──
  fij: { primary: '#FFFFFF', secondary: '#1F2937' }, // flying fijians white
  sam: { primary: '#0C4DA2', secondary: '#FFFFFF' }, // manu samoa blue
  tga: { primary: '#C8102E', secondary: '#FFFFFF' }, // ikale tahi red
  jpn: { primary: '#BC002D', secondary: '#FFFFFF' }, // brave blossoms red (white hoops)
  usa: { primary: '#041E42', secondary: '#FFFFFF' }, // eagles navy
  can: { primary: '#D80621', secondary: '#FFFFFF' }, // canadian red
  uru: { primary: '#55B5E5', secondary: '#1F2937' }, // teros sky blue
  chi: { primary: '#D52B1E', secondary: '#FFFFFF' }, // condores red
  geo: { primary: '#CE2029', secondary: '#FFFFFF' }, // lelos red
  por: { primary: '#E42518', secondary: '#FFFFFF' }, // lobos red
  esp: { primary: '#C60B1E', secondary: '#F4C22B' }, // leones red & gold
  rou: { primary: '#FFCD00', secondary: '#002B7F' }, // stejarii yellow & blue
  nam: { primary: '#003580', secondary: '#FFFFFF' }, // welwitschias blue
  zim: { primary: '#007A3D', secondary: '#FFFFFF' }, // sables green
  hkg: { primary: '#C8102E', secondary: '#FFFFFF' }, // hong kong red
  ned: { primary: '#FF7F00', secondary: '#FFFFFF' }, // dutch orange
  ken: { primary: '#C8102E', secondary: '#006B3F' }, // simbas red & green
  bra: { primary: '#FFCC29', secondary: '#00843D' }, // tupis yellow & green
};

/**
 * Chart-dot colour for a team — the jersey primary, unless it is too
 * light to read on a white card (England / Fiji white shirts), in
 * which case the secondary carries the identity.
 */
export function teamDotColor(teamId: string): string | undefined {
  const jersey = TEAM_JERSEY[teamId];
  if (!jersey) return undefined;
  const hex = jersey.primary.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.85 ? jersey.secondary : jersey.primary;
}

export interface JerseyGlyph {
  fill: string;
  /** Trim colour drawn as an outline — only for white/near-white
   *  shirts (ENG, FIJ), whose fill would vanish on a white card. */
  border?: string;
}

/** Solid jersey-glyph colours: the squad primary, except white shirts
 *  render white fill + secondary-colour border (owner call
 *  2026-07-09: "the English jersey should be white fill, red
 *  border"). */
export function jerseyGlyphColors(teamId: string): JerseyGlyph | undefined {
  const jersey = TEAM_JERSEY[teamId];
  if (!jersey) return undefined;
  const hex = jersey.primary.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.85
    ? { fill: jersey.primary, border: jersey.secondary }
    : { fill: jersey.primary };
}
