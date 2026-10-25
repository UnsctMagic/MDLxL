import fs from 'node:fs';
import path from 'node:path';
import {decodeBLP,getBLPImageData} from 'war3-model';
const ROOT='D:/Codex/sd-research',out=path.join(ROOT,'pictures/custom-painting');
const rows=JSON.parse(fs.readFileSync(path.join(ROOT,'data/lpw-textures.json')));
const hashes=['76b4080da83350b329b3c7448a1ecf2dcf9ce516fa4fe0c5b3d73128c9f3eccd','9280717815d516714ea09de8c6bd0168c455f2b911d5159aa594a5301be3575d','ef276c863ba4eac1239d92ab2ee7e33532545a6ced5cb5db06e6def191f0c9f8'];
fs.mkdirSync(out,{recursive:true});
for(const hash of hashes){const r=rows.find(t=>t.sha256===hash&&t.file),b=fs.readFileSync(path.resolve(ROOT,r.file)),image=getBLPImageData(decodeBLP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)),0);fs.writeFileSync(path.join(out,hash+'.rgba'),image.data);fs.writeFileSync(path.join(out,hash+'.json'),JSON.stringify({width:image.width,height:image.height,decoder:'war3-model decodeBLP/getBLPImageData; includes BLP JPEG alpha',sha256:hash,sourceFile:r.file}));}
