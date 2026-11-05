# Release material after 0.38.0

This recipe starts with the next release **after 0.38.0**. Do not backfill
released notes, old PDFs or old website release JSON. Tutorials are maintained
in every supported tutorial language, including the existing tutorials.

1. Choose the release version only when the owner authorizes release work.
   Prepare the full notes in `docs/RELEASE-<version>.md` (English) and
   `docs/RELEASE-<version>-ES.md`, `-RU.md`, `-ZH-CN.md`, `-FR.md`, `-DE.md`.
   All six describe the same release. Preserve names, IDs, paths and shortcuts.
2. Every newly authored PDF guide has six versions. Use suffixes
   **EN / ES / RU / ZH-CN / FR / DE**, e.g.
   `MDLxL-<version>-New-Features-FR.pdf`. Render and inspect each PDF.
   Existing historical PDFs retain their original languages and filenames.
3. Run `node scripts/release-material.mjs <version> <D:-output-directory>`.
   It requires all six note files, rejects releases at or before 0.38.0 and
   rejects incomplete language sets for any new PDF guide. It produces the
   GitHub release body, the website's six-language release JSON and guide list.
4. Have Claude publish the resulting `<version>.json` as
   `dist/mdlxl/releases/<version>.json` in LowPolyWorks at release time.
   The site and in-app update popup read that same post. Older posts fall back
   to English for French/German; do not translate or rewrite them.
5. The Draft release workflow uses this generator automatically for versions
   after 0.38.0 and attaches every runtime PDF guide (`scripts/lib/runtime-guides.mjs`,
   also used by packaging). Verify its six links:
   **English / Español / Русский / 简体中文 / Français / Deutsch**. Publish only
   after the [portable release gate](UPDATER_RELEASE_GATE.md) and owner approval.
6. Announcements use the full generated English release body: a linked release
   title, the functional change summary and update instructions, a `Download:`
   line (ZIP, SHA-256, FFmpeg source), `Read patch notes in:` with the six language
   hyperlinks and a `Guides (PDF):` section (this release's new guides by
   language, then one link to the release page that lists every attached guide,
   so the post stays under Discord's limit). The generator requires every notes
   heading to be exactly `# MDLxL <version>` (no suffix, any language) and fails
   when the body exceeds Discord's description limit; it never truncates. Check the complete
   body fits Discord’s description limit and verify the delivered post is not
   truncated. Do not replace it with a links-only stub or edit past announcements.

The [portable updater instructions](AUTO_UPDATES.md) own packaging, publication
and post-release session cleanup. Do not bump versions for localization work.
