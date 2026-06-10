// Structural allowlist for /api/overpass queries.
//
// The proxy must not be a general-purpose Overpass relay: arbitrary QL can be
// made expensive (around-filters, recursion, full-body dumps over huge areas).
// The client only ever sends one shape — bbox'd tag queries for POIs:
//
//   [out:json][timeout:30];
//   ( node["amenity"="parking"]["motorhome"!="yes"](S,W,N,E); way[…]; … );
//   out center tags;
//
// We validate that structure (grammar, not a tag allowlist — new POI types
// keep working without touching the server). Everything else → 400.

const MAX_STATEMENTS = 40 // client max is ~17 (all five POI types active)
const MAX_TIMEOUT_S = 30

// After stripping all whitespace:
//   statement = (node|way|relation) (["key"="value"] | ["key"!="value"])+ (bbox);
const COORD = String.raw`-?\d+(?:\.\d+)?`
const BBOX = `\\(${COORD}(?:,${COORD}){3}\\)`
const TAG_FILTER = String.raw`\["[\w:-]+"(?:!?=)"[\w:-]+"\]`
const STATEMENT = `(?:node|way|relation)(?:${TAG_FILTER}){1,4}${BBOX};`
const QUERY_RE = new RegExp(
  `^\\[out:json\\](?:\\[timeout:(\\d{1,3})\\])?;\\((?:${STATEMENT})+\\);outcentertags;$`,
)

/** True when the query matches the app's bbox'd POI-query shape. */
export function isValidPoiQuery(rawQuery: string): boolean {
  // Tag keys/values never contain whitespace in our shape ("out center tags"
  // collapses to a fixed token), so matching the compacted form is safe.
  const compact = rawQuery.replace(/\s+/g, '')
  const m = QUERY_RE.exec(compact)
  if (!m) return false

  const timeout = m[1] ? Number(m[1]) : 0
  if (timeout > MAX_TIMEOUT_S) return false

  const statements = compact.match(/(?:node|way|relation)\[/g)?.length ?? 0
  return statements <= MAX_STATEMENTS
}
