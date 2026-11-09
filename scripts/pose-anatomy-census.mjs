import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {realAnatomyCases,loadAnatomyCase,hash,nameVariants,challengeNames, challengeCase,anatomicalMapping,anatomyProblems,analyticalCases,analyticalRig} from '../test/helpers/pose-anatomy-fixtures.mjs';
import {holdoutAnatomyCases} from '../test/helpers/pose-anatomy-holdouts.mjs';
const source=process.env.MDLXL_POSE_SOURCE?pathToFileURL(path.resolve(process.env.MDLXL_POSE_SOURCE,'pose-ik.js')):new URL('../src/pose-ik.js',import.meta.url),pose=await import(source);
const sourceDir=path.dirname(fileURLToPath(source)),sourceHashes=Object.fromEntries(fs.readdirSync(sourceDir).filter(name=>/^pose-.*\.js$/.test(name)).map(name=>[name,hash(fs.readFileSync(path.join(sourceDir,name)))]));
const report={createdAt:new Date().toISOString(),source:String(source),sourceHashes,cases:[],totals:{pass:0,fail:0,skip:0}};
for(const spec of [...realAnatomyCases,...analyticalCases,...holdoutAnatomyCases])for(const mode of nameVariants){
 const input=spec.file?loadAnatomyCase(spec):analyticalRig(spec.options),{model,expected}=challengeCase(input.model,spec.file?spec:input.expected,mode),start=performance.now();
 try{const rig=pose.suggestPoseRig(model,model.Sequences[0].Interval[0],0),problems=anatomyProblems(model,rig,expected,pose);report.cases.push({key:spec.key,mode,file:input.file,sha256:input.sha256,generated:spec.options?{options:spec.options,geosets:model.Geosets.length,nodes:model.Bones.length}:undefined,expected,elapsedMs:performance.now()-start,pass:!problems.length,problems,mapping:anatomicalMapping(model,rig,pose)});report.totals[problems.length?'fail':'pass']++;}
 catch(error){report.cases.push({key:spec.key,mode,file:input.file,error:error.message,pass:false});report.totals.fail++;}
}
const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
for(const row of report.cases)console.log(`${row.pass?'PASS':'FAIL'} ${row.key}/${row.mode}: ${(row.problems||[row.error]).join('; ')}`);
console.log(JSON.stringify(report.totals));process.exitCode=report.totals.fail?1:0;
