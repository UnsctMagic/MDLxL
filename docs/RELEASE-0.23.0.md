# MDLxL 0.23.0 - POSE, archives and performance

## POSE and Movement

- Copy/Ctrl+C captures the complete sampled pose; Paste/Ctrl+V restores it at another frame in one Undo step. Moving a hand or foot can gently lead the connected body.
- Elbow and knee swivel keeps the hand or foot in place and preserves its orientation. Focused Skeleton shows mapped controls and limb joints.
- Restrict, beside Setup, keeps the body still when moving a hand or foot. Pin is easier to click, stays under the pointer, supports Space/Enter and retains a visible pinned badge.
- Controller starts expanded, with Highlight KF and Highlight Chain above the Controller type dropdown. Restrictions starts collapsed.
- Controller, skeleton, gizmo and Pin appearances can be customized independently. Lordaeron is the default; Appearance sections have their own preset selectors, and start collapsed except Presets.
- Multiselect from List sits beneath Object in Bones and Movement, with a divider before the details. Multiselect and Billboarded have plain-language hover explanations.
- Rotation drags respond consistently across axes and workplanes. Visible handle endpoints have priority, numeric rotation stays available, and Escape, window blur or lost pointer capture cancels unfinished edits.

## Warcraft archives

- Settings > Warcraft III lets you add CASC storage folders and MPQ files, remember them and remove individual entries.
- Custom archives supply textures and event resources before installed game data; textures beside the model retain priority. Normal game discovery remains available.

## Emitter library and viewport

- The emitter library automatically starts or resumes an incomplete index. Indexing runs in a separate process, temporary Windows file locks are retried, and progress avoids repeated full catalogue reloads.
- Later library pages load their previews, and returning from an effect stays responsive while indexing.
- The viewport FPS limiter no longer repeatedly skips display refreshes. Playback continues using actual elapsed time.

## Update

In 0.22.1, open Settings > Mouse > Search for updates > Update and restart. After this update, Updates is at the top of Settings > Configuration. You can also download the complete Windows portable ZIP from [Low Polyworks](https://www.lowpolyworks.com/mdlxl), extract the whole folder and run MDLxL.exe.
