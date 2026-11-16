# Dinosaur Land diplomacy

The existing simulation is extended in place. `World.diplomacy` owns political agreements; the existing folk modules retain their settlement growth, hunting, transport, equipment and combat. No new enemy population is spawned for diplomacy or ally support.

## Audit and integration

- `Rivals.brutes` contains clans and all four folk groups. Each folk group has its own settlement IDs, bands, movement and damage rules. Political IDs therefore use `clan:1`, `sea:1`, `sand:1`, `tree:1`, and `snow:1`, rather than treating an entire people as one faction.
- `Rivals.hostile`, `Tribe.hostile` and `scorpionTarget` are shared targeting gates. Diplomacy also validates native actions before combat, filters raid destinations, and prevents friendly Sand dragons and faction mounts from triggering guards, Scorpions, beam towers, pylons or Dragon Shields.
- The existing resource stock and unequipped armory inventory supply trades. Equipped items are never taken as trade cargo. Factions have finite stores, export production, preferences and scarcity prices.
- Buildings use the existing blueprint, material-delivery and construction system. Trading Posts are available in the Work build menu and the Diplomacy panel. Put them outside closed walls so caravans can reach their door.
- `World.serialize` includes diplomacy. Local storage, IndexedDB, save slots and cloud saves all use that world payload, so they share the same persistence path. Older saves migrate existing clan wars, clan pacts and Snow grudges without requiring a save-version reset.

## Player flow

Open **Diplomacy** in the top bar or mobile menu. Explore to meet settlements. Offer peace to hostile neighbors, build a Trading Post, then trade or send gifts to build trust. Friendly neighbors may accept an alliance according to their personality. Allies can send a limited defense party, join a specified war, or deliver supplies if their stocks allow it.

War cancels trade and existing agreements. Both sides recruit actual adult fighters from their settlements and retain defenders at home. Archers, mounted fighters and available Sand Dragon Riders retain their existing transport. Political parties travel through the world; they do not appear inside the player's walls. Independent faction wars, ceasefires and alliances also develop over time.

Peace recalls raids and military orders, cancels relevant attacks in flight, stops lingering faction breath damage and releases existing player captives held by that faction. Severe wars can require a gold payment. A ceasefire protects against immediate automatic re-declaration.

## Trade and balance

- Three Trading Post levels provide 40/80/120 units per cargo, 2/3/4 simultaneous caravans, and increasingly favorable rates.
- The displayed quote is calculated from resource value, faction demand, remaining stock, alliance and post level. Trade is available at Neutral, Friendly or Allied relations. Gifts can also repair hostile relations outside a declared war.
- The player's offered goods and the faction's promised goods enter escrow before the party leaves. Goods exchange once at the post. The party then returns with its cargo. War, a destroyed post or a timed-out route refunds any undelivered escrow.
- Sea caravans prefer water; other caravans use overland routes and bridges. Canoes, camels and bundled trade cargo are visible in the world. Clicking a caravan entry moves the camera to it.
- Supply requests have a saved replenishment cooldown. Military help uses at most six existing adults and leaves at least two defenders behind. Allies refuse to fight their own allies.

## Scope and verification

This version supports individual settlement treaties and bilateral alliances. Multi-faction peace conferences and mediating peace between two other groups remain future UI extensions; the pairwise relationship model supports them. Prisoner releases use the game's existing player-captive system; a new prisoner market was not added.

Headless tests cover relationship progression, physical deliveries, escrow refunds, native peaceful combat gates, common-enemy defense, prisoner release, friendly dragons and mounts, equipment trades, cooldown persistence, old-save migration and settlement unions. Browser interaction, visual transport quality and long-duration balance still require playtesting.
