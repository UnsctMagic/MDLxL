const { validateArguments } = require('./ai-mcp.cjs');

// Per-job orchestration state. No editor mutations or provider calls live here.
function helperSpec(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || typeof value.job !== 'string' || !value.job.trim() || typeof value.instructions !== 'string' || !value.instructions.trim())
    throw Error('A helper needs a short job and specific read-only instructions.');
  if (value.job.length > 160 || value.instructions.length > 2000) throw Error('Keep helper instructions under 2000 characters and its title under 160.');
  return { job: value.job.trim(), instructions: value.instructions.trim() };
}
function acceptanceChecks(value, sweepSchema) {
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
    helper: task.helper?.report,
    review: task.checkpoint?.review,
    failures: task.replanRequired,
  });
}
module.exports = { helperSpec, acceptanceChecks, expandRoutine, recordFailures, checkpointNote };
