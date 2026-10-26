# MDLxL 0.33.0 - Learn, Create in Movement and Auto Corpse

- **Learn**: the **LER** button opens a small menu with **Learn mode**, **Show hotkeys** and **Learn settings…**. With Show hotkeys on, every button and dialog shows its shortcut in small green letters. Ctrl+J still turns Learn mode on and off. Your old Shredder settings and custom keys carry over.
- **Alt, then a key**: tapping Alt shows the shortcut letters, and the next key runs that Alt shortcut (Alt, then R opens Recovery). Holding Alt and pressing the key works as before.
- **Space always plays or stops** the animation, even right after you clicked a checkbox, button, slider or dropdown. Only text fields keep their space.
- **Create in Movement**: Movement has a **Create** button next to its animation list. It works exactly like Create in Animations.
- **EMTR opens on your effects**: when the model already has ribbons or particles and nothing is selected, the Emitter Editor opens on them instead of the new-effect Lab.
- **Stock game textures for effects**: new sparks, glows and ribbons in EMTR, and Forge's HD helper maps, now use Warcraft III's own textures instead of pictures made by MDLxL. Models that use the old MDLxL pictures are switched over when they open, as one Undo step.
- **Auto Corpse (test)**: a new **CORP** button fits a corpse to the last frame of the Death animation, creates Decay Flesh and Decay Bone, and sets visibility, in one click. One Undo puts the model back.
- **Rotation**: Settings > Mouse has a Rotation section where each editor can use **Pivot-based** (follow a circle around the centre, the default) or **Linear** (turn by drag distance). Pivot-based no longer gets stuck or flips when the turn circle is seen edge-on, for example the Y turn in Front and Top views.
- **VIS** is the classic MDLVis layout again: no model tabs, editor buttons or AI console, the original checkbox row, and a small **XL** button to switch back.
- **Top bar**: bigger left buttons, a slimmer bar and the WC3 buttons on the right. The Hide/Show buttons are gone. When the window is narrow, inactive editor buttons shorten to their first letter so the display checkboxes keep their names.
- **Vertices**: the RGB Preview checkbox is replaced by an **RGB** checkbox among the display checkboxes. It shows the model's colours and fades from the Stand animation.
- **Recovery** keeps one draft per model and only the 15 newest. The first start of this version clears the old drafts once (a draft from a crash is still offered first).
- **File icons** also show for files you set to "Always open with" MDLxL.
- Stacked full-width buttons (such as Bake Sequence RGB / Bake All RGB) no longer touch.

**AI**
- The AI costs less: Claude API prompts are cached, each prompt has a step limit and an optional spending limit, and every prompt shows what it cost. A chat no longer moves to your API key silently after you switch connection.
- **Editing handbook** switch (book icon, off by default): gives the AI general Warcraft III editing rules and step-by-step guides. It has the shortcut W.
- **Offload**: follow-up messages go straight to the right helper, independent parts of a model can be worked on in parallel, and an optional setting lets simple jobs use a lighter model.
- AI pictures no longer fail after long chats, the AI can take close-ups of the selection, and Fit selection works in Animations and Movement.
- The AI console no longer slows the editor down while an animation plays.

**Update** Open Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
