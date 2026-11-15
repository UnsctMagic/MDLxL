# Codex work order: build the FX element redesign

Owner of the design and architecture: Claude (head designer). Codex builds exactly this; it does not redesign looks or invent values. If something in the design cannot be built as written, stop that item, write why in the report, and continue with the rest.

Background: the owner rejected trial 06 (`7e9660b2`) as "everything looks trash". Claude and Fable redesigned every element look from the owner's reference models and Blizzard's own effects. Read [the redesign note](fx-effect-redesign.md) first (5 minutes), then the design.

## Inputs

- **The design (binding):** [fx-effect-design.md](fx-effect-design.md). Section 2 has every variation as exact layer literals; section 3 the engine behaviours; section 4 the keep/undo list.
- **Recipe format reference:** [fx-effect-recipe-reference.md](fx-effect-recipe-reference.md), with file:line anchors at `7e9660b2` and a `cbc17f49` vs `7e9660b2` comparison of the main looks.
- `cbc17f49` = the looks the owner liked. `git show cbc17f49:src/<file>` gives them.

## Where to work

- Worktree `D:\Codex\fx-effects`, branch `codex/fx-effects` (already created from `claude/fx-effects`). Run `pnpm install --frozen-lockfile --prefer-offline` there. Never junction `node_modules`. Copy `electron\ffmpeg\*.exe` and `*.dll` from `D:\Claude\MDLxL\electron\ffmpeg` if a test needs them.
- Local commits only, one commit per numbered item below. No push, no PR, no tag.
- Do not touch `D:\Claude\MDLxL\.claude\worktrees\fx-effects` or any other folder outside your worktree.

## Architecture decisions (Claude's; build these, not alternatives)

Every new key is a **recipe starting value stored on the layer**. The existing controls (Emitters, Size, placement and aim handles, life table, More) keep editing the result, and a user edit always wins over the recipe value. Saved stacks without these keys compile byte-identically: `test/fx-legacy-snapshot.test.js` stays green and its fixture untouched.

| Key (design §3) | Build it as |
|---|---|
| `widthCap:k` (3.1) | Generalise the existing `airyFit` rim cap (`global-animation-model.js` ~504, ~616). Per site, W = the site's physical component radius (strip/rim sites already carry it) or, for a `birthRegion` slab, the strip's half-width. After sizing, if the largest ParticleScaling stage exceeds k·W, scale all three stages by the same factor. Skip when the user has edited Size (layer or individual), as `fireFit.sizeEdited` does today. `airyFit` keeps its 0.75 behaviour by mapping to `widthCap:.75` internally, without changing its compiled output. |
| `gather:'tip'` (3.2) | A site planner beside `defaultSurfaceSites`/`birthRegionSites`. Straight strip: one site in the last 10% of the length at the end farthest from the parent bone's pivot. Curved piece: the rim site farthest from that pivot. Many regions: up to two extremity sites, one per side. Deterministic, cached with the surface key like `defaultSurfaceSites`, so every `gather:'tip'` layer of a variation lands on the same site(s). Sites use the existing skin attachment path and stable keys, so individual edits, Delete, Emitters and Snap to surface work unchanged. |
| `aim:'tip'\|'outward'` (3.3) | Write the starting Rotation into the same field the existing aim (rotation rings) control edits, using `emitterRotationTrack`. `tip`: emitter +Z along the part axis toward the extremity. `outward`: along the site's surface normal. A user rotation edit replaces it. |
| `siteCount:n` (3.4) | Presets the layer's existing `siteCount` (the Emitters slider value) on a fresh layer; stations come from the existing strip/rim sampler, rate split evenly. On rim shapes n is an upper bound. |
| `scatter:s` (3.5) | Generalise `airyFit`'s per-site rate weights (`1+.06*(i%5-2)`, ~481): deterministic factor per stable site key spread over 1±s, normalised so the layer total is unchanged. `airyFit` output stays byte-identical. |
| `birthAcross:k` (3.6) | In `birthRegionSites` (~341–351) the slab half-width becomes k·W instead of `.7·radius`; no key = today. |
| Rate floor (3.7) | For `birthRegion` layers that fall back to point sites (curved piece, body): raise the layer total so each live site keeps ≥2 live particles, capped at 4× the recipe rate. Curved pieces take sites by coverage (length / footprint, max 16) instead of the fixed 4, only for these layers. |
| Ramp follows Colour (3.8) | `makeLayer` stores `rampTint` = the spec's tint when the spec has `native.SegmentColor`. At compile, when `rampTint` is present, each stage colour = recipe stage × (layer tint / rampTint), per channel, clamped 0–1. When the user edits a stage colour in the life table, write `native.SegmentColor` and delete `rampTint` (the user's ramp is pinned from then on). Layers without `rampTint` (all saved ones) compile as today. |
| `filter:2` (3.9) | No code. Claude checks Modulate in a render. `Heat shade` stays an ingredient (not `starts`). |
| Technique removal (3.10) | Delete `ELEMENTS`, `elementTechnique`, `withElementTechniques`, the `technique-*` variations and the `element` look field, and every use of them (`surface-effects.js` `fxElement`, `claude-fx-looks.js`, poison/magma/lava/fissures/liquid body registrations). A stack saved with a removed variation id opens on the look's first variation, with its layers kept as user layers (the `extra` path of `withVariation`). No look-id exceptions anywhere. |
| `side:'under'` (3.11) | Not built this round. Ignore the key. |

## Items (one commit each)

1. **Remove the technique generator and apply the undo list** (design §3.10 and §4): restore the `cbc17f49` recipes listed as Undo (Frost mist strength, Magma flow, Molten lava, Fissures, Poison first variation, Crystal veins, Liquid body); keep everything listed as Keep. Fire's and Fel's first variations go back to the dense cbc flame (no `airyFit`).
2. **Engine keys** `widthCap`, `scatter`, `siteCount`, `birthAcross`, the rate floor, and ramp-follows-Colour. Unit tests for each: fail first on the old code, then pass. Include one test that `airyFit` layers and a saved stack compile byte-identically.
3. **`gather:'tip'` and `aim`**, with unit tests on a straight strip, a curved piece and a many-region body (use existing fixtures in `test/helpers/fixtures.cjs`): the site is at the far end from the parent pivot, and two layers with `gather:'tip'` share it.
4. **The looks:** every variation in design §2.1–2.9, exactly as written (ids, names, order, values). Register them with `vary`; keep `legacyLayers` where the design says so. New layer names go into all five catalogues in `src/locales/` (de, es, fr, ru, zh): use short functional translations, no flavour text.
5. **Checks:** `pnpm run build`, then `node --test test/fx-*.test.js test/global-animations.test.js test/claude-fx-looks.test.js test/surface-effects.test.js test/localization-catalogs.test.js`. Fix failures your change caused. If an existing test asserts a value the design deliberately changed, update that expectation and list it in the report with the design section that changed it. Never edit `test/fx-legacy-snapshot.test.js` or its fixture. No Electron tests, no packaging, no app launches: Claude renders and reviews the looks.

## Report

Write `D:\Codex\fx-effects\out\codex-report.md`: per item done / not done, commit hashes, fail-first evidence per new test, the final test counts, every changed expectation with its reason, anything in the design you could not build and why. **Last step:** write `D:\Codex\fx-effects\out\DONE.txt` containing the final commit hash. Claude waits on that file.
