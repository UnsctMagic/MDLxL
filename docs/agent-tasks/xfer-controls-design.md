# XFER controls design contract

Status: design only (26 Nov 2026). No code written. Built by the session on `claude/xfer-engine2-1cdbdc`.
Scope: the Transfer window, both tabs (Transplant, Retarget). Engines are described in
[xfer-engine2.md](xfer-engine2.md) and are not redesigned here.

## Plain summary

1. One switch with three buttons replaces everything in the repair row: **Copy**, **Match**, **Mix**.
2. Copy = every joint turns like the donor's. Match = limbs point like the donor's and hands and feet reach the donor's spots. Mix = you choose per body part.
3. In Mix you click a limb on the model itself and pick Copy or Match right there. The limb's dot shows which one it has.
4. What the donor view shows is what gets used: the shown form (night elf or crow) and the shown side (Mirror).
5. The 26 repair checkboxes are gone. The app applies them by itself; a part it cannot handle gets a small red "!" on that part.

## Owner's words this answers

"clay in my hands. WHAT I SEE IS WHAT I GET" · "Engine 1 or 2 (with proper names) or dissection" · "why cant I pick the
engine? why does it gate and choose everything?" · "those are from the tests they were never meant to be controls" ·
"Where is this in retarget?!"

## Layout (window size, three columns and both view strips stay exactly as today)

The one-line row above the Result preview (today `xf-repairs`) becomes the **method row**. Nothing else moves.

Default (Copy or Match pressed: clean model, no dots):

```
┌ Transfer   [Transplant|Retarget] ──────────────────────────────────────────────┐
│ From        │ Donor  [Mirror][Normal|Alternate] │ Footman                │Sounds │
│  This model │ ┌───────────────────────────────┐ │ [Copy][Match✦][Mix] [All animations|This animation] More▸
│  Library... │ │                               │ │ ┌────────────────────┐ │Effects│
│ Animations  │ │        donor preview          │ │ │   result preview   │ │Keep   │
│  Stand      │ │                               │ │ │                    │ │ ...   │
│  Walk •     │ └───────────────────────────────┘ │ └────────────────────┘ │       │
│  Attack     │ ▶ ──●────── 100%  [Stand ▾]       │ ▶ ──●──── 100% [Stand▾]│       │
└─────────────┴────────────────────────────────────────────────── [Transplant] ────┘
```

Mix, right leg picked (dots on the limbs; ● = Match, ○ = Copy; the picked limb is outlined, its donor limb too):

```
│ Donor  [Mirror]                  │ [Copy][Match][Mix▣] [All animations|This animation] More▸
│ ┌──────────────────────────────┐ │ ┌─────────────────────────────┐
│ │        ○   ○                 │ │ │      ○     ○   ●weapon      │
│ │          ▓ <- same leg,      │ │ │         ▒                   │
│ │          ▓    outlined       │ │ │      ●  ▒◉ ┌─Right leg────┐ │
│ │                              │ │ │         ▒  │[Copy][Match▣]│ │
│ └──────────────────────────────┘ │ └────────────└──────────────┘─┘
```

A part that cannot be matched (shown in every state, also outside Mix):

```
│ ┌─────────────────────────────┐
│ │    ●     ●                  │
│ │       !  ┌─Left wing──────────────────┐
│ │          │ The donor has no wings.    │   <- opens on click; hover shows the same line
│ │          │ Keeps its own movement.    │
│ └──────────└────────────────────────────┘
```

## Controls

