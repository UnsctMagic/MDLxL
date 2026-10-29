# AI hook learning facts (why an outside agent fixed in one go what the hook could not)

Status: case 1 done and acted on in 0.34.0 ([harness](ai-hook-harness.md)); case 2 (facts 11–16) done, not acted on
Owner / consolidator: Claude Code (side session of the AI hook work)
Updated: 2026-10-29

## Goal and completion criteria

- Explain, in general terms, why the same kind of model repair worked first time
  in an outside GPT-6.1 Pro chat agent but failed again and again in MDLxL's own
  AI hook. Each fact below is a pattern about the hook or the AI working inside
  it. The Demonette is only the evidence.
- Out of scope: changing the hook. These facts are meant to guide later work.
  No MDLxL code, owner profile or AI provider was touched or run for this study.

## Revision and local state

- Checkout: `D:\Claude\MDLxL`, branch `claude/update-usage-ping` at `fabf4f8d`.
  The only file added is this note. Nothing is committed.
- Hook code studied: the installed 0.33.0 app the owner used
  (`D:\MDLxLVisButton\MDLxL-win32-x64-0.20.0\resources\app`), with
  `electron/ai-providers.cjs`, `src/ai-tools.js` (`AI_SYSTEM_PROMPT`,
  `AI_EDITING_HANDBOOK`) and `docs/AI-SD-REFERENCE-STUDY.md`. The same files are on `main`.
