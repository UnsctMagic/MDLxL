# Warcraft III SD reference study

Study date: 24 October 2026. This study grounds the [shared AI rulebook](AI-SD-RULEBOOK.md) in actual model data and read-only rendered comparisons. The numbers describe references; they are not automatic cleanup targets or proof that an AI will always make the right artistic decision.

## Coverage and selection

- The installed Warcraft III CASC lists 15,090 model entries. Removing HD and Definitive Edition modules leaves **3,501 SD/base entries**, including regional and tileset variants. They contain **3,448 distinct model byte streams** and 53 aliases. Every entry was read; all distinct models parsed successfully with MDLxL's compatibility reader. The installed build is identified by the metadata SHA-256 in the [study data](AI-SD-STUDY-DATA.json). Historical models absent from this build are outside that coverage.
- Hive references are the **first 100 resources in Hive's native highest-rating order**, with the Classic SD and approved filters. Six ranking pages were captured to preserve the selection; only the first 100 were used. Their packs and variants contain **705 distinct model files**, all parsed successfully. A pack counts as one rated resource, not dozens of independent endorsements. Ratings range from **4.79487 to 5/5**, with **24 to 174 votes** per resource. Hive's ranking is not a simple descending re-sort of the displayed star averages.
- The combined structural corpus contains **4,153 unique models**. Geometry, visible-geoset estimates, bindings, materials, texture references, sequence intervals, interpolation and key counts were inspected. Native referenced texture headers were read for 2,093 textures; 218 of 2,311 references were unresolved by the local reader. Supplied Hive image/texture files were also inventoried separately from in-game references.
- A visual sample attempted 128 Blizzard references spread across unit, building, doodad, effect, portrait, item and UI path families, plus one representative from each Hive resource. **127 Blizzard and all 100 Hive representatives rendered** through MDLxL's actual Warcraft renderer and compatibility adapter. Three-quarter, game-angle and topology views were inspected. **32 Walk clips were sampled at six phases** (192 poses). The first two known-good models were used to verify the capture setup before completing the corpus.

## Measured reference ranges

These are whole-model triangle totals. Families come from Blizzard paths or Hive tags and can include supporting parts, variants, corpses and LODs. The unit family also includes heroes and some supporting unit assets. Hive packs contribute unequal numbers of files. Choose a comparable individual reference and inspect the live visible body before using any number as a budget.

| Family | Blizzard files | Blizzard median / P90 triangles | Hive files | Hive median / P90 triangles |
|---|---:|---:|---:|---:|
| unit | 405 | 476 / 804 | 194 | 907.5 / 2127.1 |
| building | 163 | 362 / 1295.8 | 174 | 1869.5 / 5766.2 |
| doodad | 1693 | 54 / 298.8 | 20 | 1253 / 4491.4 |
| effect | 439 | 20 / 153.6 | 187 | 50 / 1282 |
| portrait | 343 | 301 / 436.4 | 35 | 447 / 774.4 |
| item | 22 | 83.5 / 135.0 | 94 | 233 / 484.5 |

Native unit-family models have a median of **421 geoset-alpha-visible Stand triangles** at the sampled start frame, compared with 476 total triangles; the P90 visible estimate is 619, compared with 804 total. This is one reason a whole-file count is a poor substitute for inspecting the part being edited. The source itself remains the first comparator.

Examples from the catalogue: Footman 372 total triangles, Archer 449, Hero Paladin 454, Tauren 476, Crypt Fiend 572 and Grunt 688. These coexist with more elaborate SD works in the Hive set, including the Royal Captain, The Lich King and Mo'arg Overlord. The lesson is an intentional detail budget matched to a role and project, not a universal ban on a particular triangle count.

Native unit-family bone count has a median of 34 and P90 about 67, but individual authored rigs are much larger. **836 native models** use multi-bone matrix groups. **2,731 native models** contain coincident positions within a geoset. Those measurements do not label the data defective: shared positions can carry different normals, UVs or bindings. They support preserving authored seams and testing deformations before welding or rebuilding.

