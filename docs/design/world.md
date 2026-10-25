# World

## Premise
Year 2184. The Lane, a chain of relay buoys and one jump gate, links Earth to the colony world **New Willamette** on Proxima Centauri b. Passage is cheap enough for families and dangerous enough that most of them should not try. You lead a crew of five aboard a second-hand hauler, departing **Independence Station** at Earth–Luna L1 for a 2,040-megaklick journey that takes about five months.

Homage mapping: Independence, Missouri → Independence Station; Willamette Valley → New Willamette; miles → megaklicks (Mk); months on the trail → the same calendar, because colonists still count in Earth months.

## Tone
Deadpan frontier futurism. People talk like 1840s settlers with ion drives. See `writing.md`.

## The crew
Five named crew: the captain (player) plus four. Default names are offered; the player can type their own. Each has health, illnesses, and may die. Roles are flavor only (no per-crew skills) to keep the sim simple; profession is the ship-wide bonus.

### Default names
SetupScene prefills the five fields with the defaults (crew[0] is the captain). Each field accepts 1–12 printable ASCII characters; an emptied field reverts to its default. A "Random names" option refills all five from the pool without duplicates. The pool is also the writer's stock for NPCs, beacons and seeded high scores.

| Slot | Default |
|------|---------|
| Captain | Ezra |
| 2 | Temperance |
| 3 | Amos |
| 4 | Lucinda |
| 5 | Hollis |

Pool (20): Abigail, Bartholomew, Cora, Delphine, Eli, Florence, Gideon, Hester, Ignatius, Jemima, Kit, Lavinia, Mordecai, Nell, Obadiah, Prudence, Silas, Theodora, Ulysses, Zebulon.

## Professions
| Profession | Credits | Score multiplier | Perk | Rule (exact) |
|------------|---------|------------------|------|--------------|
| Corporate Executive | 1,600 | ×1 | None. Money solves most problems. | none |
| Ship Engineer | 650 | ×2 | Repairs succeed more often and consume fewer parts; drive failures are rarer. | Repair 95% (not 80%); spare lost on failure 10% (not 30%); drive_failure weight ×0.5 |
| Hydroponics Farmer | 400 | ×3 | Rations go half again as far; "found algae bloom" events yield more. | Daily ration need `floor(need × 0.65)`, min 1; algae_bloom ×1.5 |

## Launch windows
Five windows (homage: March–July). Earlier is colder near Earth (more solar storms early in the cycle, "mud season" equivalent: slower transit through the Lunar Debris Ring) but arrives before Proxima's **flare season**. Later is calmer at the start but risks arriving during flare season, which raises hazard severity and health loss in the last three segments.

| Window | Calendar start | Early weather | Late-trail risk | Hazard modifier |
|--------|----------------|---------------|-----------------|-----------------|
| 1 | 1 March 2184 | Stormy (solar max tail) | Low | +10% at Lunar Debris Ring, Lagrange Shoals |
| 2 | 1 April | Unsettled | Low | +5% at the same two |
| 3 | 1 May | Fair | Medium | none |
| 4 | 1 June | Fair | High | none |
| 5 | 1 July | Calm | Very high (flare season on arrival) | none |

**Flare season** starts 15 September 2184. Effects: late-phase weather switches to the flare-season row (`travel.md`) and The Flare Belt crossing gets +15% incident chance and +10 severity (`trail.md`); arriving before it scores +200 (`scoring.md`). Exact weather weights per window: `travel.md`.

## New game (initial state)
`createGame({ profession, crewNames, window }, rng)` returns:

| Field | Initial value |
|-------|---------------|
| `profession`, `window` | as chosen |
| `crew` | 5 × `{ name, health: 100, conditions: [], awayDays: 0, alive: true }`; crew[0] is the captain |
| `credits` | 1,600 / 650 / 400 by profession |
| `supplies` | all 0: drives, rations, suits, charges, plates, pumps, gyros (bought in the store next) |
| `broken` | `{ hull: false, pump: false, gyro: false }`; `offlineDrives: []` |
| `date` / `day` | window start date (1st of Mar–Jul 2184) / 0 |
| `segment`, `distanceInSegment`, `distanceTotal` | 1, 0, 0 (at Independence Station) |
| `thrust`, `rations` setting | Cruise, Full |
| `weather` | Fair |
| `delayDays`, `strandedDays`, `consecutiveOverburn`, `consecutiveLowRations` | 0 |
| `eventCooldownUntilDay` | 0 |
| `scansThisSegment`, `justCrossedHazard`, `arrivedAt` | 0, false, null |
| `log` | one departure line |
| `status` | `"store"` → `"traveling"` once the player leaves with ≥ 1 drive |

## Factions and color
- **Belters**: asteroid miners who pilot ships through the Belt Crossing for a fee. Taciturn, reliable, fond of bad coffee.
- **Mattie's Outfitters**: the general store at Independence Station, run by Mattie Ostrander, who gives purchasing advice the player may regret ignoring.
- **The Lane Authority**: posts buoy bulletins (the "talk to people" pool at landmarks).
- **Tugs**: expensive, safe, unsentimental.
