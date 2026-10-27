'use strict';
// The decision diary: what each AI job on a model did and why, kept with the
// model in MDLxL's own registry. It survives provider switches, compaction,
// new birds and "Keep a summary", so later jobs know earlier edits were choices.

const KEPT = 40, // entries stored per model
  SHOWN = 8; // most recent entries given to each new job
const short = (value, length) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? text.slice(0, length - 1) + '…' : text;
};

// One entry per job, updated when the job resumes or finishes.
function recordJob(entry, { id, request, plan, steps = [], outcome, bird }) {
  const edits = steps.filter(step => step.status === 'applied').map(step => short(step.label, 80));
  if (!plan && !edits.length) return false;
  entry.diary ||= [];
  const job = entry.diary.find(item => item.id === id) || entry.diary[entry.diary.push({ id, at: new Date().toISOString() }) - 1];
  Object.assign(job, {
    request: short(request, 300),
    ...(bird ? { bird } : {}),
    ...(plan
      ? {
          plan: {
            cause: short(plan.cause, 300),
            chosen: short(plan.options?.[plan.choice]?.fix, 200),
            why: short(plan.why, 200),
            keep: (plan.keep || []).slice(0, 8).map(item => short(item, 80)),
          },
        }
      : {}),
    edits,
    outcome,
  });
  entry.diary.splice(0, Math.max(0, entry.diary.length - KEPT));
  return true;
}

// The owner's next message is their reaction to the last job.
function noteOwnerReply(entry, text) {
  const last = entry.diary?.at(-1);
  if (!last || last.ownerNext) return false;
  last.ownerNext = short(text, 300);
  return true;
}

function diaryText(entry) {
  const jobs = (entry?.diary || []).slice(-SHOWN);
  if (!jobs.length) return '';
  return (
    'Decision diary: earlier AI jobs on this model, oldest first. Each edit was a choice another AI made, not part of the authored model; if one causes the current problem, undo or rework it.\n' +
    jobs
      .map(job =>
        [
          `- ${job.at.slice(0, 10)}${job.bird ? ' ' + job.bird : ''}: "${job.request}"`,
          job.plan ? `cause: ${job.plan.cause}; chose: ${job.plan.chosen}; why: ${job.plan.why}; kept: ${job.plan.keep.join(', ')}` : '',
          job.edits.length ? `edits: ${job.edits.join('; ')}` : 'no edits',
          `result: ${job.outcome}`,
          job.ownerNext ? `the owner then said: "${job.ownerNext}"` : '',
        ]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n')
  );
}

module.exports = { recordJob, noteOwnerReply, diaryText };