Among resolved native texture headers, 256x256 is the most frequent individual size (673), followed by 64x64 (274), 16x16 (266), 128x128 (212), 32x32 (154), 512x512 (144) and 512x256 (94). The full corpus includes UI, effects and cinematic assets; these are observed sizes, not one required resolution. All 705 Hive model files use MDX 800 and none contains the measured normal/ORM/emissive texture-slot additions. The current native SD/base files mostly use version 1800 and some use weighted skinning. Eleven cinematic models in the base module contain additional material slots. Therefore neither file version nor every file in a base module should be treated as an art-style classifier.

## Animation economy

Across native unit-family sequences, median duration and median keys per active track are approximately:

| Sequence family | Clips | Median duration | Median keys per active track |
|---|---:|---:|---:|
| Stand | 1,405 | 1,833 ms | 4 |
| Walk | 533 | 933 ms | 5 |
| Attack | 622 | 1,000 ms | 6 |
| Death | 439 | 2,133 ms | 7 |

For each clip, the median is first taken across its active tracks; the table then takes the median of those per-clip medians. Constant and visibility tracks can have one key. They do not prescribe the number of limb keys required for a new action. All sampled catalogue Walk sequences are looping; all Death sequences are non-looping; most Attack sequences are non-looping. Existing exceptions and authored flags must be preserved unless changing them is requested. Decay sequences commonly last 60,000 ms, which is an engine/workflow behavior rather than a reason to stretch an unrelated action to a minute.

The pose comparisons show strong readable limb placements, substantial stride/weight shifts, held weapon identity, and controlled asymmetric character. Sparse interpolation is common even in expressive motion. A repair should sample support/impact and the loop seam, then correct the deficient keys; replacing an entire clip with dense generic motion can erase the character being preserved.

## Visual findings and modeling consequences

The following are qualitative judgments from the rendered references, not facts proven by polygon statistics alone.

1. **Large readable forms come first.** Footman, Grunt, Tauren and the hero silhouettes identify armor/weapon/role at the small game-angle view. Exaggerated masses and purposeful empty space matter more than anatomically conventional proportions. Preserve the user's authored proportions.
2. **Texture carries much of the surface information.** Native roofs, wood panels, armor edges and clothing folds often read as paint on economical shapes. Many of the highly rated custom works extend this language with more geometry while retaining bold material blocks. A request to improve detail is not automatic permission to add PBR, photographic noise or geometry for every painted mark.
3. **Silhouette edges and deformation loops justify geometry.** Leaf cards, wings, cloth and weapon edges use intentional economical surfaces. Thin planes and hard normal splits are not automatically errors requiring volume, subdivision or smoothing.
4. **Different roles have different economies.** A projectile, item, hero, city building, rock and portrait should not inherit the same count limit, rig or sequence checklist. Tiny billboard/ribbon meshes can make rich effects; a portrait can be a partial body with framing geometry that looks strange in a world camera.
5. **Game identity includes mechanics.** Team-color masks, hero-glow planes, event markers, attachments, birth/death/decay visibility and texture paths contribute to the asset's behavior. Preserve them even when they are not the primary part being edited.
6. **Highly rated is a reference quality filter, not a command to add everything.** The top list includes elaborate castles, visual effects and science-fiction subjects. Their efficient techniques can be studied without copying an unrelated genre, ornament density or effect scale into a Warcraft unit. Source/project art direction still wins.
7. **Advanced authoring tools remain useful.** IK, math and procedural operations can produce efficient SD data. The restriction is on unrequested complexity and a mismatched result, not on the sophistication of the tool used internally.

## Examples the rulebook should guide

