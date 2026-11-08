/** Which scene each Settings control shows. Keys are the control's data-hotkey, else
 * its aria-label; a trailing * matches a family. Adding a setting is one line here. */
import { uvRotateScene, uvZoomScene } from './scene-uv.jsx';
import { gizmoRotateScene } from './scene-gizmo.jsx';
import { keycapScene, mouseCameraScene, pointerGainScene, wheelScene } from './scene-input.jsx';
import { compareScene, gridSampleScene, litSampleScene, rigSampleScene, uiSampleScene, viewportSampleScene } from './scene-samples.jsx';

const SCENES = {
  'uv-rotate': uvRotateScene,
  'uv-zoom': uvZoomScene,
  'gizmo-rotate': gizmoRotateScene,
  'pointer-gain': pointerGainScene,
  'mouse-camera': mouseCameraScene,
  wheel: wheelScene,
  keycap: keycapScene,
  compare: compareScene,
  'viewport-sample': viewportSampleScene,
  'rig-sample': rigSampleScene,
  'grid-sample': gridSampleScene,
  'lit-sample': litSampleScene,
  'ui-sample': uiSampleScene,
};

const LINES = [
  ['mouse:uv-rotate-preset', 'uv-rotate', 'preset'],
  ['preset:uv:select', 'uv-rotate', 'preset'],
  ['mouse:uv-rotate-style', 'uv-rotate', 'style'],
  ['mouse:uv-rotate-speed', 'uv-rotate', 'speed'],
  ['mouse:uv-rotate-zone', 'uv-rotate', 'zone'],
  ['mouse:uv-rotate-big-pieces', 'uv-rotate', 'bigPieces'],
  ['mouse:uv-rotate-reverse', 'uv-rotate', 'reverse'],
  ['mouse:uv-rotate-snap', 'uv-rotate', 'snap'],
  ['mouse:uv-zoom-style', 'uv-zoom', 'style'],
  ['mouse:uv-zoom-speed', 'uv-zoom', 'speed'],
  ['mouse:uv-zoom-snap', 'uv-zoom', 'snap'],
  ['preset:rotate:select', 'gizmo-rotate', 'preset'],
  ['mouse:rotation-editor', 'gizmo-rotate', 'apply'],
  ['mouse:rotation-sensitivity', 'gizmo-rotate', 'sensitivity'],
  ['Use default rotation sensitivity', 'gizmo-rotate', 'inherit'],
  ['Shift rotation precision', 'gizmo-rotate', 'precision'],
  ['Use default rotation precision', 'gizmo-rotate', 'precision'],
  ['mouse:rotation-workplane-drag', 'gizmo-rotate', 'workplaneDrag'],
  ['mouse:rotation-handle-drag', 'gizmo-rotate', 'handleDrag'],
  ['mouse:rotation-line-pick', 'gizmo-rotate', 'linePick'],
  ['mouse:rotation-lever-pick', 'gizmo-rotate', 'leverPick'],
  ['mouse:rotation-off-handle', 'gizmo-rotate', 'offHandle'],
  ['mouse:rotation-face-on', 'gizmo-rotate', 'faceOn'],
  ['mouse:rotation-reverse', 'gizmo-rotate', 'reverse'],
  ['mouse:rotation-handle-speed', 'gizmo-rotate', 'handleSpeed'],
  ['Use Rotation sensitivity', 'gizmo-rotate', 'handleSpeed'],
  ['Use default: *', 'gizmo-rotate', 'inherit'],
  ['mouse:rotation-dpi', 'gizmo-rotate', 'dpi'],
  ['mouse:rotation-zone', 'gizmo-rotate', 'zone'],
  ['mouse:rotation-big-selections', 'gizmo-rotate', 'bigSelections'],
  ['mouse:rotation-shift', 'gizmo-rotate', 'shift'],
  ['mouse:rotation-snap', 'gizmo-rotate', 'snap'],
  ['Move gizmo', 'gizmo-rotate', 'moveGizmo'],
  ['Rotate handles', 'gizmo-rotate', 'handleStyle'],

  ['preset:mouse:select', 'mouse-camera', 'preset'],
  ['mouse:preset:classic', 'mouse-camera', 'preset', { preset: 'classic' }],
  ['mouse:preset:orbit', 'mouse-camera', 'preset', { preset: 'orbit' }],
  ['mouse:binding:right', 'mouse-camera', 'right'],
  ['mouse:binding:middle', 'mouse-camera', 'middle'],

  ['mouse:sensitivity-*', 'wheel', 'sensitivity'],
  ['mouse:wheel:rotate', 'wheel', 'normal'],
  ['mouse:wheel:scroll', 'wheel', 'scroll'],
  ['mouse:wheel:pointer', 'wheel', 'pointer'],
  ['mouse:right-scroll-adjust', 'wheel', 'rightScroll'],

  ['mouse:pointer-*', 'pointer-gain', 'pointer'],
  ['mouse:fine', 'pointer-gain', 'fine'],
  ['mouse:uv', 'pointer-gain', 'uv'],

  ['hotkeys:learn', 'keycap', 'enabled'],
  ['Learn mode: Where', 'keycap', 'where'],
  ['Learn mode: Size', 'keycap', 'size'],
  ['Learn mode: Look', 'keycap', 'look'],
  ['Learn mode: Stays for', 'keycap', 'duration'],
  ['Learn mode: Learned after', 'keycap', 'uses'],
  ['Learn mode: Then quiet for', 'keycap', 'quiet'],
  ['capture:pressed-keys', 'keycap', 'pressedKeys'],

  ['graphics:preset:fast', 'compare', 'preset', { preset: 'fast' }],
  ['graphics:preset:balanced', 'compare', 'preset', { preset: 'balanced' }],
  ['graphics:preset:quality', 'compare', 'preset', { preset: 'quality' }],
  ['graphics:pixel-ratio', 'compare', 'pixelRatio'],
  ['graphics:max-fps', 'compare', 'fps'],
  ['graphics:antialias', 'compare', 'antialias'],
  ['graphics:textures', 'compare', 'textures'],
  ['graphics:lighting', 'compare', 'lighting'],
  ['graphics:particles', 'compare', 'particles'],
  ['graphics:pause-when-hidden', 'compare', 'pauseHidden'],
  ['Recording frame rate', 'compare', 'captureFps'],
  ['Recording quality', 'compare', 'recordingQuality'],
  ['Screenshot quality', 'compare', 'screenshotQuality'],

  ['Lighting setup', 'lit-sample', 'light'],
  ['lighting:power', 'lit-sample', 'power'],
  ['lighting:*', 'lit-sample', 'light'],
  ['platform:*', 'lit-sample', 'platform'],
  ['Show platform', 'lit-sample', 'platform'],
  ['Platform *', 'lit-sample', 'platform'],

  ['Viewport appearance preset', 'viewport-sample', 'look'],
  ['Viewport background *', 'viewport-sample', 'background'],
  ['Background image display mode', 'viewport-sample', 'background'],
  ['Image opacity', 'viewport-sample', 'background'],
  ['appearance:background:opacity', 'viewport-sample', 'background'],
  ['Highlight Geoset *', 'viewport-sample', 'highlight'],
  ['Highlight via *', 'viewport-sample', 'highlight'],
  ['Wire style', 'viewport-sample', 'hidden'],
  ['Hidden wire intensity', 'viewport-sample', 'hidden'],
  ['appearance:size:occludedOpacity', 'viewport-sample', 'hidden'],
  ['Selected geoset *', 'viewport-sample', 'wires'],
  ['Other visible geosets *', 'viewport-sample', 'wires'],
  ['appearance:selectedGeoset:*', 'viewport-sample', 'wires'],
  ['appearance:otherGeoset:*', 'viewport-sample', 'wires'],
  ['appearance:xray-vertices', 'viewport-sample', 'vertices'],
  ['Selected vertices *', 'viewport-sample', 'vertices'],
  ['Unselected vertices *', 'viewport-sample', 'vertices'],
  ['appearance:selectedVertex:*', 'viewport-sample', 'vertices'],
  ['appearance:unselectedVertex:*', 'viewport-sample', 'vertices'],
  ['Citadel *', 'viewport-sample', 'citadel'],
  ['citadel:borderThickness', 'viewport-sample', 'citadel'],
  ['Quadview image display', 'viewport-sample', 'quadImage'],
  ['appearance:quadview:image-opacity', 'viewport-sample', 'quadImage'],

  ['Bones & skeleton appearance set', 'rig-sample', 'bones'],
  ['Bones *', 'rig-sample', 'bones'],
  ['Bone style', 'rig-sample', 'bones'],
  ['Skeleton style', 'rig-sample', 'bones'],
  ['Connector thickness', 'rig-sample', 'bones'],
  ['Chain highlight thickness', 'rig-sample', 'bones'],
  ['appearance:bones:*', 'rig-sample', 'bones'],
  ['Bone influence *', 'rig-sample', 'influence'],
  ['appearance:influence:opacity', 'rig-sample', 'influence'],
  ['Controllers appearance set', 'rig-sample', 'controllers'],
  ['Controller *', 'rig-sample', 'controllers'],
  ['Handle shape', 'rig-sample', 'controllers'],
  ['Body shape', 'rig-sample', 'controllers'],
  ['Bend shape', 'rig-sample', 'controllers'],
  ['Pin button style', 'rig-sample', 'controllers'],
  ['Show body-part symbols', 'rig-sample', 'controllers'],
  ['Editor helpers appearance set', 'rig-sample', 'helpers'],
  ['appearance:color:*', 'rig-sample', 'helpers'],
  ['Emitter marker', 'rig-sample', 'helpers'],
  ['appearance:size:keyframeSize', 'rig-sample', 'helpers'],
  ['appearance:size:helperSize', 'rig-sample', 'helpers'],

  ['grid:preset:classic', 'grid-sample', 'world', { preset: 'classic' }],
  ['grid:preset:fine', 'grid-sample', 'world', { preset: 'fine' }],
  ['grid:preset:world', 'grid-sample', 'world', { preset: 'world' }],
  ['grid:preset:xyz', 'grid-sample', 'world', { preset: 'xyz' }],
  ['grid:*', 'grid-sample', 'world'],
  ['Quadview *', 'grid-sample', 'quad'],
  ['appearance:quadview:*', 'grid-sample', 'quad'],

  ['Interface appearance set', 'ui-sample', 'chrome'],
  ['UI accent', 'ui-sample', 'chrome'],
  ['Geoset set', 'ui-sample', 'chrome'],
  ['Compact Set color', 'ui-sample', 'chrome'],
  ['Tool highlight', 'ui-sample', 'chrome'],
  ['appearance:panel-width', 'ui-sample', 'width'],
  ['appearance:panel-scale', 'ui-sample', 'scale'],
  ['appearance:toolbar-mode', 'ui-sample', 'toolbar'],
  ['Folders & lists appearance set', 'ui-sample', 'tree'],
  ['Node colors appearance set', 'ui-sample', 'nodes'],
  ['Sound folder colors appearance set', 'ui-sample', 'folders'],
  ['Tree *', 'ui-sample', 'tree'],
  ['Node *', 'ui-sample', 'nodes'],
  ['Folder *', 'ui-sample', 'folders'],
  ['appearance:tree:font-size', 'ui-sample', 'tree'],
];

