# Slider − and + buttons

State: completed. Merged in PR #666 (6d7cc2e3). Owner asked on 16 Nov 2026
(from a Discord request about EMTR): every slider gets small −/+ that move it one step,
without clutter, sliders slightly smaller; keyframe/time sliders excluded; "anything
that will be and ever was".

## What exists

- `RangeInput` in [Fields.jsx](../../app/Fields.jsx): an `<input type="range">` with − and
  + after it in the DOM (so a surrounding label still names the slider), shown on its
  ends by CSS `order`. A click moves one `step` (`step="any"`: 1% of the range) with a real
  `input` then `change` event, so every existing handler works unchanged and a click is one
  edit. Holding repeats after 400 ms every 70 ms and commits once on release.
  `onStepStart`/`onStepEnd` open and close an edit for sliders that do that on pointer down
  (EMTR/FX `ParticleSlider`, Auto Corpse, collision sizes).
- `RangeField` uses it, so every RangeField slider (and XFER/ANIM rebuild branches, which
  use RangeField) has the buttons.
- Time scrubbers stay plain and are marked `data-time-scrub`: EMTR playhead, source and test
  views, splat preview, Auto Corpse death time, OptimizeXL frame, Sort My Mess frame,
  Game Files animation time.
- Values a model stores as 32-bit numbers (3.6 → 3.5999999) count as on the step, or the
  second press would land on the same spot.

## Verification

- `test/ui-primitives.test.js`: step maths, markup, and a guard that fails on any bare
  `<input type="range">` in `app/` that is not marked `data-time-scrub`.
- `test/slider-steps.electron.cjs` (packaged app, real mouse): EMTR Aim X click, −, one
  Undo per press, hold repeats and undoes in one step; Settings wheel sensitivity.
- Looked at by eye: EMTR Motion, Settings → Mouse → Wheel, Forge add shape, Showcase.
  Other windows' sliders were converted but not opened by eye.

## Open

- Vertical Forge "Mesh detail" slider: buttons stacked by `column-reverse`; direction not
  checked by eye.
- `claude/transfer-xl`: its time strip `xs-scrub` is a bare range input; mark it
  `data-time-scrub` when that branch merges main, or the guard test fails.
