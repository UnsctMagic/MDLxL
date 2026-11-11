# Bone Namer: standard bone names from what POSE recognises

Status: fix round 2 implemented; ready for Claude QA (owner acceptance pending)
Owner / consolidator: Claude Code (brain, contract, QA); Codex builds the feature
Updated: 2026-11-11

## Goal and completion criteria

Owner, 11 Nov 2026:

> Now I want you to work on a Bone Namer button in Bones editor. It will rename
> bones into a standard MDLxL bone naming scheme that makes sense. Choose a valid
> bone name system and use it - something that is easy for users to find, easy for
> you to sort out and organise in any list (so that browsing the lists becomes a
> breeze). I want it to take any rig and be able to identify based on how Pose
> identifies things, offer a full rename - before the user commits he has a chance
> to review the names and preview the skeleton over the model - if he sees errors,
> he can switch them not by manually renaming but by assiging the correct part (e.g
> if a knee got named a thigh or whatever user just corrects it for the system). The
> point of this is just a way for people to organise quickly badly made models so
> that sharing models becomes easier.

What follows directly from those words, and nothing more:

1. A **Bone Namer** button in Bones mode → Tools, next to Attachemator.
2. It recognises the rig with POSE's own recognition and proposes a new name for
   every bone POSE identifies, all at once.
3. A review window shows old → new names and the skeleton over the model before
   anything changes. Nothing changes until **Commit** (one undoable edit).
4. Corrections are made by choosing the right **part** (and side) for a bone,
   never by typing a name. Numbers and names follow automatically.
5. One fixed naming scheme (below), documented, so names are easy to find and sort.

Done when: the owner has tried a test build and accepted it; the QA gates below
pass; nothing else in MDLxL changed behaviour.

## Revision and local state

- Branch / checkout: `claude/bone-namer`, `D:\Claude\MDLxL\.claude\worktrees\bone-namer`
  (dependencies installed with `pnpm install`, FFmpeg copied; not a junction).
- Base: `171b8bb9` (online main). Local only; nothing is pushed until the owner says "merge".
- Fixtures: `D:\Claude\MDLxL-TestModels` (read-only; add, never change).
- Related active work: POSE recognition repair, local branch
  `claude/pose-evidence-repair` (its note `docs/agent-tasks/pose-clues.md` exists on
  that branch only), owned by the session "Fable pose handle regression review".
  Bone Namer only reads POSE; it never edits the POSE files.

## The naming scheme (decision)

**Blizzard's own SD names.** A census of the 398 native SD models in
`MDLxL-TestModels/corpus-sd` (22,218 bones/helpers) shows this is the form
Blizzard uses most: `Bone_Arm#_L/R` 705, `Bone_Leg#_L/R` 598, `Bone_Head` 273,
`Bone_Chest` 231, `Bone_Root` 193, `Bone_Hand_L/R` 313, `Bone_Pelvis` 153,
`Bone_Foot_L/R` 286, `Bone_Tail#` 113, quadrupeds `Bone_Leg#_Front_R`,
`Bone_Leg#_Rear_L`, `Bone_Hoof_Front_R`. Why this one:

- Warcraft III modders already know it; it is what they search for.
- It is valid everywhere: ASCII, no spaces, far under the 79-byte limit.
- MDLxL already reads it: POSE, Attachemator, AnimXL, Auto Corpse and the Bones
  list's region grouping (`src/rig-node-order.js`) recognise these words, so a
  renamed model is recognised by name as well as by shape.
- Alphabetical lists stay readable: every body bone starts `Bone_`, then the part,
  then the number, then the side; a mount's bones sort as their own block.

| Part | Name | Numbering / side |
| --- | --- | --- |
| Root | `Bone_Root` | the actor's whole-body driver (POSE `Body`) |
| Pelvis | `Bone_Pelvis` | |
| Spine | `Bone_Spine` or `Bone_Spine1`, `Bone_Spine2`… | numbered from the pelvis up, only when there are two or more |
| Chest | `Bone_Chest` | |
| Neck | `Bone_Neck` or `Bone_Neck1`, `Bone_Neck2`… | numbered from the chest up, only when two or more |
| Head | `Bone_Head` | |
| Arm | `Bone_Arm1_L`, `Bone_Arm2_L`… | always numbered, from the body outward |
| Hand | `Bone_Hand_L` | |
| Leg | `Bone_Leg1_L`… / `Bone_Leg1_Front_L`… | always numbered, from the body down |
| Foot | `Bone_Foot_L` / `Bone_Foot_Front_L` | |
| Hoof | `Bone_Hoof_L` / `Bone_Hoof_Rear_R` | |
| Tail | `Bone_Tail1`, `Bone_Tail2`… | always numbered, from the body outward |
| Wing | `Bone_Wing1_L`, `Bone_Wing2_L`… | always numbered, from the body outward |
| Keep name | unchanged | the bone keeps its current name |