| User asks | SD-oriented response |
|---|---|
| Mirror these vertices and weld the seam | Use the captured selection; preserve other geometry and compatible UV/normal/binding boundaries; verify the requested seam and one-step Undo. |
| Make this armor smoother | Inspect shading versus silhouette first. Correct the requested normals or local shape; do not assume subdivision and global beveling are wanted. |
| Add a decorative emblem | Match the existing diffuse/UV language and view scale; add geometry when the requested silhouette or depth needs it. |
| Fix this Walk | Preserve stride/timing and unrelated tracks; inspect contacts and intermediate poses; change the sparse keys that cause the defect. |
| Make this closer to SD | Compare a suitable unit/building/effect reference; explain the specific mismatches and make the requested changes without normalizing every authored feature. |
| Target a legacy Warcraft version | Verify MDX/texture support for that target. A modern-format SD input should not be silently rewritten to 800 merely because it is visually SD. |

## Limits of the evidence

- Visual inspection is a stratified sample, not a visual review of every one of the 4,153 models. Structural analysis covers the complete listed SD/base catalogue and every model in the chosen 100 Hive resources.
- One native wood-bridge model could not render in the research renderer because a texture lookup reached an undefined entry. Its structural data remains in the catalogue; the source was not repaired or changed.
- Eighteen Hive representatives refer to legacy in-game textures unavailable through the local reader, including Clouds8x8 and older water frames. Their resolved geometry/materials can be inspected, but missing smoke/water must not be accepted as a faithful finished effect. There were no texture decode errors in the final rendered sample.
- The images use individually fitted neutral cameras and a dark background. They do not prove common world scale, ground integration, glow brightness on terrain, authored portrait framing, complete effect timing or Warcraft gameplay behavior. UI models and engine-supplied replaceable surfaces were not used as painted-character appearance exemplars.
- Ratings are a dated site snapshot and can change. The ranking and model SHA-256 identities are retained in the data. Study downloads are not redistributed as part of the rulebook.
- The shared rulebook supplies instructions; different agents can still make different judgments. MDLxL's existing scope, validation, review and Undo mechanisms remain necessary.

## Primary references

The model data itself is the primary evidence. Hive's [Classic SD highest-rating listing](https://www.hiveworkshop.com/repositories/classic-sd-models.530/?order=rating&state%5Bapproved%5D=1) supplies the ranked selection. Hive also explicitly distinguishes SD graphics from legacy-only compatibility in its [resource rules](https://www.hiveworkshop.com/threads/resource-submission-rules-models-skins-icons-spells-systems.237333/) and [SD texture compatibility discussion](https://www.hiveworkshop.com/threads/universal-local-fog-glow-shadow-as-a-prop.358900/). The policy interpretations above come from this study; they are not presented as Blizzard's official art manual.

### The 100 selected Hive resources

Listed author is the ranking card's primary author field; each source page retains its complete credits. Model counts include portraits/variants contained in the resource.

