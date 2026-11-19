// The Transfer window's Transplant builds off the main thread (app/transplant-builder.js): only the
// newest request is delivered, a newer setting stops the running build, the models go to a worker once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransplantBuilder } from '../app/transplant-builder.js';

function fakeWorkers() {
  const made = [];
  const spawn = () => {
    const worker = { sent: [], ended: false, postMessage(message) { this.sent.push(message); }, terminate() { this.ended = true; },
      finish(result) { const job = this.sent.filter(m => m.id != null).at(-1); this.onmessage?.({ data: { id: job.id, ...result } }); } };
    made.push(worker); return worker;
  };
  return { made, spawn };
}
const model = { name: 'own' }, donor = { name: 'donor' }, other = { name: 'other donor' };

test('a build runs in a worker that holds the models; the result comes back with its key', () => {
  const { made, spawn } = fakeWorkers(), results = [];
  const builder = createTransplantBuilder({ spawn, buildHere: () => assert.fail('not here'), onResult: r => results.push(r) });
  builder.request({ key: 'a', model, donor, options: { events: true } });
  assert.equal(made.length, 1);
  assert.deepEqual(made[0].sent.map(m => m.hold || 'job'), ['model', 'donor', 'job']);
  assert.equal(builder.building, true);
  made[0].finish({ model: { built: 1 }, report: { fit: 'good' } });
  assert.deepEqual(results, [{ key: 'a', model: { built: 1 }, report: { fit: 'good' } }]);
  assert.equal(builder.building, false);
  // The next setting sends only the options to the same worker.
  builder.request({ key: 'b', model, donor, options: { events: false } });
  assert.equal(made.length, 1);
  assert.deepEqual(made[0].sent.slice(3).map(m => m.hold || 'job'), ['job']);
  // Another donor is sent once.
  made[0].finish({ model: {}, report: {} });
  builder.request({ key: 'c', model, donor: other, options: {} });
  assert.deepEqual(made[0].sent.slice(4).map(m => m.hold || 'job'), ['donor', 'job']);
});

test('a newer setting stops the running build; only the newest result is delivered', () => {
  const { made, spawn } = fakeWorkers(), results = [];
  const builder = createTransplantBuilder({ spawn, buildHere: () => assert.fail('not here'), onResult: r => results.push(r.key) });
  builder.request({ key: 'a', model, donor, options: {} });
  builder.request({ key: 'b', model, donor, options: {} });
  assert.equal(made[0].ended, true, 'the older build is ended');
  assert.equal(made.length, 2);
  assert.deepEqual(made[1].sent.map(m => m.hold || 'job'), ['model', 'donor', 'job'], 'the new worker gets the models again');
  made[0].onmessage?.({ data: { id: 1, model: {} } });
  assert.deepEqual(results, [], 'nothing from the ended build');
  // The same request again waits for the running build.
  builder.request({ key: 'b', model, donor, options: {} });
  assert.equal(made.length, 2);
  made[1].finish({ model: {}, report: {} });
  assert.deepEqual(results, ['b']);
});

test('cancel stops the running build and nothing is delivered', () => {
  const { made, spawn } = fakeWorkers(), results = [];
  const builder = createTransplantBuilder({ spawn, buildHere: () => ({}), onResult: r => results.push(r) });
  builder.request({ key: 'a', model, donor, options: {} });
  builder.cancel();
  assert.equal(made[0].ended, true);
  assert.equal(builder.building, false);
  assert.deepEqual(results, []);
});

test('errors come back as messages; without a worker the build runs here after a short wait', () => {
  const { made, spawn } = fakeWorkers(), results = [];
  const builder = createTransplantBuilder({ spawn, buildHere: () => ({}), onResult: r => results.push(r) });
  builder.request({ key: 'a', model, donor, options: {} });
  made[0].finish({ error: 'non-finite geometry' });
  assert.deepEqual(results, [{ key: 'a', error: 'non-finite geometry' }]);

  const waits = [], here = [];
  const fallback = createTransplantBuilder({ spawn: () => { throw new Error('no workers'); }, buildHere: request => { here.push(request.key); return { model: { m: request.key }, report: {} }; }, onResult: r => here.push('result ' + r.key),
    wait: run => { waits.push(run); return waits.length; }, stopWait: () => {} });
  fallback.request({ key: 'x', model, donor, options: {} });
  fallback.request({ key: 'y', model, donor, options: {} });
  waits.forEach(run => run());
  assert.deepEqual(here, ['y', 'result y'], 'only the newest is built here');

  // A worker that fails builds the newest request here.
  const failing = fakeWorkers(), got = [], later = [];
  const third = createTransplantBuilder({ spawn: failing.spawn, buildHere: request => { throw new Error('bad ' + request.key); }, onResult: r => got.push(r), wait: run => { later.push(run); return 1; }, stopWait: () => {} });
  third.request({ key: 'z', model, donor, options: {} });
  failing.made[0].onerror({ preventDefault() {} });
  assert.equal(failing.made[0].ended, true);
  later.forEach(run => run());
  assert.deepEqual(got, [{ key: 'z', error: 'bad z' }]);
});

test('a model edited in place (same object, new revision) is sent again', () => {
  const { made, spawn } = fakeWorkers();
  const builder = createTransplantBuilder({ spawn, buildHere: () => ({}), onResult: () => {} });
  builder.request({ key: 'a', model, modelKey: '1', donor, donorKey: 'd', options: {} });
  made[0].finish({ model: {}, report: {} });
  builder.request({ key: 'b', model, modelKey: '2', donor, donorKey: 'd', options: {} });
  assert.deepEqual(made[0].sent.slice(3).map(m => m.hold || 'job'), ['model', 'job']);
});
