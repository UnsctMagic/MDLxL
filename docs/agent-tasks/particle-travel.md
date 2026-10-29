# Forward-travel particle previews

Status: ready for review; awaiting merge approval
Owner: Codex
Updated: 2026-10-29

## Scope

Make emitted particles trail behind forward-moving animation previews while the
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

This is a preview change, not native Warcraft III gameplay validation. Ribbons
and external-model/Popcorn emitters are outside this particle-only change.
