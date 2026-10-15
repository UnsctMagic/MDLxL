import { readWarcraftDnc, sampleWarcraftDnc } from '../src/warcraft-dnc.js';

export const PORTRAIT_DNC_PATH = 'Environment\\DNC\\DNCLordaeron\\DNCLordaeronPortrait\\DNCLordaeronPortrait.mdx';

// One read per game-data/model location. Toggling the option or re-entering
// Portrait must not fetch and parse the DNC over IPC again.
const cache = new Map();
export function clearPortraitLightCache() { cache.clear(); }

export function loadPortraitLights(desktop, modelPath) {
  if (!desktop?.resolveEventResources) return Promise.reject(Error('Game data is available in the desktop app.'));
  const key = String(modelPath || '');
  if (!cache.has(key)) {
    const promise = desktop.resolveEventResources({ names: [PORTRAIT_DNC_PATH], path: modelPath }).then(records => {
      const asset = records.find(record => record.bytes?.byteLength || record.bytes?.length);
      if (!asset) throw Error('Choose Warcraft game data in Settings to load portrait lights.');
      return sampleWarcraftDnc(readWarcraftDnc(asset.bytes, PORTRAIT_DNC_PATH, { currentLightLayout: true }));
    });
    promise.catch(() => { if (cache.get(key) === promise) cache.delete(key); });
    cache.set(key, promise);
  }
  return cache.get(key);
}

/** Experimental: reduce the DNC portrait rig to one directional light plus
 * ambient, computed once on the CPU. Directions use the same portrait-scene
 * mapping as the verified MiscData light. This is an approximation; the
 * game's own DNC portrait lighting has not been verified against it. */
export function portraitLightFromRig(lights) {
  const toward = [0, 0, 0], color = [0, 0, 0], ambient = [0, 0, 0];
  for (const light of lights || []) {
    for (let i = 0; i < 3; i++) ambient[i] += Number(light.ambient?.[i]) || 0;
    if (light.type === 2) { for (let i = 0; i < 3; i++) ambient[i] += Number(light.color?.[i]) || 0; continue; }
    // Omni lights shine from their position toward the subject at the origin;
    // directional lights shine along -direction (local +Z points at the source).
    const source = light.type === 0 ? light.position : light.direction;
    const length = Math.hypot(...source);
    if (!(length > 1e-6)) continue;
    if (light.type === 0 && Number(light.end) > 0 && length > Number(light.end)) continue;
    const strength = (Number(light.color?.[0]) || 0) * .299 + (Number(light.color?.[1]) || 0) * .587 + (Number(light.color?.[2]) || 0) * .114;
    // Game travel direction (-source) -> portrait model space (y,-x,-z).
    const travel = source.map(value => -value / length);
    const mapped = [travel[1], -travel[0], -travel[2]];
    for (let i = 0; i < 3; i++) { toward[i] += mapped[i] * strength; color[i] += Number(light.color?.[i]) || 0; }
  }
  const length = Math.hypot(...toward);
  if (!(length > 1e-6)) return null;
  const clamp = value => Math.max(0, Math.min(1, value));
  return { direction: toward.map(value => value / length), color: color.map(clamp), ambient: ambient.map(clamp) };
}

/** Classic SD portrait light is vertex-lit, clamped, and multiplied directly
 * into texture RGB. No uniforms are added (the SD hardware-skinning vertex
 * shader is near the uniform limit): .x carries the verified MiscData result,
 * clamp(.3 + N.L), exactly as before; .y the raw diffuse term. Only when
 * uMdlxlPortrait is 2 (experimental DNC rig) does the fragment stage recolour
 * .y with uMdlxlAmbient/uMdlxlDiffuse, which portrait mode otherwise ignores. */
export const portraitLightDeclarations = `out vec2 vMdlxlPortraitLight;
`;

export const portraitLightCalculation = `
    float mdlxlPortraitDiffuse = max(0., dot(vNormal, normalize(uMdlxlLightDirection)));
    vMdlxlPortraitLight = vec2(clamp(.3 + mdlxlPortraitDiffuse, 0., 1.), mdlxlPortraitDiffuse);
`;

export const portraitFragmentDeclarations = `uniform float uMdlxlPortrait;
in vec2 vMdlxlPortraitLight;
`;

export const portraitFragmentLight = '(uMdlxlPortrait > 1.5 ? clamp(uMdlxlAmbient + uMdlxlDiffuse * vMdlxlPortraitLight.y, 0., 1.) : vec3(vMdlxlPortraitLight.x))';
