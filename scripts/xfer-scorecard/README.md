# XFER scorecard

The owner's six rules ([finish line](../../docs/agent-tasks/xfer-finish-line.md)) measured on every test pair and every
donated animation, at each pair's default ticks.

The pairs are `pairs-reasonable.json`: 58 reasonable pairs (plan: [xfer-fable-plan.md](../../docs/agent-tasks/xfer-fable-plan.md),
"Test set"), every model in `D:\Claude\MDLxL-TestModels` (`reasonable-50\`, `new-30\`, `xfer-reasonable\`). Rows have the
sheets' shape, so `render.mjs --manifest` reads it; `suggestion` holds the live suggestion at the baseline revision, and the
eight pairs the owner graded 9-10 carry `regression: true` and the `ticks` he graded. `score.mjs` and `live-suggest.mjs` read
it by default (`--pairs <file>` for another list).

    node scripts/xfer-scorecard/regress.mjs --check [--jobs 4]          # the eight 9-10 pairs, exported file byte for byte
    node scripts/xfer-scorecard/regress.mjs --check --all [--jobs 4]    # every pair at the suggester's ticks: ticks and bytes
    node scripts/xfer-scorecard/regress.mjs --write --all [--jobs 4]    # new reference (regression-baseline.json); only on Fable's word

`--suggestions <live.jsonl>` takes the suggester's ticks from a `live-suggest.mjs` run instead of running it again.

    node scripts/xfer-scorecard/score.mjs out/scorecard/run.jsonl [--only 15,17] [--shard 0/4]
    node scripts/xfer-scorecard/calibrate.mjs out/scorecard/run.jsonl out/scorecard/run-cal.jsonl
    node scripts/xfer-scorecard/page.mjs out/scorecard/run-cal.jsonl out/scorecard/run-page [--before out/scorecard/baseline-cal.jsonl]

`limits.json` is fixed: each limit sits at the 80th percentile of the pairs the owner graded 9-10 in the reasonable-50 round
(20th for "in hand"); the second-hand limit is 0.8 by hand. Do not recalibrate to make a run pass. `render.mjs` draws
donor / own / result flat-shaded for the pictures and for checking by eye.
