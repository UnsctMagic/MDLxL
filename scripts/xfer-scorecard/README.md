# XFER scorecard

The owner's six rules ([finish line](../../docs/agent-tasks/xfer-finish-line.md)) measured on every test pair and every
donated animation, at each pair's default ticks.

    node scripts/xfer-scorecard/score.mjs out/scorecard/run.jsonl [--only 15,17] [--shard 0/4]
    node scripts/xfer-scorecard/calibrate.mjs out/scorecard/run.jsonl out/scorecard/run-cal.jsonl
    node scripts/xfer-scorecard/page.mjs out/scorecard/run-cal.jsonl out/scorecard/run-page [--before out/scorecard/baseline-cal.jsonl]

`limits.json` is fixed: each limit sits at the 80th percentile of the pairs the owner graded 9-10 in the reasonable-50 round
(20th for "in hand"); the second-hand limit is 0.8 by hand. Do not recalibrate to make a run pass. `render.mjs` draws
donor / own / result flat-shaded for the pictures and for checking by eye.
