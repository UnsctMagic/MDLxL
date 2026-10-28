// Route the actual bundled-checker findings, not the absence of optimizer
// proposals. Every finding receives a disposition, including unknown types.
const collections={Bone:'Bones',Helper:'Helpers',Attachment:'Attachments',EventObject:'EventObjects',ParticleEmitter:'ParticleEmitters',ParticleEmitter2:'ParticleEmitters2',RibbonEmitter:'RibbonEmitters',Light:'Lights',Camera:'Cameras',GeosetAnimation:'GeosetAnims',GeosetAnim:'GeosetAnims',Material:'Materials',TextureAnimation:'TextureAnims',Texture:'Textures',GlobalSequence:'GlobalSequences',Geoset:'Geosets',CollisionShape:'CollisionShapes'};
export function hiveTrackPath(path=''){
  const root=/^\/([^/]+?)\s+(\d+)(?= - |\/|$)/.exec(path);if(!root)return null;
  const collection=collections[root[1].replace(/\s/g,'')];if(!collection)return null;
  // Names are descriptive only, and may themselves contain slashes.
  const tail=path.slice(root[0].length).replace(/^ - "[\s\S]*"(?=\/|$)/,'');
  const parts=[collection,root[2]];
  for(const part of tail.split('/').filter(Boolean)){
    const layer=/^Layer (\d+)$/.exec(part);if(layer)parts.push('Layers',layer[1]);
    else parts.push(part.replace(/\s/g,''));
  }
  return parts.join('.');
}
// Checker messages owned by a general checker repair (see optimizexl-checker-repairs.js).
const CHECKER_RULES=[
  [/is lower than the track before it|has the same frame .* as track/,'keyOrder'],[/has a negative frame/,'negativeKeys'],
  [/^Zero tracks$/,'emptyTracks','emptyEvents'],[/^Invalid global sequence/,'globalReference'],[/^Using a variation animation/,'variation'],
  [/^Path ".*" and replaceable ID .* used together$/,'texturePath'],[/^(Unknown|Invalid) replaceable ID/,'replaceableId'],
  [/^Invalid texture animation/,'textureAnimReference'],[/^Invalid geoset animation/,'boneReference'],[/^Invalid geoset /,'geosetAnimReference','boneReference'],
  [/^Invalid parent|^Same object and parent$/,'parent'],[/which is not a bone$/,'helperSkin'],[/^There are no vertices attached to this bone$/,'unskinnedBone'],
  [/^Zero faces$/,'zeroFaces'],[/^Too many vertices in one geoset/,'vertexLimit'],[/attenuation/,'lightAttenuation'],
  [/^Missing the Origin attachment point$/,'origin'],[/^Expected time middle/,'timeMiddle'],[/^The animation file should probably be empty/,'animationFile'],
  [/is not a standard name$/,'sequenceNames'],[/^Zero length$/,'zeroLength'],[/^Missing opening track for global sequence/,'globalOpening'],
  [/^This sequence starts (at the same frame as|before) sequence/,'timeline'],[/^Vertex \d+: (Not attached|Attached to (vertex group|object) \d+ which does not exist)/,'vertexAttachment'],
  [/^Invalid material/,'materialReference'],[/^Invalid texture /,'textureReference'],[/^Invalid filter mode/,'filterMode'],[/^Corrupted path/,'texturePathExtension'],
  [/^Invalid path/,'modelPath'],[/^Referenced by \d+ geoset animations/,'duplicateGeosetAnims'],[/with a 0 alpha, the geoset may be invisible$/,'invisibleBoneLink'],
  [/^Using squirt without/,'squirt'],[/^XY Quad emitters/,'xyQuad'],[/^Interpolation type not set to None$/,'visibilityFade'],
];
export function classifyHiveFindings(findings,proposals=[]){
  return findings.map(f=>{
    const message=f.message||f.name||'',frameMatch=/\bat frame (\d+)/.exec(message),frame=frameMatch?Number(frameMatch[1]):null;
    let kind='unsupported',owner=null;
    if(f.type==='unused'){
      if(/^Track \d+ at frame \d+ has (?:roughly|exactly) the same value as tracks \d+ and \d+$/.test(message)){kind='redundantTracks';owner='sanity';}
      else if(/^Track \d+ at frame \d+ is not in any sequence$/.test(message)){kind='unusedLocalKeys';owner='sanity';}
      else if(/^Track \d+ at frame \d+ is not in global sequence \d+$/.test(message)){kind='globalKeys';owner='sanity';}
      else if(message==='Unused object'){kind='unusedObject';owner='unused';}
    }else if(/^Missing opening track for /.test(message)){kind='openingTrack';owner='sanity';}
    else if(message==='Using a gravity animation.'){kind='gravity';owner='sanity';}
    else if(message==='Interpolation type not set to None'){kind='visibilityInterpolation';owner='sanity';}
    else if(/^This sequence starts before sequence \d+ "/.test(message)){kind='sequenceTimeline';owner='sanity';}
    else if(/^Number of sequence extents \(\d+\) does not match the number of sequences \(\d+\)$/.test(message)){kind='sequenceExtents';owner='sanity';}
    else if(message==='There are no vertices attached to this bone'){kind='unskinnedBone';}
    const rules=CHECKER_RULES.find(([pattern])=>pattern.test(message))?.slice(1)||[],repair=proposals.find(p=>p.kind==='checker'&&rules.includes(p.rule));
    const location=hiveTrackPath(f.path);
    const proposal=proposals.find(p=>p.kind==='splineResample'&&kind==='redundantTracks'&&location===p.path?.join('.')&&p.noticed.includes(frame))||proposals.find(p=>f.type!=='unused'&&/extent|radius/i.test(message)&&p.targets?.some(t=>t.sequenceExtents?(kind==='sequenceExtents'&&(f.path||'')===t.hivePath)||(f.path||'').startsWith(t.hivePath+'/Extent'):(f.path||'').startsWith(t.hivePath))||
      p.kind==='sequenceTimeline'&&kind==='sequenceTimeline'||
      p.kind==='gravity'&&location===`ParticleEmitters2.${p.emitter}.Gravity`||
      p.kind===kind&&location===p.path?.join('.')&&
      (kind==='openingTrack'?p.frame===frame:kind==='redundantTracks'?p.noticed.includes(frame):kind==='unusedLocalKeys'?p.frames.includes(frame):true));
    if(!proposal&&repair)return {...f,kind:'checker',owner:'sanity',fixId:repair.id,status:'preview',reason:repair.choices?'Repair available; choose how to fix it.':'Supported correction available.'};
    if(proposal){const manual=proposal.inspectionOnly||proposal.kind==='redundantTracks'&&!proposal.frames?.includes(frame);
      return {...f,kind,owner:'sanity',fixId:proposal.id,status:manual?'manual':'preview',
        reason:manual?proposal.preservedTurns?.includes(frame)?'Similar values contain an authored turn; keep this key to preserve motion.':'Detected; its curve or domain requires manual review.':'Supported correction available.'};}
    if(kind==='unusedObject')return {...f,kind,owner,status:'stage',reason:'Review reference-based removal in Unused data; retained dependencies remain reported here.'};
    if(kind==='unskinnedBone')return {...f,kind,owner,status:'manual',reason:'An unskinned bone may still drive child nodes or reference geoset animation. Inspect its hierarchy and references before changing or removing it.'};
    return {...f,kind,owner,status:'manual',reason:kind==='unsupported'?'Detected by mdx-m3-viewer; no supported automatic correction.':'Detected; no safe automatic correction for this domain.'};
  });
}
