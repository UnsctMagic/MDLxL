# EMTR Particle Library browsing

Owner correction round applied. Codex, 1 November 2026. Branch `codex/emtr-library-browse`, based on `f75e407def9badcee9e7080a8d0b050433c85879`. Merge requires owner approval.

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

The 14 remaining numbered fallbacks are blocked cinematic records with identical source and authored emitter names. All readable recipes have evidence-based names. Some sibling names share a stem and differ by an authored layer, game variation or measured value. Generated titles now lead with the existing appearance phrase, with origin and variant evidence after it. The table below excludes the 34 preserved reviewed names and was regenerated from the same 5,032-card catalogue after the owner correction.

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
| Pale particles | 879 | 879 | Pale particles · Meat Wagon — Attack/Missile / Pale particles · Forgotten One · T Forgotten One |
| Golden particles | 483 | 483 | Golden smoke · Rock Chunks — variation 1 · tilesets g / Golden smoke · Rock Chunks — variation 2 · tilesets g |
| Unavailable particle | 348 | 348 | Unavailable particle · Stampede — special · teen · 02 / Unavailable particle · Stampede — special · teen · 03 |
| Pale particle burst | 341 | 341 | Pale particle burst · Hydralisk — Attack/Missile / Pale particle burst · Meat Wagon — Attack/Missile · Blood Splash |
| Red particles | 322 | 322 | Red glow · Sundering Blades — caster / Red smoke · Item Attack Fire Bonus — target |
| Ribbon trail | 311 | 311 | Ribbon trail · Banish — buff target · smaller · short-lived / Ribbon trail · Banish — buff target · smaller · long-lived |
| Golden particle burst | 269 | 269 | Golden particle burst · Sundering Blades — caster / Golden particle burst · Purification Caster |
| Pale streaks | 237 | 237 | Pale streaks · Revenge — special · short-lived / Pale streaks · Revenge — special · long-lived |
| Blue particles | 227 | 227 | Blue smoke · Blue Drake / Blue smoke · Cloud — buff effect |
| Pale particles group | 161 | 161 | Pale burst · Meat Wagon — Attack/Missile · layered · Blood Sput Teen / Pale smoke · Forgotten One · layered · T Forgotten One |
| Golden streaks | 150 | 150 | Golden streaks · Dark Conversion (Malganis) — buff effect / Golden streaks · Slow — buff target |
| Blue streaks | 150 | 150 | Blue streaks · Detonate — target / Blue streaks · Storm Bolt — missile |
| Ribbon trail group | 107 | 107 | Ribbon trail · Invisibility — target · layered / Ribbon trail · Resurrection — target · layered |
| Golden particles group | 102 | 102 | Golden glow · Mana Flare — buff target · layered / Golden glow · Mana Shield — buff target · layered |
| Unavailable particle group | 95 | 95 | Unavailable particle · Stampede — special · layered · teen / Unavailable particle · Banish — buff target · layered |
| Red streaks | 95 | 95 | Red streaks · Mark Of Chaos Done / Red streaks · Phoenix — special |
| Green particles | 70 | 70 | Green particles · Feedback (Arcane Tower) — special / Green particles · Flame Strike — special · flamestrike |
| Model particles | 65 | 65 | Burst · Flying Sheep · T Flying Sheep / Burst · Blue Drake · lower |
| Pale particle burst group | 65 | 65 | Pale particle burst · Flying Sheep · layered · T Flying Sheep / Pale particle burst · Vulture · layered · teen |
| Pale streaks group | 63 | 63 | Pale streaks · Revenge — special · layered / Pale streaks · Dog — Death/Special · layered |
| Red particles group | 52 | 52 | Red smoke · Burning Oil — buff effect · layered / Red glow · Ancestral Spirit — caster · layered |
| Purple streaks | 45 | 45 | Purple streaks · Item Attack Corruption Bonus — target / Purple streaks · Shadow Orb Ability — target |
| Red particle burst | 44 | 44 | Red particle burst · Volcano — buff missile · smaller / Red particle burst · Volcano — buff missile · firering |
| Blue particle burst | 43 | 43 | Blue particle burst · Blizzard — buff effect / Blue particle burst · Hex — special |
| Golden particle burst group | 40 | 40 | Golden particle burst · Sundering Blades — caster · layered / Golden particle burst · Chimaera Acid Target Art · layered |
| Green streaks | 36 | 36 | Green streaks · Item Attack Poison Bonus — missile / Green streaks · Ritual Dagger (Regenerate) — target · front |
| Blue particles group | 34 | 34 | Blue smoke · Blue Drake · layered / Blue smoke · Cloud — buff effect · layered |
| Purple particles | 27 | 27 | Purple particles · Invisibility — target / Purple smoke · Mass Teleport — area · upper |
| Blue streaks group | 24 | 24 | Blue streaks · Powerup Dispel — effect · layered / Blue streaks · Tome of Retraining — caster · layered |
| Red streaks group | 18 | 18 | Red streaks · Summoning Ritual — caster · layered / Red streaks · Doom — buff target · layered |
| Golden streaks group | 17 | 17 | Golden streaks · Item Lich Orb — effect · layered / Golden streaks · Mind Control — buff special · layered |
| Red particle burst group | 13 | 13 | Red particle burst · Rain of Fire — buff effect · layered / Red particle burst · Volcano — buff missile · layered |
| Green particles group | 13 | 13 | Green glow · Blink — special · layered / Green smoke · Entangling Roots — buff target · layered |
| Purple streaks group | 13 | 13 | Purple streaks · Starfall — buff effect · layered / Purple streaks · Tranquility — buff effect · layered |
| Blue particle burst group | 10 | 10 | Blue particle burst · Hex — special · layered / Blue particle burst · Polymorph — effect · layered |
| Green streaks group | 9 | 9 | Green streaks · Item Attack Poison Bonus — missile · layered / Green streaks · Ritual Dagger (Regenerate) — target · layered |
| Green particle burst | 7 | 7 | Green particle burst · Possession (Channeling) — missile / Green particle burst · Locust Missile |
| Model particles group | 7 | 7 | Model particles · Poison Sting Missile · layered / Model particles · Chimaera · layered |
| Purple particle burst | 4 | 4 | Purple particle burst · Item Attack Frost Bonus — missile / Purple particle burst · Power Generator |
| Purple particles group | 2 | 2 | Purple smoke · Fountain of Health · layered / Purple smoke · Fountain of Mana · layered |

