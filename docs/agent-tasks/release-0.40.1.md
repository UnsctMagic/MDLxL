# Release 0.40.1 (hotfix)

State: **completed.** Merged in PR #662 (78ffd797), tagged v0.40.1 and published 16 Nov 2026. Claude Code.

## Owner's request (16 Nov 2026)

"These two plus all the MDLxL additions I made APART FROM ANIMXL can be streamlined
all the way to a hotfix release. I am afk. The main thing is the vertex editor
viewpoint fixes that i discovered while working with reds." The two were
`D:\Codex\mdlxl-bundle-textures` and `D:\Codex\mdlxl-start-without-model`.
He also asked: "Confirm that the actual issue with RGB was fixed though - it was showing the wrong colors".

## Decisions taken without the owner (streamline)

- Version **0.40.1**, not 0.41.0: the owner said hotfix, and 0.38.3 set the precedent of
  a patch release carrying small features. QA follows the kit's hotfix path.
- Included: RGB/viewport fixes (`claude/vertex-rgb-on`, 649e506d + 39d453f9), Bundle Textures
  (Codex 315a3937, plus translations), Start without a model (already merged #653),
  everything merged since 0.40.0 (#655–#661), Claude Code own sign-in
  (`claude/claude-code-own-login`), agent rule notes (`claude/test-tiers`,
  `claude/missing-model-rule`, `claude/stale-task-rows`).
- Left out: Transfer (XFER, unfinished round 2, animation work), POSE modern icon sets
  (`claude/pose-modern-icons`, owner picked hover words instead), Codex
  `codex/fx-experimental-20261113` (never reviewed), `claude/fx-editor` (superseded by #645).
- `test/ai-connection-settings.test.js`: the four Claude markup digests were updated; the only
  difference is the removed Sign in button and the new Check sign-in tooltip.

## Checks

- RGB colours: in the packaged build Baron Rivendare's cloth is red in Vertices (RGB on at open)
  and red in Animations; RGB off shows the untinted purple. Cause: Vertices opened with the
  geoset RGB off.
- Packaged (release variant, hidden): bundle-textures (new; fails on the old build: no button),
  vertex-rgb-preview, vertex-modulate2x, uv-wrapping pass.
- Source suite: 4032 pass; the only failures were the four Claude digests above, now updated.
- Click sweep (footman; vertices, vertices all selected, animations, material manager, uv): 661 clicks, 0 crashes, 0 freezes, 0 undo problems. 8 "dead" are expected (file dialogs blocked: Bundle Textures, Save MDX…; Fit already fitted; BitsAndParts folder actions; paste with empty clipboard; Expand all with hierarchy off).

## Open for the owner

- Not hand-tested by the owner: Baron's horse skull now shows stripes in Animations too
  (the model's clamped duplicate texture entry; matches the file and the Hive viewer).

## Published

- Release https://github.com/UnsctMagic/MDLxL/releases/tag/v0.40.1; public ZIP SHA-256 b8a27d04…6dfb51 matched by hand.
- CI ZIP: bundle-textures, vertex-rgb-preview, vertex-modulate2x, uv-wrapping, startup pass.
- Website post: LowPolyWorks PR #95 (main) and gh-pages; six languages. Discord post sent (1928 characters).
- Sessions whose PRs shipped were already archived; the owner's main chat (Skynet fork) and the stood-down duplicate hotfix session are left for the owner.
