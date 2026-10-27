# MDLxL 0.34.0 - An AI that looks first

**AI**
- **Looks first, then changes once**: before its first edit on a job, the AI writes down what is actually wrong, how far the problem reaches (often beyond the area you marked), what must stay the same, at least two ways to fix it and which one it chose. MDLxL refuses its edits until it has done so. Simple edits such as "set the alpha to 0.5" skip this. Click the **Planning the change** step to read the plan.
- **Versions side by side**: the AI keeps the model as it was when you opened it and before each job, can save its own versions, compare them and go back to any one as a single Undo step. Asking it to "go back to the good version" now works.
- **Decision diary**: for every model, MDLxL remembers each AI job: your request, what the AI chose and why, what it changed, how it turned out, and what you said next. Every new job reads the latest entries, so earlier AI edits are treated as choices that may be undone. The diary survives switching between Codex and Claude and **Keep a summary**; **Wipe it all** deletes it.
- **Outside check**: when the AI says an edit is finished, a separate AI that never saw its work judges your request, the list of things to keep and the before/after pictures. A doubtful result goes back for more work before you see it, and the chat shows each verdict. On by default; costs one extra AI call per finished edit; turn it off with **Outside check** in Connection settings.
- **Web research**: a new globe switch next to the Editing handbook lets the AI search the web and read pages such as Hive Workshop tutorials. Off by default. Works with Codex, Claude Code and the Claude API.
- **Thinking effort** in Connection settings: Provider default, Medium, **High** (the default) or Extra high. Higher thinks more carefully and uses more of your plan or credits.
- With the **Editing handbook** on, each job now carries the full guide it needs (for example binding for "the legs clip into the skirt"). Patterns from reference models, and rules you pass on in the chat, are treated as evidence to check against your model, not as orders.
- The AI can take pictures of only the parts in question, in plain shading, so shapes and gaps are easier to judge.

**Editor**
- **Glow Up**: the two weapon-glow ends can be dragged freely, for example onto a hammer or axe head, and **Origin brightness %** and **Weapon brightness %** are separate sliders. Dragging a handle pauses the animation, and handles are easier to grab while they move.
- **Auto update offer**: the first time a copy of MDLxL starts with Auto update off, it asks once whether to tell you when a new version is out. Nothing is downloaded without **Update and restart**.
- The **CORP** button's label is light and readable.

**Update** Open Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