| Control | Label | Does | Default | Behaves / never |
|---|---|---|---|---|
| Method switch (3 buttons, like the Transplant/Retarget switch) | `Copy` `Match` `Mix` | Copy: all parts on method 1. Match: all parts on method 2. Mix: shows the dots and lets parts differ. | The suggested one, marked ✦ (existing mark). | One state only: the buttons are a view of the per-part choice (all 1 = Copy, all 2 = Match, else Mix). The app never changes it after the user touched it; kept per pair. Rebuild once per click. |
| Part dot (on the model, Result view, Mix only) | none (tooltip = part name + method) | Click picks the part and opens its chip. | Parts: left arm, right arm, left leg, right leg, weapon. | Reuses the POSE handle the Retarget tab already draws. A drag still turns the camera; only a click without movement picks. Trunk and head have no dot (not pickable). Never moves the camera, never a list. |
| Part chip (small box at the picked dot) | part name, `Copy` `Match` | Sets that part. Shift+click sets both sides (both arms / both legs). | The part's current method pressed. | Closes on Esc or a click on empty space. One chip at a time. A method the part cannot use is greyed with its reason as tooltip. |
| Scope (2 buttons, same look as "Whole movement / This moment") | `All animations` `This animation` | This animation: the method switch and chips change only the animation shown in the views. | `All animations` | An animation with its own choice gets a small `•` after its name in the Animations list. Pressing `All animations` while on such an animation shows the shared choice; it does not delete the own one. Chip footer in This animation: `Same as all` removes the own choice. |
| Warning mark | `!` | Small mark on the part itself. Hover: one line. Click: chip with the reason and what happens instead. | Shown whenever it applies, in Copy, Match and Mix. | Never a silent fallback: every part that does not get what the switch says carries the mark. Also on the method switch as `!` + count when the mark is off-screen. No banner, no report. |
| Front legs (only in the chip of a spare front leg: model has more legs than the donor) | `Mirror legs` `Use arms` (existing names) + `Leg timing` | The existing front-leg choice. Leg timing is the existing `RangeField` (0–100, step 5, −/+), shown only with Mirror legs. | Today's rule (Use arms where it applies). | This is the old two checkboxes and slider, moved onto the legs they change. |
| `More▸` (text button, right end of the method row) | `More` | Opens a small menu with at most three press-buttons: `Donor pose`, `Keep own torso`, `Keep donor motion` (existing names and tooltips). | All off. Closed. | Each is listed only when it changes this pair's result (today's `visible` rule). When none applies, `More` is not shown. Never a fourth item without the owner's word. |
| Mirror (donor caption, exists) | `Mirror` | Swaps the donor's left and right. The donor view shows the swapped donor. | Today's automatic choice. | The checkbox copy in the old row is removed; the caption button is the only one. |
| Form buttons (donor caption, next to Mirror; only when the donor has more than one form) | the forms' shared animation tag, e.g. `Normal` `Alternate`; else `Form 1` `Form 2` | Shows that form in the donor view and uses it. | The form of the donor's first Stand. | See "Donor view". Same look as Both / Rider / Mount, which stay as they are. |

### Colours and marks (theme variables only)

- Match dot: filled, `--ui-accent`. Copy dot: hollow ring, `--ui-text`. Shape differs as well as colour.
- Picked part: its limb line and dot outlined in `--ui-selected`; the donor limb that feeds it (other side when Mirror is on) gets the same outline in the Donor view.
- Hover: `--ui-hover` outline, on both views. Warning mark: `--ui-danger`.
- Dots and outlines redraw at most once per display frame and only when the hover, pick or method changed.

## Donor view: what is shown is what is used

- The engine reads the donor's body from the form shown in the Donor view, never from a fixed "Stand".
- Switching form: the form buttons, or clicking any animation of the other form in the Animations list (the button follows). Switching animation: the list or the strip's dropdown, as today.
- Transplant uses the shown form's animations. The other form's animations are dimmed in the list with the tooltip "Other form. Not transferred." Clicking one switches the form.
- A donor that is rider and mount keeps Both / Rider / Mount; they now show in Transplant too (same buttons, same row).
- Neither view's camera moves when the method, a part, the scope, Mirror or a `More` item changes. A new donor, form or animation follows today's framing rule.

### Parts that cannot be matched (reasons, one line each)

| Case | Line in the chip |
|---|---|
| Donor has no such part (wings, tail, extra arms) | `The donor has no {part}. Keeps its own movement.` |
| Spare front legs | `The donor has two legs.` + the front-legs choice |
| Part cannot use Match (too many joints, driven by a global animation, grips too far apart) | `Match does not fit this part. Uses Copy.` |
| Part did not move in the result although the donor's did | `This part did not follow the donor.` |
| Donor form has no body the app can read | `This form cannot be read. Choose another form.` (on the Donor view) |

The fourth line is a check on the finished result (the Footman-with-still-legs case): the build compares each limb's
movement with the donor's and marks a limb that stayed still.

## Retarget: the same controls

