// Fuzzy, punctuation-insensitive exercise search.
// Handles the common cases that exact substring matching misses:
//   "pull up" / "pullup" / "pull-up"  -> all match "Pull-Up"
//   "bench"                            -> matches "Barbell Bench Press"
//   "ohp press" (reordered tokens)    -> matches "Overhead Press"

// Lowercase, strip punctuation/hyphens, collapse whitespace.
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Returns true if `name` is a reasonable match for `query`.
export function matchesQuery(name: string, query: string): boolean {
  return scoreMatch(name, query) >= 0
}

// Higher score = better match. Returns -1 for no match.
// Used both to filter and to rank results so the closest matches surface first.
export function scoreMatch(name: string, query: string): number {
  const q = normalizeForSearch(query)
  if (!q) return 0 // empty query matches everything (unranked)

  const n = normalizeForSearch(name)
  if (!n) return -1

  // Collapsed forms ignore spaces so "pullup" <-> "pull up" line up.
  const nCollapsed = n.replace(/ /g, '')
  const qCollapsed = q.replace(/ /g, '')

  if (n === q) return 1000 // exact match
  if (n.startsWith(q)) return 900 - (n.length - q.length)

  // Query matches the start of any word ("bench" -> "Barbell Bench Press").
  const words = n.split(' ')
  if (words.some((w) => w.startsWith(q))) return 700

  if (n.includes(q)) return 500 // substring anywhere
  if (nCollapsed.includes(qCollapsed)) return 400 // punctuation/spacing differences

  // Every query token appears somewhere — covers reordered / partial words.
  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length > 1 && tokens.every((t) => nCollapsed.includes(t))) return 200

  return -1
}

// Filter + rank a list of items by how well their name matches the query.
// Stable alphabetical tie-break keeps the list calm as the user types.
export function searchByName<T extends { name: string }>(items: T[], query: string): T[] {
  if (!normalizeForSearch(query)) return items
  return items
    .map((item) => ({ item, score: scoreMatch(item.name, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((r) => r.item)
}
