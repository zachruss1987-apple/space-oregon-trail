# Memorial beacons

Homage: the 1985 tombstones that persisted on the disk. M2. UI-side persistence; the sim only supplies the death log entries.

## Writing
- On **each** crew death (any cause, including drift and the death that ends the run), after the death line, a prompt: `Leave a beacon for {name}?` Text field: 1–40 printable ASCII chars. Empty or Esc = no beacon.
- Several deaths on one day: one prompt per victim, in roster order.
- Stored record: `{ segment, captain, name, text, date }`
  - `segment` = `arrivedAt ?? segment` at the moment of death: the waypoint index at the end of the leg (a death parked at waypoint n, or on the way to it, is segment n).
  - `captain` = `crew[0].name` (the captain may be the one who died).
  - `date` = in-game ISO date.
- Storage: `localStorage['proxima.beacons']`, a JSON array, appended (array order = recency). Keep the last 200 (drop oldest). Read defensively: non-array → `[]`; skip entries missing `segment`/`name`/`text`; missing `captain` (M1 records) → `""`. Storage blocked or full: silently skip (the M1 behavior).
- Player text is not filtered (it never leaves this browser).

## Reading
On arriving at waypoint n (any type, before or after a crossing), the Waypoint scene shows up to **3** beacons for segment n:
1. Player beacons with `segment = n`, most recent first.
2. Remaining slots are filled with canned beacons for segment n from `epitaphs.json`: up to **2** while the player has fewer than 10 stored beacons in total, up to **1** afterwards (canned never crowd out real ones). Canned picks use the text `Rng`.
3. No beacons for n → the section is omitted.

Display line: `Beacon: {name}, of Captain {captain}'s ship, {date}. "{text}"` (empty captain → `Beacon: {name}, {date}. "{text}"`). Waypoint 16 (New Willamette) shows none.

## Canned beacons (`src/content/text/epitaphs.json`)
```json
{
  "$schema": "Array of { segment: 1-15, captain, name, text, date }. text <= 40 chars, date before 2184-03-01.",
  "beacons": [
    { "segment": 1, "captain": "Silas", "name": "Hester", "text": "Should have bought the second suit.", "date": "2183-04-11" }
  ]
}
```
Rules: ≥ 40 entries (M2 content target; ≥ 10 is the hard minimum), at least one for every segment 1–15 and ≥ 3 for each hazard segment (1, 2, 7, 9, 13, 15); names ≤ 12 chars (use `names.ts` pool and new ones); `text` ≤ 40 chars, unique; dates in 2183 or earlier ("last season's travelers").

## Tests
Unit: segment assignment (parked vs between), mixing rule (0, 1, 3+ player beacons; fewer/more than 10 total), malformed storage, 200 cap. E2E: write a beacon, reload, reach the same waypoint, read it.
