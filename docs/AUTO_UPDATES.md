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

GitHub Actions builds the package. Bump the version (see AGENTS.md), merge to
`main`, then push a tag that matches `package.json`, for example `v0.22.2`. The
**Draft release** workflow fetches the pinned FFmpeg, builds, tests, packages,
zips the result and creates a **draft** release with
`MDLxL-<version>-win32-x64.zip` and its `.zip.sha256`. Drafts are invisible to
the updater and do not trigger the Discord announcement, so nothing reaches
users until you publish by hand. Before publishing, run the release gate in
[UPDATER_RELEASE_GATE.md](UPDATER_RELEASE_GATE.md) on the CI ZIP, attach
`MDLxL-FFmpeg-corresponding-source.zip`, and add the language links below.

To build the same package locally instead, run `pnpm run fetch-ffmpeg`,
`pnpm run build`, then `pnpm run package`. The manual steps are:

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

## After publishing: archive finished sessions

Once the release is published (never at tag or draft time), tidy away the chat
sessions whose work shipped in it. This is automatic: the owner has approved
it, so do not ask before archiving.

1. List its PRs. `<previous>` is the newest earlier published release from
   `gh release list --exclude-drafts`, so a never-published draft's PRs count
   toward this release: run `git fetch --tags origin`, then
   `git log --first-parent --format=%s v<previous>..v<new> | grep -o '#[0-9]\+' | sort -u`.
2. For each PR, `gh pr view <n> --json headRefName,body` gives its `Session:`
   line (see AGENTS.md). Without one, the branch prefix (`claude/`, `codex/`)
   says which tool owns it.
3. Each tool archives only its own sessions. Claude Code uses its archive-session
   tool; Codex archives its own tasks or chats. The other tool's sessions go in
   the report for the owner or that tool to finish.
4. Never archive a session that is still running, has another open PR or
   unmerged work, or that the owner pinned or asked to keep. Archiving removes
   its worktree, so its handover must already be in the repository. The session
   doing the release leaves itself for the owner.
5. Report in plain words what was archived and what was left, and why.

## Installation and one-version reversion

Download, checksum verification, archive validation and file verification
finish while the editor stays open. The user's normal save/discard/cancel
flow then runs. Cancelling it cancels installation. After pending writes
finish and this MDLxL process exits, a local Windows helper applies the
verified program files in the existing installation and restarts MDLxL.
The installation location and existing shortcuts stay valid.

The closing editor acquires an installation lock before handing off to the
native installer and waits for its startup acknowledgement. New launches exit
before loading editor modules while that lock is present. The installer replaces
complete files atomically, verifies the resulting files and snapshot, drains
launches of the replaced executable, then releases the lock and restarts. The
lock also remains in place through rollback. It is never cleared over a failed
rollback.

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
