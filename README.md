# MDLxL 0.35.0

Warcraft III model editor. This source continues the requested MDLVis rebuild lane, with the MDLxL name and icon. Downloads and multilingual update posts are available at [Low Polyworks](https://www.lowpolyworks.com/mdlxl).

## Windows release

Extract the whole ZIP and run MDLxL.exe. Keep its resources, Backgrounds, BitsAndParts and Addons folders together.

## Source development

Use Node.js 22.12 or newer and pnpm.

- `pnpm install --frozen-lockfile` installs dependencies.
- `pnpm run fetch-ffmpeg` downloads the pinned, hash-verified FFmpeg used for GIF recording.
- `pnpm test` runs the compatibility tests.
- `pnpm run test:source` runs the full suite.
- `pnpm run build` builds `dist/`.
- `pnpm start` launches the desktop app directly from the checkout.
- `pnpm run dev` starts browser development.
- `pnpm run package` creates the Windows package under `release/MDLxL-win32-x64`. No installer is required.

The `dist/` build output and the FFmpeg binaries are not stored in git. After pulling source changes, rebuild before launching: `pnpm run build`, then `pnpm start`.

## Testing

`pnpm test` runs the 57 compatibility regression tests; `pnpm run test:source` runs the full suite, including the restored historical tests. CI runs both. See [the compatibility fix status](docs/MDL-MDX-COMPATIBILITY-FIXES.md) for coverage and limitations.

## Agent context

Codex and Claude Code share [AGENTS.md](AGENTS.md). Use the [project map](docs/agent-map.md)
to find a feature and the [task handovers](docs/agent-tasks/README.md) when continuing work.
Agents maintain these documents as part of the task.

## Current version

Version 0.35.0 shows bone pivots: a double-click on any part selects its bones in Focused Skeleton with an axis cross through each pivot. Zoom gets Align (Shift+1) to flatten a selection as seen from the camera, Controller type moves into the Controller heading with multiselect always on, and Glow Up gets Pause/Play. First launch greets you with a themed welcome window, Help > About is a real About, the empty Check model entry is gone, and Spanish, Russian and Chinese translations are caught up.

## Releases

Releases are built by GitHub Actions; see [docs/AUTO_UPDATES.md](docs/AUTO_UPDATES.md).

## Add-ons and notices

The **AI** icon (first in the module dock; hidden in VIS) connects Codex, Claude or a compatible API to model edits,
live selections, animation, viewport inspection and program help. External AI clients
can use the same tools over MCP. See [AI setup and tools](docs/AI-HOOK.md).

See [docs/ADDONS.md](docs/ADDONS.md) for add-ons and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for component credits.

## Release history

Newest first. Translations are linked in parentheses. Older text that existed only in the README is preserved in [docs/RELEASE-HISTORY-LEGACY.md](docs/RELEASE-HISTORY-LEGACY.md).

- [0.35.0](docs/RELEASE-0.35.0.md) ([ES](docs/RELEASE-0.35.0-ES.md), [RU](docs/RELEASE-0.35.0-RU.md), [ZH-CN](docs/RELEASE-0.35.0-ZH-CN.md))
- [0.34.0](docs/RELEASE-0.34.0.md) ([ES](docs/RELEASE-0.34.0-ES.md), [RU](docs/RELEASE-0.34.0-RU.md), [ZH-CN](docs/RELEASE-0.34.0-ZH-CN.md))
- [0.33.0](docs/RELEASE-0.33.0.md) ([ES](docs/RELEASE-0.33.0-ES.md), [RU](docs/RELEASE-0.33.0-RU.md), [ZH-CN](docs/RELEASE-0.33.0-ZH-CN.md))
- [0.32.1](docs/RELEASE-0.32.1.md) ([ES](docs/RELEASE-0.32.1-ES.md), [RU](docs/RELEASE-0.32.1-RU.md), [ZH-CN](docs/RELEASE-0.32.1-ZH-CN.md))
- [0.32.0](docs/RELEASE-0.32.0.md) ([ES](docs/RELEASE-0.32.0-ES.md), [RU](docs/RELEASE-0.32.0-RU.md), [ZH-CN](docs/RELEASE-0.32.0-ZH-CN.md))
- [0.31.0](docs/RELEASE-0.31.0.md) ([ES](docs/RELEASE-0.31.0-ES.md), [RU](docs/RELEASE-0.31.0-RU.md), [ZH-CN](docs/RELEASE-0.31.0-ZH-CN.md))
- [0.30.1](docs/RELEASE-0.30.1.md) ([ES](docs/RELEASE-0.30.1-ES.md), [RU](docs/RELEASE-0.30.1-RU.md), [ZH-CN](docs/RELEASE-0.30.1-ZH-CN.md))
- [0.30.0](docs/RELEASE-0.30.0.md) ([ES](docs/RELEASE-0.30.0-ES.md), [RU](docs/RELEASE-0.30.0-RU.md), [ZH-CN](docs/RELEASE-0.30.0-ZH-CN.md)) - unpublished draft, superseded by 0.30.1.
- [0.29.2](docs/RELEASE-0.29.2.md) ([ES](docs/RELEASE-0.29.2-ES.md), [RU](docs/RELEASE-0.29.2-RU.md), [ZH-CN](docs/RELEASE-0.29.2-ZH-CN.md))
- [0.29.1](docs/RELEASE-0.29.1.md) ([ES](docs/RELEASE-0.29.1-ES.md), [RU](docs/RELEASE-0.29.1-RU.md), [ZH-CN](docs/RELEASE-0.29.1-ZH-CN.md))
- [0.29.0](docs/RELEASE-0.29.0.md) ([ES](docs/RELEASE-0.29.0-ES.md), [RU](docs/RELEASE-0.29.0-RU.md), [ZH-CN](docs/RELEASE-0.29.0-ZH-CN.md))
- [0.28.4](docs/RELEASE-0.28.4.md) ([ES](docs/RELEASE-0.28.4-ES.md), [RU](docs/RELEASE-0.28.4-RU.md), [ZH-CN](docs/RELEASE-0.28.4-ZH-CN.md))
- [0.28.3](docs/RELEASE-0.28.3.md) ([ES](docs/RELEASE-0.28.3-ES.md), [RU](docs/RELEASE-0.28.3-RU.md), [ZH-CN](docs/RELEASE-0.28.3-ZH-CN.md))
- [0.28.2](docs/RELEASE-0.28.2.md) ([ES](docs/RELEASE-0.28.2-ES.md), [RU](docs/RELEASE-0.28.2-RU.md), [ZH-CN](docs/RELEASE-0.28.2-ZH-CN.md))
- [0.28.1](docs/RELEASE-0.28.1.md) ([ES](docs/RELEASE-0.28.1-ES.md), [RU](docs/RELEASE-0.28.1-RU.md), [ZH-CN](docs/RELEASE-0.28.1-ZH-CN.md))
- [0.28.0](docs/RELEASE-0.28.0.md) ([ES](docs/RELEASE-0.28.0-ES.md), [RU](docs/RELEASE-0.28.0-RU.md), [ZH-CN](docs/RELEASE-0.28.0-ZH-CN.md))
- [0.27.0](docs/RELEASE-0.27.0.md) ([ES](docs/RELEASE-0.27.0-ES.md), [RU](docs/RELEASE-0.27.0-RU.md), [ZH-CN](docs/RELEASE-0.27.0-ZH-CN.md))
- [0.26.0](docs/RELEASE-0.26.0.md) ([ES](docs/RELEASE-0.26.0-ES.md), [RU](docs/RELEASE-0.26.0-RU.md), [ZH-CN](docs/RELEASE-0.26.0-ZH-CN.md))
- [0.25.1](docs/RELEASE-0.25.1.md) ([ES](docs/RELEASE-0.25.1-ES.md), [RU](docs/RELEASE-0.25.1-RU.md), [ZH-CN](docs/RELEASE-0.25.1-ZH-CN.md))
- [0.25.0](docs/RELEASE-0.25.0.md) ([ES](docs/RELEASE-0.25.0-ES.md), [RU](docs/RELEASE-0.25.0-RU.md), [ZH-CN](docs/RELEASE-0.25.0-ZH-CN.md))
- [0.24.2](docs/RELEASE-0.24.2.md) ([ES](docs/RELEASE-0.24.2-ES.md), [RU](docs/RELEASE-0.24.2-RU.md), [ZH-CN](docs/RELEASE-0.24.2-ZH-CN.md))
- [0.24.1](docs/RELEASE-0.24.1.md) ([ES](docs/RELEASE-0.24.1-ES.md), [RU](docs/RELEASE-0.24.1-RU.md), [ZH-CN](docs/RELEASE-0.24.1-ZH-CN.md))
- [0.24.0](docs/RELEASE-0.24.0.md) ([ES](docs/RELEASE-0.24.0-ES.md), [RU](docs/RELEASE-0.24.0-RU.md), [ZH-CN](docs/RELEASE-0.24.0-ZH-CN.md))
- [0.23.0](docs/RELEASE-0.23.0.md) ([ES](docs/RELEASE-0.23.0-ES.md), [RU](docs/RELEASE-0.23.0-RU.md), [ZH-CN](docs/RELEASE-0.23.0-ZH-CN.md))
- [0.22.1](docs/RELEASE-0.22.1.md)
- [0.22.0](docs/RELEASE-0.22.0.md) ([ES](docs/RELEASE-0.22.0-ES.md), [RU](docs/RELEASE-0.22.0-RU.md), [ZH-CN](docs/RELEASE-0.22.0-ZH-CN.md))
- [0.21.2](docs/RELEASE-0.21.2.md) ([ES](docs/RELEASE-0.21.2-ES.md), [RU](docs/RELEASE-0.21.2-RU.md), [ZH-CN](docs/RELEASE-0.21.2-ZH-CN.md))
- [0.21.1](docs/RELEASE-0.21.1.md) ([ES](docs/RELEASE-0.21.1-ES.md), [RU](docs/RELEASE-0.21.1-RU.md), [ZH-CN](docs/RELEASE-0.21.1-ZH-CN.md))
- [0.21.0](docs/RELEASE-0.21.0.md) ([ES](docs/RELEASE-0.21.0.es.md), [RU](docs/RELEASE-0.21.0.ru.md), [ZH](docs/RELEASE-0.21.0.zh.md))
- [0.20.2](docs/RELEASE-0.20.2.md) ([ES](docs/RELEASE-0.20.2-ES.md), [RU](docs/RELEASE-0.20.2-RU.md), [ZH-CN](docs/RELEASE-0.20.2-ZH-CN.md))
- [0.20.1](docs/RELEASE-0.20.1.md) ([ES](docs/RELEASE-0.20.1-ES.md), [RU](docs/RELEASE-0.20.1-RU.md), [ZH-CN](docs/RELEASE-0.20.1-ZH-CN.md))
- [0.20.0](docs/RELEASE-0.20.0.md) ([ES](docs/RELEASE-0.20.0-ES.md), [RU](docs/RELEASE-0.20.0-RU.md), [ZH-CN](docs/RELEASE-0.20.0-ZH-CN.md))
- [0.19.0](docs/RELEASE-0.19.0.md) ([RU](docs/RELEASE-0.19.0-RU.md), [ZH-CN](docs/RELEASE-0.19.0-ZH-CN.md))
- [0.18.8](docs/RELEASE-0.18.8.md) ([RU](docs/RELEASE-0.18.8-RU.md), [ZH-CN](docs/RELEASE-0.18.8-ZH-CN.md))
- [0.18.7](docs/RELEASE-0.18.7.md) ([RU](docs/RELEASE-0.18.7-RU.md), [ZH-CN](docs/RELEASE-0.18.7-ZH-CN.md))
- [0.18.6](docs/RELEASE-0.18.6.md) ([RU](docs/RELEASE-0.18.6-RU.md), [ZH-CN](docs/RELEASE-0.18.6-ZH-CN.md))
- [0.18.5](docs/RELEASE-0.18.5.md) ([RU](docs/RELEASE-0.18.5-RU.md), [ZH-CN](docs/RELEASE-0.18.5-ZH-CN.md))
- [0.18.4](docs/RELEASE-0.18.4.md)
- [0.18.3](docs/RELEASE-0.18.3.md)
- [0.18.2](docs/RELEASE-0.18.2.md)
- [0.18.1](docs/RELEASE-0.18.1.md)
- [0.18.0](docs/RELEASE-0.18.0.md) ([RU](docs/RELEASE-0.18.0-RU.md), [ZH-CN](docs/RELEASE-0.18.0-ZH-CN.md))
- [0.17.1](docs/RELEASE-0.17.1.md)
- [0.17.0](docs/RELEASE-0.17.0.md) ([RU](docs/RELEASE-0.17.0-ru.md), [ZH](docs/RELEASE-0.17.0-zh.md))
- [0.16.1](docs/RELEASE-0.16.1.md) ([RU](docs/RELEASE-0.16.1-RU.md), [ZH-CN](docs/RELEASE-0.16.1-ZH-CN.md))
- [0.16.0](docs/RELEASE-0.16.0.md) ([RU](docs/RELEASE-0.16.0-RU.md), [ZH-CN](docs/RELEASE-0.16.0-ZH-CN.md))
- [0.15.2](docs/RELEASE-0.15.2.md) ([RU](docs/RELEASE-0.15.2-RU.md), [ZH-CN](docs/RELEASE-0.15.2-ZH-CN.md))
- [0.15.1](docs/RELEASE-0.15.1.md) ([RU](docs/RELEASE-0.15.1-RU.md), [ZH-CN](docs/RELEASE-0.15.1-ZH-CN.md))
- [0.15.0](docs/RELEASE-0.15.0.md)
- [0.14.1](docs/RELEASE-0.14.1.md)
- [0.14.0](docs/RELEASE-0.14.0.md)
- [0.13.2](docs/RELEASE-0.13.2.md)
- [0.13.1](docs/RELEASE-0.13.1.md)
- [0.13.0](docs/RELEASE-0.13.0.md)
- [0.11.1](docs/MDLxL-0.11.1-Changes.md)
- 0.11.0 and earlier: [legacy history](docs/RELEASE-HISTORY-LEGACY.md)

Unreleased changes are tracked in [docs/RELEASE-NEXT.md](docs/RELEASE-NEXT.md).
