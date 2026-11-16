import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { COMMANDS } from '../src/commands.js';
const { Reporter, ENDPOINT, readMachineGuid } = createRequire(import.meta.url)('../electron/report.cjs');

const reply = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => { if (body === undefined) throw Error('no body'); return body; } });
const make = (fetcher, extra = {}) => new Reporter({ version: '9.9.9', profile: extra.profile || tmpdir(), fetcher, readGuid: async () => 'GUID-1', release: '10.0.26200', ...extra });

test('Report a problem is a Help command without a hotkey, listed last', () => {
  const command = COMMANDS.at(-1);
  assert.deepEqual({ id: command.id, label: command.label, category: command.category, defaultKeys: command.defaultKeys }, { id: 'reportProblem', label: 'Report a problem', category: 'Help', defaultKeys: [] });
});

test('status maps the server answer and sends the MDLxL user agent', async () => {
  const seen = [];
  const get = body => make(async (url, init) => { seen.push([url, init]); return { status: 200, ok: true, json: async () => body }; });
  assert.equal(await get({ open: true }).status(), 'open');
  assert.equal(await get({ open: false }).status(), 'paused');
  assert.equal(await get({}).status(), 'error');
  assert.equal(seen[0][0], ENDPOINT);
  assert.equal(seen[0][1].method, 'GET');
  assert.equal(seen[0][1].headers['User-Agent'], 'MDLxL/9.9.9');
  assert.equal(await make(reply(500)).status(), 'error');
  assert.equal(await make(async () => { throw Error('offline'); }).status(), 'error');
});

test('send maps every server answer', async () => {
  const cases = [[204, undefined, 'sent'], [503, { error: 'paused' }, 'paused'], [429, { error: 'pc' }, 'limit-pc'], [429, { error: 'ip' }, 'limit-ip'], [429, { error: 'day' }, 'limit-day'], [429, {}, 'error'], [400, { error: 'x' }, 'invalid'], [500, undefined, 'error']];
  for (const [status, body, expected] of cases) assert.equal(await make(reply(status, body)).send('hello'), expected, `${status} ${JSON.stringify(body)}`);
  assert.equal(await make(async () => { throw Error('offline'); }).send('hello'), 'error');
});

test('send posts exactly four fields with the hashed machine id', async () => {
  let call;
  const reporter = make(async (url, init) => { call = { url, init }; return { status: 204, ok: true }; });
  assert.equal(await reporter.send('  it crashed  '), 'sent');
  assert.equal(call.url, ENDPOINT);
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers['User-Agent'], 'MDLxL/9.9.9');
  assert.equal(call.init.headers['Content-Type'], 'application/json');
  const body = JSON.parse(call.init.body);
  assert.deepEqual(Object.keys(body).sort(), ['message', 'os', 'pc', 'version']);
  assert.deepEqual(body, { message: 'it crashed', pc: crypto.createHash('sha256').update('mdlxl-report:GUID-1').digest('hex'), version: '9.9.9', os: 'Windows 10.0.26200' });
});

test('message length is checked before anything is sent', async () => {
  let calls = 0;
  const reporter = make(async () => { calls++; return { status: 204, ok: true }; });
  assert.equal(await reporter.send('   '), 'invalid');
  assert.equal(await reporter.send(''), 'invalid');
  assert.equal(await reporter.send('a'.repeat(2001)), 'invalid');
  assert.equal(await reporter.send(undefined), 'invalid');
  assert.equal(calls, 0);
  assert.equal(await reporter.send('a'.repeat(2000)), 'sent');
  assert.equal(calls, 1);
});

test('without a machine id a random id is saved once and reused', async () => {
  const dir = await mkdtemp(path.join(process.env.TEMP || tmpdir(), 'mdlxl-report-'));
  try {
    const ids = [];
    const fetcher = async (url, init) => { ids.push(JSON.parse(init.body).pc); return { status: 204, ok: true }; };
    await new Reporter({ version: '1.0.0', profile: dir, fetcher, readGuid: async () => null, release: '10.0.1' }).send('one');
    await new Reporter({ version: '1.0.0', profile: dir, fetcher, readGuid: async () => { throw Error('no reg'); }, release: '10.0.1' }).send('two');
    assert.match(ids[0], /^[0-9a-f]{64}$/);
    assert.equal(ids[1], ids[0]);
    assert.equal((await readFile(path.join(dir, 'report-id.txt'), 'utf8')).trim(), ids[0]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('the PC id is read from Windows itself, so deleting the profile does not reset the daily limit', { skip: process.platform !== 'win32' }, async () => {
  assert.match(await readMachineGuid() || '', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
});