## Owner correction — 1 November 2026

Generated names now start with the existing appearance phrase and use the source object only as a qualifier. Browse revision 2 rebuilds the sidecar without rewriting recipes. The copied installed catalogue has 4,998 appearance-first generated names, all 34 hash-verified reviewed names, and zero exact duplicate titles. All 4,591 catalogue/manifest/recipe files stayed byte-identical; a pre-existing user name, favorite and personal preset kept their IDs, state and preset bytes. The table above was regenerated from this run.

World Editor now reads the matching cached tree in missing/changed source states and retains stock, My presets and My work favorites. Without a sidecar, cached stock cards remain browsable and personal favorites use the existing rows. A never-indexed Warcraft view still shows only the short connect-Warcraft status.

Fail-first proof on c4f840c6: appearance assertions received `Heal — target · smoke` / `Slow — buff target · golden streaks`; the old sidecar was incorrectly accepted; hidden packaged offline browsing failed `Disconnected World Editor keeps the cached object cards` (`0 !== 2`). The corrected checks pass. Production build and portable verification passed (1,373 files, 55 locales); focused source 58/58, compatibility 57/57, full source 2,630 passed / 0 failed / 10 existing skips. The unchanged known-failure baseline reports zero new failures. The first full run inherited ESM in scratch helpers because MDLXL_TEMP bypassed their CommonJS marker; using the project's default D: scratch path resolved all 14 setup failures without code edits. Skip reasons remain opt-in private/corpus inputs and Windows symlink/SIGTERM/8.3 limitations.

Hidden portable checks: `particle-library-previews` passed missing/changed saved-tree cards, stock/preset/work favorites, unchanged By type, no-sidecar cards, never-connected messaging, 72 thumbnails, mouse orbit and independent personal opening; `particle-library-browse` passed the real Disease Cloud favorite/search/orbit/placement/Escape workflow. `particle-library-copy` passed independent stock/preset edits, immutable saved presets, draft restart and unchanged model bytes. Warcraft III playback and non-enUS installed game data remain unverified. Evidence: `D:\Codex\emtr-491-correction-report`.

## Earlier verification at c4f840c6

[PR #491](https://github.com/UnsctMagic/MDLxL/pull/491) is open into main. The full source suite passed 2,629 with 10 skipped, compatibility passed 57, and 70 focused source tests passed. The hidden portable app resumed a real 1,450-model partial extraction to all 3,501 candidates. Ten reopens to 144 cards took 436–615 ms in the isolated run, with 138 picture previews at completion. A parallel full-suite run exceeded the scan-completion deadline. The unchanged three-second interaction limit passed. Disconnect, independent preset copies, 72-thumbnail refresh retention, model I/O, mouse picking and rotation, and the six travel checks were also exercised.

Stopping a real scan retained 1,196 linked objects in the saved partial catalogue, a matching cache revision, and the original sampled recipe bytes. The real click-through loads `wc3-d5984f6b9d30103fa72ecb34` from Abomination → Disease Cloud → Target, then adds it to a disposable model. The source game and the owner's MDLxL profile were read-only inputs. Only enUS was installed for this run. Localized fixtures cover alternate strings. Warcraft III gameplay was not run.
