# Release 0.40.2 (hotfix)

State: **completed.** Merged in PR #664 (e8f9805f), tagged v0.40.2 and published 16 Nov 2026. Claude Code.

## Owner's request (16 Nov 2026)

"RGB DOES NOT APPEAR THE SAME ... I see red color different from animations." "I want it to be the
same view with shadows/lights/rgb on - 0 DIFFERENCES ... it should show me what I am working on."
"FIX IT NOW AND FAST AND PUSH TO RELEASE". 0.40.1 had only made Vertices open with RGB on; the
colours still differed.

## Cause and fix

- With anti-aliasing on (the owner's setting; fresh test profiles have it off, which is why the
  0.40.1 checks matched), Vertices drew the model into a linear Three render target. Geoset RGB and
  Blend layers then mixed linear colours, and the final copy encoded them: reds turned orange and
  washed out. Animations (war3-model) and the game mix encoded colours.
- `layerMaterial(..., { encodedOutput: true })` (Vertices only) writes sRGB-encoded colour itself;
  `createModelSmoothing(renderer, { encodedModel: true })` keeps encoded values in its target (the
  grid copy encodes into it, the final copy passes it unchanged). Citadel Paint is unchanged.

## Checks

- `test/vertex-rgb-antialias.electron.cjs` (owner's Baron, `MDLxL-TestModels/vertex-rgb-match`):
  anti-aliasing on vs off, same camera. Old build: 32% of surface pixels differ, red
  [101.8, 28.7, 18.9] vs [100.5, 19.2, 12.1]. Fixed: 3.1% (edges only), red [99.6, 19.1, 12.1].
- vertex-rgb-preview, vertex-modulate2x, viewport-materials, smooth-edges pass.

## Notes

- Owner, while CI ran: "Add an apology to the patch so people see it in the updater" (first bullet: the updater shows bullet lines only), then "Merge hotfix patch notes" / "both of them": the 0.40.2 notes carry the 0.40.1 bullets under `## 0.40.1`, because the updater shows only the newest version's notes. No site fold (it would show 0.40.1 twice).

## Published

- Release https://github.com/UnsctMagic/MDLxL/releases/tag/v0.40.2; public ZIP SHA-256 74e079d2…cd198a matched by hand. FFmpeg source ZIP reused from 0.40.1 (`electron/ffmpeg/` unchanged).
- CI ZIP: vertex-rgb-antialias, vertex-rgb-preview, vertex-modulate2x pass.
- Click sweep on the CI ZIP (footman; vertices, vertices all selected, animations): 628 clicks, 0 crashes, 0 freezes, 0 undo problems; 7 dead are the expected ones (Fit already fitted, BitsAndParts folder actions, blocked file dialogs, Expand all with hierarchy off). Not reached: Global Sequence Manager (the footman has no menu entry for it).
- Website post: LowPolyWorks PR #96 (main) and gh-pages; six languages, live. Discord announcement workflow succeeded.
