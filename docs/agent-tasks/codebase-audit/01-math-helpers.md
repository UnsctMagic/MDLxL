# Audit 01: math, geometry and generic data helpers re-implemented locally

Revision: `origin/main` at `fe46a534` (worktree `D:\Claude\MDLxL\.claude\worktrees\codebase-audit`), read-only.
Scope: `app/`, `src/`, `electron/` (excluding `src/vendor/`, `node_modules/`, `dist/`, `public/`). `scripts/` is mentioned only where it adds copies.
Method: `rg` over local definitions (`function X(` and `const X = (...) =>` / `const X = a =>`), then reading each definition and the inline idioms they wrap.

## Seed counts, checked

The seed counts included every `const X =`, so most of them were local variables, not helpers. Here are the corrected numbers (helper-shaped definitions only):

| Seed name | Seed | Real helper copies | Notes |
|---|---|---|---|
| clamp | 20 | 16 named `clamp` + 2 `clampByte` + about 228 inline `Math.max(a, Math.min(b, x))` in 133 files | 4 of the named ones are different functions with the same name (see M1) |
| distance | 32 | 9 (3D 4, 2D 1, track-value 4) | the rest are local variables |
| length | 25 | 3 (`optimizexl-motion-context`, 2D `forge-geometry`, `sd-kit V.len`) | the rest are variables |
| dot | 12 | 7 named + 18 inline `reduce((s,v,i)=>s+v*b[i],0)` in 16 files | |
| cross | 10 | 6 vec3 cross + 4 2D orientation `cross(a,b,c)` + 6 inline vec3 cross | two different operations share the name |
| clone | 9 | 7 `clone/copy = v => structuredClone(v)` aliases + 1 `cloneKey` | harmless (see "Already shared and good") |
| normalize | 5 | 0 vector helpers named `normalize`; the 3 hits are **path** normalizers | vector normalizers are `unit`, `normalized`, `normal`, `V.norm` (H3) |
| round | 5 | 4, each with a different precision on purpose | L10 |
| quaternion | 4 | 0 helpers (variables) | the real quaternion duplicates are H2 and M5 |
| lerp | 2 | 2 lerp + 4 scalar `mix` + 1 vector `mix` | L4 |
| uniqueName | 2 | 9 unique-name loops | M6 |
| crc32 | 2 | 2 identical (+2 in `scripts/`) | L1 |
| faceNormal | 2 | 2 + `triangleNormal` + `forgeFaceNormal` + 4 inline | H3 |
| bounds | 2 | 3 geoset-bounds implementations + about 6 ad hoc min/max boxes | M3 |
| dimensions | 2 | **false positive**: `forge.js` (image size check) and `optimizexl.js` (model max span) are unrelated | |
| descendantOf | 2 | 3 + 5 ancestor-chain walks | M7 |
| makeKey | 2 | 2 + about 8 inline "new key with default tangents" | M8 |
| bindingKey | 2 | **false positive**: `mesh-density` is per vertex, `sort-my-mess` is per geoset | |

No shared math/vector/geometry module exists in `src/`. The nearest are `src/forge-geometry.js` (2D polygon helpers, exported), `src/sd-kit.js` (a private `V` vec3 object), and three.js (`Vector3`/`Quaternion`/`Matrix4`, imported by 26/211 src files and 41/217 app files). Hand-rolled plain-array maths is concentrated in Forge, mesh tools, Paint, OptimizeXL and SD Kit.

---

## High severity

### H1. Game-path key `String(v||'').replaceAll('/', '\\').toLowerCase()`: 36 sites in 31 files, about 21 named local helpers

