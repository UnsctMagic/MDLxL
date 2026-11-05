import test from 'node:test';
import assert from 'node:assert/strict';
import {localizedHiveMessage} from '../app/hive-localization.js';
import templates from '../src/hive-diagnostic-templates.json' with {type:'json'};
import fr from '../src/locales/fr.json' with {type:'json'};
import de from '../src/locales/de.json' with {type:'json'};
import es from '../src/locales/es.json' with {type:'json'};
import ru from '../src/locales/ru.json' with {type:'json'};
import zh from '../src/locales/zh.json' with {type:'json'};

test('all bundled Hive diagnostic templates have French, German, Spanish, Russian and Chinese prose',()=>{
 assert.equal(templates.length,62);
 for(const [locale,pack]of Object.entries({fr,de,es,ru,zh}))for(const key of templates){
  assert.ok(Object.hasOwn(pack,key),locale+': '+key);
  if(!key.includes('{'))assert.notEqual(localizedHiveMessage(key,locale),key,locale+': '+key);
 }
});

test('checker messages preserve authored names, paths and IDs even when they match UI labels',()=>{
 for(const [locale,pack]of Object.entries({fr,de,es,ru,zh})){
  const cases=[
   ['Vertex {0}: Attached to "{1}" which is not a bone',['17','Rotation']],
   ['This sequence starts before sequence {0} "{1}" ends',['2','Translation']],
   ['Corrupted path: "{0}"',['Textures\\Rotation.blp']],
   ['Unknown replaceable ID: {0}',['31']],
  ];
  for(const [key,values]of cases){
   const format=source=>source.replace(/\{(\d+)\}/g,(_,id)=>values[id]);
   assert.equal(localizedHiveMessage(format(key),locale),format(pack[key]),locale+': '+key);
  }
  assert.equal(localizedHiveMessage('Rotation',locale),'Rotation','unknown diagnostic/data is literal');
 }
});
