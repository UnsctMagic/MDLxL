# MDLxL 0.28.2 - Marker performance and editing fixes

## Changes

- Bones, Skeleton and attachment markers take less CPU time to draw. The existing icons, colours, sizes, selection highlights and mouse controls are preserved. On the Blood Dragon Nightmare test model, combined marker processing fell from 23.8 ms to 6.7 ms locally. This measures marker work, not total frame time; results depend on the PC. No model changes are needed.
- Collected Bits now keep their own materials when saved or reused. A material that looks equivalent but points to a different texture can no longer replace the Bit's material, preventing missing or incorrect parts after saving.
- Loose vertices can be welded before they have any triangles, so you can join points and then create a face. The protection against welding away every triangle of an existing mesh remains in place.
- Updated project credits and technical attributions, retaining the notices for the libraries and assets MDLxL uses.

This release includes every change merged since 0.28.1: credits (#248), loose-vertex welding (#249), collected Bits materials (#250), and marker rendering (#251).

## Update

Open Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
