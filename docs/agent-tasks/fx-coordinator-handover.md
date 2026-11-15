# FX coordinator handover (14 November 2026, evening)

For the next coordinator chat. The previous one grew too large and costly. Read this, then `fx-effect-redesign.md` (latest sections) and `fx-pass9-intent.md`.

## State
- Branch `claude/fx-effects` in `D:\Claude\MDLxL\.claude\worktrees\fx-effects`, last commit `edf6d8bc` (team tattoo removed: "tattoo concept didn't work"). Everything is local; nothing goes online until the owner says "merge".
- The last test build the owner saw is `TestBuilds\fx-effects-14` (it still had tattoos).
- Other branches waiting for "merge":
  - `claude/ribbon-sweeps-6d004b`: ribbon sweeps, owner-approved.
  - `claude/node-display-37527c`: object display clean-up, in progress in its own session.
  - Both this branch and the ribbon branch add to `THIRD_PARTY_NOTICES.md` "FX reference models"; keep each entry once when merging.

## Next FX round (Fable leads; one Fable run at a time; design first)
1. The MM20 Stormforger and BlueRed Lightning Missile lightning pass. Measured in `out\fx-design\pass10\lightning-ref.md`, nothing built. Approved lightning looks get additions only.
2. Pass 9 looks from `D:\Claude\MDLxL-TestModels\fx-reference-owner3\`. Measured in `out\fx-design\pass9\ref.md`, nothing built.
3. Animation-sequence visibility (intent B).
4. Known gaps:
   - Confirm "Emitter markers" starts on.
   - Fix the picker test helper (`pickFx`) and `test/fx-placement-handles.electron.cjs`.
   - `fx-emitter-persistence` timed out in the last run.
   - The fr/de key-order test still fails (the owner hasn't decided on reordering).

## Owner rules learned this round
- The owner reviews looks by eye. Fable designs and codes. Sonnet does manual work. Opus reviews captures only when it saves Fable's time.
- The owner must have an open test build before 100% of the 5-hour window. The watcher is `out\package-watcher-live.sh`, triggered by `out\PACKAGE-NOW.txt`; it is stopped now.
- Native textures only. Blend modes must match the texture, never blocks. No regressions on approved looks.
- FX handles: emitters work like EMTR (click one dot, drag it). No clusters of unexplained lines or circles.
- Coordinator: short replies. Don't relay routine side-session status. Only send builds and questions.
