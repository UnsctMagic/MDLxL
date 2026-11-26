// The packaged app ships electron/, src/ and dist/ without node_modules (scripts/package.mjs
// refuses them), so the main process, its workers and preloads may load only Node builtins,
// `electron` and shipped files. Inside the repo Node silently finds the checkout's
// node_modules, so a launch test there cannot catch a stray package import (0.40.0: the
// packaged app opened no window because preferences.js reached `three`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {builtinModules} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rel=file=>path.relative(root,file).split(path.sep).join('/');
const packageScript=fs.readFileSync(path.join(root,'scripts/package.mjs'),'utf8');
const shipped=JSON.parse(packageScript.match(/const runtimeFolders = (\[[^\]]*\])/)[1].replace(/'/g,'"'));
const builtins=new Set(builtinModules);
// electron/ files that vite.config.js bundles (with their packages) into dist/; the app loads the bundle instead.
const bundledEntries=new Set([...fs.readFileSync(path.join(root,'vite.config.js'),'utf8').matchAll(/entryPoints:\s*\[([^\]]*)\]/g)].flatMap(m=>[...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x=>path.join(root,x[1]))));

function stripComments(code,templates=true){
 // Keeps strings and template literals (their text emptied when templates is false); drops // and /* */ comments.
 let out='',i=0;
 while(i<code.length){
  const c=code[i],n=code[i+1];
  if(c==='/'&&n==='*'){const end=code.indexOf('*/',i+2);i=end<0?code.length:end+2;continue;}
  if(c==='/'&&n==='/'){const end=code.indexOf('\n',i);i=end<0?code.length:end;continue;}
  if(c==='"'||c==="'"||c==='`'){
   let j=i+1;while(j<code.length&&code[j]!==c){if(code[j]==='\\')j++;else if(c!=='`'&&code[j]==='\n')break;j++;}
   out+=c==='`'&&!templates?'``':code.slice(i,j+1);i=j+1;continue;
  }
  out+=c;i++;
 }
 return out;
}
const PATTERNS=[
 /\b(?:import|export)\s+(?:[\w*$\s{},]+?\s+from\s*)?['"]([^'"\n]+)['"]/g,
 /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
 /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
];
function specifiers(code){
 const found=new Set();
 for(const pattern of PATTERNS)for(const match of code.matchAll(pattern))found.add(match[1]);
 return [...found];
}
function resolveRelative(from,spec){
 const base=path.resolve(path.dirname(from),spec);
 for(const candidate of [base,...['.js','.cjs','.mjs','.json'].map(ext=>base+ext),path.join(base,'index.js')])
  if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return candidate;
 return null;
}
const loadable=file=>/\.(?:c|m)?js$/.test(file);

/** Every main-process file: all of electron/, plus root-relative src/ or dist/ modules electron/ names in strings (path.join(root,'src/x.js')). */
function entries(){
 const list=[];
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(loadable(full)&&!bundledEntries.has(full))list.push(full);}};
 walk(path.join(root,'electron'));
 for(const file of [...list]){
  for(const match of stripComments(fs.readFileSync(file,'utf8')).matchAll(/['"]((?:src|dist)\/[\w./-]+\.(?:c|m)?js)['"]/g)){
   const full=path.join(root,match[1]);
   if(fs.existsSync(full))list.push(full);
  }
 }
 return [...new Set(list)];
}

/** Bare packages and unshipped files the packaged main process would fail to load, each with its import chain. */
export function unresolvableMainImports(){
 const problems=[],seen=new Map(),queue=entries().map(file=>[file,[rel(file)]]);
 for(const [file] of queue)seen.set(file,true);
 while(queue.length){
  const [file,chain]=queue.shift();
  if(!loadable(file))continue;
  // Template text is not code here: it holds prompts and scripts written to disk for other programs (mdlxl.mjs).
  for(const spec of specifiers(stripComments(fs.readFileSync(file,'utf8'),false))){
   if(spec.startsWith('node:')||builtins.has(spec)||spec==='electron')continue;
   if(!spec.startsWith('.')){problems.push(`${[...chain,spec].join(' -> ')} (package not shipped)`);continue;}
   const target=resolveRelative(file,spec);
   if(!target){
    // dist/ is build output; it is checked when built.
    if(path.resolve(path.dirname(file),spec).startsWith(path.join(root,'dist')+path.sep))continue;
    problems.push(`${[...chain,spec].join(' -> ')} (file missing)`);continue;
   }
   const top=rel(target).split('/')[0];
   if(!shipped.includes(top)){problems.push(`${[...chain,rel(target)].join(' -> ')} (folder not packaged)`);continue;}
   if(!seen.has(target)){seen.set(target,true);queue.push([target,[...chain,rel(target)]]);}
  }
 }
 return problems;
}

test('packaging ships no node_modules, so main-process code cannot use packages', () => {
 assert.deepEqual([...shipped].sort(),['dist','electron','src']);
 assert.match(packageScript,/\['node_modules', 'profile'/);
});

test('bundled build entries are known, so only their dist/ bundle is checked', () => {
 assert.ok(bundledEntries.has(path.join(root,'electron/particle-runtime.js')));
});

test('the parser sees static, re-export, dynamic and require imports', () => {
 const code=stripComments(`import {A,\n B} from 'one';\nexport {C} from "./two.js";\nimport './three.css';\nconst x=await import('four');\nconst y=require('five');\n// import z from 'six';\n/* require('seven') */`);
 assert.deepEqual(specifiers(code).sort(),['./three.css','./two.js','five','four','one']);
});

test('the packaged main process imports only builtins, electron and shipped files', () => {
 assert.deepEqual(unresolvableMainImports(),[]);
});