const TABLE = new Map(LINES.filter(([key]) => !key.endsWith('*')).map(line => [line[0], line]));
const FAMILIES = LINES.filter(([key]) => key.endsWith('*')).map(line => [line[0].slice(0, -1), line]).sort((a, b) => b[0].length - a[0].length);
export const PREVIEW_LINES = Object.freeze(LINES);

/** The registry line for a control key, as { scene, focus, options }, or null. */
export function previewEntry(key) {
  if (!key) return null;
  const line = TABLE.get(key) || FAMILIES.find(([prefix]) => key.startsWith(prefix))?.[1];
  return line ? { key, scene: line[1], focus: line[2], options: line[3] } : null;
}
export const previewScene = id => SCENES[id];
/** What each page shows before a control is reached. */
export const PREVIEW_DEFAULT_TARGET = Object.freeze({
  'mouse:Camera': 'mouse:binding:right', 'mouse:Rotation': 'mouse:rotation-workplane-drag', 'mouse:Wheel': 'mouse:sensitivity-slider', 'mouse:Pointer': 'mouse:pointer-slider', 'mouse:UV': 'mouse:uv-rotate-style',
  graphics: 'graphics:pixel-ratio', capture: 'Recording frame rate', grid: 'grid:spacing', learn: 'hotkeys:learn',
  'visuals:Presets': 'Viewport appearance preset', 'visuals:Interface': 'UI accent', 'visuals:Viewport': 'Viewport background color', 'visuals:Wires': 'Wire style', 'visuals:Vertices': 'Selected vertices color', 'visuals:Bones & skeleton': 'Bones Bone', 'visuals:Bone influence': 'appearance:influence:opacity', 'visuals:Controllers': 'Controller Handle', 'visuals:Lists & folders': 'Tree List text', 'visuals:Quadview': 'Quadview line thickness', 'visuals:Editor helpers': 'appearance:color:keyframe', 'visuals:Citadel Paint': 'Citadel Brush cursor',
});
export const PREVIEW_SCENE_IDS = Object.freeze(Object.keys(SCENES));
