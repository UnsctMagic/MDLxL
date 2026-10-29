/** Conservative conversion contract: SD content crosses versions; HD-only
 * content blocks downgrade rather than silently discarding it.
 */
export function versionConversionIssues(model, target) {
  const issues=[];
  if (![800,1000].includes(target)) return ['Choose MDX800 or MDX1000.'];
  if (![800,1000].includes(model?.Version)) return ['Only editable MDX800 and MDX1000 models can be converted.'];
  if (target===model.Version) return issues;
  if (target===800) {
    for(const key of ['ParticleEmitterPopcorns','FaceFX','BindPoses']) if(model[key]?.length)issues.push(`${key} cannot be represented in MDX800.`);
    for(const [index,g] of (model.Geosets||[]).entries()) {
      for(const key of ['SkinWeights','Tangents']) if(g[key]?.length)issues.push(`Geoset ${index+1} has ${key}.`);
      if(g.LevelOfDetail>0 || g.Name)issues.push(`Geoset ${index+1} has authored level-of-detail data.`);
    }
    issues.push(...hdMaterialIssues(model));
  }
  return [...new Set(issues)];
}
const HD_TEXTURE_SLOTS=['NormalTextureID','ORMTextureID','EmissiveTextureID','TeamColorTextureID','ReflectionsTextureID'];
function hdMaterialIssues(model) {
  const issues=[];
  for(const [index,material] of (model.Materials||[]).entries()) {
    if(material.Shader)issues.push(`Material ${index+1} uses a shader.`);
    for(const layer of material.Layers||[]) {
      for(const key of HD_TEXTURE_SLOTS) if(layer[key]!=null)issues.push(`Material ${index+1} uses ${key}.`);
      const nondefault=(key,def)=>layer[key]!=null && (typeof layer[key]==='object' || layer[key]!==def);
      if(nondefault('EmissiveGain',1)||nondefault('FresnelOpacity',0)||nondefault('FresnelTeamColor',0)||layer.ShaderTypeId>0)issues.push(`Material ${index+1} has Reforged lighting properties.`);
      if(layer.FresnelColor && (layer.FresnelColor.Keys || Array.from(layer.FresnelColor).some(v=>v!==1)))issues.push(`Material ${index+1} has a Fresnel color.`);
    }
  }
  return issues;
}
export const HD_UNSUPPORTED_MESSAGE="HD models aren't supported yet.";
export const HD_VIEW_ONLY_MESSAGE='HD models can be previewed. This model is open view-only; saving is disabled.';
export const HD_CONVERT_NOTICE="HD content isn't supported yet, so it will be converted to SD.";
export const HD_CONVERTED_MESSAGE="HD content isn't supported yet, so it was converted to SD.";
export const HD_SHADER_MESSAGE="HD shaders aren't supported yet, so the shader was not applied.";
export const HD_BORDERLINE_MESSAGE="This model has HD shader or lighting settings, which aren't supported yet. Open it view-only, or convert it to SD by removing those settings? The file is not changed until you save.";
/** Reforged HD content in any format version: the HD material content that
 * blocks downgrade (shader, HD texture slots, HD lighting) or weighted skin.
 * SD 800/1000 models, including MDLxL's own SD output, have none of it.
 */
export function hdContentIssues(model) {
  const issues=hdMaterialIssues(model||{});
  for(const [index,g] of (model?.Geosets||[]).entries()) if(g.SkinWeights?.length)issues.push(`Geoset ${index+1} has SkinWeights.`);
  return [...new Set(issues)];
}
/** 'hd' when HD textures or skin weights are present, 'borderline' when only a
 * shader name or HD lighting values mark the model, null for SD. Before 1100,
 * Shader_HD materials keep their normal/ORM/emissive maps as extra layers.
 */
export function hdContentKind(model) {
  if(!hdContentIssues(model).length)return null;
  const textures=(model.Materials||[]).some(material=>(material.Layers||[]).some(layer=>HD_TEXTURE_SLOTS.some(key=>layer[key]!=null)) || /^Shader_HD_/i.test(material.Shader||'') && material.Layers?.length>1);
  return textures || (model.Geosets||[]).some(g=>g.SkinWeights?.length) ? 'hd' : 'borderline';
}
/** Convert borderline HD to SD: clear shader names and reset HD lighting to SD defaults. */
export function clearHDMaterialSettings(model) {
  for(const material of model.Materials||[]) {
    if(material.Shader)material.Shader='';
    for(const layer of material.Layers||[]) {
      for(const [key,value] of [['EmissiveGain',1],['FresnelOpacity',0],['FresnelTeamColor',0],['ShaderTypeId',0]]) if(layer[key]!=null)layer[key]=value;
      if(layer.FresnelColor!=null)layer.FresnelColor=new Float32Array([1,1,1]);
      if(layer._MdxDefaults)for(const key of ['EmissiveGain','FresnelColor','FresnelOpacity','FresnelTeamColor'])delete layer._MdxDefaults[key];
    }
  }
  return model;
}
export function normalizeVersionFields(model, target) {
  model.Version=target;
  if(target===1000) for(const g of model.Geosets||[]) if(g.LevelOfDetail==null)g.LevelOfDetail=0;
  if(target===800) {
    for(const g of model.Geosets||[]) {delete g.LevelOfDetail;delete g.Name;}
    for(const material of model.Materials||[]) {
      delete material.Shader;
      for(const layer of material.Layers||[]) for(const key of ['EmissiveGain','FresnelColor','FresnelOpacity','FresnelTeamColor','ShaderTypeId'])delete layer[key];
    }
  }
}