- Working files (scripts, extracted audit, text dumps, copied Codex databases):
  `D:\Claude\MDLxL-AI-Study\`. Scripts are in `scripts\`. Every count below can
  be recomputed with `turn_stats.py`, `tools_chat.py` and `codex_range.py`.

## The evidence

- **The outside success.** The owner's audit zip, extracted to
  `D:\Claude\MDLxL-AI-Study\demonette-audit\extracted\`. GPT-6.1 Pro was given
  `WH_DOC_Demonette2.mdx` plus the Demoness donor, with this request: the front
  legs split in every animation, they look right in the geoset pose, make them
  stop splitting, research Hive/XGM binding rules, and shrink the over-baked keys.
  It changed 167 vertex bindings in four geosets, removed 7,178 keys, and touched
  only the bindings and bone keys. The owner says it worked first time. Its own
  report says it was never checked in the game.
- **Attempt A, 2026-10-25** (test-build profile, Codex with Offload). A Blackbird
  worker moved the Demoness rig and animations onto the Demonette. It made 86 tool
  calls and marked its own review "passed". The owner answered "its 100% deformed"
  and then "I dont understand how you approved this".
- **Attempt B, 2026-10-26** (`chat-932b2609…`). Claude Opus 5.5 on the API worked
  the first half, then Codex gpt-6-astra took over the same chat. It retargeted the
  rig and animations and then fixed skirt, thigh, belt and claw problems. That came
  to 26 owner messages, 563 tool calls and 63 applied edits, with 11 "passed" and 3
  "blocked" reviews. It ended with "All the changes are bad. Stop patching over bad
  changes".
- **Attempt C, 2026-10-27** (Codex gpt-6.1-sol, `WH_DOC_Demonette2.mdx`). This
  covered the walk, Attack 1, Stand Ready and then the same leg binding problem the
  outside agent later solved: 15 owner messages, 191 tool calls, 20 applied edits,
  8 "passed" and 1 "blocked" review. Since the brief was written, the owner cleared
  this chat, so its `chat-259ec815…` file and its Codex record are gone. The full
  thread survives in Codex's history database. A read-only copy was used (thread
  `01a178a9-55e7-7083-8118-071b6c565e77`), and its turn order matches the brief.
- **A fairness note.** The outside job was narrower: one stated defect in a saved
  file. Attempt C's binding turns are the like-for-like comparison. The outside
  agent was also a different, high-effort model working outside the hook, so model
  strength and harness cannot be fully separated. The facts below lean on
  behaviour the hook's AI showed when it plainly had the same information.

## Learning facts

### 1. The hook's AI usually finds the right clue. It then fixes it the wrong way.

On the like-for-like turn in attempt C, Codex scanned the hip for vertices that
sit on the same spot but follow different bones. It found the same eight pairs
the outside agent found (geoset 8 vertices 106/107/109/112/131/132/134/137
against geoset 14 vertices 19–22/27–30), and it measured the same tear of more
than 7 units in the walk. The two then went opposite ways:

- **The hook's AI** made the two copies match by adding the pelvis to the thigh
  copy, so it moved like the other copy and became more blended.
- **The outside agent** made them match by removing the extra bone, so both
  copies followed the thigh only.

Both fixes close the seam. Only the second keeps the shape. Within minutes the
owner wrote "You did not preserve the geoset pose".

The general truth is that finding the problem is not the hook's weak spot. The
weak spot is choosing between fixes that all pass the same check.

### 2. Left alone, the hook's AI blends more bones in. The working fix took bones out.

Across attempts B and C, nearly every binding repair added influence: blend
rings, pelvis plus thigh, dress bones together with thigh bones. The outside
agent's diagnosis found that the thigh vertices were already mixed with
independently swinging skirt bones (for example thigh + `dress_L`, or pelvis +
both thighs + skirt) and with the opposite leg. It removed those mixtures.

Those mixtures were made by the hook itself. On 2026-10-26 Claude, inside the
hook, created `dress_front/L/R/back`, removed `dress_front`, and added blend
rings around the hips. That was the session where the owner forwarded the
"Sorceress" rule ("the tops of the thighs are bound to those dress bones as well
as to the thigh bones") and the rule that neighbouring vertices always share a
bone. Demonette2 has exactly those bones, `dress_back`, `dress_L` and `dress_R`,
as IDs 34–36. The defect the outside agent fixed on 10-27 was therefore laid down
by an earlier hook pass that was following a statistical rule as an instruction.

The general truth is this. When a pattern taken from many models ("Blizzard
usually does X here") is handed over as an instruction, the AI applies it
everywhere, including rigs where it causes the fault. The outside agent reasoned
from how the game actually moves a vertex: every bone in the list gets an equal
share, so an independently swinging skirt bone folds the thigh. It used the
statistics only as background.

### 3. The hook's AI repairs the area the owner marked. The working fix repaired the whole cause.

Codex's first binding fix changed 28 vertices, "within red-marked hips", and
stopped there. The outside agent wrote one short rule (by height band and by left
or right side) and applied it to every thigh vertex in four geosets: 167
vertices. It also wrote down what it deliberately left alone, such as the skirt
panel vertices and the lower knee groups.

Scope also drifted the other way. When asked to "correct the bindings", Codex
widened the job to the shin plates and knees. It broke them, concluded that a
bindings-only fix was impossible, and asked to change the geometry. The outside
agent proved a bindings-only fix was possible.

The general truth is that the hook's AI takes its scope from where the owner
pointed, or from whatever it can measure next, not from where the cause lives.
The marked area is a symptom, and the cause is often larger or smaller than it.

### 4. The hook's review approves its own homework, so it says "passed" when the result is wrong.

The review tool asks the AI to write its own checks and then to declare "passed".
In the three attempts the AI gave 20 "passed" verdicts. The owner's next message
rejected 12 of them, partly accepted 3 and accepted 3 ("Great work", "Excellent
work", "Overall it is very good"); 2 cannot be judged. That is about two
rejections in every three verdicts.

The checks were usually true by construction. "Shared hip seams remain joined:
before 7.34, after 0" passes for any fix that makes the two copies follow the
same bones, including the one that warped the legs. Codex later admitted as much
itself: "My checks proved the seams met; they did not prove the geosets kept
their shape."

The outside agent's checks were no harder in principle (seam gaps over every
key). The difference was that it measured against a fair baseline: key-reduction
error against the repaired-but-unreduced model, not against the broken original.
It also wrote down what its checks do not prove.

The general truth is that a gate the AI writes and grades itself measures what
the AI chose to change, not what the owner sees. It cannot tell a real fix from
a check that was always going to pass.

### 5. The hook's AI keeps building on the last result, even after the owner rejects it.

Across the 18 verdicts the owner rejected or only partly accepted, the AI went
back to a known-good state on its own exactly once, and that was its own trial
inside a single turn (attempt C, "Restore original bindings after joint-fit
trial"). Twice the owner had to restore the model themselves ("i reverted the
change", and recovering revision 31 in attempt B).

When the owner explicitly said "revert to a known good point", the AI searched
its tools and reported: "The available tools don't expose a selectable
historical revision". The recovery window then stalled the editor.

In attempt B, 63 applied edits were spread over 21 working turns, each landing
on the live model. The outside agent saved a repair-only stage plus five
key-reduction trials as separate files. It compared candidates and picked one.

The general truth is that the hook has no habit, and no tool, for "keep a clean
stage, try variants beside it, compare, choose". So every correction is a patch
on the previous correction. The owner's complaint "you are accumulating bad
results" is exactly what the structure produces.

### 6. The hook's AI sees many pictures, but not pictures that answer the question.

Attempt B asked for 339 views and attempt C for 167, mostly whole-model or
close-up 768×576 textured renders. The AI often could not use them:

- "The pictures are small, so I'll measure…"
- "The overall views are too small to judge the elbow"
- "The drawings cover the waist in the screenshots, so I'll work from measurements"
- "Vertex markers obscure the surfaces"
- "The live capture stayed on one frame"

In one turn the review's own off-screen picture failed on every attempt.

The outside agent drew far fewer pictures (36 during the repair): plain shapes of
only the relevant geosets, front and side, with the same camera, the same pieces
and the same scale before and after. It even redid its comparison images when it
noticed that two sets showed different pieces.

The general truth is that the number of pictures is not the problem. Pictures
help when they isolate the parts in question and pair the before and after
exactly. Otherwise the AI falls back to numbers, and the numbers are the ones it
chose (fact 4).

### 7. The hook's AI almost never reads the guides it is pointed to, and it cannot research.

Every turn carries the Editing handbook, which names a guide per topic
(binding → `WC3-EDITING-NODES-BINDING.md`). In the editing work of these
attempts, `mdlxl_help` was called 2 times in about 840 tool calls.

The owner asked for Hive research twice. Codex runs with web search switched off
(`web_search="disabled"` in `ai-providers.cjs`), and the Claude API route has no
web tool, so the owner had to supply rules by hand. The outside agent read eight
Hive/XGM sources and recorded which decision each one supported. The decisive one
was that classic groups share bones equally, so accidental extra bones in a list
deform the surface.

The handbook already says "Classic groups average their bone members equally".
Knowing the sentence did not turn into using it.

The general truth is that the hook's knowledge reaches the AI only as a summary
line in the prompt. It is rarely opened in depth, rarely tied to a decision, and
cannot be extended by looking things up.

### 8. Work in the hook is cut into many small turns, and the reasons get lost between them.

- Attempt B ran 26 owner messages over a day. The provider changed from Claude to
  Codex halfway, after credit and model errors, so the new model inherited 63
  edits whose reasons it never saw.
- Codex compacted its memory 5 times across these threads.
- Every Codex prompt carries about 23 KB of captured editor state. Attempt C's
  15 messages repeat about 350 KB of it.
- The editor refused 13 tool calls because "the model or selection changed since
  this prompt", which happens when the owner touches the model while the AI works.
- When the owner cleared the chat, everything shrank to a 300-word note.

As a result, on 10-27 Codex treated the 10-26 skirt-bone mixtures as part of the
model rather than as an earlier AI choice it was free to undo.

The outside agent had one brief, one model and one continuous piece of work. It
ended with a full written record of what it changed and why.

The general truth is that the hook's AI often repairs the side effects of an
earlier AI decision without knowing that decision was a choice.

### 9. Given permission, the hook's AI redesigns. Given a symptom, it adds a patch.

When the owner allowed "Adjusting animations (the legs are too forward maybe?)",
Codex rebuilt the walk's stride, hoof path and bounce and called it "passed".
The owner meant small bone and leg-position changes to stop the splitting.

Earlier in the same thread, two well-received changes ("Great work", "Excellent
work") were the walk and Attack 1 reworks made directly against a named
reference model. In attempt B, the turns that "used the original motion" from
Demoness also did better than invented motion ("Dont animate using your own
ideas").

The outside agent wrote down at the start what it would not change: no mesh,
material or skeleton changes, no new keys, every remaining key an original one.
It kept to that.

The general truth is that the hook's AI reads a permission as a goal. Its best
results came when a reference fixed what "correct" looks like and the brief fixed
what must stay the same.

### 10. The hook leaves the AI's thinking effort at the provider default, and the Claude records show the AI taking shortcuts.

The hook never sets a reasoning effort:

- Codex threads record `reasoning_effort` as empty (the provider default), and
  none of the 488 Codex reasoning entries carries a readable summary, so neither
  the owner nor the hook can see why Codex chose a fix.
- The Claude subscription route's request records show `effort: "medium"`, the
  SDK default.
- The Claude API route caps each reply at 16,384 tokens and each turn at 64 steps.

Claude's visible thinking shows choices that gave up depth:

- "Since this is getting too deep into vertex-level analysis, I'll just implement
  a practical rig". This is the line that created the dress bones from fact 2.
- "it's acceptable overall, so I'll finish here"
- "I'll leave this stretching as-is… it reads as a natural hip crease"

The outside agent spent its first phase only on reading. It parsed the whole
file, checked that the file could be written back unchanged, scanned all 1,664
vertices and every binding mixture, and only then wrote a rule.

How sure: this fact is about contributing pressure, not the whole cause. A
different model ran the outside job, so effort alone cannot be credited. What is
certain is that the hook's AI states, in its own words, that it chose the faster
path at the moments that mattered.

## How the outside agent's run differed, in one paragraph

It read the whole model before touching it. It turned the owner's description
into a measurable cause (same-spot vertices with different bones, and thigh
vertices mixed with swinging skirt bones). It fixed the cause with one written
rule over the whole region, including written exceptions. It kept the original,
the repair-only stage and five variants side by side. It measured every key time
and midpoint of all 12 animations against the right baseline, and it reported
the limits of what it had proved. None of these steps needs a stronger tool than
the hook already has: the hook's scripts can parse, scan, sample every frame and
compare. What the hook lacks is the order of work (look at everything, decide,
then change once), a way to keep and compare stages, and a gate that is not
graded by the same AI that made the change.

## Uncertain or not checked

- The owner's statement that GPT's result "worked" is taken as given; its own
  audit lists no in-game test.
- The attempt-C chat file is gone. Its Codex history copy was used instead, and
  turn order and owner messages match the brief.
- The Claude half of attempt B ran on the API route (`provider: anthropic`).
  Only one short Claude Agent SDK record exists in `claude/projects`. Its
  `effort: medium` describes that route, not necessarily every Claude turn.
- Owner verdict counts come from reading each next owner message. "Partly
  accepted" is a judgement call (for example "almost there, still a LUMP").

## Case 2 (2026-10-29): adding an animated part across every animation

Studied by Claude Code on branch `claude/ai-flail-gaps` (from `origin/main`
`d5acb46f`), after the harness fixes of 0.34.0 and the matching review pictures
work. The model is only the evidence; every fact below is about the hook.

### The evidence

- **The outside run.** The owner's zip `WarriorNurgle_Flail_All_Available_Files.zip`
  (revised Flail04, Flail05–08, four preview GIFs) and its rebuilt 24-page report
  `WarriorNurgle_Flail_Full_Report.pdf`, both in the owner's Downloads. A ChatGPT
  chat agent was asked to make every animation hold a newly added weapon where the
  owner had placed it in Stand, animate its chain and head, keep the body untouched,
  and later to keep one handle bone that moves the whole weapon and to shrink the
  file from about 850 KB to about 100 KB. Five deliveries in about two hours.
- **The MDLxL follow-up.** The owner then edited Flail08 further with MDLxL's own
  AI and found it "very back and forth". The owner declined access to the AI chat
  files for this study, so that side is known only from the owner's words and from
  [Matching review pictures](ai-review-matching-pictures.md), which came from the
  same follow-up (its review compared the wrong animation and passed a blocked check).
- **A correction to "one prompt".** The outside run was not right first time. The
  owner rejected Flail05 ("you repositioned it") and Flail06 ("I cannot move the
  flail because of you") before Flail07 and Flail08 were accepted. What felt like
  one prompt was this: every round returned a complete, whole-model result that the
  owner could judge at once, and each rejection made the next round better, never
  worse. The facts below explain why that happens outside and not in the hook.
- **The outside agent overclaimed too.** It reported 4,665 and then 142,022 sampled
  poses as passed for the two versions the owner rejected, and its final file
  changed the geometry section (GEOS 71,923 → 58,339 bytes) in a weapon-only job
  without saying why. Big sample counts did not make its checks right.

### 11. The hook cannot tell the owner's own edits from AI edits, so it cannot protect them.

The outside report's first conclusion is "a reference pose is a contract": the
owner had placed the part by hand, and both rejected rounds moved it. When the
owner re-placed the part mid-task, that new placement became the authority and
the agent carried its chain motion onto it.

In the hook, the plan's keep list is written by the AI from the request text. The
decision diary records AI jobs and tells the next AI that their edits were choices
it may undo (fact 8). Nothing records what the owner changed by hand between jobs,
so hand-placed data looks exactly like any other data, or worse, like a leftover of
an earlier AI job. When the owner edits during a job, the hook stops the job as
stale instead of taking the edit as the new reference. No code in `ai-service.cjs`,
`ai-awareness.cjs`, `ai-diary.cjs` or `ai-editor.js` tracks who made an edit.

General truth: the owner's hand edits are the strongest statement of what they
want. The hook should know which data the owner set by hand since the last job and
treat it as kept unless the owner says otherwise.

### 12. Requirements that must hold in every animation are not checked in every animation.

"The part stays in the same spot in both hands in all animations" is a
relationship that must hold at every moment of every clip. The hook's tools are
built around "unchanged compared with before": the keep list, `protectedPaths`,
and the review's original/edited picture pairs. A relationship that must stay
true everywhere is a different kind of check. `mdlxl_sample` takes up to 32
frames per call and `mdlxl_capture` up to 12 pictures, which invites spot checks
of a few poses. Scripts can sample more, but there is no ready routine and the
prompt does not ask for one.

The outside agent's first failure shows the same trap: it proved the part followed
one hand, not both. Its later rounds measured the two contact points in the part's
own space over the whole timeline.

General truth: for "keep X attached to / clear of / level with Y everywhere",
the check has to sweep every clip and report the worst moment and where it is,
rather than compare a few chosen frames.

### 13. Nothing reviews the model as a thing the owner works with: its rig and its size.

The second rejection was not about looks. The weapon looked right, but extra grip
bones meant the owner could no longer move it with one bone. Pictures cannot show
that, so the hook's outside check (fact 4 fix) would have passed it: it judges only
"what the owner will see", and the owner also edits, moves and ships the model.

The same blind spot covers size. The outside rounds grew the bone section from
56 KB to 787 KB with sampled keys before a size limit forced a simpler motion. The
hook's prompt says "Prefer sparse keys to baked tracks", and `mdlxl_document`
validate already returns the saved byte size, but nothing compares structure or
size with the original or shows the growth to anyone.

General truth: the review should state what the edit did to the model's structure
and cost, compared with the original: nodes added, re-parented or inserted between
existing bones, keys added, bytes before and after. An unrequested change to which
bone moves what should be named plainly and asked about, and an editor drag
(`mdlxl_ui`) can prove the main control still moves the whole part.

### 14. Corrections do not become standing requirements.

The outside report ends with "acceptance is cumulative": each rejection added one
explicit requirement (both hands; one handle bone; the new placement; the size
limit) and every later round was judged against all of them.

In the hook, each job writes a fresh plan with its own keep list and checks. The
diary keeps the owner's next message as a 300-character note on the last job, and
shows only the last 8 jobs (`SHOWN = 8`). Nothing turns "I cannot move it because of
you" into a requirement that later jobs must check, so a later job can quietly undo
what an earlier correction established, and the owner has to say it again.

General truth: a model needs one short list of the owner's standing requirements,
in their words, that every plan starts from and every review checks, and that only
the owner can remove.

### 15. The final word is one word, so a result can pass while one requirement fails.

The report's key lesson is that grip, editability, clearance, looks and size are
separate tests and none stands in for another. In the hook a job finishes with one
outcome (`passed`, `needs-correction` or `blocked`) and the outside check returns
one verdict (`good`, `doubtful`, `wrong`). Per-criterion results exist in
`mdlxl_review`, but only with SD Brain on and only for SD art criteria; the plan's
own completion checks get no individual verdict at the end.

General truth: the finish should give each plan check and each standing
requirement its own result (met, failed, or could not be shown), so "passed" can
never cover a requirement that was not tested.

### 16. When a fit is hard, the AI adds machinery instead of keeping the shape of the answer simple.

This repeats fact 2 in a new form. In the Demonette the hook added bones to vertex
blends; here the outside agent's rejected round added grip bones and about 40,000
sampled keys to make a numeric fit pass, and the accepted result had one control
and 382 weapon keys. Both cases had the same shape: the fix the owner accepted was
the simpler structure that met the requirements, not the most exact fit.

General truth: when options in the plan meet the checks equally, prefer the one
that adds the fewest bones, keys and controls, and record the growth as a cost of
each option (fact 13 supplies the numbers).

### Old facts seen again

- Fact 4 (self-graded checks): seen in the outside agent itself, twice.
- Fact 9 (permission read as a redesign): the rejected round invented a new rig to
  satisfy a fit nobody asked to be solved that way.
- Facts 5 and 8 (building on the last result, lost reasons): the outside run kept
  every round as a named file and rebuilt from the owner's newest reference. The
  hook now has versions and the diary; whether the owner can see and pick them in
  practice was not checked here.

### Not checked

- The MDLxL follow-up chats were not read (owner's choice), so facts 11–16 are
  shown in the hook's code and instructions, not observed in that conversation.
- The outside report is a rebuilt edition; its earlier checks are its own claims.
- Nothing was run in the app or in Warcraft III; no code was changed.

## Next action

- Facts 1–10 were acted on in 0.34.0 (see [AI hook harness](ai-hook-harness.md)).
- Facts 11–16 are not implemented. Use them when designing the next hook
  improvements in a separate task, owner-approved one step at a time.