Rules:

- **Side** `_L` / `_R` is decided by position, never by the old name: Warcraft III
  units face +X, so +Y is the unit's left (y = 0 counts as left, as in
  Attachemator). Use Stand-pose world positions (Stand = `standSequenceIndex` in `src/sequence-editor.js`, Attachemator's Stand rule,
  its first frame; node maths from `src/animation.js`). Trunk parts, Head and
  Tail never get a side. Never give a trunk name a side (POSE demotes a mirrored
  pair named Pelvis/Body/Chest).
- **Position** for legs, feet and hooves of one actor: pair the legs left/right and
  order the pairs by X of the foot, front first (as Attachemator does). One pair:
  no position word. Two pairs: `Front`, `Rear`. Three or more: `Front`, `Middle`
  (`Middle1`, `Middle2`… when more than one middle pair), `Rear`. The position goes
  before the side: `Bone_Leg2_Front_L`.
- **Numbers** are never chosen by the user. Within one actor, bones with the same
  part, position and side are numbered by hierarchy depth, nearest the body = 1.
- **Actors.** Every POSE body (the rig's `body` and every identified bone whose
  resolved role is `Body`, see Recognition;
  a chain with no body above it uses its top ancestor) is an actor; each bone
  belongs to the actor of its nearest body ancestor (or itself). Order: actors whose
  skin is visible in Stand first, then actors with two hands, then larger (span of
  their limb joints). The first is **Main**: no prefix. Then, in that order:
  - **Copy**: an actor whose proposed names are the same set as an earlier actor's
    takes that actor's names plus a suffix: `_Death` if the bone's current name or
    its actor body's name contains "death", `_Portrait` likewise, otherwise `_Copy`;
    a further copy of the same kind adds a number (`_Copy2`, `_Death2`).
  - **Mount**: any other actor larger than Main: the word `Mount_` right after
    `Bone_` (then `Mount2_`…), e.g. `Bone_Mount_Leg1_Front_R`; a mount's bones
    still sort as one block. (Fix round 1: a prefix before `Bone_` hid tail tips
    from POSE's `^bone[ _]` rule on 21 models.)
  - **Extra**: any other actor not larger than Main: `Bone_Extra_…` (then `Extra2_`…).
- **Unique**: a new name already used by another node (any type, including bones
  that keep their names) gets `uniqueName` from `src/node-hierarchy.js`.
- Only Bones and Helpers are renamed. Attachments, emitters, lights, event objects,
  collision shapes and everything else keep their names.

Words other MDLxL tools read (from the POSE brain, 11 Nov; keep them true):

- Never name a forearm with "hand" or "wrist", or a shin with "foot", "ankle" or
  "toe" (POSE's row rule). The scheme's `Arm#` / `Leg#` already avoids this.
- Never produce a lone `W` or `Wep` token (weapon words in `WEAPON_WORDS`), and never
  a name like `Bone_1` / `Helper 3` (`^(bone|helper)…<digits>$` extends chains).
- Chain, rein, guard, camera, over head, cloth, cape, banner, hair, beard, finger,
  thumb, decoration, jaw, lip, eye, brow: POSE leaves these unidentified, so they
  keep their names unless the user assigns a part.
- `Mount_` contains "mount": POSE's `/horse|mount/` follower rule then sees every
  renamed mount body. The QA gate checks this.

## Recognition (from POSE only)

Call `suggestPoseRig(model, frame, sequence)` with the Stand frame and sequence and
**no options object**. On main this is today's POSE; after the POSE repair merges
the default (`clues: true`) is exactly what the POSE screen shows, which is what
"based on how Pose identifies things" asks for (decided with the POSE brain).

Read `chains`, `body`, `nodes` and `roles` from the result. `roles` holds only
POSE's overrides; a bone's role is resolved with POSE's own `poseRole(model, rig, id)`
(exported from `src/pose-ik.js`, used by the POSE preview in `app/pose-overlay.js`):
the override when there is one, else the role POSE reads from the name. A role
counts only when it is one of `Body, Pelvis, Spine, Chest, Neck, Head, Hand, Foot,
Hoof, Tail, Wing`; anything else (`Object`, or a joint's own name) means "no role".

POSE has identified a bone when it is `rig.body`, in `rig.nodes`, a joint of a
chain, or has an override in `rig.roles`; only those bones take their part from
their resolved role. Bones on the parent paths in the last three table rows also
use `poseRole`: a role word gives that part, no role gives Tail/Spine/Neck as listed.
(Decided 11 Nov after Codex's blocker; `poseRole` is read-only use of an existing
POSE export, no POSE change.)

| POSE says | Part |
| --- | --- |
| `body`, role `Body` | Root |
| role `Pelvis` / `Spine` / `Chest` / `Neck` / `Head` | same part |
| chain `kind: 'arm'`, no label: joints before the end | Arm |
| … its end | Hand |
| chain `kind: 'leg'`: joints before the end | Leg |
| … its end | Foot, or Hoof when the chain label or the end's role is Hoof |
| chain label `Wing` (any kind), or role `Wing` | Wing (every joint) |
| chain label `Chain` | Keep name (the user may assign a part) |
| role `Tail` on a tail tip | Tail, for the tip and every joint between it and the body |
| no role, on the parent path from Chest down to Pelvis/Root | Spine |
| no role, on the parent path from Head down to Chest (no Chest: down to Pelvis/Root → Spine) | Neck |
| anything else | Keep name |

A chain end that is not a Bone or Helper (an attachment such as `Hand Right Ref`)
is skipped; the joints before it keep their Arm/Leg numbers. Bones POSE does not
identify keep their names by default; the user can assign them a part.

## The window (mirror Attachemator exactly)

Same `ToolWindow`, list-and-preview layout, CSS approach (theme variables), footer,
key scope and close behaviour as [Attachemator](../../app/Attachemator.jsx). No new
control styles.

- **Button**: Bones mode → Tools, beside Attachemator, same class and size, label
  `Bone Namer`, shown when Attachemator's button is shown. Tooltip: "Renames the
  rig's bones to Warcraft III's standard names (Bone_Head, Bone_Arm1_L,
  Bone_Hand_L…) from the parts POSE recognises. Opens a preview first; nothing
  changes until Commit." No default hotkey (Attachemator has none).
- **List**, one row per Bone/Helper: tick | current name | new name | Part ▾ | Side ▾.
  - Rows are grouped by actor; each group starts with a header row showing
    `Main`, `Mount`, `Extra` or `Copy` and a dropdown with those four, only when the
    model has more than one actor. Choosing `Main` for another actor swaps the two.
    Tooltip: "Which body this group of bones belongs to. Main has no prefix;
    a mount's bones start with Bone_Mount_."
  - Inside a group: Root, Pelvis, Spine, Chest, Neck, Head, left arm, right arm,
    legs front to back (left, right), Tail, left wing, right wing. Rows that keep
    their names come last in one group, `Not recognised`, in hierarchy order.
  - **Part** dropdown: Root, Pelvis, Spine, Chest, Neck, Head, Arm, Hand, Leg, Foot,
    Hoof, Tail, Wing, Keep name. Choosing a part ticks the row; `Keep name` unticks
    it. Tooltip: "The body part this bone is. Arm and leg bones are numbered from
    the body outward (Arm1 upper arm, Arm2 forearm, then Hand); numbers update
    by themselves."
  - **Side** dropdown: Left, Right; for Leg/Foot/Hoof of an actor with two or more
    leg pairs also Front Left, Front Right, (Middle Left, Middle Right,) Rear Left,
    Rear Right. Disabled for parts without a side. Tooltip: "Left and right as the
    unit sees it: it faces +X, its left is +Y."
  - **Tick**: ticked rows are renamed; unticked rows keep their names. Rows whose
    proposed name differs from the current one start ticked; rows whose name is
    already right show it and change nothing.
  - New names are plain text, `translate="no"`, updated live after every change.
- **Preview**: `GamePreview` of a renamed copy, in the rest pose, with the
  skeleton (bones and helpers) drawn over the model, markers on top, Stand-hidden
  geosets hidden (as Attachemator). Empty-space drag turns the camera; nothing can be
  moved; edits never reset the camera (`preserveCameraView`). Clicking a row selects
  its bone (Focused Skeleton highlight) and labels, with their new names, the bones
  of that row's limb (same actor, same part family, side and position; the trunk
  Root–Head is one family). Clicking a bone in the preview selects its row and
  scrolls it into view. Nothing selected: no labels.
- **Footer**: status (error, or "Click a row or a bone to see its name. Drag
  empty space to turn the camera."), **Commit** (active when a ticked row would
  change; tooltip "Rename the ticked bones as one undoable edit"), **Close**.
  Changing a part, side, actor or tick away from the proposal counts as unapplied
  work: exactly as Attachemator, the close key (Escape) then asks for a second
  press, and the Close button and × close the window like Attachemator's do (no
  extra question; fix round 1). Keep the row in docs/HOTKEYS.md's unapplied table.
- Read-only documents: Commit disabled. A model with no recognised parts lists every
  bone as `Keep name` with status "No body parts recognised. Choose a part for each
  bone you want renamed."
- Commit = one undoable edit named `Bone Namer` on `['Nodes']`, through App's
  `edit()` as Attachemator does; the status message says how many bones were renamed.
  Only `Name` changes: no hierarchy, pivots, keys, weights, attachments or other data.
- Every new visible English string gets an entry in all five catalogs
  (`src/locales/ru.json`, `es.json`, `zh.json`, `fr.json`, `de.json`). Bone names
  and part names inside new bone names are never translated.

## Fix round 1 (11 Nov, from Claude's QA of `6d52a020`)

These change the rules above where they differ. Evidence: library gate
`out/bone-namer-corpus/codex-6d52a020/` and diagnosis `out/bone-namer-diag/`
in `.claude\worktrees\bone-namer-qa` (71 of 940 models failed; causes measured).

Engine:
1. **Hub joints keep their names.** A chain joint that is not the chain's end and
   is an ancestor of another chain's end (or belongs to two chains) is part `keep`.
   POSE otherwise runs the other limb through it and drops one (23 models).
2. **Actor word after `Bone_`**: `Bone_Mount_…`, `Bone_Extra_…` (scheme section above).
3. **A mount is never Main.** An actor whose body is a key of `rig.followers`
   is never Main (Steve.mdx lost POSE's horse follower).
4. **Nested bodies.** A Body-role bone below another actor's body is its own actor
   only when at least two limb chains (no `Chain` label) have it as their nearest
   body; otherwise it belongs to the enclosing actor and keeps its name (part
   `keep`). The rider on a horse stays its own actor; an `Abdomen` or `Hip` inside
   one creature no longer splits it into `Extra` (103 models had such splits).
5. **Attachment-ended limbs.** When a chain ends at an attachment, its last bone
   is Hand/Foot/Hoof when its resolved POSE role says so, else the next Arm/Leg
   number (mirrored limbs got different names, e.g. `Bone_Arm2_R` vs `Bone_Hand_L`).
6. **Numbers count within each limb.** Arm/Leg/Wing numbers restart for each
   chain; two limbs of one kind on one side no longer share one sequence
   (windserpent got `Arm2_L` and `Arm4_L`).
7. **Stable names.** Planning a model already renamed by Bone Namer (defaults
   committed) proposes no change. Method: plan → apply to a scratch copy →
   plan again on it, up to three rounds, and propose the last round's names
   (POSE reads named rigs differently: today a second run renames 297 bones in
   71 models, e.g. sheep `Bone_Foot_L` → `Bone_Leg2_L`). The rows still report
   the original model's current names; user corrections apply on top as before.

12. **Mesh-piece ends get `Mesh_`, not `Bone_`.** When POSE grips a limb end by
    its skin (the chain from `suggestPoseRig` has a `grip` array), that end is a
    mesh node with an arbitrary pivot, not an authored joint. Its name is the
    scheme name with `Mesh_` in place of the leading `Bone_`: `Mesh_Hand_L`,
    `Mesh_Foot_Front_R`, `Mesh_Mount_Hoof_Rear_L`, plus any copy suffix. POSE never
    grips a name starting `bone`/`helper` (pose-ik.js:207); the POSE team measured
    that rule on 1,019 models and keeps it, because the prefix means "authored
    joint". Blizzard's own SD rigs keep mesh nodes out of `Bone_` names too. This
    keeps the hand/foot handle on the mesh (166 ends in 100 models jumped to the
    pivot, median 54 units).

Window:
8. Remove the Discard `Dialog`; Close/× behave as Attachemator's (Footer rule
   above). The packaged test found the question hidden behind the window.
9. Raise the CSS specificity (`.atm-row.bnm-row`, `.atm-body.bnm-body`): opened
   before Attachemator, the Part column shrank to 20 px because
   `attachemator.css` loads later.
10. Status: `Bone Namer renamed {0} bone{1}.` with the same plural pattern and
    locale entries as Attachemator's message (today: "renamed 1 bones").
11. Mount the window with `key={session.id}` like Attachemator (today the key
    includes `doc.revision`, so choices are lost if the document changes).

Not ours (sent to the POSE session, no change here): Head moving to the neck when
`Head Ref` hangs on the neck (pose-ik.js:164, 7 models; the POSE team is fixing it
in its clues mode). The skin-grip loss is solved on our side by item 12. The limb re-rooting
after a body or chest gets its real name (20 models) is POSE's intended reading;
the gate reports it for review.

## Fix round 2 (11 Nov, from Claude's QA of `5c25ff10`)

Bug fixes only. QA of `5c25ff10`: packaged workflow 68/68 and Attachemator pass;
source tests 53/55; library gate on main's POSE: 0 LOST/MOVED/GRIP, 7 STABILITY;
on POSE `88aef3e1` also 3 models LOST that belong to that POSE branch (below).

1. **Mount order.** Item 3 means only "never Main". Do not move follower-carrying
   bodies to the end of the actor order: Main is the first actor in the normal order
   (visible in Stand, two hands, larger) that is not a key of `rig.followers`; every
   other actor keeps its normal place. Today the native Knight's hidden horse copy
   (`ABDOMEN01`) becomes the Mount and the visible horse (`ABDOMEN`) its `_Copy`
   (`bone-namer.js:203`).
2. **Nested bodies need their own legs.** Item 4 counted any two limb chains, so a
   spine bone named `Abdomen` with the arms below it became its own actor. A nested
   Body is its own actor only when at least two **leg** chains (kind `leg`, no
   `Chain` label) have it as their nearest body. A rider has legs; a spine piece
   does not.
3. **Hand/Foot/Hoof only from chains.** As the Recognition table says, Hand, Foot
   and Hoof come only from chain ends; a bone that POSE gives a Hand/Foot/Hoof role
   but that is not in a chain is part `keep` (`bone-namer.js:62` assigns them from
   any lone role). Those bones carry only a `Foot Left/Right Ref` attachment; once
   named Foot, POSE writes no role for them, so names flip between two states on
   every run (easterchicken `WingL` → `Bone_Foot_Front_L`, kelthuzad/necromancer
   `RobeBackL` → `Bone_Mount_Foot_Rear_L`; 7 models). Measured: this alone makes
   STABILITY 0 on both POSE versions; 90 lone hand/foot mesh pieces in 56 models
   now keep their names.

Not ours (sent to the POSE side; POSE branch `88aef3e1` only, main unaffected):
zergling's mirrored `Bone Root L/R` lose their Body handles once the hands carry
Hand names (`pose-recognition.js:192-216` reads limb kinds from names); Lord of
Change's wings `B_W_1..6` read as Wing limbs only while anonymous
(`pose-recognition.js:153` skips a pair whose joints have a Wing part role).

## Engine (fixed API, Claude's tests are written against it)

New file `src/bone-namer.js`, pure (no React), importing only shared helpers
(`pose-ik.js` `suggestPoseRig`/`poseChainIds`/`poseRole`, `sequence-editor.js`
`standSequenceIndex`, `animation.js` node maths and `sampleGeosetAnimation`,
`node-hierarchy.js` `nodeIndex`/`uniqueName`, `bone-tools.js` `renameRigNode`).

```js
export const BONE_PARTS; // ['root','pelvis','spine','chest','neck','head','arm','hand','leg','foot','hoof','tail','wing','keep']
export function planBoneNames(model);
// → { actors: [{ body, kind: 'main'|'mount'|'extra'|'copy', copyOf, prefix, suffix }],
//     rows: [{ id, current, part, side, position, actor, name }], error }
//   side: 'L' | 'R' | null; position: null | 'Front' | 'Middle' | 'Middle1'… | 'Rear';
//   actor: the actor's body id or null; name: the proposed name (= current for 'keep').
export function nameBones(model, plan, { parts = {}, sides = {}, actors = {} } = {});
// parts: { [id]: part }, sides: { [id]: { side, position } }, actors: { [bodyId]: kind }
// → rows like plan.rows with every name, number, position and suffix recomputed. Pure.
export function applyBoneNames(model, rows, chosen);
// chosen: Set of ids. Renames those rows' bones to row.name (same checks as
// renameRigNode); all or nothing; returns { changed }.
```

## Out of scope and must not change

- POSE files (`src/pose-ik.js`, `src/pose-recognition.js`), `src/rig-names.js`,
  `src/attachemator.js` and their behaviour. If Bone Namer needs something from
  POSE, stop and record it here; the brain asks the POSE session.
- No new nodes, geosets, textures or data of any kind; only names change.
- No new panels, toolbars or permanent UI beyond the one button and its window.
- No renaming of attachment points (Attachemator owns them).

## Work split

- **Codex** builds: `src/bone-namer.js`, `app/BoneNamer.jsx`, `app/bone-namer.css`,
  the button in `app/MovementControllerRecomp.jsx`, wiring in `app/App.jsx` /
  `app/AppSidebar.jsx` like Attachemator, locale entries, `docs/BONE-NAMER.md`
  (user guide: the scheme table and how to correct a part), the
  [map](../agent-map.md) (Attachemator row gains Bone Namer) and docs/HOTKEYS.md.
  Codex runs `pnpm run build` only; it writes and runs no tests (owner: Codex does
  no QA).
- **Claude** does all QA (below) and reviews the diff against the owner's words.

## QA plan (Claude)

Workers start once the owner confirms the scheme; they write against the API above
and must show each new test failing on code without the feature or with the rule
broken ([testing rules](../TESTING-RULES.md)).

1. Source acceptance tests, `test/bone-namer.test.js` (Sonnet): made-up rigs
   (biped, quadruped, rider on mount, death copy, left hand named `_R`, bones named
   `Bone01…`) and real fixtures: native Footman (left hand `Bone_Hand_R` becomes
   `Bone_Hand_L`), native Knight (rider plain, horse `Mount_`, rig copies), the
   owner's Slaanesh Champion knight (death copy `_Death`), Lahmian. Corrections:
   setting a wrongly included first leg joint to Pelvis renumbers the thigh to
   `Leg1` and the knee to `Leg2`; un-keeping a missed shin renumbers the rest.
2. Library gate, `scripts/bone-namer-corpus.mjs` (Sonnet): for every model in the
   test library, apply the default plan, re-run POSE on the renamed model (as
   animated): no POSE handle lost or moved to another bone; every gained or
   re-typed handle listed for review; no duplicate new names; every `_L` on +Y and
   `_R` on −Y in Stand; every name ≤ 79 bytes; share of bones renamed. Report in
   `out/bone-namer-corpus/`. Rerun after the POSE repair merges.
3. Packaged workflow, `test/bone-namer.electron.cjs` (Opus), hidden desktop: open
   Footman, Bones mode → Bone Namer, the list and labels, change a part and a side by
   dropdown, real mouse drag turns the preview camera, Commit renames, one Undo
   restores every name, Close with changes asks first.
4. Brain review of the diff, then a hand-test build in
   `D:\Claude\MDLxL\TestBuilds\bone-namer` for the owner.

QA state (11 Nov): owner said yes to the scheme. Workers 1 and 2 write in
`.claude\worktrees\bone-namer-qa` on local branch `claude/bone-namer-qa`
(from `189879e3`), separate from Codex's folder; the brain merges it into
`claude/bone-namer` after Codex hands back. Worker 3 starts then.

## Changes and verification

### Fix round 2

- Resumed from clean `06100731a926e9b354ee7a9903265fad8001d17c` on
  `claude/bone-namer` in the same named D: worktree.
- Implemented only items 1–3 in `src/bone-namer.js`: select the first eligible
  Main and promote only it, preserving all other actors' normal relative order;
  count only `kind: 'leg'` chains without the `Chain` label for nested Body actors;
  exclude Hand/Foot/Hoof from standalone and parent-path role assignments, leaving
  endpoint assignment to the existing chain rules.
- Updated the guide's affected actor/endpoint wording. No UI, locale, test or
  protected-file changes. The Engine API, name-only mutations and round-1 rules
  outside these three fixes remain intact. No POSE rebase or merge.
- `pnpm run build` passed (Vite 7.3.1, 40.53 s). Existing JSON import-attribute
  and large-chunk warnings remain. `git diff --check` passed. No tests written or
  run; no fixture, corpus or packaged-app checks. Claude owns QA of these changes.
- Removed this round's generated build, log and temporary directory; dependencies
  were reused unchanged. No task-started background process remains. Saved locally
  with this note; no push, PR, merge or release.

### Fix round 1 (historical)

- Initial implementation: `6d52a020`; Claude's QA findings are recorded in
  **Fix round 1** above. Codex resumed on clean `82600d8f8659dfb563ea1262a2bf6bb831eab78d`
  in `D:\Claude\MDLxL\.claude\worktrees\bone-namer`, branch `claude/bone-namer`.
- Round 1 engine items 1–7 and 12 implemented in `src/bone-namer.js`:
  shared hub joints keep their names; Mount/Extra follow `Bone_` (or `Mesh_`);
  follower-bearing mounts cannot become Main; nested Body actors require two
  non-Chain limbs; attachment-ended chains use the last bone's resolved endpoint
  role when available; Arm/Leg/Wing numbering groups include the individual
  chain; default planning applies to a scratch model and replans for up to three
  rounds; skin-gripped mesh ends use `Mesh_`. The returned `current` names remain
  the original names, and kept rows reserve their original names across rounds.
  Corrections resolve on top of the final default proposal. The four exported
  functions/constants and their argument/return contracts are unchanged.
- Window items 8–11 implemented: removed the extra Discard dialog and trusted-
  event close branch, retaining the shared unapplied Escape guard; increased
  body/row CSS specificity including the narrow layout; changed the status to
  `Bone Namer renamed {0} bone{1}.` with Attachemator's singular/plural pattern;
  restored `key={session.id}`. Actor-name display reads the new Bone_/Mesh_ forms.
- Updated all five locale catalogs, the actor tooltip, `docs/BONE-NAMER.md`, and
  the HOTKEYS unapplied row for direct Close/× behavior. Removed the three
  Bone Namer-specific strings belonging to the discarded confirmation dialog.
- `pnpm run build` passed (Vite 7.3.1, 2,887 modules, 21.62 s). Existing JSON
  import-attribute warnings for `view-menu.json` and large-chunk warnings remain.
  `git diff --check` passed. No tests written, modified or run; no corpus probes,
  packaged app, desktop interaction or model acceptance verification performed.
- No protected files changed: `src/pose-ik.js`, `src/pose-recognition.js`,
  `src/rig-names.js`, `src/attachemator.js`. No POSE branch rebased or merged.
  Model mutations remain names only. Dependencies were reused without installation
  or junctioning. No requested fix-round item was intentionally omitted.
- Removed this round's generated `dist/`, build log and temporary directory.
  No task-started background process remains. Source and this handoff are saved
  together on the local branch; no push, PR, merge or release.

## Blockers and next action

- No new implementation blocker. The three-round naming feedback is implemented
  as specified; its stability across the library is unverified until Claude QA.
- **Next for Claude:** review the round-2 diff against `06100731`, rerun the source,
  corpus and applicable packaged QA against the three items, then prepare the owner's
  hand-test build when the gates pass. Direct Close/× now close immediately;
  only the close key has the shared second-press guard for unapplied changes.
- The Head Ref/neck issue remains with the POSE session, as described above.
  No POSE branch was integrated here. Owner acceptance remains pending.
- On eventual approved merge, mark completed with its revision and remove the
  README task row.
