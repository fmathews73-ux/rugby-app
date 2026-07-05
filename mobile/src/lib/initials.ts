/** First letters of the first two name parts, uppercased — the monogram
 *  shown in player avatar circles (photos are a Phase 6 image-rights
 *  licence tier; the monogram is the deliberate placeholder). */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}
