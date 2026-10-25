# Glossary

| Term | Meaning |
|------|---------|
| The Lane | The marked route from Earth to Proxima b: relay buoys plus the Kuiper Gate. |
| Megaklick (Mk) | Distance unit on the Lane. The whole trail is 2,040 Mk. |
| Independence Station | Departure point at Earth–Luna L1. |
| Mattie's Outfitters | The general store at Independence Station. Proprietor: Mattie Ostrander. |
| New Willamette | The colony on Proxima Centauri b. |
| Belters | Asteroid miners; hire them as pilots through the Belt Crossing. |
| Tug | A for-hire ship that tows you safely through a hazard, for a price. |
| Flare season | From 15 September 2184, when Proxima's flares make the last three segments dangerous. |
| Ion drive | The ship's engine units (the "oxen"). |
| Paste | Nutrient paste; the lowest ration setting. |
| Beacon | A memorial left where a crew member died; later travelers can read it. |
| Lane Authority | Bureaucracy that posts bulletins at landmarks. |
| Ration-day | The unit rations are sold and counted in. Full rations eat 3 per crew member per day, Half 2, Paste 1. |
| Thrust | The ship's pace setting: Cruise, Hard burn, Overburn. |
| Drone charges | Salvage-drone ammunition, sold in boxes of 20; a salvage scan uses 5. |
| Salvage scan | Spending a day and 5 drone charges to pick through wreckage for rations or parts. |
| Ion fog | Weather that slows the ship and makes it easy to lose the Lane. |
| Lost the Lane | Drifting off the buoy line; costs days. |
| Mattie Ostrander | Proprietor of Mattie's Outfitters; gives advice in the store, which is worth heeding. |
| Lane Authority bulletin | A buoy-posted notice at a waypoint; the game's "talk to people" pool (`bulletins.json`). |
| Shoals | Drifting gravel tides at the Lagrange Shoals, where Earth and Luna pull equally. |
| Spire | Ceres Approach Spire; a surveyor's needle used as a landmark. |
| Pathfinder / Spacer / Groundling | Arrival ratings, best to worst (score >= 6,000 / >= 3,000 / below). |
| Recycler | The ship's water recycler; blamed first for any illness (`bad_recycler`). |
| EVA drift | A crew member lost outside the ship on a spacewalk (`crew_eva_drift`, death cause `drift`). |
| Hull mold fever | The Lane's version of cholera; walls are suspected. |
| Derelict | An abandoned wreck that may hold rations, a spare, or suits. |
| Drones | Salvage drones; they sweep wrecks on a scan and come back smug or sorry. |
| Hold position | A lost day when the ship waits in place (`delay`). |
| Talk lines | Per-station chatter (`stations.json`, `talk`): dockhands, clerks, colonists. |
| Persona | A trading partner voice in `trades.json`; offers use `{give}` (what the player pays) and `{get}` (what the player receives). |
| Canned beacon | A pre-written memorial left by NPC colonists (`epitaphs.json`); text max 40 chars, tied to a trail segment. |
| Lucky bolt | An ordinary bolt sold as a charm at Independence Station. |
| Paste cake | Nutrient paste, baked. Not an improvement. |
| The Shock | Short for the Proxima Heliopause Shock. |
| Outfitters | A station's store (buy and sell). Mattie's at Independence; the keeper's elsewhere. |
| Buy-back | Selling to a station: 50% of its price, never more than 90% of the Independence price ("Lane list"). |
| Lane list | The Independence Station price; the most any station pays when buying back is 90% of it. |
| Trader | An NPC at a road station offering a one-time barter; each has a persona (`trades.json`). |
| Talk | Station flavor lines from locals (`stations.json`), the stations' version of bulletins. |
| Keeper | A road station's store proprietor, named in `stations.json`. |
| Density | How thick a hazard is today, 1–5, rolled on arrival around the hazard's nominal value. |
| Thread it | Crossing a hazard under your own power; risk by density and ship state. |
| Shields up and push | Crossing behind shields: half the risk, no deaths, but strains the coolant pump. |
| Belter pilot | A miner who flies your ship through the Belt Crossing or Saturn Ring Plane after a wait, for 10 cr. |
| Coolant strain | The 15% chance shields break the coolant pump. |
| Gate direct | The route from Titan Refinery that skips Oort Beacon (1,926 Mk total); the Heliopause is worse. |
| Via Oort | The default route through Oort Beacon (2,040 Mk). |
| Fork | Titan Refinery's route choice: Via Oort Beacon or Direct to the Shock. |
| Dome gardener / ice diver / algae farmer | Trader personas at Mars Relay, Europa Outpost and the vats (`trades.json`). |
| Station keepers | Ottoline Varga (Mars Relay), Bram Okonkwo-Hale (Ceres Depot), Sister Maren Voss (Europa Outpost), Dutch Halloran (Titan Refinery), Quill Anand (Oort Beacon), Imogen Pike (Lane Terminus); Mattie Ostrander keeps Independence. |
| Salvage Run | The drone mini-game behind "Scan for salvage": grapple drifting debris for 40 s, tow back at most 100 units. |
| Grapple | The drone's cable; one drone charge per shot, hit or miss. |
| Haul | What the drone reels in during a Salvage Run; rations weigh 1 unit, spare parts 10. |
| Tumbler | A spinning debris chunk; dents the drone (3 dents and it limps home with half the haul). |
| Hot chunk | Radioactive debris; touching or hauling it costs a crew member 5 health. |
| Debris Threading | The playable "Thread it": 25 s dodging rocks; hits become severity rolls. |
| Ride the solar wind | Flying the Flare Belt yourself (45 s of dodging flare arcs); five hits is a crash. |
| Pay the tug | The Flare Belt tug: 120 cr, 180 in flare season. |
| Flare arc | A telegraphed band of plasma across the Flare Belt; glows dim, then burns. |
| Rode the wind | Score bonus (+200) for a clean Flare Belt ride. |
| Auto-resolve | The Options setting (and skip) that settles a mini-game by the statistical roll instead. |
| Wrecked (drone) | A drone out of HP; the Salvage Run ends and the haul is halved. |
| Carry limit | The 100 units a drone can tow home: rations 1 each, spare parts 10 each. |
| Clean thread | A Debris Threading run with zero hits; earns a bonus pick (+2 health all crew or +10 rations). |
| Crash (Flare Belt) | Five flare hits: the run ends, one crew member is lost, and the hold is halved. |
| Skip with penalty | Abandoning a mini-game from the pause menu; settled by the statistical roll, a little worse. |
