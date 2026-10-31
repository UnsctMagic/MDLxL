# Bitz visibility, RGB list and global animations

Status: ready for review; awaiting merge approval
Owner: Claude Code
Updated: 2026-10-31

## Request (owner, 31 Oct)

- Replace Part takes its visibility from the part it replaces.
- A Bit imported whole gets standard visibility, the way CORP decides it
  (body part, corpse, or portrait background).
- Bitz uses a Bit's animations only for RGB. List the distinct RGBs, not the
  animations: animations with the same RGB are one entry. A Bit with one RGB
  (or none) shows no list. Several start with "No RGB".
- A Bit with global animations asks "Keep global animations?" when collecting
  and "Apply its global animations?" when importing.

Why: SlaanSword hides itself inside its own Death animation, so picking Death
in the old animation list imported the sword invisible in every animation.
SlaanBlade (saved from an Untitled model after a geoset paste) carried show/hide
keys from two other models that no animation covers, so they could not be seen
or edited anywhere.

## Implementation

Branch: claude/bitz-visibility.

- src/bits-and-parts.js: `partRgbOptions` (distinct looks, compared as the shown
  0-255 values; exact colours kept), `partLook` replaces `partRgbSnapshot`,
  `partHasGlobalAnimations`, `collectedPartModel({ keepGlobals })`. `commitPart`
  takes `look` (Bitz) instead of `rgbSequence`; without `look` (game-file
  library, tests) the as-is path is unchanged. With `look`, a Bit's own alpha
  never travels: a replacement copies the alpha of the replaced geoset most of
  its vertices took their binding from; a whole import gets `standardVisibility`.
- src/auto-corpse.js `standardVisibility`: body = shown everywhere, through
  Decay Flesh until its last frame, hidden in Decay Bone; corpse (gutz/corpse
  texture) = only while decaying, as CORP's corpse; team-glow background =
  Portrait only. No decay animations: plain alpha 1.
- app/PartRgb.jsx replaces PartAnimations.jsx (select labelled RGB, accessible
  name "Bit RGB" because the main window already has an "RGB" checkbox).
  BitsAndParts and CollectBit ask the global question in their footer.
  Collect Bit's preview no longer plays animations.

## Verification

- Focused tests: bit-replacement, bits-and-parts, bit-collection,
  collect-bit-save, auto-corpse, localization, model-import-identity and
  related suites pass (new tests cover each rule above).
- Hidden-desktop window tests pass: bit-replacement.electron.cjs and
  bit-collection.electron.cjs (RGB list order No RGB / 255/0/0 / 0/0/255).
- Owner's SlaanSword and SlaanBlade replacing the Horns axe: imported pieces
  show exactly where the axe showed; neither shows an RGB list.
- Not exercised in a window: the two global-animation questions (unit-tested).
