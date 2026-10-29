# Forward-travel particle previews

Status: ready for review; awaiting merge approval
Owner: Codex
Updated: 2026-10-29

## Scope

Make emitted particles and authored foot/hoofprint decals trail behind forward-moving animation previews while the
unit stays centered. No treadmill, ground marker, UI control, authored animation
change, installed-app update, or release is included.

## Implementation

- Base: `188be9cb`; branch: `codex/preview-particle-travel`.
- `app/particle-preview-adapter.js` owns the existing per-renderer native particle
  hooks. World-space particles move backward on X by the current sequence's
  positive `MoveSpeed` multiplied by elapsed animation seconds. The particles'
  own velocity, gravity, lifetime, emission and texture behavior are preserved.
- Zero/unset movement speed adds no displacement. Animation names do not imply
  a guessed speed. `ModelSpace` particles remain attached to their emitter.
- `app/GamePreview.jsx` supplies the selected/authored timeline sequence and
  disables travel for rest pose, isolated globals and paused manual effects.
  Library, Movement, Animations and other consumers share this renderer.
- EMTR's deterministic simulation accounts for independent animation/FX rates.
  Its existing checkpoints retain displaced particle positions.
- `event-preview-runtime.js` also offsets automatic `FPT` ground decals by
  authored movement speed and their animation age. Manual event tests, unrelated
  blood/spawn effects and original event timing/fade are preserved. A separate
  unwrapped animation clock gives each footprint its own loop identity and full
  lifespan. Looping adds new prints without clearing older ones. Pause/resume
  preserves the trail; deliberate seeking or changing animations resets it.

## Verification

- Build and package passed; compatibility suite: 57 passing.
- Focused native-particle checks: 44 passing, including six new tests for
  emission age, stationary/model-space behavior, independent rates, looping,
  checkpoint replay, pause and sequence switching.
- `test/particle-travel.electron.cjs` passed against the hidden packaged app
  with the installed game's Firelord: Walk and Stand in Library, Movement and
  Animations; pausing; existing Alt-drag camera rotation; unchanged document;
  no treadmill UI; no renderer errors.
- Initial full source run: 2119 passed, 22 skipped, one unrelated AI scheduler
  timing assertion failed under concurrent packaging load. Its 26-test file
  passed in isolation. Final bounded-concurrency source run: 2120 passed,
  22 skipped, zero failures.
- Hoofprint follow-up: build plus 14 focused event/particle tests passed.
  `footprint-travel.electron.cjs` verified all four real Chaos Knight hoofprint
  GPU transforms against their contact positions and authored speed, repeated
  paused draws, unchanged model data, normal Alt-drag rotation and no page errors.
  The loop regression test follows the same hoofprint through more than twelve
  actual Walk loops, a pause/resume, its natural fading alpha, and expiration at
  the installed Warcraft table's full seven-second lifespan; newer prints remain.
  The source-built test window was left open for owner review; the installed app
  and model original were not changed.

This is a preview change, not native Warcraft III gameplay validation. Ribbons
and external-model/Popcorn emitters are outside this particle-only change.
