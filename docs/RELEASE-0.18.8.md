# MDLxL 0.18.8 — MDX saving fix

- Models containing empty bone-binding groups now save as MDX without the false `Save verification failed: serialization changed ... Geosets[n].Groups` error.
- Opening and reopening MDX files preserves empty groups, group order, bone IDs, and vertex bone assignments. Save verification remains enabled.
- Includes all changes from 0.18.7 and the saving fix merged in [PR #109](https://github.com/UnsctMagic/MDLxL/pull/109).

Download **MDLxL-0.18.8-win32-x64.zip**, extract the whole ZIP, and run **MDLxL.exe**. Keep its folders together. The FFmpeg corresponding source archive is provided separately for redistribution.
