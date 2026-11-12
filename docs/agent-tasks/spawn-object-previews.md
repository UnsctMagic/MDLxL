# Contract: Spawn Objects that show nothing

Status: inline preview implemented, package approval pending
Owner / consolidator: Codex (fix), Claude Code (diagnosis, contract and review)
Updated: 2026-11-12

Owner report (12 Nov, Great Unclean Dude.mdx, Node Manager → Nodes → `SPNxUBGH`):
"There are spawn objects that I don't have previews for and when I change them
nothing happens. In this case abomination blood is the only one that works for
this model based on the abomination."

Map row: "UV Wrapper, textures and resource managers" (Node Manager event nodes) and
"Viewport, rendering, cameras and preview" (event effects in the preview). Topic
guide: [RESOURCE-MANAGERS-XL.md](../RESOURCE-MANAGERS-XL.md).

## Diagnosis (verified 12 Nov on main `19481b44`, game data `D:\Warcraft III`)

Picking a Spawn Object does rename the node and the preview does rebuild. The
picked effect then fails to load and the only sign is a small brown line at the
bottom of the preview. Every one of the 104 `Splats\SpawnData.slk` rows was loaded
through the same code the preview uses (`resolveEventDefinition` →
`parseEventRenderModel` in [event-render-model.js](../../app/event-render-model.js)).
Only 29 can show:

| Group | Rows | Why nothing shows |
| --- | --- | --- |
| A. Shows | 29 | HBL0 HBF0 HBK0 HBM0 HBP0 HBPR HBR0 HBSR OBHE OBHS OBFS OBWD OBWR OBT0 **UBAB** DBCR NBAR NBDT NBDR NBDB NBDA NBKG HBBM HBSB NBMF DBBM IFPW HBCE OBCE |
| B. Zero-length global sequence | 19 | HBNE OBTC OBKB OBWY OBG0 OBP0 UBGA **UBGH** UBAC NBDC NBHU NBDH NBCH NBHG DBPT OBBT OBSH CBAL NBWS. Particle-only blood models like UBAB, but they carry a global sequence of length 0. `parseEventRenderModel` runs the editor's save check `validateModel` ([editor-document.js](../../src/editor-document.js) `GLOBAL_SEQUENCE_DURATION`) and refuses the whole effect. The owner's case. |
| C. Format 1800 with more than particles | 26 | UEGG GCBL UDIS EENT DNAM DNAS DUME DUSM INFR INFL INFU DNBL CLID HFSS UBSC UBCC DBPB PEFI DNBD FTSO TOBO IFP0 IFP1 FRBS PBSX GDCR. The game serves these as 1800; they have geosets, materials or other chunks. The event path only accepts 1200+ files that are ParticleEmitter2-only scenes ("Format 1800 event preview currently supports ParticleEmitter2 scenes only"). |
| D. File not found | 19 | EDIS DDIS ODIS HDIS HBS0 HBS1 HBL1 NBVW OBWV OKBP NBMP CHMA CHMB TYCA MFCA MDII USDM, plus junk rows INIT and TEST (`bugger.mdx`). The probe asked CASC for the plain path only; check through the app's own resolver (`preview:eventResources`) before deciding they are absent. |
| E. No model in the table | 10 | HBDH NBFD NBWD NBMG OBSW UBCL UBOB DBDR DBSW DBPL (Model is `_` or empty). They can never show anything. |

Also: Node Manager shows a picture under the list for Blood, Footprint and Uber
Splat (`EventDecalPreview` in [NodeEventEditor.jsx](../../app/NodeEventEditor.jsx)
line 50), nothing for Spawn Object. The click-sweep note already flags
`SPNxHBF0`/`SPLxHBS0`/`SPLxHBS1` in Showcase ([click-sweep-findings.md](click-sweep-findings.md) row 4);
HBS0 is in group D, so expect overlap.

## Goal and completion criteria

