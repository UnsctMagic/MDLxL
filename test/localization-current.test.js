import test from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../src/localization.js';
import { currentSources, currentRussian, currentSpanish, currentChinese } from '../src/locales/current-ui-locales.js';
const slots=text=>[...new Set(text.match(/\{\d+\}/g)||[])].sort();
test('newer UI and update controls have entries in all three translated languages',()=>{
  assert.ok(currentSources.length>300);
  assert.equal(new Set(currentSources).size,currentSources.length);
  for(const [locale,pack] of Object.entries({ru:currentRussian,es:currentSpanish,zh:currentChinese}))for(const source of currentSources){assert.ok(pack[source]?.trim(),`${locale}: ${source}`);assert.deepEqual(slots(pack[source]),slots(source));assert.notEqual(translate(source,locale),undefined);}
  for(const locale of ['ru','es','zh','mordor'])for(const label of ['Search for updates','Auto update','Update and restart','Revert to last version','Move checked geosets','Collect Bit','Sound preview','Resource managers','UV map tile limit'])assert.notEqual(translate(label,locale),label,`${locale}: ${label}`);
});
test('update messages preserve actual versions and localized native revert prompts',()=>{
  for(const locale of ['ru','es','zh','mordor'])for(const message of ['MDLxL 0.19.0 is available.','Installed version: 0.18.8','Previous version: 0.18.7','Revert to MDLxL 0.18.7?']){assert.notEqual(translate(message,locale),message);assert.match(translate(message,locale),/0\.1[89]\.[078]/);}
});
