// Read-only simplification evidence for retained-coordinate subsets. This owner
// never invents nearest-point identities or changes the candidate mesh.
import { indexedSurfaceIslands } from './geoset-operations.js';
import { vertexBoneWeights } from './part-bones.js';

const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const array = value => Array.from(value || []);
const index = n => Number.isInteger(n) && n >= 0;
const coord = (g,v) => `${g.Vertices[v*3]},${g.Vertices[v*3+1]},${g.Vertices[v*3+2]}`;
const uv = (g,v) => (g.TVertices || []).map(values => array(values.slice(v*2,v*2+2)));
function binding(g,v) {
  // Mirror native skinGeoset's supported weighted prefix / classic tail.
  const pairs = g.SkinWeights?.length >= (v+1)*8 ? vertexBoneWeights({Vertices:[0,0,0],SkinWeights:g.SkinWeights.slice(v*8,v*8+8)},0) : vertexBoneWeights(g,v);
  return pairs.sort((a,b)=>a[0]-b[0]);
}
const attributes = (g,v) => [uv(g,v),binding(g,v),array(g.Normals?.slice(v*3,v*3+3)),array(g.Tangents?.slice(v*4,v*4+4))];
const faceKey = face => [face.join(','),[face[1],face[2],face[0]].join(','),[face[2],face[0],face[1]].join(',')].sort()[0];
function checked(g) {
  if (!g || !g.Vertices || g.Vertices.length%3 || !g.Faces || g.Faces.length%3 || array(g.Vertices).some(n=>!Number.isFinite(n))) throw Error('Simplify evidence requires complete finite vertices and triangles.');
  const count=g.Vertices.length/3;
  if(array(g.Faces).some(v=>!index(v)||v>=count)) throw Error('Simplify evidence found a triangle with an invalid vertex.');
  for(const values of g.TVertices || []) if(values.length!==count*2 || array(values).some(n=>!Number.isFinite(n))) throw Error('Simplify evidence requires complete finite UV sets.');
}
function extent(g,vertices) {
  if(!vertices.length)return null;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const v of vertices)for(let a=0;a<3;a++){min[a]=Math.min(min[a],g.Vertices[v*3+a]);max[a]=Math.max(max[a],g.Vertices[v*3+a]);}
  return{min,max};
}
function surface(g,faces) {
  const vertices=new Set(),edges=new Map(),seenFaces=new Set(),parent=faces.map((_,i)=>i);
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const join=(a,b)=>{a=find(a);b=find(b);if(a!==b)parent[b]=a;};
  let duplicates=0,degenerates=0;
  faces.forEach((face,f)=>{
    const canonical=[...face].sort((a,b)=>a-b).join(',');if(seenFaces.has(canonical))duplicates++;seenFaces.add(canonical);
    for(const v of face)vertices.add(v);
    const [a,b,c]=face,ab=[0,1,2].map(k=>g.Vertices[b*3+k]-g.Vertices[a*3+k]),ac=[0,1,2].map(k=>g.Vertices[c*3+k]-g.Vertices[a*3+k]);
    if(new Set(face).size<3 || Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])===0)degenerates++;
    for(let i=0;i<3;i++){
      const x=face[i],y=face[(i+1)%3],key=`${Math.min(x,y)},${Math.max(x,y)}`;
      if(edges.has(key)){const edge=edges.get(key);edge.count++;join(f,edge.face);}else edges.set(key,{a:x,b:y,count:1,face:f});
    }
  });
  const boundary=[...edges.values()].filter(e=>e.count===1),adj=new Map();
  for(const{a,b}of boundary){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}
  const boundaryInfo=new Map(),visited=new Set();let loops=0,branches=0;
  for(const list of adj.values())if(list.length!==2)branches++;
  for(const start of adj.keys())if(!visited.has(start)){
    const connected=[start];visited.add(start);for(const a of connected)for(const b of adj.get(a))if(!visited.has(b)){visited.add(b);connected.push(b);}
    if(connected.some(v=>adj.get(v).length!==2))continue;
    let previous=null,at=start,order=0;
    do{boundaryInfo.set(at,{loop:loops,order:order++,length:connected.length});const next=adj.get(at).find(v=>v!==previous);previous=at;at=next;}while(at!==start);
    loops++;
  }
  return{triangles:faces.length,duplicates,degenerates,surfaceComponents:new Set(faces.map((_,i)=>find(i))).size,nonManifoldEdges:[...edges.values()].filter(e=>e.count>2).length,boundaryLoops:loops,boundaryBranches:branches,boundaryInfo,boundaryEdges:boundary.map(({a,b})=>[a,b]),vertices:[...vertices]};
}
function sourceGeoset(g) {
  checked(g);
  if(!g.Vertices.length)return{islands:[],membership:new Int32Array(),parts:[],coordinates:new Map()};
  const islands=indexedSurfaceIslands(g),membership=new Int32Array(g.Vertices.length/3).fill(-1);
  islands.forEach((ids,c)=>ids.forEach(v=>membership[v]=c));
  const faces=islands.map(()=>[]),coordinates=new Map();
  for(let v=0;v<membership.length;v++){const key=coord(g,v);if(!coordinates.has(key))coordinates.set(key,[]);coordinates.get(key).push(v);}
  for(let f=0;f<g.Faces.length;f+=3)faces[membership[g.Faces[f]]].push(array(g.Faces.slice(f,f+3)));
  return{islands,membership,parts:faces.map(part=>surface(g,part)),faces,coordinates};
}
function correspondence(a,b,source) {
  const stable=a.Vertices.length===b.Vertices.length && array(a.Vertices).every((v,i)=>v===b.Vertices[i]);
  const matches=[],faces=source.islands.map(()=>[]);let unknown=0,ambiguous=0,crossComponentFaces=0;
  for(let v=0;v<b.Vertices.length/3;v++){
    let ids=stable?[v]:source.coordinates.get(coord(b,v))||[],components=[...new Set(ids.map(id=>source.membership[id]))];
    if(components.length>1){const exact=ids.filter(id=>equal(attributes(a,id),attributes(b,v))),owned=[...new Set(exact.map(id=>source.membership[id]))];if(owned.length===1){ids=exact;components=owned;}}
    if(components.length!==1){if(components.length>1)ambiguous++;else unknown++;matches.push({component:null,ids});continue;}
    const component=components[0];ids=ids.filter(id=>source.membership[id]===component);
    const exact=ids.filter(id=>equal(attributes(a,id),attributes(b,v)));
    matches.push({component,ids,vertex:ids.length===1?ids[0]:exact.length===1?exact[0]:null});
  }
  for(let f=0;f<b.Faces.length;f+=3){const face=array(b.Faces.slice(f,f+3)),comps=face.map(v=>matches[v].component);
    if(comps[0]!==null && comps.every(c=>c===comps[0]))faces[comps[0]].push(face);
    else if(comps.every(c=>c!==null))crossComponentFaces++;
  }
  return{matches,faces,unknown,ambiguous,crossComponentFaces};
}
function boundaryRetention(before,after,matches) {
  let newBoundaryVertices=0,unknownVertices=0,wrongConnections=0;
  const retained=new Map();
  for(const v of after.vertices){const source=matches[v].vertex;if(source!==null){const info=before.boundaryInfo.get(source);if(info){if(!retained.has(info.loop))retained.set(info.loop,new Set());retained.get(info.loop).add(source);}}}
  const next=new Map();
  for(const [loop,ids]of retained){const ordered=[...ids].sort((a,b)=>before.boundaryInfo.get(a).order-before.boundaryInfo.get(b).order);for(let i=0;i<ordered.length;i++)next.set(ordered[i],ordered[(i+1)%ordered.length]);}
  for(const [a,b]of after.boundaryEdges){
    const x=matches[a].vertex,y=matches[b].vertex;
    if(x===null||y===null){unknownVertices++;continue;}
    const ax=before.boundaryInfo.get(x),by=before.boundaryInfo.get(y);
    if(!ax)newBoundaryVertices++;if(!by)newBoundaryVertices++;
    if(ax&&by&&(ax.loop!==by.loop||next.get(x)!==y&&next.get(y)!==x))wrongConnections++;
  }
  return{beforeLoops:before.boundaryLoops,afterLoops:after.boundaryLoops,newBoundaryVertices,unknownVertices,wrongConnections,beforeBranches:before.boundaryBranches,afterBranches:after.boundaryBranches,
    verified:unknownVertices===0,retained:unknownVertices===0&&newBoundaryVertices===0&&wrongConnections===0&&before.boundaryLoops===after.boundaryLoops&&after.boundaryBranches<=before.boundaryBranches};
}
const summary=p=>({triangles:p.triangles,duplicates:p.duplicates,degenerates:p.degenerates,surfaceComponents:p.surfaceComponents,nonManifoldEdges:p.nonManifoldEdges,boundaryLoops:p.boundaryLoops,boundaryBranches:p.boundaryBranches});
const verdict=rows=>rows.some(v=>v===false)?false:rows.some(v=>v===null)?null:true;
const resultCheck=(name,values,actual,expected)=>({name,passed:verdict(values),actual,expected});

