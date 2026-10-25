# Resources

Credits (cr) are the currency. Base prices at Independence Station; stations further out mark up (see `economy.md`, M2). In M1 the only store is Mattie's Outfitters at departure, so the whole trip is bought up front.

| Item | Homage | State unit | Sold as | Base price | Buy limit at start | Inventory cap | Notes |
|------|--------|------------|---------|------------|--------------------|---------------|-------|
| Ion drive | Oxen (yoke) | drive | 1 drive | 40 cr | 1–9 (≥ 1 to depart) | 9 | Speed scales with working drives up to 4; extras are spares against drive_failure. |
| Rations | Food (lbs) | ration-day | 1 ration-day | 0.30 cr | ≤ 3,000 | none (mass penalty) | Integer. Consumption in `travel.md`. |
| EVA suits | Clothing (sets) | suit | 1 suit | 10 cr | ≤ 99 | none | Protect against storms, flares, punctures. Target: 2 per crew. |
| Drone charges | Ammunition (box of 20) | charge | box of 20 | 2 cr/box | ≤ 99 boxes | none | Stored as individual charges. Scan for salvage uses 5. |
| Hull plates | Wagon wheels | spare | 1 | 10 cr | ≤ 3 | 3 | Broken hull = speed ×0.5 until repaired. |
| Coolant pumps | Wagon axles | spare | 1 | 10 cr | ≤ 3 | 3 | Broken pump = no movement until repaired. |
| Nav gyros | Wagon tongues | spare | 1 | 10 cr | ≤ 3 | 3 | Broken gyro = lost_lane weight ×2. |

"Spare" counts are spares in the hold. The ship's installed hull plate, pump and gyro are not inventory: each is a boolean `broken` flag, starting intact.

Starting credits by profession: `world.md`. Spending all credits is allowed; Mattie warns. The player cannot leave with 0 drives.

## Mattie's advice (numbers for the writer's store copy)
| Item | Mattie suggests |
|------|-----------------|
| Ion drives | 3 to 4 |
| Rations | 450 per crew member (2,250 for five) "if you like eating every day" |
| EVA suits | 2 per crew member (10) |
| Drone charges | 5 boxes |
| Spare parts | 1 of each, 2 if you can |

Warnings (shown once each in the store): 0 drives ("You will not get far."), rations below 1,000, suits below the crew count, credits spent to 0.

## Consumption and wear
- Rations: per present crew member per day, Full 3, Half 2, Paste 1; Farmer `floor(need × 0.65)` (`travel.md`).
- Drone charges: 5 per Scan for salvage (M1); 1 per grapple fire in Salvage Run (M3).
- EVA suits: on each Solar storm or Flare day, 25% chance one suit is ruined. Also lost to hull_fire, pirates, cargo_shift, hazards.
- Spare parts: consumed by Attempt repair (`travel.md`).

## Weight and speed
`massFactor = 1 − min(0.15, 0.05 × max(0, rations − 1000) / 1000)`: −5% at 2,000 rations, −10% at 3,000, capped at −15%. Only rations count. This nudges players toward buying sensibly.

## Affordability check
Full rations for five crew over a ~150-day trip is 2,250 ration-days = 675 cr. After a basic kit (~260 cr), only the Executive can afford it; the Engineer can afford Half for the whole trip (1,500 = 450 cr); the Farmer cannot afford Half without salvage. See the worked example in `travel.md`.

## Selling
Stations buy back at 50% of their local price, capped at 90% of base price, and only items they sell (M2, `economy.md`). Independence Station does not buy back.
