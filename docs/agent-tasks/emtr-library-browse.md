# EMTR Particle Library browsing

Ready for review. Codex, 1 November 2026. Branch `codex/emtr-library-browse`, based on `f75e407def9badcee9e7080a8d0b050433c85879`. Merge requires owner approval.

## What changed

The library opens in **By type** with appearance headings. **World Editor** uses the main Library’s installed tables, localized object names, icons and expandable folder rows. Both views use the same card, thumbnail queue, favorite annotation, Details and recipe-opening control. Personal collections keep their existing ordering and storage.

The extraction worker joins physical source paths from every card against unit, hero, building, item, doodad and destructible art. It follows spells, level-specific buffs and effects, summoned units and upgrades with model art. Missing model paths can resolve to a unique sibling folder within the same parent. An exact installed model with zero emitters takes precedence. Other effects keeps every unlinked card. Searching a spell can also find a referenced model with zero indexed emitters.

The browse sidecar lives beside the catalogue. The source key covers the install, build and installed locale tags. Catalogue size, modification time and the browse schema identify the sidecar revision. Existing complete catalogues acquire it in the utility process. User display names take precedence over reviewed names, followed by generated suggestions. Recipe IDs, extracted files and personal metadata require no rewrite for this upgrade.

## Installed game proof

Classic Warcraft III build **3.0.1.24371**, English (US), read through the project’s CASC reader. The independent extraction enumerated 3,501 candidate models and parsed 3,500. One model could not be parsed.

| Measure | Result |
|---|---:|
| Native emitters found in parsed models | 4,315 |
| Native emitters on linked / unlinked source paths | 3,534 / 781 |
| Catalogue cards, including single recipes, source groups and blocked cards | 5,032 |
| Linked cards / Other effects | 4,144 / 888 |
| World Editor objects with at least one card | 1,313 |
| Readable recipes / blocked cards | 4,589 / 443 |
| Whole-model emitter groups among readable recipes | 752 |
| Repeated exact titles | 40 groups covering 4,998 cards → 0 |
| Appearance category Other | 2,887 → 1,006 |
| Hash-verified reviewed names preserved | 34 |

The 14 remaining numbered fallbacks are blocked cinematic records with identical source and authored emitter names. All readable recipes have evidence-based names. Some sibling names share a stem and differ by an authored layer, game variation or measured value. Stripping punctuation, plurals and **all** trailing numbers, including meaningful measurements, yields 139 repeated stems in the resulting catalogue.

| Requested example | Evidence from the installed files |
|---|---|
| Abomination | Disease Cloud target, spawned Disease Cloud and the Disease buff target each have one card. |
| Priest | Heal target has four cards. Dispel Magic target and special each have one. Inner Fire’s buff points to `InnerFireTarget.mdx`, which has zero native emitters. |
| Archmage | Blizzard buff target has three cards and effect art has six. Summon Water Elemental resolves all three levels, with nine shared cards at each level. Both Brilliance Aura and General Aura Target models have zero native emitters. |
| Mountain King | Thunder Clap caster has one card. Storm Bolt missile has three. |
| Far Seer | Chain Lightning missile has one card. Its BoltImpact target model has zero native emitters. |
| Death Knight | Death Coil missile has five cards and impact has five. The game stores the impact in Special Art and supplies no Target Art field. |
| Blood Mage | Flame Strike effect has three cards, special has 18, buff target has one and buff effect has three. |
| Frost Wyrm | The FrostWyrmMissile model supplies five attack cards. |
| Rifleman | The attack table supplies one RifleImpact card. The model group has four cards. |
| Town Hall / Altar of Kings | Town Hall has 22 model, one missile and seven death/special cards. Altar has 12 model and seven death/special cards. |
| Brazier | The Lordaeron Summer Brazier has three model cards. |
| Orb of Frost | The granted Item Attack Frost Bonus has one target, five missile and one special card. Its Slowed buff adds three target cards. |

Card counts per art row can overlap. A shared effect is counted once per object and once in the catalogue totals.

## Duplicate names by previous title

