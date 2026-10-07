# Next release — unreleased changes

- Portable MDLxL can search for updates manually or, when enabled, at startup. It shows the changes and the English, Russian, and Chinese full logs, then downloads and installs only after confirmation. Settings includes **Revert to last version**; each successful update retains exactly one previous program version while keeping current settings, personal libraries, and saves.
- Added translations for 458 newer interface labels, help messages, and updater messages in Russian, Spanish, and Chinese, preserving the existing community Chinese catalog.
- Help, About, and update prompts now include a small link to the official [lowpolyworks.com](https://www.lowpolyworks.com) website.
- EMTR library effects open as independent working copies. Editing an effect no longer changes the values opened from its library default or saved preset. Edited effects can still be saved as new presets, and My work retains drafts and undo history. [PR #111](https://github.com/UnsctMagic/MDLxL/pull/111).
- UV Wrapper initial scrolling speed increases by 30%, from 1.0 to 1.3. Both UV views share this value, reopening resets it to 1.3, and other editors' scrolling speeds stay unchanged. [PR #115](https://github.com/UnsctMagic/MDLxL/pull/115).