1. **Group B shows (the owner's case).** A zero-length global sequence in a
   read-only game effect must not refuse the effect. Do it the way the game does:
   check how the upstream viewer handles a global sequence of length 0
   ([mdx-m3-viewer](https://github.com/flowtsohg/mdx-m3-viewer), event object and
   animated-object code) and record the answer here. Change only the private event
   copy in `parseEventRenderModel`; do not loosen `validateModel` for models the
   editor saves. UBGH on a Footman Death plays blood like UBAB does.
2. **Group C shows.** These are SD models the editor itself can open today.
   Reuse the editor's existing open path for 1800 files (start from
   `parseCompatibleMdx` in [mdx-compatibility.js](../../src/mdx-compatibility.js)
   and follow what `openDocument` does) to give the event renderer a decodable
   private copy. No downgrade of any file on disk, no edit of `war3-model`
   (imported library). HD content stays refused as now. If a model in this group
   still cannot render after reuse, list it here with the reason; do not invent a
   substitute effect.
3. **Group D and E are honest.** Rows whose model cannot be found through the
   app's resolver, and rows with no model, stay listed (the owner may want the
   name for the game) but are marked as having nothing to preview, using the
   wording and look the Sound list already uses for missing sounds
   (`MISSING_SOUND` / `MISSING_SOUND_TIP` in
   [node-event-data.js](../../app/node-event-data.js)). No new style.
4. **No silent failure.** When the picked Spawn Object cannot show, Node Manager
   says so under the list in the same `field-error` line it uses for sound
   errors, with the short reason ("This model format cannot be previewed",
   "Not found in the game files"). Plain words, no flavour text.
5. **Nothing else changes.** Group A renders byte-for-byte as before (same
   instances, lifespans, positions). Blood, Footprint, Uber Splat and Sound
   behaviour unchanged. Camera never moves on pick (AGENTS.md viewpoint rule).

## Live picker preview

The owner reported that the picker still gave no live preview while browsing
Great Unclean Dude. The manager sits over the main model, so the selected
game effect now loops under the list in the existing rotatable 3D viewer.
The preview has its own animation clock and camera. The editor viewport and
authored event timing are independent of it.

## Rules

- Branch `codex/spawn-object-previews` from `main` `19481b44` or newer. Local
  commits only; nothing goes online until the owner says "merge".
- **Owner tests first (owner, 12 Nov).** Build and hand over; do not write or run
  test suites at this stage. The only check before hand-over: open the packaged
  build hidden, pick UBGH and UEGG once, confirm it does not crash.
- Hand back with a test build that opens `TEST SPAWN OBJECTS 01.mdx` (a Footman
  copy with `SPNxUBGH` on Death and one group C object, e.g. `SPNxUEGG`), and a
  short click list for the owner.
- **After the owner accepts, before merge:** add tests per
  [TESTING-RULES.md](../TESTING-RULES.md) (real game files, fail on `19481b44`
  first; one test walks every SpawnData row and asserts its group; named UBGH and
  UEGG cases), then run them plus `pnpm run test:source` against the CI baseline.

## Revision and local state

- Contract branch: `claude/spawn-object-contract` (this note and its README row).
- Base: `main` `19481b44`.
- Probe used for the table: `out/tmp/spn-probe.mjs` in `D:\Claude\MDLxL`
  (untracked, output in `out/tmp/spn-probe.txt`).

## Changes and verification

- The original ParticleEmitter2-only decode remains in place for group A. The
  private event parser allows a zero-duration global for group B and freezes
  its sampled value without changing the editor save validator. The renderer
  pins its zero-duration clock to frame 0. The upstream
  [animated track sampler](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/sd.ts)
  constructs the interval [0, 0] and uses the first key as a constant when it
  lies beyond that interval. Its
  [event object sampler](https://github.com/flowtsohg/mdx-m3-viewer/blob/master/src/viewer/handlers/mdx/eventobjectemitterobject.ts)
  produces no event for a zero-duration global because the modulo yields NaN
  and the interval check fails. The host event clock was left as-is.
- Format-1800 resources outside the existing particle-only layout use
  openDocument and its compatibility codec on the resource bytes in memory.
  HD content remains unsupported. Node Manager marks empty model fields and
  files missing after the app resolver, and shows a short error under the list.
- Built and packaged on D:. Opened the packaged editor with the named model
  on the hidden desktop. Picked UBGH once and UEGG once, confirmed that both
  selected the corresponding event ID and that the editor stayed responsive.
  The initial launch waited on the wrong UI text and made no picks.
- The named model keeps the Footman's original blood event frame (21367) for
  UBGH and adds UEGG at 22533, offset 50 along Y. Launch from
  D:\Claude\MDLxL\TestBuilds\spawn-object-previews\Open Spawn Object Test.cmd.
  It uses a dedicated owner profile and the local Warcraft III installation.

## Next action

After approval, build and package the inline preview and check UBGH, UEGG,
mouse rotation and the missing-model line in the hidden package. The first
handoff package predates the inline preview. The full 104-row classification
and the group A regression check still follow owner acceptance.
