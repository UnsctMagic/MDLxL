# FX passes 8–9: the owner's intent (14 November 2026)

Written by the orchestrator (Opus) from the owner's long free-form messages. Fable leads all design and meaningful code. This file is the brief; `fx-effect-redesign.md` is the running task note.

## The goal

FX ships as a polished tool, now the owner's favourite MDLxL feature: "This tool is going to de-mystify a lot of magic for people." The most important things are **modularity** and **many beautiful presets to mod from**. It must read shapes well on many models; the owner tested a grunt too, and it was good.

How to learn (owner's words): "I love how fable learns and adapts, not just throw these in. They are all using the same materials, the same tools - they are just well made. Fable adapts them, makes them snap to surfaces - he creates from there much more modular and more re-applicable templates to use and also enhances what is."

**No regressions:** nothing added may change a look the owner already approved and likes (Fire, Fel fire, Frost, Lightning, Crackling arcs, Crystal, Lightning cage, Star flare, Fly swarm, and everything else praised so far). Saved models compile as before.

## Work list

### A. Pass 8 list (not started; the limit cut it off before any commit)

The pass 8 brief stands in full: crystal spike geosets with sliders, flush to the skin (the explicit permission to create geometry); team colour tattoo; team fire; Void walker inspiration; Arcane swirl; Rune circle (weapons back to at least pass 6 quality, and the body must show); Glow orb; Plague clouds as one cloud sized to the whole part; Fly swarm variations with emitters riding the flies; elemental barrier orbs (fire, ice, acid, lightning) flying around the unit; Souls sized to the part; twirling energy from the pass 7 references; wrapping on many surface types.

### B. New: animation sequences, not only global sequences

"Currently it can only make global sequences, lets also allow it to create animation sequences by setting visibility already in the editor." FX effects can be bound to the model's animations: visible only in chosen sequences (for example Attack or Spell), via visibility tracks set in the FX window. Global-sequence looping stays the default.

### C. New references (read-only): `D:\Claude\MDLxL-TestModels\fx-reference-owner3\`

Learn and adapt; never copy. Native art only.
- **Orcish Runes** and **Darkness Rising:** floating, moving letters. Ideas: a swirling cloud of runes the user can add more or fewer of, like flies; runes embedded inside swords and armour.
- **Fire Arrows:** a beautiful use of particles for elemental sweep attacks. The sweeps themselves go to the Ribbon maker (a separate session, see below); FX can learn the particle craft.
- **Radiance:** shimmers and rings, nice particle use.
- **Lord Archimonde:** his hooves have a fel-lava skin overlay that is "perfect for many effects", such as a demonic sword, demonic skin or hooves.
- **Frost Fury:** very nice frost and ice emitters.
- **Doom Emperor:** fel fire with black smoke.
- **Prism Ray:** magical mist.
- **SoulArmor:** "VERY WELL MADE SOULS". The model for Souls.
- **Vengeful Spirit:** demonic fire energy, shimmering, almost like fire crystals.
- **Infernal Bulwark:** the swirling flames.
- **Demigod Cenarius:** leaf overlays that lie nicely on the surface; use them.
- **Nature Blast:** leaves and green energy.
- **Shalamayne:** "intense", a weapon sheen that follows the edge of the sword. "id love a version of this that adapts to surfaces."
- **Demon Hunter:** the same kind of sheen, but not seamless. Learn from it and make ours seamless.
- **Heart of the Storm:** "EXCELLENT use of electricity between stuff - like its holding pieces together", and the way the electricity moves is very good for WC3.

Every studied model goes into the credits (`THIRD_PARTY_NOTICES.md` "FX reference models", with author, link and permission check), the same way as before. Hand that to a Sonnet agent.

## How the work runs (the owner's workflow; follow it)

- **Fable drives the show:** all design and meaningful code. It decides which agents to use.
- **Sonnet (cheapest) does the manual work:** loading many models, running the capture workbench (`out\fx-look\run.ps1 -Plan … -Out …`, hidden desktop), taking the pictures, translations, test expectations.
- **Opus (mid) reads the results:** compares captures across models against the approved Great Unclean Dude results, decides what looks off, and forwards only the bad cases, with the relevant images, to Fable. Fable does not read every image.
- **Test models:** `D:\Claude\MDLxL-TestModels\fx-owner\Great Unclean Dude.mdx` (approved reference) and `fx-owner\variety\` (Chikichiki, Knight Nurgle, Khorne Berserker, Void walker). Add native units such as a grunt and a footman through `test/helpers/fixtures.cjs`.
- **The owner reviews the build by eye.**

## Credit rule (hard)

The owner has approved running each 5-hour window to 100%, and must have an open test build before 100% hits. At **90%** of the 5-hour window, everything must be committed with the build passing. Then create `out\PACKAGE-NOW.txt`: a watcher builds, packages and opens a test build for the owner while work continues. At 98%, stop starting new work, commit, update the task note with the exact next step, and report.

## Ribbon maker (separate session)

Elemental sweeps (fire, frost, spirit and the like, learning from Fire Arrows) go to the Ribbon maker in its own session, with the same workflow and quality bar.
