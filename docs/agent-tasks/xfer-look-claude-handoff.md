# Claude handoff — XFER transplant diagnosis

Avner wants the donor’s posture and motion on the recipient’s own proportions. The same visible failures recur on new rigs. Review the two rejected torso fixes and identify which shared engine failure is worth addressing next. This handoff is for diagnosis. Implementation and another owner grading round are outside this review.

## Start here

Worktree `D:\Codex\xfer-look-fixes`, branch `codex/xfer-look-fixes`. The round report is at `ba1e20ae96`. The retained engine and checker match `claude/xfer-look-check` at `a96fd433`. Neither experimental patch shipped. Use the existing measurements first. Everything is on this PC.

- Read “Sweep over the saved pair lists” and “Round outcome.” The opening status describes the earlier checker build. [Round report](xfer-look-check.md) · [Every changed grade of 9 or 10](xfer-look-fixes-grades.md)
- The owner supplied 295 grades, including 114 nonempty comments. The grade index identifies each donor, saved result and original model where available. Match each look-check reason to what the owner actually reported. [Owner grades and comments](D:/Claude/xfer-look/graded-n.json) · [Measurements of the graded exports](D:/Claude/xfer-look/graded-m4.jsonl)

## Latest owner grades, in his words

On the fresh cloak-and-tail sheet the owner graded only the **Auto fix** result. He saved 9 grades out of 20. Rows 10–20 are unanswered. The later 888-row trials exercised the **normal transplant with Auto fix off**. [Original answers](<D:/Codex/xfer-engine-34/Fresh cloak and tail 20/answers.json>) · [Sheet and model paths](<D:/Codex/xfer-engine-34/Fresh cloak and tail 20/cases.json>)

| Row | Donor → recipient | Grade | Owner comment |
| --- | --- | ---: | --- |
| 01 | Elven Executioner → Zweihander Knight | 0 | weapon DOES NOT stay in his hand - look at attack |
| 02 | Dire Ice Troll → Kroxigor Ancient | 10 | — |
| 03 | Medivh → Ent Mystic | 8 | — |
| 04 | Gryphon Rider → Hawkstrider Knight | 0 | the whole model is messed up, curled up into a fucking ball |
| 05 | Dwarf Demon Huntress → Bonelord | 0 | model shakes up and down during walk on both versions |
| 06 | Raccoon → Giant Arctic Rat | 0 | during walk - front legs collapse into body on both |
| 07 | Silverpaw Marksman → Magnataur | 0 | Whole body is messed up 100% what the fuck is this shit codex fuck you |
| 08 | King Bloodstone Ragnar → Arkain Prosecutor | 10 | — |
| 09 | Thanatos Serpent → Ironclaw Beast | 0 | NO MOVEMENT IN TAIL OR LEGS FOR FUCKS SAKE CODEX |

Across sheets held out during calibration, the checker caught 37 of 59 low grades and flagged 23 of 139 high grades. On cloth-01 it flagged bobbing in Spell. The owner saw the weapon leave the hand in Attack. Treat those as separate observations and keep the published checker and thresholds fixed.

## What the two trials established

| Result across the same 888 rows | Starting engine | Trial 1 | Trial 2 |
| --- | ---: | ---: | ---: |
| Skin stretch warnings | 91 | 75 | 90 |
| Rows with any warning | 259 | 246 | 258 |
| Previously clean rows newly flagged | — | 2 | 0 |
| Changed high-grade exports that still flagged | — | 6 of 59 changed | 2 of 10 changed |
| Required tests passing | 251/251 | 250/251 | 251/251 |

- **Trial 1** kept the recipient’s torso weights wherever its skin already covered every mapped donor bend. It cleared 16 stretch warnings. It also changed accepted exports and removed two expected blended vertices from Kurgan → Tauren. Its two newly flagged rows, humanoid-214 and panel-39, use the exact same mirrored Gryphon Rider → Wyvern Rider files. [Patch for reading](../../out/look-fixes/stretch-1.patch) · [Per-pair changes](../../out/look-fixes/stretch-1-delta.json)
- **Trial 2** protected a sewn torso edge only when two independent donor hinges turned more than 90° from their starting relation and the height split more than doubled the edge. Only Felguard → Murloc cleared. Two changed high grades still flagged. Murloc Behemoth → Sea Giant (9) already had collapse at 0.442 and its stretched-edge share improved from 6.5% to 6.0%. Fel Vindicator → Dark Hunter (10) already had collapse at 0.425 and stayed there. The rule required a changed high-grade export to pass all checks. Both failed that requirement. [Patch](../../out/look-fixes/stretch-2.patch) · [Per-pair changes](../../out/look-fixes/stretch-2-delta.json)
- **Denominators matter.** The 888 saved manifest rows contain **877 distinct ordered donor/recipient file-path pairs**. All official gates used 888. The baseline stretch warnings cover 90 distinct ordered path pairs. Count distinct rigs alongside manifest rows when arguing that a cause generalizes. Of 140 high grades, 138 could be rebuilt. The original Daemonette21 recipient for grades 24 and 37 is missing. [Sweep manifest](D:/Claude/xfer-look/sweep-pairs.json) · [High-grade inputs](../../out/look-fixes/high-inputs.json)

## Evidence for the diagnosis

Join the three measurement files by `key`. Run `verdict(row.m)` from `scripts/xfer-look/verdict.mjs` to recover all reasons and their worst clips. The existing files cover every row. [Baseline measurements](D:/Claude/xfer-look/sweep-888.jsonl) · [Trial 1 measurements](../../out/look-fixes/stretch-1.jsonl) · [Trial 2 measurements](../../out/look-fixes/stretch-2.jsonl)

The 23-pair edge probe contains source geoset and vertex indices, original and result bone groups, lengths and clip offsets. H912 has 18 stretched edges with both ends on the Murloc’s original chest. H153 has 98 from one original Minotaur torso bone. H75 and H982 show why a stretch flag alone is insufficient. At 408 ms in Attack Slam the Gor’s visible head edges reach 1.667× their starting length. The corresponding result peaks are 1.678× on the Ghoul and 1.679× on Jaina. The donor visibly authors that head movement. Other edges on those rows still need their own evidence. In the normal engine, follow `fitTrunk`, `trunkShare` and `vertexTargets`. [Measured edges](../../out/look-fixes/edge-probe.jsonl) · [Normal transplant engine](../../src/skeleton-transplant.js)

## What to return to Avner

1. Explain why a useful reduction across the sweep still failed to protect good work, and why the narrower rule missed almost all flagged pairs. Distinguish a newly introduced defect from an inherited warning on a changed export.
2. Identify shared causes on genuinely different rigs. Use POSE handles, geoset pose, bones, attachments and the donor’s and recipient’s own animations together. For each cause you can confirm, give the affected row count, independent rig examples, a clip and frame, and a high-scoring control. Trace the same visible skin or sewn edge from its native pose through the transfer. Mark unresolved rows and hypotheses explicitly.
3. Recommend one general rule in the layer that owns the fault and one independent visual measurement that could disprove it. Preserve the existing gates for any future implementation. The targeted warning must clearly fall across all 888 rows, each other warning may rise by at most two, changed 9s and 10s must pass every check, and all four test files must pass. Keep the review local and reuse the saved runs. The two-failure stop stands. No further grading is needed from Avner for this diagnosis.
