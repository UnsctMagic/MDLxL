# EMTR Particle Library browsing

Placement R1–R9 implemented; ready to test. Codex, 1 November 2026. PR [491](https://github.com/UnsctMagic/MDLxL/pull/491), branch `codex/emtr-library-browse`. No merge or release is authorized.

## Add like ribbons — current placement round

Implemented the [PR #498 R1–R9 contract](emtr-add-like-ribbons.md) from source base a5c5a17e. A Library single-click now feeds the same load-then-place route as stage Add. Selected vertices determine the centre and ribbon-rule bone; a selected bone/helper/attachment supplies the no-vertex fallback. The shared ribbon panel contains Visibility, Create and Cancel. The shared handle follows the actual emitter, including UI scaling; Snap keeps its double-click interaction and binds to the hit face. The existing On model handle and visibility key track remain available. See the linked note for owners and fail-first evidence.

Final hidden packaged P1–P10 **10 / 0 / 0**, five Library workflows **5 / 0 / 0**, source **2,647 / 0 / 10 existing skips**, focused **80 / 0 / 0**, compatibility **57 / 0 / 0**; build/package **1,381 files, 55 locales**. [Results and bundle hashes](../../test/evidence/emtr-add/results.json), [P1](../../test/evidence/emtr-add/P1.png), [P4](../../test/evidence/emtr-add/P4.png), [P5](../../test/evidence/emtr-add/P5.png), [P6](../../test/evidence/emtr-add/P6.png). Prior A27a/A27b evidence below remains valid; no catalogue data or Standard browser contents changed.

D:/Codex/mdlxl-491-particle-review was preserved and not replaced. Ready to test; independent Claude QA, owner acceptance and Warcraft III playback remain pending. Small logs: D:/Codex/mdlxl-491-add-effects-report.

## Owner contents and motion correction (1 November 2026)

The owner rejected the World Editor view's contents (layout itself kept). Binding rules are in [the contract §11.1a, §11.5 and A27a/A27b](../particle-editor/CONTRACT.md#111a-world-editor-view-special-effects-only-each-shown-once).

`src/particle-world-effects.js` now projects special effects into a once-only Warcraft tree: melee before campaign, units/buildings before reusing abilities/items; shallow unit ability/Attack groups; flat Buildings race folders; stock neutral structures under Neutral, while playable shipyards retain their object race; one shared Blood & death folder; no empty or 0-count folders. Unshown associations remain in Details and search. Zero-emitter ability art appears only as search status. The shared GameFileBrowser layout and Standard tree are preserved. A comparison over all 5,032 installed entries found the Standard tree byte-for-byte equivalent.

A27a: `node scripts/verify-particle-world-effects.mjs <copied-profile>` proves 3,595 visible recipes, 469 folders, 213 Blood & death effects, zero repeated IDs, zero empty folders and zero count mismatches. The independent association inventory confirms all 3,595 eligible recipes are present and validates 3,230 first-owner placements. Buildings: Human 200, Orc 107, Night Elf 39, Undead 77, Neutral 751. Priest contains Heal and Dispel Magic; Shaman contains Bloodlust; Fountain of Life variants are Neutral. Before correction the installed tree had 22,068 placements for 5,032 IDs (17,036 repeats) and 1,253 empty folders. No catalogue recipe is removed.

`src/particle-library-motion.js` retains authored movement or adds the existing labeled preview-only sweep to a disposable model. Stage and thumbnails use the same preparation and active sample; the stage frames the path and the still thumbnail frames live geometry. Sampling counts recent births and checks animated opacity, rather than treating instantaneous rate as a living trail. Native preflight now produces live geometry for all 424 readable ribbon recipes. The pinned renderer and authoring simulation incorrectly defaulted KRVS to zero when absent or without keys in a clip. Their runtime default now matches [mdx-m3-viewer KRVS defaults and sequence sampling](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/sd.ts); explicit hidden values stay hidden. A regression fails before correction (`Missing KRVS must emit a visible ribbon`); the real Banish proof changes from 0 to 14 ribbon segments with an identical original recipe.

Browse revision 3 adds ability icons. Revision-2 links/names remain usable offline and during their background upgrade; revision 1 remains invalid. Thumbnail version 7 regenerates motion-aware pictures, including supported ribbons in an explicitly incomplete group. Saved visibility/rate fields, authored motion, personal libraries and export data are preserved.

A27b passes for all **424 readable native ribbon recipes**: changing viewport pixels with an unchanged camera and nonempty gridless thumbnails. The full installed catalogue identifies the corpus; sharded runs narrow only disposable catalogue snapshots, leaving recipe bytes intact. The Archer fail-first on the old bundle reports `changed pixels=0`. Short Tauren attack pulses use synchronized captures of the actual viewport layers, avoiding an asynchronous screenshot that can miss their emission window. Faint authored additive colors use RGB-sum delta >3; earlier checks passed the stricter >24 threshold. Neither color nor alpha is boosted. A short Pit Lord trail exposed full-path still-thumbnail framing (3 significant pixels); live-geometry framing raises it to 36. Native preflight confirms living nondegenerate ribbon geometry for all 424; the existing demonstration isolation regression verifies recipes remain unchanged. An incomplete Medivh ribbon group still renders after its editable tags are replaced.

Final source: **2,640 passed, 0 failed, 10 existing skips**; compatibility **57/57**, unchanged failure baseline. Portable verification: **1,378 files, 55 locales**. All five hidden packaged workflows pass: layout, previews, copy, browse and indexing, with real mouse/keyboard input and actual camera drags. Offline revision-2 names/links/favorites, never-connected messaging, personal presets/drafts, 72 virtual-row thumbnails, source context, Footman placement and scan/cancel/resume are retained. The ten optional-input/Windows skips are listed below. Final captures: [Priest](../../test/evidence/particle-library/priest.png), [Shaman](../../test/evidence/particle-library/shaman.png), [Blood & death](../../test/evidence/particle-library/blood-death.png), [Buildings → Orc](../../test/evidence/particle-library/buildings-orc.png), [Archer ribbon](../../test/evidence/particle-library/archer-ribbon.png). The Archer image uses the existing dark-background preference and real mouse orbit/zoom; the app's background preference is unchanged. [A27a proof](../../test/evidence/particle-library/a27a.json) and [A27b proof](../../test/evidence/particle-library/a27b.json) retain the installed build identity and per-recipe results. Small logs: `D:/Codex/mdlxl-491-effects-report`.

Ready for review; awaiting merge approval. Warcraft III gameplay, non-enUS installed data and owner visual acceptance remain unverified. No merge or release.

## Previous layout round

The owner rejected the separate card layout. ParticleLibrary now supplies catalogue rows, a live particle stage and existing actions to GameFileBrowser. Both it and Models render the same BrowserToolbar, BrowserTree and BrowserFrame: 24-pixel rows, virtual scrolling, game icons, Standard / World Editor Style, arrow keys, Enter and double-click. Standard means By type for particles. Warcraft opens expanded; My presets, My work and Favorites are tree folders. Actions, name/tags and source paths sit below the selected effect. Scan/cancel and Coverage remain in the Library footer.

ParticleWorldBrowser only adapts the existing catalogue into row data. ParticleLibraryStage shares recipe/asset preparation with the thumbnail queue. The recipe files, IDs, appearance names, sidecar revision, service, World Editor catalogue and placement mechanism are unchanged.

Verification used a disposable D: package on the hidden Windows desktop with real mouse and keyboard input. The owner-profile comparison copied settings and personal data, excluding Chromium and regenerated texture caches. The installed app and source profile stayed read-only. The updated layout, browse, previews, copy and indexing checks failed on the old package because `.gf-tree` was absent (0 !== 1). The folder-arrow visibility assertion also failed before correcting EMTR's inherited SVG hiding rule. Search now expands newly arriving matches without reopening folders the user has collapsed. The selected preview uses Lab's existing fit-when-ready callback, followed by normal mouse controls.

Final build/package verification passed (1,372 runtime/asset files, 55 locales). Compatibility: **57 passed, 0 failed, 0 skipped**. Full source: **2,630 passed, 0 failed, 10 existing skips**, with zero new failures against the unchanged baseline. All five final packaged checks passed with zero skips:

- `particle-library-layout`: copied owner profile; main Models comparison; identical row height/font; visible shared arrows/icons; Standard default and expanded Warcraft; ArrowDown through Fire; playing preview and real mouse orbit; double-click Lab.
- `particle-library-browse`: real Disease Cloud path; Left/Right keys; shared favorite; zero-emitter search; source context and Lab mouse orbit; double-click opening; placement on a real Footman; Escape.
- `particle-library-previews`: 72 thumbnails through virtual scrolling, retained thumbnails across progress refresh, repeated preview/Lab round trips, blocked/incomplete suffixes, missing/changed/no-sidecar offline views, personal favorites, offline presets and starter effects.
- `particle-library-copy`: independent stock/preset edits, immutable saved presets, draft restart, rename/tags, duplicate/export/delete for My presets, rename/duplicate/export/open for My work (no Delete), unchanged source model bytes.
- `particle-library-indexing`: cancel/resume on a disposable partial catalogue; background utility; all 3,501 candidates completed; 137 thumbnails across 144 browsed effects; ten reopens **363–445 ms** against the unchanged three-second limit. The measured interaction/scan run took 57.2 seconds.

The ten source skips remain: Windows SIGTERM semantics; opt-in archer armor (`MDLXL_ARCHER`); opt-in broken/rebuilt skin pair; opt-in private Fx; two POSE corpus checks without the optional manifest; opt-in dense twin-head rider; Windows symlink privileges; opt-in Tinker/Brown Magnataur (`MDLXL_SORT_NURGLE`); and no 8.3 short names on this volume. No test or baseline entry was added to suppress a failure.

Screenshots: [rejected layout](../../test/evidence/particle-library/before.png), [shared browser](../../test/evidence/particle-library/after.png), [main Models reference](../../test/evidence/particle-library/models.png). Small logs and evidence: `D:\Codex\mdlxl-491-owner-browser\report`. Warcraft III playback, non-enUS installed data and owner visual acceptance remain unverified; Claude retains final QA ownership.

## Retained data work

The extraction worker joins physical source paths against unit, hero, building, item, doodad and destructible art, including spells, buffs, effects, summoned units and upgrades. An exact installed zero-emitter model takes precedence over a sibling fallback. Other effects retains unlinked recipes. Spell search can show referenced art with no indexed emitters.

The separate browse sidecar covers the install, build, locale, catalogue timestamp and browse schema. User names override reviewed names and generated names. The installed-game evidence below belongs to the earlier data round; it is retained as provenance, not a new extraction claim.

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
