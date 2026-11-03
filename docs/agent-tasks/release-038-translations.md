# 0.38.0 translation catch-up

Status: ready for Claude QA; awaiting merge approval
Owner: Codex; release QA: Claude
Updated: 2026-11-03

## Scope and revision

- Branch: `codex/release-0.38.0-translations`; base: `23126f99` (origin/main including #532).
- Compared `v0.37.2` with the base in `app/*.jsx`, `src/*.js`, and `electron/menu.cjs`.
- Reviewed AST literals, JSX text/attributes, template strings and added-line contexts across 130 surviving changed files (one deleted file has no current UI). Traced data-backed labels to their presentation owners and exercised the actual FX label/menu generation through translate.
- Added 183 Spanish, 189 Russian and 178 Chinese entries. Catalog totals, in ru/es/zh order: 7850 / 7860 / 7719. Preserved existing entries, order and CRLF; appended only missing keys.
- Kept product names and authored values/IDs, menu routing and layout. This task does not merge or package the app.

## Presentation wrappers

- `app/SurfaceEffects.jsx`: translate FX folder/preset display names before GameLibraryRow, which intentionally preserves supplied names.
- `app/GlobalAnimationControls.jsx`: translate the complete Adjust-this-layer and Changes-the-colour templates, substituting the translated type/name before display. Lowercasing the English name first prevented catalog lookup.
- `app/OptimizeXL.jsx`: translate the Box/Sphere presentation word used inside removal tooltip/aria text.
- `app/WorldEditorTree.jsx`: translate folder labels and effect status text inside LibraryTree's presentation span; leaf asset names, paths and detail text retain their existing treatment.
- Other labels, titles, placeholders and aria text already pass through localizedCreateElement; native menus already translate recursively.

## Scan exclusions and existing coverage

- Excluded model collection/property names, persisted node/asset names, imports/paths, SVG paths, math/CSS expressions, keyboard names/chords and AI-only prompts/tool protocol.
- Surface palette names are not displayed: the current controls consume their RGB defaults only. Unused surface descriptions are removed from compiled look metadata and are not shown.
- `Units & characters` and `Paintings & art` already have entries in all three catalogs. JSX decodes `&amp;` before lookup, so no entity-encoded duplicate key was added.
- Existing default-colour tooltip already has all three translations.
- Added explicit decorated menu keys even where the existing punctuation fallback already translated them. Numbered/composite labels use reusable templates, rather than numbered duplicate entries. Retired Lava skin/Dark crust/Molten cracks remain reachable through saved-stack reopening and are covered.

## Verification and handoff

- `npx vite build`: passed (ordinary chunk-size warning).
- `node --test test/localization*.test.js`: 21 passed, 0 failed, 0 skipped.
- `node --test tests/*.test.js`: 57 passed, 0 failed, 0 skipped.
- Before count changes, the existing size assertion failed as expected: expected [7661, 7677, 7541], actual [7847, 7857, 7716]; the subsequent three saved-stack labels brought the final totals above. No checks were weakened.
- Catalog audit verifies no existing key/value changed, all CRLF, matching placeholders, and all current FX names/layer choices/emitter recommendations translated.
- Packaged interaction/visual QA and Warcraft III were not run, as requested. Claude owns release testing; ready to test.
- Next: Claude reviews translations and runs the release checks; merge requires owner approval.

## Added-key inventory

Every new catalog key is listed below. Missing-language columns describe the base catalogs.

| English source / template | Missing languages | Presentation source |
| --- | --- | --- |
| Close add-ons | es, ru, zh | `app/Addons.jsx:14` |
| Loading Surface Effects… | es, ru, zh | `app/AppDialogs.jsx:54` |
| Add to tab… | es, ru, zh | `app/AppDialogs.jsx:61` |
| Hide Geoset | es, ru, zh | `app/AppDialogs.jsx:62` |
| Show Always | es, ru, zh | `app/AppDialogs.jsx:63` |
| Keep this geoset visible when Show all and its selection are off. | es, ru, zh | `app/AppDialogs.jsx:65` |
| Hide this geoset in the view while keeping its number in the list. | es, ru, zh | `app/AppDialogs.jsx:65` |
| Geoset {0} Show Always | es, ru, zh | `app/AppSidebar.jsx:63` |
| Editors | es, ru, zh | `app/AppToolbar.jsx:77` |
| Select collision shape {0} | es, ru, zh | `app/CollisionOverlay.jsx:144` |
| Remove collision shape | es, ru, zh | `app/CollisionOverlay.jsx:155` |
| Torus (%) | es, ru, zh | `app/ForgeShapes.jsx:383` |
| New tab | es, ru, zh | `app/GeosetTabs.jsx:101` |
| Geoset tab actions | es, ru, zh | `app/GeosetTabs.jsx:102` |
| More geoset tabs | es, ru, zh | `app/GeosetTabs.jsx:108` |
| More tabs | es, ru, zh | `app/GeosetTabs.jsx:108` |
| Milliseconds for one full loop. | es, ru, zh | `app/GlobalAnimationControls.jsx:55` |
| Loop length | es, ru, zh | `app/GlobalAnimationControls.jsx:55` |
| Attack | es, ru, zh | `app/GlobalAnimationControls.jsx:57` |
| Attack animation | es, ru, zh | `app/GlobalAnimationControls.jsx:57` |
| Adjust this {0} layer. | es, ru, zh | `app/GlobalAnimationControls.jsx` |
| Add one editable layer to this part. | es, ru, zh | `app/GlobalAnimationControls.jsx:61` |
| Remove the selected layer and the pieces it owns. | es, ru, zh | `app/GlobalAnimationControls.jsx:62` |
| Changes the colour of {0}. | es, ru, zh | `app/GlobalAnimationControls.jsx` |
| How many separate flies circle the part. | es, ru, zh | `app/GlobalAnimationControls.jsx:88` |
| Particles emitted each second across the whole layer. | es, ru, zh | `app/GlobalAnimationControls.jsx:88` |
| How long each particle stays visible. | es, ru, zh | `app/GlobalAnimationControls.jsx:89` |
| How far the flies circle from the part. | es, ru, zh | `app/GlobalAnimationControls.jsx:90` |
| Size of each visible particle. | es, ru, zh | `app/GlobalAnimationControls.jsx:90` |
| Initial speed away from the part. | es, ru, zh | `app/GlobalAnimationControls.jsx:91` |
| Pulls the particles down as they age. | es, ru, zh | `app/GlobalAnimationControls.jsx:92` |
| Complete turns or texture passes within the loop. | es, ru, zh | `app/GlobalAnimationControls.jsx:104` |
| Direction of travel on the surface, in degrees. | es, ru, zh | `app/GlobalAnimationControls.jsx:105` |
| Tiling | es, ru, zh | `app/GlobalAnimationControls.jsx:105` |
| How many times the skin repeats across the part. | es, ru, zh | `app/GlobalAnimationControls.jsx:105` |
| Drag the move handle in the preview. | es, ru, zh | `app/GlobalAnimationControls.jsx:107` |
| Drag the move handle or the edges in the preview. | es, ru, zh | `app/GlobalAnimationControls.jsx:107` |
| Apply this stack and open its selected emitter in the full editor. | es, ru, zh | `app/GlobalAnimationControls.jsx:108` |
| Open in EMTR | es, ru, zh | `app/GlobalAnimationControls.jsx:108` |
| Remove selected collision shape | es, ru, zh | `app/ModelManager.jsx:53` |
| Movement workplane | es, ru | `app/MovementControllerRecomp.jsx:178` |
| Min X | es, ru, zh | `app/OptimizeXL.jsx:33` |
| Min Y | es, ru, zh | `app/OptimizeXL.jsx:33` |
| Min Z | es, ru, zh | `app/OptimizeXL.jsx:33` |
| Max X | es, ru, zh | `app/OptimizeXL.jsx:33` |
| Max Y | es, ru, zh | `app/OptimizeXL.jsx:33` |
| Max Z | es, ru, zh | `app/OptimizeXL.jsx:33` |
| Sphere size | es, ru, zh | `app/OptimizeXL.jsx:179` |
| Remove this collision {0} from the proposal. It is kept only after approval. | es, ru, zh | `app/OptimizeXL.jsx:179` |
| Remove {0} {1} | es, ru, zh | `app/OptimizeXL.jsx:179` |
| Effect added. Drag it to adjust. | es, ru, zh | `app/ParticleEditor.jsx:316` |
| Glow Up | es, ru, zh | `app/ParticleEditor.jsx:336` |
| Add hero glow like Warcraft III heroes: a pulsing team-coloured glow at the feet and along the weapon. | es, ru, zh | `app/ParticleEditor.jsx:336` |
| By type: Fire, Smoke, Sparks, Magic, Glows, Trails, Bursts, Other | es, ru, zh | `app/ParticleLibrary.jsx:95` |
| No matching effects. | es, ru, zh | `app/ParticleLibrary.jsx:96` |
| No effects. | es, ru, zh | `app/ParticleLibrary.jsx:96` |
| Loading effects… | es, ru, zh | `app/ParticleLibrary.jsx:96` |
| Open in Lab | es, ru, zh | `app/ParticleLibrary.jsx:101` |
| Finding World Editor effects… | es, ru, zh | `app/ParticleLibrary.jsx:114` |
| Empty effect | es, ru, zh | `app/ParticleLibraryStage.jsx:14` |
| Choose an effect. | es, ru, zh | `app/ParticleLibraryStage.jsx:14` |
| Add effect | es, ru, zh | `app/ParticlePlacementControls.jsx:6` |
| Effect placement handles | es, ru, zh | `app/ParticlePlacementStage.jsx:32` |
| Pulls the edge/trail down as it fades | es, ru, zh | `app/ParticleRibbonFields.jsx:38` |
| Add an animation first: a burst is placed inside an animation | es, ru, zh | `app/ParticleTimingTool.jsx:13` |
| Show bones and helpers. Right-click to choose Helpers or Bones. | es, ru, zh | `app/QuickDisplay.jsx:8` |
| Show the model colored the way it looks in its Stand animation (geoset colors and fades) | es, ru | `app/QuickDisplay.jsx:8` |
| Bone types | es, ru, zh | `app/QuickDisplay.jsx:24` |
| Removing editor data also removes the editable FX layer list. The enchantment will still play. | es, ru, zh | `app/SaveEditorData.jsx:9` |
| Geoset set | es, ru, zh | `app/Settings.jsx:425` |
| Compact Set | es, ru, zh | `app/Settings.jsx:425` |
| Classic Set | es, ru, zh | `app/Settings.jsx:425` |
| Compact Set uses numbered boxes. Classic Set uses the numbered checklist. VIS always uses Classic Set. | es, ru, zh | `app/Settings.jsx:425` |
| Compact Set color | es, ru, zh | `app/Settings.jsx:426` |
| RGB tint | es, ru, zh | `app/SurfaceEffects.jsx:35` |
| Choose a custom RGB colour | es, ru, zh | `app/SurfaceEffects.jsx:35` |
| Colour | es, ru, zh | `app/SurfaceEffects.jsx:39` |
| Highlight geoset | es, ru, zh | `app/SurfaceEffects.jsx:101` |
| Double-click a surface to select it. | es, ru, zh | `app/SurfaceEffects.jsx:101` |
| Highlight the selected part in the preview. | es, ru, zh | `app/SurfaceEffects.jsx:101` |
| Search… | es, ru, zh | `app/SurfaceEffects.jsx:104` |
| Effects library | es, ru, zh | `app/SurfaceEffects.jsx:105` |
| Show only the selected part. | es, ru, zh | `app/SurfaceEffects.jsx:113` |
| Frame the selected part. | es, ru, zh | `app/SurfaceEffects.jsx:113` |
| Show the original model. | es, ru, zh | `app/SurfaceEffects.jsx:113` |
| Click to dismiss this warning | es, ru, zh | `app/WarningToasts.jsx:13` |
| Dismiss {0} | es, ru, zh | `app/WarningToasts.jsx:14` |
| Flaming sword | es, ru, zh | `src/global-animation-looks.js:31` |
| Blades | es, ru, zh | `src/fx-sort-looks.js:15` |
| Hot core | es, ru, zh | `src/global-animation-looks.js:31` |
| Moving skin | es, ru, zh | `app/GlobalAnimationControls.jsx:104` |
| Blade flames | es, ru, zh | `src/global-animation-looks.js:31` |
| Rising embers | es, ru, zh | `src/global-animation-looks.js:17` |
| Frost blade | es, ru, zh | `src/global-animation-looks.js:32` |
| Cold sheen | es, ru, zh | `src/global-animation-looks.js:32` |
| Glow | es, ru, zh | `app/GlobalAnimationControls.jsx:74` |
| Crystal glints | es, ru, zh | `src/global-animation-looks.js:18` |
| Falling mist | es, ru, zh | `src/global-animation-looks.js:15` |
| Lightning blade | es, ru, zh | `src/global-animation-looks.js:33` |
| Storm steel | es, ru, zh | `src/global-animation-looks.js:33` |
| Forked arcs | es, ru, zh | `src/global-animation-looks.js:33` |
| Arcane blade | es, ru, zh | `src/global-animation-looks.js:34` |
| Enchanted steel | es, ru, zh | `src/global-animation-looks.js:34` |
| Flowing energy | es, ru, zh | `src/global-animation-looks.js:34` |
| Narrow highlight | es, ru, zh | `src/global-animation-looks.js:34` |
| Rune blade | es, ru, zh | `src/global-animation-looks.js:35` |
| Water surface | es, ru, zh | `src/global-animation-looks.js:36` |
| Crossing highlights | es, ru, zh | `src/global-animation-looks.js:36` |
| Ice skin | es, ru, zh | `src/global-animation-looks.js:37` |
| Glowing skin | es, ru, zh | `src/global-animation-looks.js:40` |
| Glowing texture | es, ru, zh | `src/global-animation-looks.js:19` |
| Poison skin | es, ru, zh | `src/global-animation-looks.js:41` |
| Poison surface | es, ru, zh | `src/global-animation-looks.js:41` |
| Heavy drops | es, ru, zh | `src/global-animation-looks.js:41` |
| Crystal veins | es, ru, zh | `src/global-animation-looks.js:42` |
| Felwood curse | es, ru, zh | `src/global-animation-looks.js:43` |
| Fly swarm | es, ru, zh | `src/global-animation-looks.js:44` |
| Around the unit | es, ru, zh | `src/fx-sort-looks.js:16` |
| Orbiting flies | es, ru, zh | `src/global-animation-looks.js:44` |
| Motes | es, ru, zh | `src/global-animation-looks.js:45` |
| Drifting lights | es, ru, zh | `src/global-animation-looks.js:45` |
| Frost mist | es, ru, zh | `src/global-animation-looks.js:47` |
| Moving own texture | es, ru, zh | `src/global-animation-looks.js:48` |
| Your textures | es, ru, zh | `src/global-animation-looks.js:48` |
| Moving texture | es, ru, zh | `src/global-animation-looks.js:48` |
| Fade pulse | es, ru, zh | `src/global-animation-looks.js:50` |
| Breathing opacity | es, ru, zh | `src/global-animation-looks.js:50` |
| Surface {0} | es, ru, zh | `src/global-animation-looks.js` |
| Particles {0} | es, ru, zh | `src/global-animation-looks.js` |
| Ground piece {0} | es, ru, zh | `src/global-animation-looks.js` |
| Ground seal | es, ru, zh | `src/global-animation-looks.js:69` |
| Light edge | es, ru, zh | `src/global-animation-looks.js:20` |
| {0} global animation | es, ru, zh | `app/SurfaceEffects.jsx` |
| {0} impact | es, ru, zh | `app/SurfaceEffects.jsx` |
| Enable {0} | es, ru, zh | `app/GlobalAnimationControls.jsx` |
| {0} (recommended) | es, ru, zh | `src/global-animation-looks.js` |
| Blood & death | es, ru, zh | `src/particle-world-effects.js:16` |
| Other effects | es, ru, zh | `src/particle-world-effects.js:46` |
| Heroes | es, ru, zh | `src/particle-world-effects.js:18` |
| Items | es, ru, zh | `src/particle-world-effects.js:18` |
| Destructibles | es, ru, zh | `src/particle-library-browse.js:143` |
| Save verification failed: FX layers changed. | es, ru, zh | `src/editor-document.js:653` |
| The saved FX layer list could not be read. | es, ru, zh | `src/global-animation-data.js:28` |
| Select a part with a visible length. | es, ru, zh | `src/global-animation-looks.js:134` |
| The selected part has no texture to animate. | es, ru, zh | `src/global-animation-model.js:95` |
| Choose an Attack animation. | es, ru, zh | `src/global-animation-model.js:217` |
| Select a part first. | es, ru, zh | `src/global-animation-model.js:443` |
| This animation has no length. | es, ru, zh | `src/particle-placement.js:18` |
| The selected bone has a zero scale. Choose another bone or animation. | es, ru, zh | `src/particle-placement.js:45` |
| Choose an existing animation. | es, ru, zh | `src/particle-placement.js:57` |
| Select a geoset with a material or choose Replace with a native effect. | es, ru, zh | `src/surface-effects.js:163` |
| Select a geoset. | es, ru, zh | `src/surface-effects.js:223` |
| This part has bind-pose matrices. Choose a surface-only effect. | es, ru, zh | `src/surface-effects.js:224` |
| New geoset requires a model without bind-pose matrices. | es, ru, zh | `src/surface-effects.js:226` |
| Choose a positive speed. | es, ru, zh | `src/surface-effects.js:227` |
| This model already contains every variation of this ground mark. | es, ru, zh | `src/visual-effect-composition.js:222` |
| The model texture list could not be read. | es, ru, zh | `src/world-editor-textures.js:20` |
| Mouse and general… | es, ru | `app/AppToolbar.jsx:67` |
| Keyboard Shortcuts… | es, ru | `app/AppToolbar.jsx:67` |
| Graphical settings… | es, ru | `app/AppToolbar.jsx:67` |
| Recording and screenshots… | es, ru, zh | `app/AppToolbar.jsx:67` |
| Appearance… | es, ru | `app/AppToolbar.jsx:67` |
| Configuration… | es, ru | `app/AppToolbar.jsx:67` |
| Grid… | es, ru, zh | `app/AppToolbar.jsx:67` |
| Add-ons… | es, ru, zh | `app/AppToolbar.jsx:67` |
| Undo cache… | es, ru, zh | `app/AppToolbar.jsx:67` |
| Material Manager… | es, ru, zh | `electron/menu.cjs:36` |
| Texture Manager… | es, ru, zh | `electron/menu.cjs:36` |
| Node Manager… | es, ru, zh | `electron/menu.cjs:36` |
| Geoset Manager… | es, ru, zh | `electron/menu.cjs:36` |
| Geoset Animation Manager… | es, ru, zh | `electron/menu.cjs:36` |
| Sequence Manager… | es, ru | `electron/menu.cjs:36` |
| Texture Animation Manager… | es, ru, zh | `electron/menu.cjs:36` |
| Global Sequence Manager… | es, ru, zh | `electron/menu.cjs:36` |
| Min X {0} | es, ru, zh | `app/OptimizeXL.jsx` |
| Max X {0} | es, ru, zh | `app/OptimizeXL.jsx` |
| Min Y {0} | es, ru, zh | `app/OptimizeXL.jsx` |
| Max Y {0} | es, ru, zh | `app/OptimizeXL.jsx` |
| Min Z {0} | es, ru, zh | `app/OptimizeXL.jsx` |
| Max Z {0} | es, ru, zh | `app/OptimizeXL.jsx` |
| Lava skin | es, ru, zh | `src/global-animation-looks.js:39` |
| Dark crust | es, ru, zh | `src/global-animation-looks.js:39` |
| Molten cracks | es, ru, zh | `src/global-animation-looks.js:39` |
| Open... | ru | `app/AppToolbar.jsx:67` |
| Save as... | ru | `app/AppToolbar.jsx:67` |
| Recovery... | ru | `app/AppToolbar.jsx:67` |
| Special paste... | ru | `app/AppToolbar.jsx:67` |
| Undo settings... | ru | `app/AppToolbar.jsx:67` |
| Choose Warcraft III folder… | ru | `app/AppToolbar.jsx:67` |
| Remove layer | zh | `app/GlobalAnimationControls.jsx:62` |
| Search textures | zh | `app/TextureLibrary.jsx:196` |
| Search surfaces, colours and kitbash associations | zh | `app/TextureLibrary.jsx:197` |
