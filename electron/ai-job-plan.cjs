const { validateArguments } = require('./ai-mcp.cjs');

// Per-job orchestration state. No editor mutations or provider calls live here.
// The existing direct-chat exact-edit exemption for planning.
function exactValueRequest(text, images = []) {
  if (images.length) return false;
  const value=String(text).trim().replace(/^(?:ask\s+)?[A-Za-z]+(?:[:,]|\s+to\b)\s*/i,'');
  if (/\b(shape|spatial|bind|binding|deform|retarget|animate|animation feel|pose|sculpt|smooth|fit|improve|design|create|repair|fix|beautiful|natural|realistic|suggest|recommend)\b/i.test(value)) return false;
  const parts=value.split(/\s*(?:;|\n|\band then\b)\s*/).filter(Boolean);
  return parts.length>0 && parts.every(part=>
    /^(?:read|list|count|report|show)\s+(?:(?:all|the|current|selected)\s+)?(?:names?|bones?|nodes?|geosets?|materials?|textures?|sequences?|flags?|values?|counts?|metadata|diagnostics|selection)\b[^?]*[.?]?$/i.test(part) ||
    /^rename\s+.+\s+to\s+(?:"[^"\n]+"|'[^'\n]+'|[\w .-]+)[.]?$/i.test(part) ||
    /^(?:set|change|recolou?r)\s+.+\s+(?:to|=)\s*(?:[-+]?\d+(?:\.\d+)?(?:\s*[, ]\s*[-+]?\d+(?:\.\d+)?)*|true|false|on|off|#[0-9a-f]{6}|red|green|blue|black|white|yellow|transparent)[.]?$/i.test(part) ||
    /^(?:set|change)\s+.+\b(?:visibility|visible|hidden)\b.+\b(?:from|between)\s+\d+\s+(?:to|and)\s+\d+[.]?$/i.test(part)
  );
}

function planChecks(value, sweepSchema) {
  if (!Array.isArray(value) || !value.length || value.length > 20)
    throw Error('List 1–20 concrete completion checks in checks, covering the requested result and protected data.');
  return value.map(check => {
    const name = typeof check === 'string' ? check : check?.name;
    if (typeof name !== 'string' || !name.trim() || name.length > 500)
      throw Error('Give each completion check a name of 1–500 characters.');
    if (typeof check === 'string') return name.trim();
    validateArguments(sweepSchema, check.sweep, 'check.sweep');
    return { name: name.trim(), sweep: check.sweep };
  });
}
function expandRoutine(task, name, args) {
  if (!['mdlxl_script', 'mdlxl_review'].includes(name) || !args.routine) return args;
  if (name === 'mdlxl_review' && args.action !== 'inspect') throw Error('Review routines are only used by inspect.');
  if (typeof args.routine !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(args.routine)) throw Error('Use a short alphanumeric routine name.');
  const key = name === 'mdlxl_script' ? 'code' : 'checksCode';
  const routines = (task.routines ||= {});
  if (args[key] !== undefined) {
    if (typeof args[key] !== 'string' || !args[key].trim()) throw Error('Supply a nonempty routine body.');
    routines[args.routine] = { tool: name, code: args[key] };
  }
  const routine = Object.hasOwn(routines, args.routine) && routines[args.routine];
  if (!routine || routine.tool !== name) throw Error('No saved ' + name + ' routine called ' + args.routine + '. Supply its body once.');
  if (args.parameters != null && (typeof args.parameters !== 'object' || Array.isArray(args.parameters))) throw Error('Routine parameters must be an object.');
  const { routine: ignored, parameters, ...expanded } = args;
  expanded[key] = 'const parameters = JSON.parse(' + JSON.stringify(JSON.stringify(parameters || {})) + ');\n' + routine.code;
  return expanded;
}
function recordFailures(task, checks, fingerprint) {
  const failed = (checks || []).filter(c => c.passed === false && typeof c.name === 'string');
  const failures = (task.checkFailures ||= {});
  for (const check of failed) {
    const key = check.name.slice(0, 200);
    const previous = Object.hasOwn(failures,key) ? failures[key] : null;
    Object.defineProperty(failures, key, { value: { count: (previous?.count || 0) + (previous && previous.fingerprint === fingerprint ? 0 : 1), fingerprint }, enumerable: true, configurable: true, writable: true });
  }
  for (const check of checks || []) if (check.passed === true && typeof check.name === 'string') delete failures[check.name.slice(0, 200)];
  const repeated = Object.entries(failures).filter(([,v]) => v.count >= 2).map(([name]) => name);
  if (repeated.length) task.replanRequired = repeated.join('; ');
  return task.replanRequired;
}
function checkpointNote(task) {
  return JSON.stringify({
    plan: task.plan && { cause: task.plan.cause, chosen: task.plan.options[task.plan.choice], keep: task.plan.keep, checks: task.plan.checks },
    checkpoint: task.workCheckpoint,
    appliedStepCount: task.steps.filter(s => s.status === 'applied').length,
    appliedSteps: task.steps.filter(s => s.status === 'applied').map(s => ({ tool:s.tool, label:s.label })),
    recentSteps: task.steps.slice(-20).map(s => ({ tool:s.tool, label:s.label, status:s.status })),
    routines: Object.keys(task.routines || {}),
    review: task.checkpoint?.review,
    failures: task.replanRequired,
  });
}
module.exports = { planChecks, exactValueRequest, expandRoutine, recordFailures, checkpointNote };
