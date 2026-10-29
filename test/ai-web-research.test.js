import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_WEB_RESEARCH } from '../src/ai-tools.js';
test('web research names both community sources without duplicated names',()=>{
 assert.match(AI_WEB_RESEARCH,/Hive Workshop and XGM tutorials/);
 assert.doesNotMatch(AI_WEB_RESEARCH,/\b(\w+) and \1\b/);
});
