# MDLxL 0.18.5 — Showcase particle recording

- Showcase keeps particle simulation at the requested export frame while GIF readback and encoding run. Slow captures no longer advance the effects clock and then rewind it, clearing living particles.
- Live preview and recording playback keep their existing timing. GIF dimensions, FPS, duration, palette and local file-size limit stay unchanged.
- The event sound picker omits unresolved sound definitions. Existing event nodes retain their IDs until a valid replacement is chosen.

Download **MDLxL-0.18.5-win32-x64.zip**, extract the whole ZIP, and run **MDLxL.exe**. Keep its folders together. The FFmpeg corresponding source archive is provided separately for redistribution.
