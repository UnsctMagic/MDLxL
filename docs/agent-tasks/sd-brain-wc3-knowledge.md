# Task: SD Brain that knows how Warcraft III models are made

Start from branch `claude/ai-console-tools` (PR #291, not merged yet). Make your own
branch from it, keep everything that is there, and open your PR into that branch or
into `main` after #291 lands. Do not restore older snapshots.

## What the owner wants (their words, summarised)

MDLxL is a tool where all you can make is Warcraft III models, and it now has an AI.
The AI must stop treating MDLxL like a generic 3D program. A casual prompt such as
"make a sword", "orc grunt with an axe", "banner of khorne" or "make this armour
cooler" should come out looking like it shipped with Warcraft III (classic SD), without
the owner writing careful prompts full of constraints. The owner can get good results
today only with careful prompting; the job is to make the AI write that careful
prompt for itself, from real knowledge of how Warcraft models are built.

- Basic, not fancy. Current results are too smooth and too dense ("insanely round
  meshes"). Warcraft is low-poly and faceted: a grip is a 4-5 sided tube, a head about
  60 triangles, an arm a few boxy segments; the detail lives in the painted texture.
- Understanding, not a box of parts. Do not solve this with prefab shapes: over time
  every sword and skull comes out the same. The AI must know how to build each kind
  of thing (different sword types, different skulls, muscles, armour, cloth, hair,
  creatures, buildings, trees, props, effects) and build it fresh each time.
- Native textures. The AI should know Blizzard's in-game textures (what is on each
  sheet and where) and map parts onto them, the way real Warcraft and Hive models do.
  New painted textures are a fallback when nothing native fits.
- Never copy a model. Learning from the game's models (measuring them) is fine;
  loading a game model and reusing its geometry as the result is not, unless the user
  explicitly asks for that.
- It must also help with edits to the owner's own models (adjusting, UV mapping,
  cleanup): the knowledge decides what to change and what to keep.

## What exists already (read these first)

- `src/ai-sd-rules.js`: `AI_SD_ART_DIRECTOR` (a tool-free turn that turns each prompt
  into a fixed-format brief: Goal, Kind, Role and size, Parts, Silhouette, Shape
  language, Palette, Focal motif, Painted, Avoid, Checks), `AI_SD_BRAIN` (the builder
  policy), `AI_SD_RULES` (the older rulebook), review criteria and `sdReviewProblem`.
- `electron/ai-service.cjs`: `artDirection()` runs the art director once per task;
  the brief is shown as a collapsed "Art direction" row and is appended to the
  builder's prompt and to the Offload worker's job. With SD Brain on, every
  `mdlxl_review inspect` also returns front/back/left/right views.
- `src/sd-kit.js`: the SD Kit (lathe, blade, emblem, extrude, spike, ring, sphere, box,
  and a painter that bakes light, creases, edge highlights, sheen, glow spill and
  patterns into one texture). This is the "box of parts" the owner does not want as
  the main approach. Keep it as an optional fallback painter; stop steering the AI
  to it as the default way to build.
- `app/ai-editor.js`: an AI edit that leaves the model unsavable is undone and explained.
- `docs/AI-SD-REFERENCE-STUDY.md` and `docs/AI-SD-STUDY-DATA.json`: the earlier
  measured study (3,448 installed Blizzard models; 646 Hive models from 90 resources
  that allow use with credit; excluded resources must stay excluded and unmentioned).
  The earlier study scripts and CASC indexes are in
  `D:\Codex\mdlxl-sd-rulebook-20261024\work` (for example `model-metrics.mjs`,
  `casc-model-index.json`, `casc-texture-index.json`); `electron/casc.cjs` reads the
  installed game.
- `docs/agent-tasks/ai-editor-hook.md`: history and verification notes.
- `scripts/sd-trial/`: the trial rig used on 2026-10-24/25. `trial.ps1` runs one real
  prompt through the packaged app with the real Codex provider on a hidden desktop and
  saves five pictures, the chat and the exported model under `out/sd-trials/runs/<label>`.
  It links (never copies) the test build's Codex sign-in, uses its own port and
  profile, and ends only its own process tree.

## Deliverables

