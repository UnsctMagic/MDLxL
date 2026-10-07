# Portable MDLxL updates

Settings → Mouse contains **Auto update**, **Search for updates**, and
**Revert to last version**. Auto update is off by default. Enabling it checks
once after the editor starts; it does not download or install anything until
the user selects **Update and restart**. Manual searches work independently.

The prompt shows the newer version and the release's bullet-point summary.
English, Russian, Spanish and Chinese use their corresponding release log.
The full post on Low Polyworks has four language choices at the top.
Help, About, and the update prompt include a small lowpolyworks.com link
leading directly to the MDLxL page.

## Publishing an update

Build the renderer and run `node scripts/package.mjs`. The portable package
now contains `mdlxl-update-manifest.json`, identifying its version and the
SHA-256 of each shipped file. Keep this file in the whole ZIP.

Publish a stable GitHub release in `UnsctMagic/MDLxL` with:

- A strictly newer semantic version tag, such as `v0.20.0`.
- `MDLxL-0.20.0-win32-x64.zip`, containing the `MDLxL-win32-x64` directory.
- The asset's GitHub SHA-256 digest, or its matching `.zip.sha256` asset.
- Release-body links labeled `English`, `Русский`, and `简体中文` to
  `https://www.lowpolyworks.com/mdlxl/?version=0.20.0&lang=en` (or ru/zh).
- Before publishing the release, publish `mdlxl/releases/0.20.0.json` on the
  website, with `version` and `notes` containing the same full Markdown logs
  for `en`, `ru`, `es`, and `zh`. The website and prompt use this one post.

The updater reads GitHub's latest stable release. Drafts, prereleases, equal
versions and older versions do not prompt. There is no separate update feed
to maintain. Unavailable log content leaves the
full-log links available. Network errors leave the editor usable. GitHub
stores the ZIP; public announcements and download instructions lead through
the official Low Polyworks page. Garithos links its release title to that page
and lists the English, Russian and Chinese post links.

## Installation and one-version reversion

Download, checksum verification, archive validation and file verification
finish while the editor stays open. The user's normal save/discard/cancel
flow then runs. Cancelling it cancels installation. After pending writes
finish and this MDLxL process exits, a local Windows helper applies the
verified program files in the existing installation and restarts MDLxL.
The installation location and existing shortcuts stay valid.

The updater never writes into `resources/app/profile`. Existing Addons,
Backgrounds, BitsAndParts and Textures files stay as they are; new shipped
examples are added only to empty paths. Saved models, Showcase recordings,
and other files outside the shipped program manifest remain intact. A
locally modified program file that would be replaced blocks installation.
Obsolete program files are removed only when their contents still match
the previous package's manifest.

Each successful update replaces `.mdlxl-previous` with a verified snapshot
of the program being replaced. Only one previous version is retained. A
failed installation restores changed program files and keeps the existing
snapshot. Temporary transaction copies are discarded after installation.

**Revert to last version** confirms the exact retained version, uses the
same save-before-close flow, and restores the program without network access.
Current settings, libraries and saves remain current. A successful revert
consumes the snapshot; the next successful update creates a new one. Newly
added library examples remain available after reversion.

This release must first be installed through the existing portable download
workflow. Older builds do not contain an updater. Future packages produced
by the packaging script are updateable without reinstalling manually. Legacy
official ZIPs without a file manifest are indexed only after their published
ZIP checksum and archive paths pass verification; a malformed manifest is
rejected.