| Hive rank | Resource | Listing author | Stars | Votes | Model files studied |
|---:|---|---|---:|---:|---:|
| 1 | [Skeleton Warriors (pack I) ](https://www.hiveworkshop.com/threads/skeleton-warriors-pack-i.336636/) | Villagerino | 5 | 74 | 26 |
| 2 | [Wight & Spell Models ](https://www.hiveworkshop.com/threads/wight-spell-models.341155/) | Villagerino | 5 | 68 | 9 |
| 3 | [Lindormr Dragon ](https://www.hiveworkshop.com/threads/lindormr-dragon.52050/) | olofmoleman | 4.94545 | 110 | 2 |
| 4 | [Old God Pack ](https://www.hiveworkshop.com/threads/old-god-pack.334166/) | Explobomb | 5 | 67 | 9 |
| 5 | [ChaosCitadel ](https://www.hiveworkshop.com/threads/chaoscitadel.95534/) | HappyTauren | 4.96104 | 77 | 1 |
| 6 | [Arch Angel - Elenai. ](https://www.hiveworkshop.com/threads/arch-angel-elenai.50740/) | General Frank | 4.90323 | 124 | 2 |
| 7 | [Mo'arg Overlord ](https://www.hiveworkshop.com/threads/moarg-overlord.295043/) | Murlocologist | 5 | 55 | 1 |
| 8 | [The Lich King ](https://www.hiveworkshop.com/threads/the-lich-king.154837/) | Kwaliti | 4.87931 | 174 | 2 |
| 9 | [Lordaeron Buildings ](https://www.hiveworkshop.com/threads/lordaeron-buildings.341580/) | bakr | 5 | 52 | 13 |
| 10 | [Gilneas Buildings ](https://www.hiveworkshop.com/threads/gilneas-buildings.336977/) | bakr | 5 | 51 | 16 |
| 11 | [Icons to Models Pack ](https://www.hiveworkshop.com/threads/icons-to-models-pack.316803/) | Kenathorn | 4.98214 | 56 | 94 |
| 12 | [Deadeye ](https://www.hiveworkshop.com/threads/deadeye.113615/) | Tarrasque | 4.93506 | 77 | 1 |
| 13 | [Gul'dan ](https://www.hiveworkshop.com/threads/guldan.295598/) | Tauer | 5 | 48 | 1 |
| 14 | [Khadgar ](https://www.hiveworkshop.com/threads/khadgar.341596/) | Tauer | 5 | 47 | 3 |
| 15 | [Skeleton Fire Warior Mage ](https://www.hiveworkshop.com/threads/skeleton-fire-warior-mage.65646/) | HappyTauren | 4.90667 | 75 | 1 |
| 16 | [Kilrogg Deadeye ](https://www.hiveworkshop.com/threads/kilrogg-deadeye.341964/) | Tauer | 5 | 43 | 1 |
| 17 | [Deathwing ](https://www.hiveworkshop.com/threads/deathwing.200374/) | Kwaliti | 4.91176 | 68 | 2 |
| 18 | [Demonic Brethren (pack I) ](https://www.hiveworkshop.com/threads/demonic-brethren-pack-i.337930/) | Villagerino | 5 | 41 | 5 |
| 19 | [Anduin Lothar ](https://www.hiveworkshop.com/threads/anduin-lothar.286783/) | Tauer | 4.93103 | 58 | 1 |
| 20 | [Dwarven Buildings (Bronzebeard) ](https://www.hiveworkshop.com/threads/dwarven-buildings-bronzebeard.338590/) | bakr | 4.9434 | 53 | 15 |
| 21 | [Ratling Gunner ](https://www.hiveworkshop.com/threads/ratling-gunner.313020/) | Gluma | 4.97727 | 44 | 2 |
| 22 | [GrommashHellscream ](https://www.hiveworkshop.com/threads/grommashhellscream.262156/) | Tauer | 4.97727 | 44 | 3 |
| 23 | [Prime Matron ](https://www.hiveworkshop.com/threads/prime-matron.125142/) | dickxunder | 4.89855 | 69 | 1 |
| 24 | [Garrosh ](https://www.hiveworkshop.com/threads/garrosh.262422/) | Tauer | 5 | 39 | 1 |
| 25 | [Alleria Windrunner ](https://www.hiveworkshop.com/threads/alleria-windrunner.341592/) | Tauer | 4.97674 | 43 | 1 |
| 26 | [Doom Lord ](https://www.hiveworkshop.com/threads/doom-lord.334164/) | Explobomb | 5 | 37 | 2 |
| 27 | [Icecrown Overlord ](https://www.hiveworkshop.com/threads/icecrown-overlord.48381/) | General Frank | 4.91071 | 56 | 1 |
| 28 | [Turalyon ](https://www.hiveworkshop.com/threads/turalyon.341590/) | Tauer | 4.975 | 40 | 1 |
| 29 | [Zandalari Throne of War ](https://www.hiveworkshop.com/threads/zandalari-throne-of-war.345255/) | frostwhisper | 5 | 36 | 2 |
| 30 | [Kultiras Buildings ](https://www.hiveworkshop.com/threads/kultiras-buildings.328594/) | bakr | 4.93617 | 47 | 13 |
| 31 | [Flamestrike ](https://www.hiveworkshop.com/threads/flamestrike.327490/) | Vinz | 4.97436 | 39 | 16 |
| 32 | [Danath Trollbane ](https://www.hiveworkshop.com/threads/danath-trollbane.341594/) | Tauer | 4.97368 | 38 | 1 |
| 33 | [Demonic Brethren (pack II) ](https://www.hiveworkshop.com/threads/demonic-brethren-pack-ii.341724/) | Villagerino | 5 | 34 | 9 |
| 34 | [Ember Forge & Ember Knight ](https://www.hiveworkshop.com/threads/ember-forge-ember-knight.318735/) | Vinz | 5 | 34 | 3 |
| 35 | [Arthas/Nerzhul merge - Lich king Arthas ](https://www.hiveworkshop.com/threads/arthas-nerzhul-merge-lich-king-arthas.90625/) | General Frank | 4.79487 | 117 | 2 |
| 36 | [Divine Golem (variative) ](https://www.hiveworkshop.com/threads/divine-golem-variative.337087/) | Villagerino | 4.97222 | 36 | 4 |
| 37 | [Tauren Buildings ](https://www.hiveworkshop.com/threads/tauren-buildings.328637/) | bakr | 4.97143 | 35 | 9 |
| 38 | [Medieval  Trebuchet ](https://www.hiveworkshop.com/threads/medieval-trebuchet.48314/) | olofmoleman | 4.92683 | 41 | 1 |
| 39 | [WotLK - Forsaken Plague Catapult ](https://www.hiveworkshop.com/threads/wotlk-forsaken-plague-catapult.345739/) | kangyun | 5 | 31 | 2 |
| 40 | [Armor Penetration / Stimulus ](https://www.hiveworkshop.com/threads/armor-penetration-stimulus.328873/) | Vinz | 5 | 31 | 12 |
| 41 | [Cosmic Elven Wings ](https://www.hiveworkshop.com/threads/cosmic-elven-wings.315167/) | Vinz | 5 | 31 | 10 |
| 42 | [Void Missiles ](https://www.hiveworkshop.com/threads/void-missiles.313156/) | Vinz | 5 | 31 | 12 |
| 43 | [Cho'gall ](https://www.hiveworkshop.com/threads/chogall.295776/) | Tauer | 5 | 31 | 1 |
| 44 | [Stormwind Buildings ](https://www.hiveworkshop.com/threads/stormwind-buildings.342290/) | bakr | 4.97059 | 34 | 12 |
| 45 | [Starfall Empire ](https://www.hiveworkshop.com/threads/starfall-empire.319375/) | Vinz | 4.97059 | 34 | 24 |
| 46 | [Beholder ](https://www.hiveworkshop.com/threads/beholder.217410/) | SuPa- | 4.97059 | 34 | 1 |
| 47 | [Alterac Buildings ](https://www.hiveworkshop.com/threads/alterac-buildings.337484/) | bakr | 4.94595 | 37 | 13 |
| 48 | [NuclearExplosion ](https://www.hiveworkshop.com/threads/nuclearexplosion.51829/) | WILL THE ALMIGHTY | 4.94595 | 37 | 1 |
| 49 | [Kurdran and Sky'ree ](https://www.hiveworkshop.com/threads/kurdran-and-skyree.341595/) | Tauer | 5 | 30 | 2 |
| 50 | [Rhapsody ](https://www.hiveworkshop.com/threads/rhapsody.341198/) | Villagerino | 5 | 30 | 1 |
| 51 | [Kultiras Structures and Doodads ](https://www.hiveworkshop.com/threads/kultiras-structures-and-doodads.338876/) | bakr | 5 | 30 | 20 |
| 52 | [Mars the Impaler ](https://www.hiveworkshop.com/threads/mars-the-impaler.336494/) | Jab1z | 5 | 30 | 3 |
| 53 | [Eternity's Crown (1.32) ](https://www.hiveworkshop.com/threads/eternitys-crown-1-32.334147/) | Vinz | 5 | 30 | 1 |
| 54 | [Void Teleport ](https://www.hiveworkshop.com/threads/void-teleport.315971/) | Vinz | 5 | 30 | 27 |
| 55 | [Skaven Clanrat ](https://www.hiveworkshop.com/threads/skaven-clanrat.309120/) | Gluma | 5 | 30 | 1 |
| 56 | [Soul Harvester Scythe ](https://www.hiveworkshop.com/threads/soul-harvester-scythe.276681/) | Blood Raven | 5 | 30 | 1 |
| 57 | [Animated Sky Sphere ](https://www.hiveworkshop.com/threads/animated-sky-sphere.295243/) | ILH | 5 | 29 | 8 |
| 58 | [Durotan ](https://www.hiveworkshop.com/threads/durotan.268006/) | Tauer | 5 | 29 | 1 |
| 59 | [Diablo III: King Leoric ](https://www.hiveworkshop.com/threads/diablo-iii-king-leoric.224358/) | HappyTauren | 5 | 29 | 2 |
| 60 | [Dwarven Buildings (Wildhammer) ](https://www.hiveworkshop.com/threads/dwarven-buildings-wildhammer.339361/) | bakr | 4.94286 | 35 | 12 |
| 61 | [Stromgarde Buildings ](https://www.hiveworkshop.com/threads/stromgarde-buildings.337746/) | bakr | 4.9 | 40 | 12 |
| 62 | [Legends of Arkain - GoldenGuard bundle ( OLD ) ](https://www.hiveworkshop.com/threads/legends-of-arkain-goldenguard-bundle-old.337410/) | Rhapsodie | 4.96774 | 31 | 21 |
| 63 | [Windwalk ](https://www.hiveworkshop.com/threads/windwalk.323748/) | Vinz | 5 | 28 | 5 |
| 64 | [Coup de Grace ](https://www.hiveworkshop.com/threads/coup-de-grace.315537/) | Vinz | 5 | 28 | 5 |
| 65 | [HeroGlow ](https://www.hiveworkshop.com/threads/heroglow.129462/) | assasin_lord | 4.85417 | 48 | 1 |
| 66 | [Swordmaster & Dueler ](https://www.hiveworkshop.com/threads/swordmaster-dueler.339820/) | Villagerino | 4.93939 | 33 | 5 |
| 67 | [Dwarven Buildings (Dark Iron) ](https://www.hiveworkshop.com/threads/dwarven-buildings-dark-iron.344306/) | bakr | 4.96667 | 30 | 15 |
| 68 | [Detheroc ](https://www.hiveworkshop.com/threads/detheroc.335229/) | Ustanak | 4.96667 | 30 | 2 |
| 69 | [Sweep Attachments ](https://www.hiveworkshop.com/threads/sweep-attachments.333560/) | Hate | 4.96667 | 30 | 42 |
| 70 | [Culling Slash ](https://www.hiveworkshop.com/threads/culling-slash.315815/) | Vinz | 5 | 27 | 8 |
| 71 | [Footmen and Captains (Re-Classic Pack) ](https://www.hiveworkshop.com/threads/footmen-and-captains-re-classic-pack.338588/) | johnwar | 4.96552 | 29 | 13 |
| 72 | [Assorted City Buildings ](https://www.hiveworkshop.com/threads/assorted-city-buildings.336823/) | bakr | 4.96552 | 29 | 5 |
| 73 | [Royal Captain ](https://www.hiveworkshop.com/threads/royal-captain.108101/) | Tranquil | 4.8 | 60 | 2 |
| 74 | [Gnome Tinker - Gunstrider ](https://www.hiveworkshop.com/threads/gnome-tinker-gunstrider.361641/) | Villagerino | 5 | 26 | 6 |
| 75 | [Hero Troll Godslayer ](https://www.hiveworkshop.com/threads/hero-troll-godslayer.345981/) | PROXY | 5 | 26 | 2 |
| 76 | [DotA1: Zeus (Lord of Olympus) ](https://www.hiveworkshop.com/threads/dota1-zeus-lord-of-olympus.341085/) | Jab1z | 5 | 26 | 3 |
| 77 | [Revenant Covenant ](https://www.hiveworkshop.com/threads/revenant-covenant.332680/) | Rhapsodie | 5 | 26 | 7 |
| 78 | [Mecha-CL ](https://www.hiveworkshop.com/threads/mecha-cl.330617/) | Jab1z | 5 | 26 | 11 |
| 79 | [Valiant Charge ](https://www.hiveworkshop.com/threads/valiant-charge.315129/) | Vinz | 5 | 26 | 5 |
| 80 | [Villager ](https://www.hiveworkshop.com/threads/villager.64141/) | .KC | 5 | 26 | 2 |
| 81 | [Lightning Elemental ](https://www.hiveworkshop.com/threads/lightning-elemental.99584/) | Tarrasque | 4.87179 | 39 | 2 |
| 82 | [Scarlet Monastery ](https://www.hiveworkshop.com/threads/scarlet-monastery.339122/) | HerrDave | 4.96429 | 28 | 1 |
| 83 | [Fire Missiles ](https://www.hiveworkshop.com/threads/fire-missiles.313049/) | Vinz | 4.96429 | 28 | 12 |
| 84 | [Clifford ](https://www.hiveworkshop.com/threads/clifford.337765/) | tillinghast | 5 | 25 | 3 |
| 85 | [Hellstone Golem ](https://www.hiveworkshop.com/threads/hellstone-golem.336159/) | Villagerino | 5 | 25 | 2 |
| 86 | [Elemental Lord ](https://www.hiveworkshop.com/threads/elemental-lord.335587/) | frostwhisper | 5 | 25 | 1 |
| 87 | [Ubershield ](https://www.hiveworkshop.com/threads/ubershield.332057/) | Vinz | 5 | 25 | 24 |
| 88 | [Ogron ](https://www.hiveworkshop.com/threads/ogron.330520/) | Explobomb | 5 | 25 | 3 |
| 89 | [Valeera Sanguinar ](https://www.hiveworkshop.com/threads/valeera-sanguinar.296006/) | A.R. | 5 | 25 | 2 |
| 90 | [Arthas Menethil (Re-Classic) ](https://www.hiveworkshop.com/threads/arthas-menethil-re-classic.341574/) | johnwar | 4.93333 | 30 | 2 |
| 91 | [Forsaken Dread Guard ](https://www.hiveworkshop.com/threads/forsaken-dread-guard.339527/) | kangyun | 4.90625 | 32 | 2 |
| 92 | [Night Elf Blademistress ](https://www.hiveworkshop.com/threads/night-elf-blademistress.364399/) | Nyctaeus | 5 | 24 | 1 |
| 93 | [Goblin Emperor ](https://www.hiveworkshop.com/threads/goblin-emperor.337580/) | tillinghast | 5 | 24 | 1 |
| 94 | [Dragonbone Golem (variative) ](https://www.hiveworkshop.com/threads/dragonbone-golem-variative.335016/) | Villagerino | 5 | 24 | 4 |
| 95 | [Rain of Fire Vol. II ](https://www.hiveworkshop.com/threads/rain-of-fire-vol-ii.315904/) | Vinz | 5 | 24 | 2 |
| 96 | [Stormfall ](https://www.hiveworkshop.com/threads/stormfall.314787/) | Vinz | 5 | 24 | 6 |
| 97 | [Varok Saurfang ](https://www.hiveworkshop.com/threads/varok-saurfang.302902/) | Ustanak | 5 | 24 | 2 |
| 98 | [Footman, Captain, and Derivatives ](https://www.hiveworkshop.com/threads/footman-captain-and-derivatives.300263/) | Ujimasa Hojo | 5 | 24 | 15 |
| 99 | [Brutal Lord ](https://www.hiveworkshop.com/threads/brutal-lord.204070/) | Tarrasque | 5 | 24 | 1 |
| 100 | [Spellbringers: Mad Scientist ](https://www.hiveworkshop.com/threads/spellbringers-mad-scientist.336981/) | General Frank | 4.96154 | 26 | 3 |
