# Oregon Trail Mechanics Reference (1985 Apple II / 1990-92 Deluxe)

Confidence key: **[V]** verified in a fetched source this session, **[M]** recalled from community write-ups (not re-verified), **~** estimate. Fandom and StrategyWiki blocked fetching, so many tables are [M] or from the Maxwolf open-source clone, which claims to mirror the 1985 scoring. Treat [M] numbers as design starting points, not ground truth.

## 1. Game flow
1. Title / menu (travel the trail, learn about the trail, Oregon Top Ten). [M]
2. Choose profession: Banker / Carpenter / Farmer. [V] (Deluxe adds more professions with higher multipliers. [M])
3. Name leader plus 4 companions (5 total). [V]
4. Choose departure month (1985: March-July; Deluxe: March-September). [M]
5. Matt's General Store: oxen, food, clothing, ammo, spare parts. [V]
6. Travel loop: status screen daily (date, weather, health, food, miles to next landmark). "Press RETURN to size up the situation" opens menu: continue, supplies, map, pace, rations, rest, trade, talk, buy (forts), hunt. [V mostly]
7. 16 segments, each ending at a landmark (fort, river, or plain landmark). Two landmarks offer cut-offs that skip the next fort. [V]
8. Final segment: Barlow Toll Road or Columbia River raft. [V]
9. End: reach Willamette Valley (score, Top Ten) or all die (tombstone + epitaph). [V]

## 2. Professions
| Profession | Start cash | Score multiplier | Other effects |
|---|---|---|---|
| Banker | $1600 | x1 | none |
| Carpenter | $800 | x2 | Deluxe: better wagon repair [M] |
| Farmer | $400 | x3 | Deluxe: hardier oxen [M] |
Cash and multipliers [V]; extra perks are Deluxe-only and unverified. The 1985 version uses profession only for cash and score.