/** Explicit targets refer to BEFORE indexed-island IDs (zero-based), never a
 * pooled geoset total. Exact retained coordinates support vertex compaction;
 * unknown or ambiguous identities remain unverified. Retained UV samples do
 * not certify interpolation across changed triangles or rendered appearance.
 */
export function measureSimplifyCandidate(reference,candidate,{targets=[],selection,preserveDimensions=true,preserveBoundary=true,preserveUVs=true,preserveBindings=true,dimensionTolerance=0}={}) {
  if(!Array.isArray(targets)||targets.some(t=>!t||!index(t.geoset)||!index(t.component)||!index(t.triangles)||t.triangles<1))throw Error('Simplify targets need zero-based geoset/component IDs and a positive triangle count per island.');
  if(!Number.isFinite(dimensionTolerance)||dimensionTolerance<0)throw Error('Simplify dimension tolerance must be a finite nonnegative number.');
  const components=[],unverified=[],targetMap=new Map();
  for(const t of targets){const key=`${t.geoset}/${t.component}`;if(targetMap.has(key))throw Error('Choose each simplify target once.');targetMap.set(key,t.triangles);}
  let confinement=[],selectedComponents=0;
  const selectionMap=new Map();
  if(selection!==undefined){if(!selection||typeof selection!=='object'||Array.isArray(selection))throw Error('Simplify selection must name geoset vertex lists.');for(const[key,ids]of Object.entries(selection)){const gi=Number(key);if(!index(gi)||!reference.Geosets?.[gi]||!Array.isArray(ids)||ids.some(v=>!index(v)||v>=reference.Geosets[gi].Vertices.length/3))throw Error('Simplify selection has invalid geoset or vertex indices.');selectionMap.set(gi,new Set(ids));}}
  for(let geoset=0;geoset<Math.max(reference.Geosets?.length||0,candidate.Geosets?.length||0);geoset++){
    const a=reference.Geosets?.[geoset],b=candidate.Geosets?.[geoset];
    if(!a){unverified.push(`Geoset ${geoset+1}: new geometry has no original component correspondence.`);if(selection!==undefined)confinement.push(false);continue;}
    const source=sourceGeoset(a);
    if(b)checked(b);
    const mapping=b?correspondence(a,b,source):{matches:[],faces:source.islands.map(()=>[]),unknown:0,ambiguous:0,crossComponentFaces:0};
    const comparable=!!b&&!mapping.unknown&&!mapping.ambiguous&&!mapping.crossComponentFaces;
    if(mapping.unknown)unverified.push(`Geoset ${geoset+1}: retained-coordinate correspondence is unknown for ${mapping.unknown} vertices.`);
    if(mapping.ambiguous)unverified.push(`Geoset ${geoset+1}: component correspondence is ambiguous for ${mapping.ambiguous} vertices.`);
    for(const[component,ids]of source.islands.entries()){
      const original=source.parts[component],next=b?surface(b,mapping.faces[component]):surface(a,[]),key=`${geoset}/${component}`;
      const selected=selectionMap.has(geoset)?ids.filter(v=>selectionMap.get(geoset).has(v)).length:0;
      if(selected)selectedComponents++;
      const row={geoset,shown:geoset+1,component,comparable,beforeTriangles:original.triangles,afterTriangles:b&&!comparable?null:next.triangles,targetTriangles:targetMap.get(key)??null,before:summary(original),after:summary(next)};
      if(comparable){
        row.retained=original.triangles===0?next.vertices.length>0:next.triangles>0;
        row.surfaceValid=next.duplicates<=original.duplicates&&next.degenerates<=original.degenerates&&next.nonManifoldEdges<=original.nonManifoldEdges&&next.surfaceComponents<=original.surfaceComponents&&next.surfaceComponents>0;
        row.boundary=boundaryRetention(original,next,mapping.matches);
        const x=extent(a,original.vertices),y=extent(b,next.vertices);row.dimensions={before:x,after:y,maxDelta:x&&y?Math.max(...[...x.min.map((v,i)=>Math.abs(v-y.min[i])),...x.max.map((v,i)=>Math.abs(v-y.max[i]))]):null};
        row.uvRetained=(a.TVertices?.length||0)===(b.TVertices?.length||0)&&next.vertices.every(v=>mapping.matches[v].ids.some(id=>equal(uv(a,id),uv(b,v))));
        row.bindingsRetained=next.vertices.every(v=>mapping.matches[v].ids.some(id=>equal(binding(a,id),binding(b,v))));
        if(selection!==undefined){
          if(selected>0&&selected<ids.length){confinement.push(null);unverified.push(`Geoset ${geoset+1}, component ${component}: compacted partial-island selection needs explicit corner correspondence.`);}
          else if(!selected){
            const mapped=next.vertices.every(v=>mapping.matches[v].vertex!==null);
            const oldFaces=source.faces[component].map(faceKey).sort(),newFaces=mapping.faces[component].map(f=>faceKey(f.map(v=>mapping.matches[v].vertex))).sort();
            confinement.push(mapped?equal(oldFaces,newFaces)&&next.vertices.every(v=>equal(attributes(a,mapping.matches[v].vertex),attributes(b,v))):null);
          }
        }
      }else{
        row.retained=b?null:false;row.surfaceValid=b?null:false;
        if(selection!==undefined)confinement.push(b?null:false);
      }
      if(row.boundary&&!row.boundary.verified)unverified.push(`Geoset ${geoset+1}, component ${component}: boundary vertex correspondence is ambiguous.`);
      components.push(row);
    }
  }
  for(const key of targetMap.keys())if(!components.some(r=>`${r.geoset}/${r.component}`===key))throw Error('Simplify target component does not exist in the reference.');
  const requested=components.filter(r=>targetMap.has(`${r.geoset}/${r.component}`)),relevant=requested.length?requested:components;
  const compact=rows=>rows.slice(0,32).map(({geoset,shown,component,...r})=>({geoset,shown,component,...r}));
  const checks=[resultCheck('component retention',components.map(r=>r.retained),compact(components.filter(r=>r.retained!==true)),'Every original indexed surface component retains a corresponding surface.'),
    resultCheck('surface integrity',relevant.map(r=>r.surfaceValid),compact(relevant.filter(r=>r.surfaceValid!==true)),'No new duplicate/degenerate faces, nonmanifold edges or disconnected triangle surfaces.')];
  if(targets.length)checks.push(resultCheck('per-component triangle targets',requested.map(r=>r.afterTriangles===null?null:r.afterTriangles===r.targetTriangles),compact(requested),'Each explicitly named island meets its own triangle count.'));
  else unverified.push('Per-component triangle targets were not supplied.');
  if(preserveBoundary)checks.push(resultCheck('boundary retention',relevant.map(r=>!r.comparable?null:r.boundary.verified?r.boundary.retained:null),compact(relevant.filter(r=>!r.boundary?.retained)),'Original boundary loops remain closed, with retained rim vertices in their original cyclic order; no new interior-to-boundary cuts.'));
  if(preserveDimensions)checks.push(resultCheck('component dimensions',relevant.map(r=>!r.comparable?null:r.dimensions.maxDelta===null?false:r.dimensions.maxDelta<=dimensionTolerance),compact(relevant.filter(r=>!r.dimensions||r.dimensions.maxDelta>dimensionTolerance)) ,{maximumExtentDelta:dimensionTolerance}));
  if(preserveUVs){checks.push(resultCheck('UV preservation',components.map(r=>!r.comparable?null:r.uvRetained),compact(components.filter(r=>r.uvRetained!==true)),'All retained-coordinate UV corners preserve authored values in every UV set.'));unverified.push('UV interpolation and surface appearance across changed triangles require rendered comparison.');}
  if(preserveBindings)checks.push(resultCheck('binding retention',components.map(r=>!r.comparable?null:r.bindingsRetained),compact(components.filter(r=>r.bindingsRetained!==true)),'Retained vertices preserve native SD groups or weighted influences.'));
  if(selection!==undefined)checks.push(resultCheck('selection confinement',confinement.length?confinement:[selectedComponents>0],{selectedComponents},'Only complete selected indexed islands may change; exterior faces and vertex attributes retain correspondence.'));
  return{checks,components,componentsTotal:components.length,unverified};
}
