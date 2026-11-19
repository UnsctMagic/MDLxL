'use strict';
// The decision diary: what each AI job on a model did and why, kept with the
// model in MDLxL's own registry. It survives provider switches, compaction,
// new chats and "Keep a summary", so later jobs know earlier edits were choices.

const KEPT = 40; // entries stored per model (unchanged)
const short = (value, length) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > length ? text.slice(0, length - 1) + '…' : text;
};

// One entry per job, updated when the job resumes or finishes.
function recordJob(entry, { id, request, plan, steps = [], outcome, nodeIds = [] }) {
  const edits = steps.filter(step => step.status === 'applied').map(step => short(step.label, 80));
  if (!plan && !edits.length) return false;
  entry.diary ||= [];
  const job = entry.diary.find(item => item.id === id) || entry.diary[entry.diary.push({ id, at: new Date().toISOString() }) - 1];
  Object.assign(job, {
    request: short(request, 300),
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

// The registry keeps the complete diary. Direct jobs get entries related
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

// Standing requirements: rules the owner states for a model ("keep it under
// 250 KB", "respect the geoset pose", "never touch my rig") stay with the model
// and go to every later job until the owner replaces or drops them.
const REQUIRED_KEPT = 8;
const SIZE = /\b\d+(?:[.,]\d+)?\s*(?:kb|mb|bytes|k)\b|\bfile size\b|\bsize limit\b/i;
const COUNT = /\b(?:under|below|at most|no more than|max(?:imum)?(?: of)?)\s+\d[\d,.]*\s*(?:kb|mb|k|bytes|triangles|tris|polys|polygons|faces|vertices|verts|keys|bones)\b/i;
const STANDING = /\b(?:always|never|must|from now on|at all times|in (?:all|every) (?:animations?|clips?|jobs?)|every (?:animation|clip|time|job)|respect|keep my|leave (?:my|the) .{1,40}? alone|do ?n[o’']t (?:ever )?(?:touch|change|move|edit|delete|remove|wipe|replace|rebind|re-?rig)|stay (?:under|below|within))\b/i;
const RELEASE = /\b(?:no longer|forget (?:about )?(?:the|my)?|ignore (?:the|my)|drop the|(?:does|do)(?: not|n[o’']t) matter (?:any ?more)?|not needed any ?more|no (?:size |file size )?limit|you (?:can|may) now)\b/i;
const QUESTION = /^(?:why|what|how|did|where|when|who|is|are|was|were)\b/i;
// Words that say how strongly, not what about; they never make two rules the same subject.
const MARKERS = new Set('always never must now from times all every time job jobs respect keep leave alone dont don touch change move edit delete remove wipe replace rebind rerig stay under below within longer forget ignore drop matter anymore any more needed limit can may fine instead'.split(' '));
const subject = text => new Set([...terms(text)].filter(word => !MARKERS.has(word) && !/^\d/.test(word)));
const sameSubject = (a, b) => {
  if (a.toLowerCase().replace(/\W+/g, ' ').trim() === b.toLowerCase().replace(/\W+/g, ' ').trim()) return true;
  if (SIZE.test(a) && SIZE.test(b)) return true;
  const left = subject(a), right = subject(b);
  const shared = [...left].filter(word => right.has(word)).length;
  return shared > 0 && shared >= Math.ceil(Math.min(left.size, right.size) / 2);
};
function noteRequirements(entry, text) {
  const sentences = String(text || '').split(/(?<=[.!?;])\s+|\n+/).map(s => s.trim()).filter(s => s.length >= 6 && s.length <= 400 && !QUESTION.test(s));
  let changed = false;
  for (const sentence of sentences) {
    const release = RELEASE.test(sentence), standing = !release && (STANDING.test(sentence) || COUNT.test(sentence) || (SIZE.test(sentence) && /\b(?:under|below|keep|max|limit|at most|smaller than|less than)\b/i.test(sentence)));
    if (!release && !standing) continue;
    const kept = (entry.requirements || []).filter(item => !sameSubject(item.text, sentence));
    if (standing) kept.push({ text: short(sentence, 200), at: new Date().toISOString() });
    if (kept.length !== (entry.requirements || []).length || standing) changed = true;
    entry.requirements = kept.slice(-REQUIRED_KEPT);
  }
  if (entry.requirements && !entry.requirements.length) delete entry.requirements;
  return changed;
}
// The list for a job; rules stated in this very request are already in front of the AI.
function requirementsText(entry, request = '') {
  const items = (entry?.requirements || []).filter(item => !String(request).includes(item.text)).reverse();
  if (!items.length) return '';
  return "Standing requirements the owner gave for this model, in their words, newest first. Keep every one in this job and report any you could not keep; the current request wins where it says otherwise:\n" +
    items.map(item => `- "${item.text}" (${item.at.slice(0, 10)})`).join('\n');
}
// What the owner changed by hand since the AI's last delivery on this model.
function handEditsText(lines) {
  if (!lines?.length) return '';
  return "Hand edits since the AI's last delivery on this model (the owner's own changes; keep them unless the request says otherwise):\n" + lines.map(line => '- ' + line).join('\n');
}

module.exports = { recordJob, noteOwnerReply, diaryText, noteRequirements, requirementsText, handEditsText };
