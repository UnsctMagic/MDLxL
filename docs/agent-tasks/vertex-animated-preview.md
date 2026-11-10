# Animated preview in the Vertex editor

Status: completed through [PR #613](https://github.com/UnsctMagic/MDLxL/pull/613)
Merge revision: `9e5e80a24eea8de3749620427b202222c7386c7d` (verified on online `main`)
Owner: Codex
Updated: 2026-11-10

- Feature head `24573bc9` on `codex/animated-vertex-preview`, based on `1e717852`.
- **Animated** and **Shift+Space** toggle the frozen frame of the chosen sequence. The arrow starts at the first sequence in each model and choosing a different sequence enables the preview at its first frame. Right-click **Animated** and press Enter to choose a different frame using the Movement timeline's frame numbers. Toggling retains that frame. The Movement playhead stays independent.
- [App](../../app/App.jsx) owns per-model view state and [AppToolbar](../../app/AppToolbar.jsx) owns the controls. [Viewport](../../app/Viewport.jsx) draws and picks skinned vertices but still commits vertex edits through the existing base-pose path. Camera, selection and animation tracks stay in place when switching.
- The hidden [Electron test](../../test/vertex-animated-preview.electron.cjs) verifies the arrow opens, ten switches take at most 31 ms each, and picking, live base-pose edits, undo, mouse orbit and Quad View work. The packaged billboard drag, Quad Move and Vertex RGB Preview tests also passed.
- On the 2,075-vertex Gnome Lindormr Rider fixture, the longest of ten switches was 30 ms in single view and 21 ms in Quad View. All 108 focused source tests passed.
- The frame-picker follow-up passed the same 108 focused source tests and the hidden preview, billboard drag and Vertex RGB Preview checks. The Windows build and compatibility tests passed in GitHub CI. The [PR source suite](https://github.com/UnsctMagic/MDLxL/actions/runs/42816475564) and the [exact base run](https://github.com/UnsctMagic/MDLxL/actions/runs/42704190569) reported the same seven AnimXL failures with matching assertion messages.
