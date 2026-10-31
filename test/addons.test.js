import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateAddon,installAddon,loadAddons} from '../src/addons.js';
const fixture=JSON.parse(readFileSync(new URL('../Addons/inspection-example.json',import.meta.url)));
test('command add-ons install, disable and restore without running actions',()=>{
  const installed=installAddon([],fixture);assert.equal(installed[0].enabled,true);
  installed[0].enabled=false;assert.deepEqual(loadAddons(JSON.stringify(installed)),installed);
  assert.equal(validateAddon(fixture).actions[0].command,'fit');
});
test('unsupported API and initialization/command failure preserve installed list',()=>{
  const installed=installAddon([],fixture), before=structuredClone(installed);
  assert.throws(()=>installAddon(installed,{...fixture,id:'second',apiVersion:2}),/Unsupported/);
  assert.throws(()=>installAddon(installed,{...fixture,id:'second',actions:[{id:'bad',label:'Bad',command:'not-a-command'}]}),/Unknown/);
  assert.throws(()=>installAddon(installed,fixture),/already installed/);
  assert.deepEqual(installed,before);
});

// Both menus must reach the same existing install/list/run panel.
test('Settings exposes Add-ons before its separator in both shells',async()=>{
  const {createRequire}=await import('node:module');
  const {buildMenuTemplate}=createRequire(import.meta.url)('../electron/menu.cjs');
  const sent=[], menu=buildMenuTemplate({},id=>sent.push(id)).find(item=>item.label==='Settings').submenu;
  const index=menu.findIndex(item=>item.label==='Add-ons…');
  assert.ok(index>=0,'Settings contains Add-ons…');
  assert.equal(menu[index+1].type,'separator');
  menu[index].click(); assert.deepEqual(sent,['addons']);
  const bar=readFileSync(new URL('../app/AppToolbar.jsx',import.meta.url),'utf8');
  const panel=readFileSync(new URL('../app/Addons.jsx',import.meta.url),'utf8');
  assert.match(bar,/\['Add-ons…','addons'\], null/);
  assert.match(panel,/function Addons\(\{open,onClose,onCommand,isEnabled\}\)/);
  assert.match(panel,/data-hotkey-scope="addons"/);
  assert.match(panel,/useDismiss\(open/);
  assert.doesNotMatch(panel,/>Add-ons<\/button>/);
});
