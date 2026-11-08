# AI workspace and model merges

Branch `codex/ai-local-workspace` starts at `7612078a`. Ready for independent QA and owner review.

The chat header enables a local JavaScript workspace for new jobs. All embedded tool-capable providers share the same tool. With the switch off, a provider can explain a specific benefit in a green Yes/No card. The answer applies to the current job. The workspace uses the protected model-script runner, bounded per-job scratch files and selection-only candidate previews.

An embedded job keeps its captured model and selection when the user changes the live editor. Edits that touch separate data combine without a provider call (`planIndependentEdits` in `app/ai-job-copy.js`). When they overlap, the user can open a finished candidate separately or ask the same provider to merge it into the latest model. A second edit during the merge prompts again. The common base and candidate are available to that provider through read-only script inputs. The editor checks uncontested changes before transferring the merged data to the source through Undo. [Hook behavior](../AI-HOOK.md#editing-while-the-ai-is-working)

## Verification

- On the previous package the local-workspace switch was absent. Before model delivery was implemented the packaged conflict test timed out waiting for the merge choice after an actual edit.
- The packaged [Knight selection test](../../test/ai-local-workspace.electron.cjs) covers the header switch, Yes, No, offer suppression, selection scope and a real isolated render. The local fixture provider narrows 3,373 marked vertices to 425 and the preview contains 649 complete triangles.
- [Overlap rules](../../test/ai-job-copy.test.js) cover separate geosets, the same data, list inserts and removals, the model-wide box, unfinished work and an editor rejection.
- The packaged [delivery test](../../test/ai-model-merge.electron.cjs) uses the Knight model. Separate edits (header and animation, and two geosets) combine with no provider call and one Undo. An overlapping sequence field exercises repeated edits during a merge, opening the candidate in another tab, delivery to the same tab, and Ctrl+Z. It reopens serialized model data for its assertions.
- Verification uses an isolated package, disposable profiles and local provider fixtures. Live provider judgment and the owner's installed editor are outside this run.