## 3. Store prices and limits
| Item | Unit | ~Price at Matt's | Cap at Matt's | Notes |
|---|---|---|---|---|
| Oxen | yoke (2) | ~$40 ($20/ox) | 9 yokes [V clone] | Matt suggests ~$200 total; forts sell single oxen |
| Food | lb | ~$0.20 | 4 digits | Suggested ~200 lb per person |
| Clothing | set | ~$10 | 99 | Suggest 2 sets per person |
| Ammunition | box of 20 | ~$2 | 99 | |
| Spare wheel / axle / tongue | each | ~$10 | 9 [V clone] | counted separately |
Prices rise at each fort by ~25% of base per step, capped at 2.5x (clone thresholds: six; per step clothing/part +$2.50, ammo +$0.50, food +$0.05/lb, yoke +$10). [V clone; the original's exact table is M]

## 4. Departure month
| Month | Effect (~) |
|---|---|
| March | Cold, snow possible, little grass early, high rivers; most slack time before winter |
| April | Conventional best compromise |
| May | Good grass, rivers still high |
| June | Warm; mountains arrive later in season |
| July | High risk of snow in Blue Mountains/Cascades; Columbia danger; often fatal |
A typical run takes ~150 days (about 5 months) [V]. Weather comes from a monthly regional average table; bad weather when daily temp <= monthly mean [V clone]. Weather band on travel screen: white = snow, orange = very dry, green = normal [V]. Rivers run deepest in spring and shallower late summer. [M]

## 5. Landmarks (miles from Independence; ~ = uncertain)
Total ~2040 miles [V]. Early mileposts [M]; rows 9-16 are ~ and need verification.
| # | Landmark | Type | ~Miles |
|---|---|---|---|
| 1 | Independence, MO | start | 0 |
| 2 | Kansas River | river | 102 |
| 3 | Big Blue River | river | 185 |
| 4 | Fort Kearney | fort | 304 |
| 5 | Chimney Rock | landmark | 554 |
| 6 | Fort Laramie | fort | 640 |
| 7 | Independence Rock | landmark | 830 |
| 8 | South Pass | landmark, cut-off choice | 932 |
| 9 | Fort Bridger (cut-off: Green River crossing) | fort / river | ~990-1000 |
| 10 | Soda Springs | landmark | ~1150 |
| 11 | Fort Hall | fort | ~1200-1290 |
| 12 | Snake River | river | ~1300+ |
| 13 | Fort Boise | fort | ~1450-1540 |
| 14 | Blue Mountains | landmark, cut-off choice | ~1550-1700 |
| 15 | Fort Walla Walla | fort | ~1650-1750 |
| 16 | The Dalles | final choice | ~1760-1850 |
| 17 | Willamette Valley | end | ~2040 |
Mountain delays: 80% chance of being stuck leaving South Pass, 70% leaving Blue Mountains, up to 10 days [V clone].

River crossing options [M]: ford (safe when shallow, roughly under 2.5 ft; deeper risks lost supplies and drowning), caulk and float (handles deeper water, can tip), ferry (fee ~$5, wait 1-5 days), Indian guide (Deluxe; costs clothing; very safe). Success depends on river depth, width, and weather [V].

## 6. Travel simulation
| Pace | ~Effect |
|---|---|
| Steady | ~20 mi/day base (varies with oxen) [M] |
| Strenuous | ~+30% miles, more illness/breakage |
| Grueling | ~+50-60% miles, much higher risk |
| Rations | lb/person/day | Effect |
|---|---|---|
| Filling | ~3 | health recovers |
| Meager | ~2 | slow decline, more illness |
| Bare bones | ~1 | fast decline |
[V that levels exist and affect illness/event odds; lb values M]
- Daily miles = base from oxen plus small random, minus penalties (dead/lame/wandering oxen, flood, fog, hail, snow/mud, mountains, illness), with a minimum floor. [V clone]
- Hidden per-person health score drives the displayed good/fair/poor/very poor. Inputs [M]: rations, pace, weather vs clothing, illness, bad water, rest. Resting 1-9 days restores health and consumes food.
- Bad-water locations double daily dysentery/cholera chance. [V clone]

## 7. Random events
Clone: each tick a 0-99 roll, event on 0 (~1%), then weighted table [V clone]. Original checks daily with weighted tables; risk rises with pace/rations. [M]
| Event | Condition / odds (~) | Consequence |
|---|---|---|
| Illness | most common; higher at poor health | see sec 8 |
| Injury / broken limb | low | member slowed, may die |
| Snakebite | low | injury, may die |
| Thief | low | steals items overnight [V graphic exists] |
| Lost trail / wrong trail | medium | lose 1-5 days |
| Wagon part breaks | low-medium | need spare or lose days |
| Ox dies / injured / wanders off | low-medium | slower or lose days |
| Bad water | in bad-water zones | illness odds up |
| No water | desert | lose days |
| Wagon fire | rare | supplies lost |
| Heavy fog / hail / thunderstorm | weather | lose days or miles [V thunderstorm graphic] |
| Blizzard | winter/high elevation; 90% of high-altitude storms [V clone] | days lost, health hit |
| Found wild fruit | positive | +food |
| Found abandoned wagon | positive | free supplies |
| Indians help find food | positive | +food |
| Member lost | rare | lose days |

## 8. Illnesses
| Illness | Notes |
|---|---|
| Dysentery | most common killer |
| Cholera | bad water, high fatality |
| Typhoid | long, dangerous |
| Measles | usually survivable with rest |
| Exhaustion | from grueling pace |
| Snakebite, broken arm/leg | injuries |
Clone tiers: mild, bad, very serious [V]. The original medicine/doctor system was cut in 1985 [V]. Loop: rest to recover; each sick day carries a death chance, higher when party health is poor or you keep traveling. Exact durations/percentages unverified.

## 9. Hunting
- Third-person; move in 8 directions, shoot in 8 directions, one shot per ammo (1980 version fired 8-bullet clusters). [V]
- 6 animals in the final game (18 planned, 11 considered, cut for memory). [V]
- Yield ~ by animal weight (squirrel ~2 lb, rabbit ~2, deer ~50-100, bear ~100, bison ~350) [M]. Carry limit 100 lb in 1985, 200 lb later: "However, you were only able carry 100 pounds back to the wagon." [V] Clone halves dressed meat on the walk back [V clone].
- Terrain: 5 zones (Eastern forest, Plains, Rockies, Desert, Western forest); 4-6 random obstacles per hunt. Players get proficient after 3-4 hunts. [V] Each hunt costs about a day. [M]

## 10. Trading and talk
Deluxe fort/wagon encounters offer random barter (e.g. clothing for oxen, ammo for food) with accept/decline. "Talk to people" gives flavor and tips (river depth, route advice, weather); fort NPCs have fixed lines. [M]

## 11. Tombstones
On total party death a gravestone shows the leader's name and a player-typed epitaph. In the 1985 game epitaphs persist on the game disk and later players see them as markers along the trail. High-score table is pre-populated with real trail travelers' names. [V partial; M persistence]
Famous messages: "You have died of dysentery." "[Name] has died of cholera/measles/typhoid." "You have run out of food." "[Name] has broken a leg." [M]

## 12. End of trail and scoring
At The Dalles: Barlow Road (toll, ~$10-$25 per wagon [M]; slow, mountain days) vs Columbia raft (rock-dodging mini-game; hits can lose supplies or drown people). [V choice]
Scoring [V Maxwolf clone, said to match 1985]:
| Item | Points |
|---|---|
| Survivor by health | 500 / 400 / 300 / 200 (good/fair/poor/very poor) |
| Wagon | 50 |
| Oxen | 4 each (capped) |
| Spare parts | 2 each (cap 3 per type) |
| Clothing | 2 per set |
| Bullets | 1 per 50 |
| Food | 1 per 25 lb |
| Cash | 1 per $5 |
Lines are floored, then multiplied x1/x2/x3 by profession. Ratings: Trail Guide 6000+, Adventurer 3000+, Greenhorn below. Max 13,860. [V clone]

## 13. Design lessons (Bouchard)
- Make tradeoffs concrete: food vs oxen vs ammo under a cash limit.
- Frequent small misfortunes keep tension; choices shift odds, never guarantee outcomes.
- Hidden state (health) read indirectly keeps the player anxious but fair.
- Hunting is a skill release valve with a carry cap that teaches restraint; field testing showed it worked. [V]
- Daily simulation nested inside landmark-to-landmark cycles gives rhythm. [V]
- Memory limits forced elegant cuts (18 animals to 6; 110 sprites to 48). [V]
- Playtest the interface: "Press S to stop" became "size up the situation". [V]
- Death is shareable: tombstones, epitaphs, Top Ten.
- Multiplied scoring by difficulty rewards hard starts. [V]
- Departure month is a strategic choice with a late-trail payoff or punishment. [M]
- Education delivered via landmarks and NPC talk, not lectures.

## Sources
- https://en.wikipedia.org/wiki/The_Oregon_Trail_(1985_video_game)
- https://en.wikipedia.org/wiki/The_Oregon_Trail_(series)
- https://died-of-dysentery.com/stories/hunting.html
- https://died-of-dysentery.com/stories/travel-screen.html
- https://github.com/Maxwolf/OregonTrail
