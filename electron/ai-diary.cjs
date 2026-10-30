'use strict';
// The decision diary: what each AI job on a model did and why, kept with the
// model in MDLxL's own registry. It survives provider switches, compaction,
// new birds and "Keep a summary", so later jobs know earlier edits were choices.

const KEPT = 40; // entries stored per model (unchanged)
const short = (value, length) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? text.slice(0, length - 1) + '…' : text;
};

// One entry per job, updated when the job resumes or finishes.
function recordJob(entry, { id, request, plan, steps = [], outcome, bird, nodeIds = [] }) {
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
    nodeIds: [...nodeIds],
    paths: [...new Set(steps.filter(s => s.status === 'applied').flatMap(s => (s.changes || []).map(c => c.path)).filter(p => typeof p === 'string'))],
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

// The organiser keeps the complete stored diary. Workers get entries related
// to this request or the parts it touches, never a fixed number of recent jobs.
const common = new Set('the and for with from this that these those them they their its you your please make model mesh geoset bone part whole selected current keep look same change changes edit work task result about like into only'.split(' '));
const terms = text => new Set((String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length > 2 && !common.has(w)).map(w => w.length > 4 ? w.replace(/s$/, '') : w));
function diaryText(entry, task) {
  let jobs = [...(entry?.diary || [])].reverse();
  if (task) {
    const wanted = terms(task.request),
      selection = new Set(Object.keys(task.context?.selection || {})),
      nodes = new Set((task.context?.selectedNodeIds || []).map(String)),
      followup = /\b(?:it|this|that|these|those|them|again|still|same)\b/i.test(task.request || '');
    const matches = jobs.map(job => {
      const previous = followup && job.id === task.previous;
      const content = terms([job.request, job.plan?.cause, job.plan?.chosen, ...(job.edits || [])].join(' '));
      const score = [...wanted].filter(word => content.has(word)).length;
      const touched = (job.nodeIds || []).some(id => nodes.has(String(id))) || (job.paths || []).some(path => {
        const part = /^\/Geosets\/(\d+)(?:\/|$)/.exec(path);
        return part && selection.has(part[1]);
      });
      return { job, score, touched, previous };
    });
    const best = Math.max(0, ...matches.map(m => m.score));
    jobs = matches.filter(m => m.previous || m.touched || (m.score > 0 && m.score === best)).map(m => m.job);
  }
  if (!jobs.length) return '';
  return (
    `Decision diary: ${task ? 'relevant ' : ''}earlier AI jobs on this model, newest first. Each edit was a choice another AI made, not part of the authored model; if one causes the current problem, undo or rework it.\n` +
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
