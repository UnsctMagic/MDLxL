# MDLxL 0.20.1 — Texture Manager file selection

- **Choose texture files:** Texture Manager → **Resolve from folder…** now shows supported BLP, TGA, DDS, PNG, JPG/JPEG and WebP files and lets you select several at once.
- **Load into the model:** the selected files load into the current session. Existing texture references keep their paths; files with new names get texture entries.
- **Folder-wide resolution remains available:** File → **Resolve textures from folder** still searches a chosen folder for paths already referenced by the model.

Warcraft III models reference external texture files. Keep selected files available with the model when sharing it. The portable updater remains opt-in: it checks at startup only when enabled and installs only after **Update and restart** is selected.