- Same method row, same dots, chip, scope, warning marks, colours and keys. No second scheme.
- Dots sit on the taken parts' existing handles; untaken parts have none. Dragging a hand or foot handle still aims it; a click without movement opens the chip.
- The method is stored on the taken part and travels with setups. Existing Retarget part settings (right column) are not changed by this contract.
- `This animation` is hidden in Retarget (a Retarget result is one animation).

## The old repair checkboxes

- **Removed from the window:** the whole repair row and the "Engine 2:" box group, including "This animation only".
- **Automatic (no control):** `hand, markers, detached, trunk, arms, chains, looseAxis, gripRouting, heldGeometry, surfaceGrip, extraMotion, skinLandmarks, hangingChains, rootHeight, saddleDriver, trackWindow, movingCarrier, wristGrip, sewnTorso, seatLooseGrip, riderSeat, seatWeapon, gripInHand`. The build uses the set the suggester picks today. A repair that was tried and left a part wrong shows the warning mark on that part.
- **Moved onto the model:** `mirrorLegs`, `useArms`, Leg timing (front-leg chip); Mirror (donor caption).
- **Behind `More`:** `donorPose`, `keepTorso`, `authoredMotion`.
- Keys stay in the engine, saved pairs and the grading sheets; only the window's controls go. The pick sheet (`TransferPicks.jsx`) is a test tool and keeps its boxes.

## Keys (through the existing hotkey system, scope `transfer`, reassignable)

- `M`: next method (Copy → Match → Mix).
- `X`: flip the hovered or picked part between Copy and Match (Mix only). With Shift: both sides.
- If either default is taken in this scope, use the nearest free single key and keep it at two.

## Labels (new ones; existing names keep their catalog entries)

| en | es | ru | zh-CN | fr | de |
|---|---|---|---|---|---|
| Copy | Copiar | Копия | 复制 | Copier | Kopieren |
| Match | Ajustar | Подгонка | 匹配 | Ajuster | Anpassen |
| Mix | Mezcla | Смесь | 混合 | Mixte | Mix |
| All animations | Todas las animaciones | Все анимации | 所有动画 | Toutes les animations | Alle Animationen |
| This animation | Esta animación | Эта анимация | 此动画 | Cette animation | Diese Animation |
| Same as all | Igual que todas | Как у всех | 与全部相同 | Comme toutes | Wie alle |
| More | Más | Ещё | 更多 | Plus | Mehr |
| Normal | Normal | Обычная | 普通 | Normale | Normal |
| Alternate | Alterna | Альтернативная | 替代 | Alternative | Alternativ |
| Form {0} | Forma {0} | Форма {0} | 形态 {0} | Forme {0} | Form {0} |

Tooltips (English; add to all five catalogs in catalog order):

- Copy: "Each joint turns as the donor's joint turns. Best when the two bodies are built alike."
- Match: "Limbs point the way the donor's do. Hands and feet go to the donor's spots, scaled to this body. Best when the bodies differ."
- Mix: "Choose Copy or Match for each body part. Click a part on the model."
- Weapon chip, Match: "The hand turns so the weapon points the way the donor's weapon points."
- This animation: "Changes apply only to {0}."
- More: "Choices for unusual models."
- Form button: "The donor form to show and use."
- The five warning lines above and "Other form. Not transferred."

## Build order

1. Method row: the three-button switch wired to today's `regions` state (`engineOptions`); delete the "Engine 2:" boxes.
2. Dots in the Result view from the existing POSE handles, coloured by method; hover and pick outlines on both views.
3. Part chip (Copy/Match, Shift = both sides) and the two keys.
4. Scope buttons wired to `regions.animations`; the `•` in the Animations list.
5. Repairs: build with the suggested set automatically; remove the repair row; `More` with the three items; front-leg chip with Leg timing.
6. Warning marks: the unmatched cases and the "did not follow the donor" check; count on the method switch.
7. Donor forms: read the body from the shown form, form buttons, dimmed other-form animations; Both / Rider / Mount in Transplant.
8. Retarget: the same row, dots and chip on taken parts; method saved in setups.
9. Six-language catalog entries; tooltips; `TEST XFER CONTROLS 01.mdx` click-through of every new control in the packaged build (hidden).

## Decided: starting method

Owner, 26 Nov: "Suggested method". Every new pair starts on the suggested method (✦), in Transplant and in Retarget,
and the app never changes it after the user touches it.
