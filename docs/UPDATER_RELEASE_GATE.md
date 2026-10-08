# Full portable release acceptance

The 0.21.1 candidate was assembled, ZIPped, and extracted into one isolated
installation. Its unmodified packaged updater installed full private ZIPs A
(0.21.2) and B (0.21.3) consecutively. Both private packages differed in version
metadata and valid EXE overlay bytes, so each cycle replaced the executable.
The runtime updater and native installer were identical across all three.

Candidate: 197803680 bytes; SHA-256
`ed0ec26f267112e45a106aacc1b6312c392aeab962352eed82d010ecf1e0d113`.

- Both cycles used Search for updates and Update and restart, completed real
  streamed ZIP downloads, checksum and manifest verification, and displayed
  the native Save/Cancel/Close prompt. Close was selected through Windows UI.
- Six immediate relaunches in A and 25 relaunches in B exited without an editor
  window. B's additional relaunches spanned verification, file replacement,
  and snapshot finalization, including both old and new on-disk versions.
- The installer automatically restarted the correct running version each time.
  Search for updates then returned current, with no repeat offer or error.
- Every installed program hash and retained snapshot hash passed. Personal
  profile files, libraries, recordings, untracked saves and an overridden
  bundled library file retained their hashes. A retained 0.21.1; B retained
  only 0.21.2.
- Normal operation after A included Forge creation, movement, mouse camera
  rotation, commit, undo and redo. After B, Forge creation and commit produced
  an editable model with 36 vertices and 12 triangles.
- B's normal offline revert restored running A, preserved personal files,
  matched all restored program hashes, and consumed the retained snapshot.

## Repeating the gate

Use `test/updater-release-gate.cjs prepare` with `MDLXL_GATE_PACKAGE` pointing
to the complete candidate and a fresh `MDLXL_GATE_ROOT`. Then run the same
script with `serve`. Its loopback control endpoint supports launch, attach,
detach, offer, renderer, main, processes and verify actions. The fixture feed
serves actual ZIP bytes on HTTP; the installed program is never rewritten by
the harness. `test/updater-release-reopen.ps1 -Root <gate-root> -Cycle <name>`
observes the real installation lock and launches only that test executable
throughout installation, recording process exit and window evidence.

The external inspector changes only the updater instance's HTTP transport
in memory, mapping its requested GitHub URLs to the loopback fixture. The
original response handler, streaming, limits, SHA-256, extraction, manifests,
file planning, save prompt, native installation and restart all execute.
Disconnect the inspector before selecting Close. After the native restart,
attach to the new process and confirm its executable path and runtime version
before interacting. No helper swaps, package edits or installation resets are
permitted between A and B. This local routing does not test GitHub TLS/CDN;
verify the actual public ZIP and checksum separately after publication.

The earlier instrumented single-cycle/bootstrap scripts are not substitutes
for this full-release gate. Any shipping package or updater change requires
assembling a new candidate and repeating both cycles before publication.