1. **Measure the game, by part.** From the installed SD models, measure what each kind
   of part is made of, not only whole-model totals: sides of round parts (grips,
   shafts, limbs, horns), triangles per part type (head, hand, foot, torso, shoulder
   pad, helmet, blade, guard, pommel, shield, cape, wing, tail, tree trunk, roof...),
   proportions relative to body height, how muscles/faces/hair are handled (geometry vs
   painted), and how cloth, capes and banners are built. Use geoset, bone and texture
   names to classify parts; record method and confidence. Store results as data in the
   repo (like `AI-SD-STUDY-DATA.json`), never as copied geometry.
2. **A Warcraft modeling handbook** (for example `docs/AI-SD-HANDBOOK/*.md`), one
   chapter per subject: bodies and proportions, heads and faces, hands and feet,
   muscles, each weapon family (human longsword, orc cleaver/axe, elven glaive and
   moonblade, dwarven hammer, undead runeblade, staffs, bows, polearms, shields...),
   armour, skulls and bones, cloth/capes/banners/hair, creatures and wings, buildings,
   trees and doodads, props and items, effects, textures, UV mapping, edits. Each
   chapter gives concrete construction steps and numbers from deliverable 1 (sides,
   triangles, proportions), what is modelled versus painted, which native textures fit,
   race/faction variants, and how to vary things so two results are not identical.
3. **A native texture catalogue.** Index the installed SD textures: path, size, alpha
   use, team-colour areas, what each sheet is for, and named regions (normalised
   rectangles) for reusable areas such as blade, grip leather, gold trim, orc skin,
   cloth, wood, stone, roof tiles, bone. Generate what can be measured automatically;
   label the rest by actually looking at the images (`mdlxl_assets` preview), and say
   which entries were checked by eye. Models keep the game paths; nothing is copied.
4. **Tools the AI uses.** Let the AI fetch only the handbook chapters it needs (for
   example through `mdlxl_help` topics), search the texture catalogue by meaning ("orc
   axe blade", "elven purple cloth"), and lay selected faces' UVs onto a catalogue
   region in one step. Prefer the existing mesh tools (extrude, bevel, mirror, weld,
   UV projection) over new prefab shapes; add small modeling helpers only where they
   are general operations a Warcraft modeller uses.
5. **Art director from knowledge.** The art director picks the relevant chapters for
   the prompt and writes the careful prompt the owner would have written: which type
   of thing, how many sides and triangles per part, which native texture and region,
   proportions, variation, what to avoid. Keep the brief short and visible as today.
6. **A review that catches over-detail.** Measure the result: sides of round parts,
   triangles per part against the handbook, overly smooth normals, parts that float or
   clip. Flag "too round / too dense" so the AI simplifies before finishing.
7. **Prove it with real prompts.** Use `scripts/sd-trial` with SD Brain on and off,
   at least: "make a sword", "make an orc axe", "make an elven glaive", "make a wizard
   hat", "make me a chalice worthy of mordor", "make me a banner of khorne", "make a
   skull" (three times: they must differ), "make a footman-style knight" (body), and
   edits on an existing model ("make this armour cooler", "uv map this properly").
   Success: the casual prompt with the brain looks like a shipped Warcraft III asset
   next to Blizzard models of the same kind (basic, faceted, native or SD-painted
   texture), and is clearly better than the same prompt with the brain off. Put the
   pictures side by side in the PR and in the report.

## Rules (from the owner)

- Plain-language reports; the owner is not a programmer.
- No windows on the owner's screen: run every Electron test and trial on the hidden
  desktop (`scripts/hidden-run.ps1`). Never close or restart the owner's open MDLxL.
- Everything on the D: drive. Do not use `C:\Users\PC\Documents\Codex`,
  `C:\Users\PC\Documents\ChatGPT` or `C:\Users\PC\.codex`.
- No new permanent panels or UI clutter; the "Art direction" row stays collapsed.
- Respect resource terms: only Hive resources that allow use and editing with credit;
  the ten excluded ones stay excluded and unmentioned. Blizzard models are measured,
  never redistributed.
- Keep `pnpm test`-style source tests and the packaged AI tests passing; add tests for
  new tools. Do not change the version for unshipped work.
