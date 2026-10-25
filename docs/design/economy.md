# Economy

Station stores (Outfitters), markups, buy-back, NPC trade offers, Talk, and the station visit flow. M2. Base prices, buy limits and caps: `resources.md`. Rest rules: `travel.md`.

## Stations
Seven stores: Independence Station (index 0, Mattie's, the M1 store) and six road stations. Oort Beacon is only reached on the via-Oort route (`hazards.md`, Route branch).

| # | Station | Theme for prices |
|---|---------|------------------|
| 0 | Independence Station | List prices. Mattie does not buy back. |
| 3 | Mars Relay | Greenhouse domes: food at Earth prices. |
| 5 | Ceres Depot | Mining town: drone charges and plate stock are cheap; everything else is shipped in. |
| 8 | Europa Outpost | Under-ice algae vats keep food flat; ice divers make good suits. Drives come a long way. |
| 10 | Titan Refinery | Cryogenic plant: coolant pumps cheap, refurbished drives fair; food dear. |
| 12 | Oort Beacon | Keepers of the buoy line: nav gyros cheap. **No drives** (nothing to build them from). |
| 14 | Lane Terminus Station | End of the line: food flows outbound from the colony and is cheaper; the rest costs the most. |

## Markups
Price per pack = base price (`resources.md`) × markup, rounded half-up to the cent. "—" = not sold. Every markup is ≥ 1.0 and ≤ 2.5 (the original's cap). Ration markups are only 1.0/1.5/2.0/2.5 so prices are whole cents.

| Station | Drives | Rations | Suits | Charges | Plates | Pumps | Gyros |
|---------|--------|---------|-------|---------|--------|-------|-------|
| Independence (0) | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| Mars Relay (3) | 1.25 | **1.0** | 1.25 | 1.25 | 1.25 | 1.25 | 1.25 |
| Ceres Depot (5) | 1.5 | 1.5 | 1.5 | **1.0** | **1.25** | 1.5 | 1.5 |
| Europa Outpost (8) | **2.0** | **1.5** | **1.25** | 1.75 | 1.75 | 1.75 | 1.75 |
| Titan Refinery (10) | **1.75** | **2.5** | 2.0 | 2.0 | 2.0 | **1.25** | 2.0 |
| Oort Beacon (12) | — | 2.5 | 2.25 | 2.25 | 2.5 | 2.5 | **1.5** |
| Lane Terminus (14) | 2.5 | **2.0** | 2.5 | 2.5 | 2.5 | 2.5 | 2.5 |

Bold = off-trend on purpose (trend is +0.25 per station). Resulting prices (cr per pack; charges per box of 20):

| Station | Drive | Ration | Suit | Charges box | Plate | Pump | Gyro |
|---------|-------|--------|------|-------------|-------|------|------|
| Independence | 40 | 0.30 | 10 | 2.00 | 10 | 10 | 10 |
| Mars Relay | 50 | 0.30 | 12.50 | 2.50 | 12.50 | 12.50 | 12.50 |
| Ceres Depot | 60 | 0.45 | 15 | 2.00 | 12.50 | 15 | 15 |
| Europa Outpost | 80 | 0.45 | 12.50 | 3.50 | 17.50 | 17.50 | 17.50 |
| Titan Refinery | 70 | 0.75 | 20 | 4.00 | 20 | 12.50 | 20 |
| Oort Beacon | — | 0.75 | 22.50 | 4.50 | 25 | 25 | 15 |
| Lane Terminus | 100 | 0.60 | 25 | 5.00 | 25 | 25 | 25 |

Content: replace `Waypoint.markup: number` with `markup: Partial<Record<SupplyKey, number>>` (missing key = not sold).

## Buying on the road
- Allowed while parked at a station (`arrivedAt` is a station index ≥ 3) through intent `{ type: 'buy', item, packs }`, 0 days. Independence keeps the M1 `buy()` (status `store`).
- Same limits as Independence, counted on what is held: held packs + packs ≤ buy limit; units ≤ inventory cap (drives 9, each spare 3). No per-visit stock limit.
- Refusals (state unchanged, `error` set): `"They don't sell that here."` (not sold), `"You can carry at most N."`, `"You cannot afford that."`. **Credits never go negative**: cost > credits is refused, never partially filled.

## Buy-back (selling)
- Intent `{ type: 'sell', item, packs }`, 0 days, at road stations only. Independence: `"Mattie does not buy back."`
- A station buys only what it sells (Oort Beacon will not buy drives).
- **Sell price per pack = min(50% of local price, 90% of base price)**, rounded down to the cent. The 90% cap ("Lane list") binds from Titan Refinery outward.
- Cannot sell the last drive: `"You need a drive to leave."` (selling may never strand the ship). Cannot sell more than held.
- Log kind `store`, id = item, text `"Sold {n} {item} for {cr} cr."` / `"Bought {n} {item} for {cr} cr."`.

**No arbitrage loop.** The cheapest purchase of any item anywhere is its base price (all markups ≥ 1.0; NPC credit offers are ≥ base value, below). The best sell price anywhere is 90% of base. So buy-then-sell always loses ≥ 10%, at the same station or across stations. Item-for-item NPC trades can gain value, but each is accept-once and there are at most 3 per station visit (≤ 18 per run).

## NPC trade offers
Generated once on arrival at a road station (main `Rng`, inside the arrival tick, after the arrival is set), stored in `state.station.offers`, kept for the whole visit (rest days included), discarded on departure. Not at Independence.

1. **Count**: d100 ≤ 50 → 3 offers, else 2.
2. For each offer, draw a **persona** id from `trades.json` without replacement within the visit.
3. **Get** (what the player receives): weighted draw, skipping items at cap. Lot size uniform in range:

| Get item | Weight | Lot |
|----------|--------|-----|
| Ion drive | 15 (0 at Oort Beacon) | 1 |
| Rations | 30 | 30–150, step 10 |
| EVA suits | 15 | 1–3 |
| Drone charges | 10 | 1–3 boxes (20–60) |
| Hull plate / Coolant pump / Nav gyro | 10 each | 1 |

4. **Value** `V` = lot × base unit value (drive 40, ration 0.30, suit 10, charge 0.10, spare 10, credit 1).
5. **Fairness** d100: 01–15 *swindle* r = 1.6; 16–50 *steep* r = 1.25; 51–85 *fair* r = 1.0; 86–100 *generous* r = 0.75. If the ask is credits, r = max(r, 1.0).
6. **Give** (what the trader asks): uniform among the player's holdings other than the get item: credits (if ≥ 1), rations, suits, charges, plates, pumps, gyros (qty > 0), drives (only if drives ≥ 2). Ask qty = `ceil(V × r / unitValue)`, then rounded up: rations and charges to a multiple of 5, others to whole units.
7. If the ask exceeds what the player holds (drives: holdings − 1), drop that give candidate and redraw; if none is left, redraw the get item. After 5 failed attempts the slot is dropped (a visit can have 0–3 offers; 0 → `"Nobody here wants to trade."`).

Offer shape: `{ persona, give: { item: SupplyKey | 'credits', qty }, get: { item: SupplyKey, qty }, fairness, taken: false }`. Fairness is stored for tests, never shown; the player judges by the numbers (imperfect information).

**Accepting**: intent `{ type: 'trade', offer: index }`, 0 days. Re-checks the ask against current holdings (the player may have sold things since): refused `"You don't have {give} anymore."`; refused if the get would exceed a cap (`"You can carry at most N."`) or the ask would take the last drive. On success: subtract give, add get, `taken = true`; log kind `trade`, id = persona, text from that persona's `accept` lines. A taken offer cannot be accepted again: `"That deal is done."`. Declining is UI-only (no intent, no state change).

## Talk
Each road station has a pool of ≥ 10 lines in `stations.json` (`talk`). Each Talk shows one line from a per-visit shuffle drawn with the text `Rng`, no repeats until the pool is exhausted, then reshuffle. 0 days, no state change. (6 × 10 = 60 lines meets M2's ≥ 60.)

## Rest at a station
The Travel `rest` intent while parked at a station: +6 health/day instead of +3 (`travel.md`). Offers persist through the rest.

## Enter station flow
Arrive → Waypoint scene (blurb, bulletin line, beacons per `beacons.md`) → `Enter station` / `Continue`.
`Enter station` → StationScene, keeper greeting, menu:
1. **Outfitters** — table: item, buy price, sell price ("—" if not traded), held, room left. Buy and Sell use `NumberInput`.
2. **Trade** — list offers: persona pitch line, then `You give: {give}  You get: {get}`; Accept / Decline; taken offers dimmed "(done)".
3. **Talk** — next talk line.
4. **Rest** — 1–9 days prompt, station bonus.
5. **Continue** — departs (`continue`). Refused with 0 drives: `"You need at least one ion drive to leave."` Arriving with 0 drives (a drive died on the arrival day) is not a soft-lock: buy, trade, or Rest (passing haulers 10%/day; adrift after 15 days, `health.md`). At Titan Refinery, Continue first asks the route (`hazards.md`).

## Worked example (sanity check)
**Farmer, 0 credits at Mars Relay**, holding 10 boxes of charges and 1 nav gyro. Cannot buy anything (every price > 0). Sells 2 boxes: 50% × 2.50 = 1.25 each → 2.50 cr; sells 1 gyro: 50% × 12.50 = 6.25 cr. **Total 8.75 cr** → buys 29 rations (8.70 cr). Selling is a poor channel by design.
A *fair* trader offering 30 rations (V = 9) who asks for the gyro asks `ceil(9 / 10)` = 1 gyro: 30 rations for the gyro, vs 20 rations (6.25 cr) selling it to the store (1.5×; a *generous* trader asks the same gyro for up to 40 rations, 2×). A fair offer of 1 coolant pump for rations asks 10 / 0.30 = 33.3 → 35 rations. The Farmer's real lever is trading, not selling.
**Loop check**: buy a drive at Independence for 40, sell at Lane Terminus: min(50, 36) = 36 → −4. Buy rations at Mars 0.30, sell at Titan: min(0.375, 0.27) = 0.27 → −0.03 each.
**Executive at Titan with 370 cr**: buys 3 pumps (37.50) on the cheap; at Lane Terminus the same would cost 75.

## Content schemas (writer works in parallel)
`src/content/text/stations.json` — keyed by station waypoint id (the six road stations; blurbs stay in `bulletins.json`):
```json
{
  "$schema": "Station id -> { keeper, greeting[], talk[] }. No placeholders except {captain} in greeting.",
  "mars-relay": {
    "keeper": "Ottoline Varga",
    "greeting": ["Welcome to Mars Relay, Captain {captain}. The tomatoes are real."],
    "talk": ["Overheard: 'They grow beans in the dome. They grow opinions about beans, too.'"]
  }
}
```
Rules: `keeper` ≤ 24 chars; `greeting` ≥ 2; `talk` ≥ 10; every line ≤ 140 chars, unique across the file; Oort Beacon talk should hint "no drives here"; Titan talk should hint at the route choice.

`src/content/text/trades.json` — personas (≥ 20):
```json
{
  "$schema": "Persona id (kebab-case) -> { name, pitch[], accept[], decline[] }. {give} = what the player hands over, {get} = what the player receives, both full phrases with counts ('35 rations', '1 coolant pump', '40 cr'). {n} = the get quantity alone (optional).",
  "one-glove-belter": {
    "name": "a Belter with one glove",
    "pitch": ["Got {get}. Want {give}. Not haggling, the other glove did that."],
    "accept": ["The Belter nods once. That is the whole ceremony."],
    "decline": ["'Suit yourself.' The Belter does not, in fact, have a spare suit."]
  }
}
```
Rules: `name` ≤ 32 chars, lowercase article form ("a ...") for mid-sentence use; `pitch` ≥ 2 and each contains both `{give}` and `{get}`; `accept` ≥ 1; `decline` ≥ 1; ≤ 140 chars. Item nouns the sim formats: ion drive(s), ration(s), EVA suit(s), drone charge(s), hull plate(s), coolant pump(s), nav gyro(s), cr.
