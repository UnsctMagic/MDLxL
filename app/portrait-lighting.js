import { readWarcraftDnc, sampleWarcraftDnc } from '../src/warcraft-dnc.js';

export const PORTRAIT_DNC_PATH = 'Environment\\DNC\\DNCLordaeron\\DNCLordaeronPortrait\\DNCLordaeronPortrait.mdx';

export async function loadPortraitLights(desktop, modelPath) {
  if (!desktop?.resolveEventResources) throw Error('Game data is available in the desktop app.');
  const records = await desktop.resolveEventResources({ names: [PORTRAIT_DNC_PATH], path: modelPath });
  const asset = records.find(record => record.bytes?.byteLength || record.bytes?.length);
  if (!asset) throw Error('Choose Warcraft game data in Settings to load portrait lights.');
  return sampleWarcraftDnc(readWarcraftDnc(asset.bytes, PORTRAIT_DNC_PATH));
}

export function portraitLightUniformValues(lights) {
  const selected = (lights || []).slice(0,8), positions = new Float32Array(32), directions = new Float32Array(24), colors = new Float32Array(24), ambient = new Float32Array(24), ranges = new Float32Array(16);
  selected.forEach((light,index) => {
    positions.set([...light.position,light.type],index*4); directions.set(light.direction,index*3); colors.set(light.color,index*3); ambient.set(light.ambient,index*3); ranges.set([light.start,light.end],index*2);
  });
  return { count:selected.length, positions, directions, colors, ambient, ranges };
}

export const portraitLightDeclarations = `uniform int uPortraitLightCount;
uniform vec4 uPortraitLightPositions[8];
uniform vec3 uPortraitLightDirections[8], uPortraitLightColors[8], uPortraitLightAmbient[8];
uniform vec2 uPortraitLightRanges[8];
out vec3 vMdlxlPortraitLight;
`;

// Match the Classic vertex-lighting path already used by the Paint workspace.
export const portraitLightCalculation = `
    vMdlxlPortraitLight = vec3(clamp(.3 + max(0., dot(vNormal, normalize(uMdlxlLightDirection))), 0., 1.));
    if (uPortraitLightCount > 0) {
      vMdlxlPortraitLight = vec3(0.);
      for (int lamp = 0; lamp < 8; lamp++) {
        if (lamp >= uPortraitLightCount) break;
        float type = uPortraitLightPositions[lamp].w;
        vec3 toward = uPortraitLightPositions[lamp].xyz - position.xyz;
        float distanceToLight = length(toward), weight = 1.;
        vec3 axis = uPortraitLightDirections[lamp];
        if (type < .5) { axis = toward / max(distanceToLight, .0001); float units = 1. + distanceToLight / 64.; weight = 1. / (units * units); }
        if (type > 1.5) {
          weight = distanceToLight <= uPortraitLightRanges[lamp].y ? 1. / max(.001, min(distanceToLight - uPortraitLightRanges[lamp].x, uPortraitLightRanges[lamp].y - uPortraitLightRanges[lamp].x)) : 0.;
          vMdlxlPortraitLight += uPortraitLightAmbient[lamp] * weight;
        } else vMdlxlPortraitLight += clamp(uPortraitLightColors[lamp] * max(0., dot(vNormal,axis)) * weight,0.,1.) + uPortraitLightAmbient[lamp] * weight;
      }
      vMdlxlPortraitLight = clamp(vMdlxlPortraitLight,0.,1.);
    }
`;
