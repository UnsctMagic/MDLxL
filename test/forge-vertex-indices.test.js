import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { vertexForgeDraft, vertexForgeResult, vertexForgePickEntries } from '../src/forge-vertex.js';
import { bevelForgeShape } from '../src/forge-molding.js';
import { transformForgeSelection } from '../src/forge-shape-editing.js';
import { forgeTangents } from '../src/geoset-tangents.js';
const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const streams = g => [[g.Vertices,3],[g.Normals,3],...g.TVertices.map(uv=>[uv,2]),...(g.VertexGroup?.length?[[g.VertexGroup,1]]:[]),...(g.SkinWeights?.length?[[g.SkinWeights,8]]:[]),...(g.Tangents?.length?[[g.Tangents,4]]:[])];
const bytes = (stream,index,width) => Buffer.from(stream.buffer,stream.byteOffset+index*width*stream.BYTES_PER_ELEMENT,width*stream.BYTES_PER_ELEMENT);

for (const name of ['citadel-footman','forge-hd-footman']) test(`small ${name} edit preserves every untouched vertex index and stream byte`,()=>{
  const model=openDocument(fs.readFileSync(fixturePath(name)),'Footman.mdx').model;
  const gi=model.Geosets.reduce((best,g,i)=>g.Vertices.length>model.Geosets[best].Vertices.length?i:best,0),g=model.Geosets[gi];
  if(name==='forge-hd-footman')assert.ok(g.SkinWeights.length&&g.Tangents.length,'genuine HD fixture');
  const selection=Array.from(g.Faces.slice(0,3)),draft=vertexForgeDraft(model,{[gi]:selection}),source=draft.shapes[0];
  const selected=new Set(draft.selection[gi]),affected=new Set(source.sourceVertices.flatMap((id,i)=>selected.has(id)?[i]:[]));
  const snapshot=structuredClone(model),count=g.Vertices.length/3;
  const after=bevelForgeShape(source,draft.selection[gi],'Vertices',.05,false);
  const result=vertexForgeResult(model,draft,{...draft,shapes:[after]}).Geosets[gi];
  assert.deepEqual(model,snapshot,'preview does not mutate its source');
  assert.ok(result.Vertices.length>g.Vertices.length,'new bevel vertices append');
  for(let i=0;i<count;i++)if(!affected.has(i))streams(g).forEach(([a,width],s)=>assert.deepEqual(bytes(streams(result)[s][0],i,width),bytes(a,i,width),`untouched index ${i}, stream ${s}`));
  const appended=new Set(Array.from(result.Faces).filter(i=>i>=count));
  assert.equal(result.Vertices.length/3,count+appended.size,'only referenced new vertices increase the count');
});

test('HD tangent updates match the full owner calculation for changed indices',()=>{
  const g=openDocument(fs.readFileSync(fixturePath('forge-hd-footman')),'Footman.mdx').model.Geosets[0],ids=new Set([0,1,3,500,6900]);
  const full=forgeTangents(g),part=forgeTangents(g,ids);
  for(const i of ids)assert.deepEqual(part.slice(i*4,i*4+4),full.slice(i*4,i*4+4));
});

test('face picking reuses unaffected geosets and detects in-place edits',()=>{
  const model=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx').model,cache=new Map(),selectable=new Set([0,1]);
  const first=vertexForgePickEntries(model,selectable,cache),again=vertexForgePickEntries(model,selectable,cache);
  assert.equal(first[0],again[0]);assert.equal(first[1],again[1]);
  model.Geosets[0].Vertices[0]+=1;
  const edited=vertexForgePickEntries(model,selectable,cache);
  assert.notEqual(edited[0],first[0]);assert.equal(edited[1],first[1]);
});

test('a local move updates existing slots and retains authored duplicates and free vertices',()=>{
  const model=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx').model,g=model.Geosets[0],count=g.Vertices.length/3;
  // Append two exact authored copies; one referenced, one free.
  for(const [stream,width] of streams(g)){
    const next=new stream.constructor(stream.length+2*width);next.set(stream);next.set(stream.slice(0,width),stream.length);next.set(stream.slice(width,2*width),stream.length+width);
    for(const key of ['Vertices','Normals','VertexGroup','SkinWeights','Tangents'])if(g[key]===stream)g[key]=next;
    g.TVertices=g.TVertices.map(uv=>uv===stream?next:uv);
  }
  g.Faces=new g.Faces.constructor([...g.Faces,count,g.Faces[1],g.Faces[2]]);
  const draft=vertexForgeDraft(model,{0:[253,254,255]}),source=draft.shapes[0],selected=new Set(draft.selection[0]);
  const after={...draft,shapes:[transformForgeSelection(source,draft.selection[0],'Vertices',{translation:[1,2,3]})]};
  const out=vertexForgeResult(model,draft,after).Geosets[0];
  assert.equal(out.Vertices.length,g.Vertices.length,'moving creates no vertices');
  for(let i=0;i<count+2;i++)if(!selected.has(source.sourceVertices[i]))streams(g).forEach(([a,width],s)=>assert.deepEqual(bytes(streams(out)[s][0],i,width),bytes(a,i,width)));
  assert.ok(out.Faces.includes(count),'authored duplicate identity remains referenced');
  for(const i of [253,254,255])for(let a=0;a<3;a++)assert.equal(out.Vertices[i*3+a],Math.fround(g.Vertices[i*3+a]+a+1),'changed vertices update in place');
});