| Previous name | Cards before | Distinct names after | Two resulting names |
|---|---:|---:|---|
| Pale particles | 879 | 879 | Meat Wagon — Attack/Missile · pale particles / Forgotten One · pale particles · T Forgotten One |
| Golden particles | 483 | 483 | Rock Chunks — variation 1 · golden smoke · tilesets g / Rock Chunks — variation 2 · golden smoke · tilesets g |
| Unavailable particle | 348 | 348 | Stampede — special · teen · 02 / Stampede — special · teen · 03 |
| Pale particle burst | 341 | 341 | Hydralisk — Attack/Missile · pale particle burst / Meat Wagon — Attack/Missile · pale particle burst · Blood Splash |
| Red particles | 322 | 322 | Sundering Blades — caster · red glow / Item Attack Fire Bonus — target |
| Ribbon trail | 311 | 311 | Banish — buff target · ribbon trail · smaller · short-lived / Banish — buff target · ribbon trail · smaller · long-lived |
| Golden particle burst | 269 | 269 | Sundering Blades — caster · golden particle burst / Purification Caster · golden particle burst |
| Pale streaks | 237 | 237 | Revenge — special · pale streaks · short-lived / Revenge — special · pale streaks · long-lived |
| Blue particles | 227 | 227 | Blue Drake · blue smoke / Cloud — buff effect · blue smoke |
| Pale particles group | 161 | 161 | Meat Wagon — Attack/Missile · layered · Blood Sput Teen / Forgotten One · layered · T Forgotten One |
| Golden streaks | 150 | 150 | Dark Conversion (Malganis) — buff effect / Slow — buff target |
| Blue streaks | 150 | 150 | Detonate — target / Storm Bolt — missile · blue streaks |
| Ribbon trail group | 107 | 107 | Invisibility — target · layered / Resurrection — target · layered |
| Golden particles group | 102 | 102 | Mana Flare — buff target · layered / Mana Shield — buff target · layered |
| Unavailable particle group | 95 | 95 | Stampede — special · layered · teen / Banish — buff target · layered |
| Red streaks | 95 | 95 | Mark Of Chaos Done · red streaks / Phoenix — special · red streaks |
| Green particles | 70 | 70 | Feedback (Arcane Tower) — special / Flame Strike — special · green particles · flamestrike |
| Model particles | 65 | 65 | Flying Sheep · burst · T Flying Sheep / Blue Drake · burst · lower |
| Pale particle burst group | 65 | 65 | Flying Sheep · layered · T Flying Sheep / Vulture · layered · teen |
| Pale streaks group | 63 | 63 | Revenge — special · layered · pale streaks / Dog — Death/Special · layered · pale streaks |
| Red particles group | 52 | 52 | Burning Oil — buff effect · layered / Ancestral Spirit — caster · layered |
| Purple streaks | 45 | 45 | Item Attack Corruption Bonus — target / Shadow Orb Ability — target |
| Red particle burst | 44 | 44 | Volcano — buff missile · red particle burst · smaller / Volcano — buff missile · red particle burst · firering |
| Blue particle burst | 43 | 43 | Blizzard — buff effect · blue particle burst / Hex — special · blue particle burst |
| Golden particle burst group | 40 | 40 | Sundering Blades — caster · layered / Chimaera Acid Target Art · layered |
| Green streaks | 36 | 36 | Item Attack Poison Bonus — missile · green streaks / Ritual Dagger (Regenerate) — target · front |
| Blue particles group | 34 | 34 | Blue Drake · layered / Cloud — buff effect · layered |
| Purple particles | 27 | 27 | Invisibility — target · purple particles / Mass Teleport — area · purple smoke · upper |
| Blue streaks group | 24 | 24 | Powerup Dispel — effect · layered / Tome of Retraining — caster · layered |
| Red streaks group | 18 | 18 | Summoning Ritual — caster · layered / Doom — buff target · layered |
| Golden streaks group | 17 | 17 | Item Lich Orb — effect · layered / Mind Control — buff special · layered |
| Red particle burst group | 13 | 13 | Rain of Fire — buff effect · layered / Volcano — buff missile · layered |
| Green particles group | 13 | 13 | Blink — special · layered / Entangling Roots — buff target · layered |
| Purple streaks group | 13 | 13 | Starfall — buff effect · layered / Tranquility — buff effect · layered |
| Blue particle burst group | 10 | 10 | Hex — special · layered / Polymorph — effect · layered |
| Green streaks group | 9 | 9 | Item Attack Poison Bonus — missile · layered / Ritual Dagger (Regenerate) — target · layered |
| Green particle burst | 7 | 7 | Possession (Channeling) — missile / Locust Missile · green particle burst |
| Model particles group | 7 | 7 | Poison Sting Missile · layered / Chimaera · layered |
| Purple particle burst | 4 | 4 | Item Attack Frost Bonus — missile · purple particle burst / Power Generator · purple particle burst |
| Purple particles group | 2 | 2 | Fountain of Health · layered / Fountain of Mana · layered |

## Verification

[PR #491](https://github.com/UnsctMagic/MDLxL/pull/491) is open into main. The full source suite passed 2,629 with 10 skipped, compatibility passed 57, and 70 focused source tests passed. The hidden portable app resumed a real 1,450-model partial extraction to all 3,501 candidates. Ten reopens to 144 cards took 436–615 ms in the isolated run, with 138 picture previews at completion. A parallel full-suite run exceeded the scan-completion deadline. The unchanged three-second interaction limit passed. Disconnect, independent preset copies, 72-thumbnail refresh retention, model I/O, mouse picking and rotation, and the six travel checks were also exercised.

Stopping a real scan retained 1,196 linked objects in the saved partial catalogue, a matching cache revision, and the original sampled recipe bytes. The real click-through loads `wc3-d5984f6b9d30103fa72ecb34` from Abomination → Disease Cloud → Target, then adds it to a disposable model. The source game and the owner's MDLxL profile were read-only inputs. Only enUS was installed for this run. Localized fixtures cover alternate strings. Warcraft III gameplay was not run.
