# Update and first-open popup helmet eyes

Owner approved both test EXEs and authorized merging both effects on 2026-10-28.
Session: codex codex://threads/01a182e1-70fc-7001-a424-e0f8d8c0800b

Scope: normal popup appearance; dark eye cores only; original red eyes and the
Aspiring Champion's four native eye emitters start with the existing fanfare
after 650 ms. Emitters continue until close. Saved Disable sounds still stops
and mutes the fanfare, without stopping the eyes. Keep welcome layout and Yes/No
handling, normal update controls, preferences and installation behavior.

Shared owner: src/update-popup-effects.js. useUpdates owns the normal popup's
session across dialog remounts. The welcome window uses the same bundled runtime.
Assets in src/update-helmet-assets.js contain only the approved, detached eye
emitters and original red_Glow2/Shadow BLP pixels; no body geometry or model edits.
Color segmentation follows the two connected eye cores and fills their bright
centers, preserving gold trim. Screen compositing removes black sprite squares.

Implementation and validation complete; owner authorized merging both.
Verified: renderer build; 57 compatibility tests; 26 focused source tests and
one existing platform skip; native welcome layout/Yes/Escape; native updater
manual/startup/current; browser onset 655.8 ms with nonzero audio, remount and
progress stability, immediate mute, reopen, and continuous eyes after audio ends.
No release/version bump or installed-app/profile changes are part of this merge.
