// OpenAI-compatible fixture exercising the same provider-neutral editor tools as
// a real connection. No direct bridge calls, model hooks or provider credentials.
const assert = require('node:assert/strict');
const textOf = message => typeof message?.content === 'string' ? message.content : (message?.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
function createHandbookFixture(record) {
  const stages = new Map();
  return async (req, res) => {
    try {
      let raw = ''; for await (const part of req) raw += part;
      if (req.url.endsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"data":[{"id":"handbook-fixture"}]}'); }
      const data = JSON.parse(raw), system = textOf(data.messages[0]);
      const user = [...data.messages].reverse().find(message => message.role === 'user' && /MDLxL context (?:captured when this prompt was sent|for this prompt:)/.test(textOf(message)));
      assert.ok(user, 'production provider receives captured editor context');
      const prompt = textOf(user), targetFromPrompt = JSON.parse(textOf(user).slice(textOf(user).lastIndexOf('\n') + 1)).target;
      if (prompt.includes('native-staging-fixture')) {
        const key = 'staging', stage = stages.get(key) || 0; stages.set(key, stage + 1);
        const tool = (name, args) => ({ delta: { tool_calls: [{ index: 0, id: key + stage, function: { name, arguments: JSON.stringify({ ...args, target: targetFromPrompt }) } }] }, finish_reason: 'tool_calls' });
        const previous = textOf([...data.messages].reverse().find(message => message.role === 'tool'));
        let value;
        if (!stage) value = tool('mdlxl_context', {});
        else if (stage === 1) value = tool('mdlxl_plan', { cause: 'Stage and compare a one-unit vertex move before adoption.', reach: 'Only the first X coordinate of geoset zero.', scope: ['/Geosets/0/Vertices'], protectedPaths: ['/Geosets/0/TVertices', '/Materials', '/Textures', '/Bones'], keep: ['Every UV and exterior vertex'],
          options: [{ fix: 'Stage the exact coordinate change', cost: 'One named private candidate' }, { fix: 'Translate the whole surface', cost: 'Changes extra coordinates' }], choice: 0, why: 'Smallest requested variant.', checks: ['Live model is unchanged before adoption', 'One Undo restores the adopted edit'],
          nativeChecks: [{ name: 'Scoped staged position', editing: { scope: ['/Geosets/0/Vertices'] } }] });
        else if (stage === 2) value = tool('mdlxl_versions', { action: 'save', name: 'staging accepted' });
        else if (stage === 3) value = tool('mdlxl_script', { candidate: 'safe scoped variant', edit: false, scope: ['/Geosets/0/Vertices'], protectedPaths: ['/Geosets/0/TVertices', '/Materials', '/Textures', '/Bones'], code: 'model.Geosets[0].Vertices[0]+=1; return {scoped:true};' });
        else if (stage === 4) {
          const result = JSON.parse(previous.split('\n')[0]); assert.equal(result.applied, false); assert.equal(result.staged, true);
          value = tool('mdlxl_versions', { action: 'compare', name: 'staging accepted', other: 'safe scoped variant', nativeChecks: [{ name: 'Scoped private comparison', editing: { scope: ['/Geosets/0/Vertices'] } }] });
        } else if (stage === 5) {
          const result = JSON.parse(previous.split('\n')[0]); assert.ok(result.differences > 0); assert.ok(result.native.checks.every(row => row.passed));
          record.stagedCompared = true; record.stageReady?.(); await record.stageGate;
          value = tool('mdlxl_versions', { action: 'use', name: 'safe scoped variant' });
        } else if (stage === 6) value = tool('mdlxl_review', { action: 'inspect', checksCode: 'return [{name:"Staged coordinate adopted",passed:model.Geosets[0].Vertices[0]===before.Geosets[0].Vertices[0]+1}];' });
        else if (stage === 7) {
          const result = JSON.parse(previous.split('\n')[0]); assert.equal(result.review.passed, true);
          value = tool('mdlxl_review', { action: 'finish', outcome: 'passed', summary: 'Scoped candidate adopted and verified against its original baseline.' });
        } else value = { delta: { content: 'STAGING_COMPLETE' }, finish_reason: 'stop' };
        res.writeHead(200, { 'content-type': 'text/event-stream' }); return res.end('data: ' + JSON.stringify({ choices: [value] }) + '\n\n');
      }
      const domain = /native-domain-(optimization|emitter)-fixture/.exec(prompt);
      if (domain) {
        const kind = domain[1], key = 'domain-' + kind, stage = stages.get(key) || 0; stages.set(key, stage + 1);
        record.domainPrevious = { kind, stage, result: textOf([...data.messages].reverse().find(message => message.role === 'tool')).slice(0, 2000) };
        const tool = (name, args) => ({ delta: { tool_calls: [{ index: 0, id: key + stage, function: { name, arguments: JSON.stringify({ ...args, target: targetFromPrompt }) } }] }, finish_reason: 'tool_calls' });
        let value;
        if (!stage) value = tool('mdlxl_context', {});
        else if (stage === 1) value = tool('mdlxl_versions', { action: 'save', name: key, note: 'Read-only native domain baseline' });
        else if (stage === 2) value = tool('mdlxl_versions', { action: 'compare', name: key, nativeChecks: [{ name: 'Native ' + kind + ' goal', editing: kind === 'optimization'
          ? { operation: kind, scope: ['/Geosets'], optimization: { measureBytes: true, maxBytes: 1000000 } }
          : { operation: kind, scope: ['/ParticleEmitters2'], emitterGoals: [record.effectGoal] } }] });
        else {
          const result = JSON.parse(textOf([...data.messages].reverse().find(message => message.role === 'tool')).split('\n')[0]);
          assert.ok(result.native.checks.length > 0 && result.native.checks.every(row => row.passed), 'native domain checks pass through the production versions endpoint');
          const report = result.native.reports[0].editing;
          (record.nativeDomains ||= []).push({ kind, ...(kind === 'optimization' ? { bytes: report.optimization.afterBytes } : { sampled: result.native.checks.filter(row => row.name.includes('emitter ')).length }) });
          value = { delta: { content: 'DOMAIN_' + kind + '_COMPLETE' }, finish_reason: 'stop' };
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' }); return res.end('data: ' + JSON.stringify({ choices: [value] }) + '\n\n');
      }
      const route = /routing-(\d)-fixture/.exec(prompt);
      if (route) {
        const id = Number(route[1]), routeKey = 'route-' + id, stage = stages.get(routeKey) || 0;
        stages.set(routeKey, stage + 1);
        assert.ok(system.includes('Editing handbook (on)'), 'routed tasks use the enabled handbook');
        const expectedGuide = [2, 6].includes(id) ? 'UV-MATERIALS' : id === 5 ? 'NODES-BINDING' : 'GEOMETRY';
        assert.ok(prompt.includes('Editing guide for this job (WC3-EDITING-' + expectedGuide + '.md)'), 'actual prompt carries the routed guide: ' + expectedGuide);
        let value;
        if (!stage) value = { delta: { tool_calls: [{ index: 0, id: routeKey, function: { name: 'mdlxl_context', arguments: '{}' } }] }, finish_reason: 'tool_calls' };
        else {
          const result = JSON.parse(textOf([...data.messages].reverse().find(message => message.role === 'tool')).split('\n')[0]);
          assert.equal(result.mode, 'vertices', 'actual editor mode remains vertices');
          assert.equal(result.uvEditing, id === 2, 'AI captures UV area only for the focused UV case');
          assert.ok(Object.values(result.selection).some(ids => ids.length), 'real selected geometry remains captured');
          (record.routes ||= []).push({ id, guide: expectedGuide, mode: result.mode, uvEditing: result.uvEditing });
          value = { delta: { content: 'ROUTING_' + id + '_COMPLETE' }, finish_reason: 'stop' };
        }
        res.writeHead(200, { 'content-type': 'text/event-stream' }); return res.end('data: ' + JSON.stringify({ choices: [value] }) + '\n\n');
      }
      const on = prompt.includes('handbook-on-fixture'), key = on ? 'on' : 'off';
      const context = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1)), target = context.target;
      const stage = stages.get(key) || 0; stages.set(key, stage + 1);
      const previous = [...data.messages].reverse().find(message => message.role === 'tool');
      const resultText = textOf(previous);
      record.requests.push({ mode: key, stage, handbook: system.includes('Editing handbook (on)'), previous: resultText.slice(0, 3000) });
      assert.equal(system.includes('Editing handbook (on)'), on, 'handbook follows the actual switch at task start');
      const answer = content => ({ delta: { content }, finish_reason: 'stop' });
      const tool = (name, args) => ({ delta: { tool_calls: [{ index: 0, id: key + '-' + stage, function: { name, arguments: JSON.stringify({ ...args, target: targetFromPrompt }) } }] }, finish_reason: 'tool_calls' });
      let value;
      if (!on) value = stage === 0 ? tool('mdlxl_context', {}) : answer('HANDBOOK_OFF_COMPLETE');
      else if (stage === 0) value = tool('mdlxl_context', {});
      else if (stage === 1) { record.context = JSON.parse(resultText.split('\n')[0]); value = tool('mdlxl_read', { target, path: '', parts: true, limit: 2 }); }
      else if (stage === 2) {
        const partMap = JSON.parse(resultText.split('\n')[0]);
        assert.ok(partMap.parts.length > 0 && partMap.parts[0].selectedVertices > 0, 'real user selection enters native part map'); record.partMap = partMap;
        value = tool('mdlxl_plan', { target, cause: 'Move the first selected vertex exactly one model unit in X.', reach: 'Geoset zero; keep UV coordinates and all exterior geometry.', keep: ['Every UV coordinate', 'All other geosets, materials, rig and timing'],
          options: [{ fix: 'Move just the first selected vertex', cost: 'Changes one selected position' }, { fix: 'Translate the entire selected surface', cost: 'Changes extra selected vertices' }], choice: 0, why: 'Smallest exact requested change.', checks: ['Requested vertex is +1 X and every other position is unchanged'],
          nativeChecks: [{ name: 'Original edit boundary', editing: { operation: 'geometry', scope: ['/Geosets/0'], selection: record.context.selection, preserveUVs: true, preserveMaterials: true, preserveTiming: true } }] });
      } else if (stage === 3) value = tool('mdlxl_script', { target, edit: true, label: 'Candidate vertex move', scope: ['/Geosets/0'], code: 'model.Geosets[0].Vertices[0]+=1; model.Geosets[0].TVertices[0][0]+=.125; return {candidate:true};' });
      else if (stage === 4 || stage === 7) value = tool('mdlxl_review', { target, action: 'inspect', checksCode: 'return [{name:"Requested first vertex moved",passed:model.Geosets[0].Vertices[0]===before.Geosets[0].Vertices[0]+1}];' });
      else if (stage === 5) {
        const result = JSON.parse(resultText.split('\n')[0]);
        assert.equal(result.review.passed, false, 'native gate rejects self-reported successful unsafe candidate');
        assert.ok(result.review.checks.some(row => row.name.includes('UV preservation') && row.passed === false), 'native UV check is the concrete failure'); record.unsafeRejected = true;
        value = tool('mdlxl_review', { target, action: 'finish', outcome: 'passed', summary: 'Attempt to bypass the failed native UV gate.' });
      } else if (stage === 6) {
        assert.match(resultText, /Inspect and pass|checks and images|failed/i, 'failed native gate refuses passed finish'); record.finishRefused = true;
        value = tool('mdlxl_script', { target, edit: true, label: 'Restore preserved UVs', scope: ['/Geosets/0/TVertices'], code: 'model.Geosets[0].TVertices=structuredClone(references["version:original"].model.Geosets[0].TVertices); return {corrected:true};' });
      } else if (stage === 8) {
        const result = JSON.parse(resultText.split('\n')[0]);
        assert.equal(result.review.passed, true, 'corrected candidate passes the same persistent native checks');
        assert.ok(result.review.native.reports.length > 0); record.corrected = true;
        value = tool('mdlxl_review', { target, action: 'finish', outcome: 'passed', summary: 'The requested vertex move is present and authored UVs and exterior data are preserved.' });
      } else value = answer('HANDBOOK_ON_COMPLETE');
      res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: ' + JSON.stringify({ choices: [value] }) + '\n\n');
    } catch (error) { record.error = error.stack; record.failure?.(error); res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { message: error.message } })); }
  };
}
module.exports = { createHandbookFixture };