**Instances** (named helpers first):
- `src/bits-and-parts.js:12` `export const partPathKey = value => String(value || '').replaceAll('/', '\\').toLowerCase();` (already exported, used 11 times)
- `src/forge-assets.js:1` `const assetKey=name=>String(name||'').replaceAll('/','\\').toLowerCase();`
- `src/material-presets.js:5` `const normalize = path => ...` (same body)
- `src/uv-preview.js:5` `const normal = value => ...`
- `src/particle-assets.js:4` `const pathKey=value=>...`
- `src/texture-library-search.js:31` `const normalizedPath = value => ...`
- `src/sprite-frames.js:68` `const shortName=name=>...`
- `src/forge.js:218` `const pathKey = p => String(p).replaceAll('/', '\\').toLowerCase();` (**no `|| ''`: turns `undefined` into `"undefined"`**)
- `app/App.jsx:105` `const normalize = ...`
- `app/event-preview-data.js:7` `const norm = value => String(value || '').replace(/\//g, '\\').toLowerCase();`
- `app/event-preview-runtime.js:10` `const pathKey = ...`
- `app/GamePreview.jsx:54` `const pathKey = ...`
- `app/GameFileBrowser.jsx:22` `const normalize=...`
- `app/PaintViewport.jsx:42` and `app/Viewport.jsx:48` `const normalizedPath = ...`
- `app/ParticleEditor.jsx:38` `const pathKey=...`
- `app/ParticlePictureTool.jsx:5` `const key=path=>...`
- `app/ParticleThumbnailQueue.jsx:8` `const normalize=...`
- `app/uv-material-preview.js:6` `const normalPath = ...`
- `electron/texture-library.cjs:6` `const normalized = ...`
- Inline or no null guard: `app/ai-assets.js:21` `name.replaceAll(...)` and `:61` `texture.Image.replaceAll(...)` (throw on missing value), `app/AiAssistant.jsx:99`, `src/geoset-animation-repair.js:45`, `src/particle-assets.js:32` (`t.Image?.replaceAll` gives `undefined` in the Set), `src/particle-starters.js:12`, `src/texture-library-art.js:24`, `app/node-event-data.js:34`, `app/TextureLibrary.jsx:132`, `electron/casc.cjs:7,10`, `electron/game-file-library.cjs:134` (lowercases first, then `.trim()`), `:160` (also strips leading `\`), `:191`, `electron/particle-review.cjs:7`.

**Identical or different:** the main body is identical. Edge handling differs:
- (a) Null handling: `String(v||'')` gives `''`; `String(p)` gives `"undefined"`/`"null"` (`forge.js:218`); `v.replaceAll` throws (`ai-assets.js`, `casc.cjs`).
- (b) Some sites add `.trim()` or strip leading separators (`game-file-library.cjs:134,160`). The same texture name can therefore match in one feature and miss in another.
- (c) There is also a **same name with opposite direction** trap: `src/paint-targets.js:1` `const slash = v => String(v||'').replaceAll('/', '\\')` versus `src/paint-export.js:12` `const slash = v => String(v||'').replaceAll('\\','/')`.

**Proposed owner:** new `src/game-path.js` exporting `gamePathKey(value)` (exactly the `String(value || '').replaceAll('/', '\\').toLowerCase()` body). `bits-and-parts.js` re-exports it as `partPathKey` so its 11 callers do not change. The renderer/src helpers listed above switch to it. Electron `.cjs` files cannot import the ESM module, so they get one `electron/game-path.cjs` (or keep `texture-library.cjs`'s and export it). Leave the sites that add `trim`/strip/split. They do more than build a key, and they can call `gamePathKey` first.

**Regression risk:** low for the guarded copies, which are byte-identical. For `forge.js:218`, `ai-assets.js` and `casc.cjs`, switching changes `undefined` handling from "undefined"/throw to `''`. Check that no caller relies on the throw. Tests: `test/material-presets.test.js`, `test/uv-preview.test.js`, `test/texture-library.test.js`, `test/particle-assets.test.js`, `test/forge-assets.test.js`, `test/bits-and-parts.test.js`, `test/game-file-library.test.js`, `test/event-preview.test.js`. The renderer sites (`Viewport.jsx`, `PaintViewport.jsx`, `GamePreview.jsx`) are covered only by `*.electron.cjs` packaged tests.

### H2. "How far apart are two track values": quaternion angle / vector distance, 7 implementations with 2 formulas

**Instances:**
- `src/motion-inspector.js:12` `export const rotationDistance = (a, b) => new Quaternion().fromArray(a).normalize().angleTo(new Quaternion().fromArray(b).normalize()) * 180 / Math.PI;` and `:13` `distance = (a,b,property) => property==='Rotation' ? rotationDistance(a,b) : Math.hypot(...a.map((v,i)=>v-b[i]))`
- `src/optimizexl-motion.js:8` `const angle = (a, b) => new Quaternion().fromArray(a).normalize().angleTo(...)* 180 / Math.PI;` (identical to `rotationDistance`; this file **already imports** `scanCurveMotion` from `motion-inspector.js`)
- `src/optimizexl-motion-context.js:12-14` `distance = (a,b,property) => property==='Rotation' ? new Quaternion()...angleTo(...)*180/Math.PI : length(subtract(a,b))` (identical to motion-inspector `distance`)
- `src/optimizexl-animation.js:5-9` `error=(a,b,rotation)=>{... const dot=Math.abs(a.reduce(...)/(Math.hypot(...a)*Math.hypot(...b)||1)); return 2*Math.acos(Math.min(1,dot))*180/Math.PI;}`
- `src/optimizexl.js:81` `function trackError(a,b,rotation){ ... same as optimizexl-animation ... }`
- `src/optimizexl-endpoints.js:8` `const error=(a,b,p)=>a.every((v,i)=>v===b[i])||p==='Rotation'&&a.every((v,i)=>v===-b[i])?0: ...same formula...`
- `src/anim-xl.js:71` `2 * Math.acos(Math.min(1, Math.abs(q[0]*p[0]+...+q[3]*p[3])))` (**radians**, no normalisation)
- Related: `src/optimizexl-geometry.js:15` `normalAngle` (vector angle in degrees), `src/sd-kit.js:197`, `src/forge-shape-editing.js:125` (2D angle in radians).

**Identical or different:**
- The three three.js copies are identical.
- The three hand-rolled OptimizeXL copies use one identical formula; `endpoints` adds an exact-equal / exact-negated short-circuit to `0`.
- **The two formulas differ for a zero or degenerate quaternion.** three.js `normalize()` turns `[0,0,0,0]` into identity (`[0,0,0,1]`), which then compares as a real rotation. The hand-rolled version divides by `(0||1)`, gets `dot = 0` and reports **180°**. They also differ in the last bits near 0° (`acos` of a divided vs pre-normalised dot), which matters for OptimizeXL's tolerance thresholds.
- `anim-xl.js:71` uses different units (radians) and does no normalisation.

**Proposed owner:** do not merge the two formulas, because OptimizeXL baselines depend on the hand-rolled one. Smallest change:
- (1) `optimizexl-motion.js` and `optimizexl-motion-context.js` import `rotationDistance` from `motion-inspector.js` (drops 2 copies, behaviour identical).
- (2) Export the hand-rolled one once, e.g. `export const trackValueError` from `src/optimizexl-animation.js`. `optimizexl.js:81` and `optimizexl-endpoints.js:8` then use it, and `endpoints` keeps its short-circuit as a wrapper.
- (3) Add one comment at each owner naming the other and the zero-quaternion difference.

**Regression risk:** (1) none, the bodies are identical. (2) also identical bodies, but OptimizeXL rules apply (`docs/OPTIMIZEXL_TEACHING.md`): re-run the flail regression and the full OptimizeXL suite. Tests: `test/motion-inspector.test.js` (uses `rotationDistance` directly), `test/optimizexl-motion-removal.test.js`, `test/optimizexl-motion-context.test.js`, `test/optimizexl-animation.test.js`, `test/optimizexl-motion-preservation.test.js`, `test/optimizexl.test.js`, `test/optimizexl-flail-regression.mjs`, `test/optimizexl-footman.mjs`, `test/optimizexl-context-models.mjs`.

### H3. Plain-array vec3 helpers copied file to file; normalize has 7 different zero-length behaviours

**Instances (named helper blocks):**
- `src/forge-shape-editing.js:4-9` `add, sub, mul, dot, cross, unit` (`unit = a => mul(a, 1 / (Math.hypot(...a) || 1))`)
- `src/forge-detail-editing.js:3-8` same six, **verbatim** (this file already imports from `forge-shape-editing.js`)
- `src/forge-molding.js:5-7` same six, verbatim, compressed onto 3 lines (also imports from `forge-shape-editing.js`)
- `src/sd-kit.js:54-61` `const V = { add, sub, mul, dot, cross, len, norm }` (fixed 3 components; `norm` uses `|| 1`)
- `src/mesh-tools.js:4-6` `dot` (fixed 3), `cross`, `normalized = a => length > 1e-12 ? a/length : [1, 0, 0]`
- `src/mesh-density.js:17-20` `normal = v => length > 1e-12 ? v/length : [0, 0, 1]`; `:155` local `cross`, `dot`
- `src/optimizexl-motion-context.js:8-10` `length, subtract, dot`
- `src/optimizexl-geometry.js:13` `distance = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]))`; `src/optimizexl-snaps.js:3` `dist` (same, via `Array.from`)
- `src/paint-uv-atlas.js:31` `function dot(a,b)`; `:4-10` `faceNormal(geoset, face)` gives `length > 1e-8 ? n/length : [0, 0, 1]`
- `src/paint-projection.js:23-28` `faceNormal(vertices,a,b,c)` gives `/ (length || 1)`, so `[0,0,0]` when degenerate
- `src/forge-shape-editing.js:11-12` `triangleNormal`, `forgeFaceNormal` (exported)
- Inline vec3 cross: `app/ForgeShapes.jsx:42`, `app/showcase-director.js:40`, `src/geoset-tangents.js:13`, `src/glow-up.js` (1), `src/normals-rebuild.js:110,316`, `src/editor-document.js:888`, `src/paint-selection-space.js:34`
- Other inline normalisations: `src/editor-document.js:892-894` (`> 1e-12` else **only** `normals[i+2] = 1`, so x and y keep their tiny values), `src/normals-rebuild.js:144-145` (`> 1e-9` else previous normal or `null`), `src/classic-mesh.js:141-142` (`< 1e-10` throws), `app/portrait-lighting.js:37-38,46-47` (`> 1e-6` else skip / `null`), `src/animation.js:172` (`|| 1`), `src/geoset-tangents.js:12` (`< 1e-10` uses a fallback axis), `src/motion-decisions.js:17` (`|| 1`).

**Identical or different:**
- The three Forge blocks are **byte-identical** apart from whitespace and parameter names.
- `sd-kit V` gives the same results for length-3 plain arrays, but its fixed 3-component form drops a 4th component; the Forge `a.map` form keeps the input length and returns a `Float32Array` if given one.
- `mesh-tools` `dot` is fixed at 3 components; the others are n-dimensional.
- **Zero-length vectors diverge on purpose and by accident:** `[0,0,0]` (Forge `unit`, `V.norm`, `paint-projection`, `animation.js`), `[1,0,0]` (`mesh-tools`), `[0,0,1]` (`mesh-density`, `paint-uv-atlas`), `(x,y,1)` (`editor-document`), previous/`null` (`normals-rebuild`), throw (`classic-mesh`), skip (`portrait-lighting`). Epsilons are 0, 1e-6, 1e-8, 1e-9, 1e-10 and 1e-12.
- `optimizexl-motion-context` uses its `length`/`subtract` on Translation/Scaling. A fixed-3 shared version would be wrong for any 4-component input, so the shared module must keep the n-dimensional `map/reduce` form.

**Proposed owner:** new `src/vec.js` exporting `add, sub, scale, dot, cross, length, distance, lerp, unit`. Use the n-dimensional `a.map / a.reduce` bodies exactly as in `forge-shape-editing.js`, so `unit` keeps the `|| 1` (zero gives zero) behaviour. Switch first:
- the three Forge files (drop 18 lines);
- `sd-kit.js` (`V` becomes `import * as V`; keep the `len/norm` names as aliases or rename call sites);
- `optimizexl-motion-context.js` `length/subtract/dot`;
- `optimizexl-geometry.js` `distance`, `optimizexl-snaps.js` `dist/lerp`.

Leave every normaliser whose fallback differs (`mesh-tools`, `mesh-density`, `paint-uv-atlas`, `editor-document`, `normals-rebuild`, `classic-mesh`, `portrait-lighting`) as it is, or later give `unit` an explicit `fallback` argument. Do not unify those fallbacks in a refactor. Flag only: `editor-document.js:894` leaving x and y non-zero for a degenerate normal may be an accidental bug, and the owner should decide.

**Regression risk:** low for the Forge and SD Kit swaps (identical bodies); medium if the fallbacks are ever unified. Tests: `test/forge-shape-editing.test.js`, `test/forge-detail-editing.test.js`, `test/forge-molding.test.js`, `test/forge-cuts.test.js`, `test/sd-kit.test.js`, `test/optimizexl-motion-context.test.js`, `test/optimizexl-snaps.test.js`, `test/optimizexl-nuclear.test.js`, `test/mesh-tools.test.js`, `test/mesh-density.test.js`, `test/paint-uv-atlas.test.js`, `test/paint-projection.test.js`, `test/normals-rebuild.test.js`, plus `forge-*.electron.cjs`.

---

## Medium severity

### M1. `clamp`: 16 named copies, 4 same-name impostors, about 228 inline expressions

**Same-meaning copies `(value, min, max)`:**
- `src/anim-xl.js:20` `x < a ? a : x > b ? b : x`
- `app/event-preview-data.js:6` `Math.min(high, Math.max(low, value))`
- `src/forge-molding.js:8` **exported** `Math.min(b,Math.max(a,n))` (imported by `app/ForgeShapes.jsx:12`)
- `src/forge.js:12` `Math.max(a, Math.min(b, v))`
- `app/GlowStageTools.jsx:8`, `app/KeyframeTimeline.jsx:11`, `src/glow-up.js:164` (function-local), `app/showcase-director.js:3`, `app/ShowcaseLayers.jsx:81` (local), `app/uv-workspace-layout.js:9`
- `src/sd-kit.js:63` and `app/showcase-text.js:28` with defaults `(v, a = 0, b = 1)`
- `app/portrait-background.js:26` `clamp = (value, [min, max])` (**tuple** signature)
- Coercing variants: `src/optimizexl.js:43` `Number(v)||0`, `app/showcase-crop.js:1` (0..1, `Number(v)||0`), `app/showcase-orbit.js:4` (0..100, `Number(v)||0`), `app/portrait-lighting.js:48` (0..1, local)
- `clampByte`: `app/uv-material-preview.js:8` and `src/uv-material-compositor.js:1` are identical (`uv-material-preview.js` already imports from the compositor), plus inline at `src/paint-decal.js:47-48` and `app/pixel-lines.js:74-75`.

**Same name, different job (do not merge):** `app/movement-overlay.js:379` `clamp(x, y)` keeps a button on screen; `app/useMovableWindow.js:8` `clamp(left, top)`; `src/paint-uv-coverage.js:68` `clamp(value,size,wrap)`.

**Identical or different:**
- NaN: `Math.min/max` propagate NaN; the ternary returns NaN; the coercing ones return the bound reached from `0`.
- `min > max`: `Math.max(a, Math.min(b, v))` gives `a`, `Math.min(b, Math.max(a, v))` gives `b`. `uv-workspace-layout.js:22` already guards this by sorting.
- Argument order is consistent apart from the tuple form.

**Proposed owner:** new `src/math.js` exporting `clamp(value, min, max)` (`Math.min(max, Math.max(min, value))`, as `forge-molding` already exports), `clamp01(value)` and `clampByte(value)`. `forge-molding.js` re-exports `clamp` for `ForgeShapes.jsx`. Switch the plain copies; keep the coercing ones local (or as `clamp(Number(v)||0, ...)` at the call). Inline expressions: leave them.

**Regression risk:** low, except at call sites that might pass `min > max` (changes which bound wins) or NaN. Tests: `test/anim-xl*.test.js`, `test/event-preview.test.js`, `test/forge.test.js`, `test/forge-molding.test.js`, `test/glow-up.test.js`, `test/sd-kit.test.js`, `test/showcase*.test.js`, `test/uv-workspace-layout.test.js`, `test/showcase-layout.test.js` (crop); `KeyframeTimeline.jsx` and `GlowStageTools.jsx` are only covered in packaged tests.

### M2. `forge.js` re-implements 2D helpers that `forge-geometry.js` already exports (it already imports from it)

**Instances:**
- `src/forge.js:81` `const area = loop => ...` is identical to `src/forge-geometry.js:6` `export const signedArea`
- `src/forge.js:82` `const pointIn = ...` is identical to `src/forge-geometry.js:8` `export function pointInside` (only the variable `inside`/`yes` differs)
- `src/forge.js:83` `function segmentDistance` matches `src/forge-geometry.js:11` (private there) exactly (`clamp(...,0,1)` vs `Math.max(0, Math.min(1, ...))`)
- 2D orientation `cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])`: `src/forge-geometry.js:7` (**exported**), `src/forge.js:96` and `:108` (two local copies in neighbouring functions), `src/sd-kit.js:112`
- `src/sd-kit.js:109` `function signedArea(loop)` (loop form, same maths; `sd-kit` already imports `forge.js`)
- Object-shaped variant: `app/movement-overlay.js:145` `cross(a,b,c)` on `{x,y}`. That is a different data shape, so leave it.

**Identical or different:** identical maths. Floating-point results can differ only in the order of operations for the `sd-kit` loop form of `signedArea` (same order, so identical).

**Proposed owner:** `src/forge-geometry.js` (already the owner). Also export its `segmentDistance`. `forge.js` and `sd-kit.js` import `signedArea, pointInside, cross, segmentDistance`.

**Regression risk:** very low. Tests: `test/forge.test.js`, `test/forge-contract.test.js`, `test/forge-hd.test.js`, `test/sd-kit.test.js`, `test/auto-corpse.test.js` (corpse-geometry uses `signedArea`).

### M3. Geoset/model bounds: 3 implementations with different empty-geoset behaviour; per-sequence extent fill copied 6 times

**Bounds instances:**
- `src/editor-document.js:899-907` `bounds(vertices)` returns zero extents for an empty array; used by `recalculateExtents` (`:908`).
- `src/mesh-tools.js:31-38` `export function updateBounds(g)`: for an empty geoset it writes **`±Infinity` extents** and radius 0.
- `src/classic-mesh.js:31-39` `bounds(vertices)` does the same min/max and radius, keeps `±Infinity` when empty, and **throws** when the radius overflows float32.
- `src/auto-corpse.js:83` `extent()` wraps `updateBounds`.
- Ad hoc min/max boxes: `src/optimizexl-effect-visibility.js:8-12`, `src/optimizexl.js:45` (`dimensions`), `src/forge-molding.js:10-15` (`forgeMoldBounds`), `src/forge-detail-editing.js:11-14` (`sizeOf`), `src/forge-detail-magnet.js:10` (`extent`), `src/forge-detail-editing.js:77`, `app/ai-review.js:185`, `src/forge-shape-editing.js:28`.
- Info radius from the union box: `src/glow-up.js:301`, `app/portrait-background.js:245`, `src/geoset-operations.js:403`.

**Per-sequence `geoset.Anims` fill**, the same line repeated six times:
`src/bits-and-parts.js:47`, `:235`, `src/forge.js:257`, `src/glow-up.js:232`, `app/portrait-background.js:242`: `geoset.Anims = (model.Sequences || []).map(() => ({ MinimumExtent: g.MinimumExtent.slice(), MaximumExtent: g.MaximumExtent.slice(), BoundsRadius: g.BoundsRadius }))`. Variants: `src/bits-and-parts.js:86` (structuredClone of existing), `src/auto-corpse.js:177,180` (uses the *sequence* extents: different semantics, leave), `src/editor-document.js:1214`.

**Identical or different:** min/max and radius are the same maths (radius = max distance from the box centre). Empty input differs: zeros, ±Infinity, or ±Infinity plus a float32 overflow guard. `editor-document` builds `Float32Array` via `V3`; `mesh-tools`/`classic-mesh` build `Float32Array` directly, so the types match.

**Proposed owner:** `src/mesh-tools.js` already exports `updateBounds`. Add `export function geosetBounds(vertices)` there (the `editor-document` body, zero for empty) and an `export function fillSequenceExtents(model, geoset)` next to it. `editor-document.bounds` and `classic-mesh.bounds` call it; `classic-mesh` keeps its float32 throw as a check after the call. `updateBounds` becomes `Object.assign(g, geosetBounds(g.Vertices))`. The 5 identical `Anims` fills switch to `fillSequenceExtents`.

**Regression risk:** medium. An empty geoset currently gets `±Infinity` from `updateBounds`; writing zeros instead changes saved MDL/MDX output for that edge case. Decide explicitly, or keep the `updateBounds` empty behaviour behind a flag. Tests: `test/mesh-tools.test.js`, `test/classic-mesh.test.js`, `test/editor-document.test.js`, `test/editor-roundtrip.test.js`, `test/geoset-operations.test.js`, `test/bits-and-parts.test.js`, `test/glow-up.test.js`, `test/portrait-background.test.js`, `test/auto-corpse.test.js`, `test/optimizexl-bounds.test.js`, `test/save-*.test.js`.

### M4. "Is this track on a global sequence?": two predicate families, 38 + 10 + 5 sites

- **Family A**, `Number.isInteger(t.GlobalSeqId) && t.GlobalSeqId >= 0`: 38 sites in 20 files, including `src/anim-xl.js:23` (also requires duration > 0), `src/animation.js:10-11` (requires duration > 0), `src/classic-keyframes.js:6`, `src/keyframe-timeline.js:8` (identical `globalId`), `src/motion-inspector.js:11`, `src/optimizexl-motion.js:6`, `src/optimizexl-snaps.js:5`, `src/sort-my-mess.js:31`, `src/animation-tracks.js:139,162,227,318`, `src/sequence-editor.js` (8 sites), `src/bits-and-parts.js` (5), `src/movement.js:210,282,345`, `src/particle-sweep.js:30,43`, `app/AnimationController.jsx:102,257`, `app/ParticleTimingTool.jsx:6`.
- **Family B**, `local = t => t.GlobalSeqId == null || t.GlobalSeqId === -1 || t.GlobalSeqId === 0xffffffff`: 10 OptimizeXL files: `src/optimizexl-checker-repairs.js:13`, `optimizexl-effect-visibility.js:4`, `optimizexl-format.js:4`, `optimizexl-opening-tracks.js:3`, `optimizexl-endpoints.js:5`, `optimizexl-redundant-tracks.js:4`, `optimizexl-spline-tracks.js:26`, `optimizexl.js:42`, `optimizexl-unused-tracks.js:3`, `optimizexl-animation.js:76`.
- **Loose**, `GlobalSeqId >= 0` only: `src/ai-regions.js:74`, `app/ai-review.js:124,141`, `src/optimizexl.js:115`, `app/ParticleKeyTrack.jsx:10`.

**Identical or different:** `war3-model` turns the MDX "none" sentinel into `null`, so on parsed data A and B agree. They **disagree** on ids that are out of range or invalid (`-2`, `NaN`, `1.5`, `0xfffffffe`): A says local, B says global. On an id past `GlobalSequences.length` or with zero duration, `animation.js` plays the track as local while every other A site (and B) treats it as global. So the timeline and OptimizeXL can disagree with playback on a broken model. B mirrors the pinned mdx-m3-viewer checker on purpose.

**Proposed owner:** new `src/global-sequence.js` (or add to `src/animation.js`, which owns playback) exporting `globalSequenceId(track)` (the `keyframe-timeline`/`classic-keyframes` body, returning id or `null`) and `playsOnGlobalSequence(track, model)` (the `animation.js` rule with duration > 0). Switch the identical A copies (`classic-keyframes`, `keyframe-timeline`, `motion-inspector`, `sort-my-mess`). Leave B as one exported `optimizexlLocalTrack` in `optimizexl-format.js`, shared by the 10 OptimizeXL files, because it encodes the checker contract.

**Regression risk:** low for consolidating A or B among themselves; high if A and B are merged (OptimizeXL boundaries). Tests: `test/keyframe-timeline.test.js`, `test/sequence-editor.test.js`, `test/motion-inspector.test.js`, `test/sort-my-mess.test.js`, `test/optimizexl-*.test.js`, `test/optimizexl-checker-repairs.test.js`, `test/animation-tracks.test.js`.

### M5. Euler-degrees and quaternion conversion: 12 identical inline copies

- **Quaternion to degrees** (`new Euler().setFromQuaternion(new Quaternion().fromArray(v).normalize(), 'XYZ').toArray().slice(0, 3).map(v => v * 180 / Math.PI)`): `src/motion-inspector.js:40`, `src/particle-bindings.js:42`, `src/particle-editing.js:11`.
- **Degrees to quaternion** (`new Quaternion().setFromEuler(new Euler(...deg.map(v => v * Math.PI / 180), 'XYZ'))`): `src/motion-inspector.js:51`, `src/particle-bindings.js:87,90`, `src/particle-editing.js:24`, `src/movement.js:393`, `src/portrait-model-control.js:119`, `src/forge-primitives.js:68`, `app/ForgeEditor.jsx:48`, `app/editor-camera-controls.js:22`.

**Identical or different:** identical (always `'XYZ'`). Some add `.normalize()` after `setFromEuler`, which is a no-op since the result is already unit length. `three.MathUtils.degToRad/radToDeg` is used only 4 times (`app/Viewport.jsx:639`, `app/PaintViewport.jsx:457`); 61 sites convert inline.

**Proposed owner:** new `src/rotation-math.js` (or `src/math.js`) exporting `quaternionToDegrees(values)` (returns `[x,y,z]`) and `degreesToQuaternion(degrees)` (returns a `THREE.Quaternion`). Callers switch one line each.

**Regression risk:** very low. Tests: `test/motion-inspector.test.js`, `test/particle-*.test.js`, `test/movement*.test.js`, `test/forge-primitives.test.js`, `test/portrait-movement.test.js`.

### M6. Unique-name generators: 9 loops with different "used" sets and case rules

- `src/glow-up.js:179-183` `uniqueName(model, base)`: all nodes, case-sensitive, `"Base 2"`
- `src/node-clipboard.js:73-77`: `"<name>_copy"`, `"_copy2"`
- `src/bone-tools.js:23-26`: **only `model.Bones`** names, `bone_new0..`
- `src/dummy-bone.js:17-18`: all serialized nodes, `DummyBone_2..`
- `app/portrait-background.js:186`: all nodes except itself, `"<NAME>2"`
- `src/sequence-editor.js:75` and `app/AnimXL.jsx:421`: sequence names
- `src/paint-materials.js:13-17` `uniquePaintTextureName` and `src/paint-current-materials.js:16`: **case-insensitive**, `"Stem 2"`
- Texture paths: `src/paint-export.js:22-26` (case-insensitive, forward slash), `app/App.jsx:1017` (via `normalize` path key)

**Identical or different:** the loop is the same; the suffix format is a product decision. The differences that matter are the used set and the case rule:
- `bone-tools.js` ignores Helpers/Attachments/other nodes, so a new `bone_new0` can collide with a Helper of that name. WC3 tolerates this, but it breaks name-based lookups (`Attachemator`, pose role detection by name).
- Node names are compared case-sensitively everywhere; texture/paint names case-insensitively.

**Proposed owner:** `src/node-hierarchy.js` (a model data helper, not maths), exporting `uniqueName(base, used, format = n => \`${base} ${n}\`, start = 2)` that takes a `Set`. Each caller keeps its own format and used set. Smallest high-value fix: `bone-tools.js` builds its set from `allNodes(model)`.

**Regression risk:** low. `test/bone-tools.test.js:13,16` asserts `bone_new0/1`, which still holds. Also `test/node-clipboard.test.js`, `test/glow-up.test.js`, `test/paint-materials.test.js`, `test/sequence-editor.test.js`, `test/portrait-background.test.js`.

### M7. Ancestor walk / `descendantOf`: 3 predicates + 5 chain walks, one rebuilt per call

- `src/attachemator.js:89-93` `descendantOf(byId, id, ancestor)` (takes a prebuilt map)
- `src/pose-ik.js:618-626` `descendantOf(model, id, ancestor)`: **rebuilds `new Map(allNodes(model)...)` on every call** and is called inside `filter/some` loops (`:44, 173, 185, 190, 192, 200, 269, 277, 292, 295-296, 629, 686, 689, 743, 803`), giving O(n²) map builds during rig detection.
- `src/optimizexl-motion-context.js:185` `ancestor(node, id)` (same loop)
- Chain walks: `src/optimizexl-exclusions.js:19`, `src/optimizexl-skin-collapse.js:25`, `src/optimizexl-snaps.js:19`, `src/movement.js:429-431` (depth), `src/optimizexl.js:68`, `src/attachemator.js:234` (root).

**Identical or different:** the three predicates have identical logic, cycle guard included. They differ only in whether the map is passed in.

**Proposed owner:** `src/node-hierarchy.js` (exists; exports `nodeHierarchyRows`, `downstreamBoneIds`, ...), adding `isDescendant(byId, id, ancestor)` and `ancestorIds(byId, id)`. `pose-ik` builds `byId` once per public call and passes it in. That is also a speed-up.

**Regression risk:** low (identical logic). Tests: `test/pose-ik.test.js`, `test/pose-complex.test.js`, `test/pose-corpus.test.js`, `test/pose-performance.test.js`, `test/attachemator.test.js`, `test/optimizexl-motion-context.test.js`, `test/optimizexl-exclusions.test.js`, `test/optimizexl-skin-collapse.test.js`.

### M8. "New key with default tangents" rule re-encoded in about 10 places

- `src/animation-tracks.js:104-111` `makeKey(Frame, Vector, lineType)`: Hermite gives zero tangents for **all** properties
- `src/keyframe-timeline.js:95-102` `makeKey(time, value, track, property)`: Hermite gives zeros **except Rotation**, which copies the value
- `src/particle-bindings.js:120` (Hermite zeros, Bezier value), `src/anim-xl.js:535-536,557-558` (translation), `src/anim-xl.js:970` (rotation only, copy value), `src/optimizexl-checker-repairs.js:207`, `src/optimizexl-motion.js:221`, `src/optimizexl-spline-tracks.js:13-15`, `src/sort-my-mess.js:397,400`

**Identical or different:** these are consistent with WC3 rules where checked: rotation tangents are quaternions, Hermite translation tangents are derivatives, Bezier tangents are control points. But only `keyframe-timeline` encodes the Rotation exception. `animation-tracks` is safe today only because it serves Alpha/Color/ribbon heights; if it ever gains node Rotation, it would write zero quaternions.

**Proposed owner:** `src/animation-tracks.js` exports the property-aware body (taken from `keyframe-timeline.js:95`) as `makeKey(frame, value, lineType, property)`. `keyframe-timeline.js` already imports from `animation-tracks.js`, so it imports `makeKey` from there without creating a cycle. Leave the OptimizeXL and AnimXL sites alone (they compute real tangents, not defaults).

**Regression risk:** low. Tests: `test/animation-tracks.test.js`, `test/keyframe-timeline.test.js`, `test/particle-sweep.test.js`.

---

## Low severity

### L1. CRC-32: 2 identical copies
`src/forge-assets.js:16-17` (`crcTable`, `crc32`) and `src/paint-project.js:119-121` (`crcTableValue`, `crcTable`, `crc32`) are identical (`0xedb88320`, standard). Two more are in `scripts/build-paint-brushes.mjs:24` and `scripts/sd-trial/tga2png.cjs:6`. **Owner:** `src/crc32.js` exporting `crc32(bytes)`. Risk: none. Tests: `test/forge-assets.test.js` (stored ZIP), `test/paint-project.test.js` (PNG chunks).

### L2. SHA-256 hex digests: 5 renderer + 10 Electron copies with different truncations
Renderer (`crypto.subtle`): `app/ai-review.js:57-60` (full), `app/Forge.jsx:107` (10 bytes), `src/motion-decisions.js:6` (full), `app/PaintTextureShelf.jsx:14` (full), `src/paint-model-integration.js:21-22` (12 bytes). Electron (`createHash('sha256')`): `electron/casc.cjs:6`, `particle-library-worker.mjs:11`, `particle-source.cjs:2`, `texture-preview-cache.cjs:5`, `updater.cjs:16` (full); `game-file-library.cjs:4`, `preview-backgrounds.cjs:8`, `texture-library.cjs:5` (`.slice(0,24)`, identical); plus `ffmpeg-verification.cjs:14`, `updater.cjs:197`. **Owner (optional):** `src/sha256.js` `sha256Hex(bytes, bytesKept)` for the renderer, and one `electron/hash.cjs`. The truncation lengths are part of stored file names and cache keys, so keep each length as it is. Risk: none if the lengths are kept.

### L3. `quantile`: 4 copies, 2 definitions
`src/optimizexl-motion.js:7` and `src/optimizexl-motion-context.js:7` are identical (nearest rank, `floor`, empty gives 0). `src/corpse-geometry.js:10` is the same rank rule with **no empty guard** (returns `undefined`). `src/rig-node-order.js:76-81` uses **linear interpolation**. **Owner:** `src/math.js` `quantile` (nearest rank, empty gives 0), used by the two OptimizeXL files and corpse-geometry. Keep `rig-node-order`'s interpolated version under a different name. Risk: low (OptimizeXL suite). Tests: `test/optimizexl-motion-*.test.js`, `test/auto-corpse.test.js`, `test/rig-node-order.test.js`.

### L4. `lerp`/`mix`/`smooth`
Scalar, identical: `src/anim-xl.js:21` `lerp`, `src/sd-kit.js:64`, `app/showcase-director.js:4`, `app/showcase-timeline.js:2` `mix`. Vector, identical: `src/corpse-geometry.js:9` `mix`, `src/optimizexl-snaps.js:4` `lerp`. Smoothstep: `src/anim-xl.js:22` and `app/showcase-text.js:29` (`u` clamped to 0..1) versus `src/sd-kit.js:65` (GLSL `smoothstep(a,b,x)` signature). Colour `mix` in `app/showcase-text.js:31` and `src/viewport-appearance.js:16` is a different job. **Owner:** `src/math.js` `lerp`, `smoothstep01`; `src/vec.js` `lerp`. Risk: none.

### L5. Undirected edge keys
`src/forge-geometry.js:9` `edgeKey` is identical to `src/forge-shape-editing.js:10` `export const forgeEdgeKey` (both `a < b ? \`${a}:${b}\` : \`${b}:${a}\``). The same expression is inline at `app/forge-surface-colors.js:12`, `src/mesh-tools.js:152` and `src/paint-uv-atlas.js:36`; the `Math.min/Math.max` form is at `app/preview-overlays.js:139`, `app/preview-presentation.js:65`, `app/viewport-shared.js:40`. All produce the same string. **Owner:** `forge-geometry.js` imports `forgeEdgeKey`. Others are optional. Risk: none.

### L6. "Same position" vertex keys: 8 sites, 6 tolerances
Exact: `app/ai-review.js:414`, `app/forge-surface-colors.js:31`, `src/mesh-density.js:21` (`fround`, `-0` becomes 0). Rounded: `src/sort-my-mess.js:188` (`toFixed(2)`), `src/geoset-operations.js:241`, `src/paint-projection.js:4`, `src/sd-kit.js:407` (×1000), `src/paint-region.js:35` (×1e5), `src/forge-molding.js:157` (×1e7). Seam and weld detection can therefore disagree between features (Sort My Mess, geoset operations, Paint, AI review). Mostly intentional; **document rather than merge**. A shared `positionKey(values, decimals)` would make each choice explicit. Risk if merged: high (changes which vertices count as the same).

### L7. Hex colour parsing: about 8 inline variants
`app/AppToolbar.jsx:17`, `app/Forge.jsx:124` (0..1), `src/sd-kit.js:66` (validates, throws), `app/PortraitToolbar.jsx:14` (validates, falls back to `ff0303`), `src/viewport-appearance.js:14`, `app/showcase-text.js:30` (`||0`), `app/uv-material-preview.js:10` `rgba(hex)`, `src/paint-raster.js` `rgbaColor`. Different validation on purpose. Optional owner `src/paint-raster.js`'s `rgbaColor`. Risk: low.

### L8. `rotationOf` copied 3 times inside one file
`src/anim-xl.js:695`, `:758`, `:884`: identical `(M, id) => { ...decompose(p, q, s); return q; }`. Hoist to one module-level function. Risk: none (`test/anim-xl*.test.js`).

### L9. Array equality
Strict: `src/mesh-density.js:16` `same`, `src/optimizexl-animation.js:3` `same`, `src/model-optimizer.js:25` `bytesEqual`, plus 9 inline `every((v,i)=>v===b[i])`. JSON-based: `src/optimizexl-geometry.js:11` `same` (NaN equals NaN as `null`, `-0` equals `0`), `app/AnimationController.jsx:18`, `src/ai-model.js:154`, `src/model-optimizer.js:17` (10 JSON-equality sites in 8 files). The two families treat NaN and `-0` differently. Leave them; flag `optimizexl-geometry.same` as deliberately loose.

### L10. `round` helpers: intentional, no change
`src/ai-sketch.js:225` (0.1), `src/attachemator.js:334` (1e-4), `src/motion-inspector.js:10` (`toFixed(2)`), `src/sort-my-mess.js:34` (1e-3), `src/animation-tracks.js:298` `fmt` (`toFixed(6)`). Each precision is part of that feature's output. 36 `toFixed` sites in 29 files; no general formatter is needed.

---

## Already shared and good

- **Deep clone** is uniformly `structuredClone` (246 sites in 84 files). There is no `JSON.parse(JSON.stringify())` cloning and no hand-rolled deep clone. The `clone`/`copy` aliases (`src/animation-tracks.js:14`, `editor-document.js:26`, `history-store.js:9`, `model-optimizer.js:15`, `keyframe-timeline.js:6`, `node-clipboard.js:7`, `particle-recipes.js:9`, `particle-bindings.js:39`, `sort-my-mess.js:16`) are one-line wrappers. Removing them is optional. `src/anim-xl.js:953` `cloneKey` is a deliberate typed-array fast path.
- **Quaternion maths** (multiply, slerp, invert, angle, Euler) and **matrix compose/decompose** all go through three.js. There are no hand-rolled quaternion multiply or slerp formulas (`showcase-director.js:30-45` is a vector arc slerp for camera paths, a different job).
- **ObjectId allocation** has one owner: `src/editor-document.js:798` (`createNode`). `dummy-bone.js:26` only repairs an invalid id.
- **2D polygon helpers** live in `src/forge-geometry.js` and are already imported by `corpse-geometry.js` and `forge-detail-magnet.js`; only `forge.js` and `sd-kit.js` re-implement them (M2).
- **`rotationDistance`** is exported and tested (`test/motion-inspector.test.js`); it just needs its two copies removed (H2).
- **`partPathKey`** (`src/bits-and-parts.js:12`) is already a shared exported path key. It only needs to become the general one (H1).
- **Track sampling** goes through `animation.js` `sampleTrack` for interpolation (no local interpolators found in this pass).
- **`display-number.js`** (`displayNumber`) is a tidy single-purpose shared helper (5 importers).

## Suggested order (smallest first, each independently mergeable)

1. M2 + L5 (`forge.js`/`sd-kit.js` import from `forge-geometry.js`): identical code, Forge tests.
2. H2 step 1 (`optimizexl-motion*` import `rotationDistance`): identical code.
3. H3 Forge trio and SD Kit into `src/vec.js`: identical code.
4. L1 `src/crc32.js`, L8 `rotationOf` hoist, M5 Euler helpers.
5. H1 `gamePathKey` (decide the `undefined` behaviour for the three unguarded sites first).
6. M1 `clamp` (plain copies only).
7. M6 `bone-tools` used set (small behaviour fix, owner decision).
8. M3, M4, M8 (need an owner decision on edge cases: empty geoset extents, invalid global ids, default tangents).
