import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

// Existing native/inner-state claims, outside the audited window-close handlers.
// Counts prevent a new raw window key handler from quietly joining an exception.
const documentedClaims = {
  "CorpseStageTools.jsx": [
    1,
    "Cancel the active pointer drag."
  ],
  "Fields.jsx": [
    2,
    "Restore unfinished numeric input."
  ],
  "ForgeShapes.jsx": [
    1,
    "Cancel the active shape operation."
  ],
  "GamePreview.jsx": [
    4,
    "Cancel attachment picking and pointer gestures; rotation belongs to PR #409."
  ],
  "GlowStageTools.jsx": [
    1,
    "Cancel a glow-handle drag."
  ],
  "KeyframeTimeline.jsx": [
    3,
    "Cancel key/range selection and restore frame/speed drafts."
  ],
  "ModelManager.jsx": [
    2,
    "Cancel an unfinished manager edit."
  ],
  "MotionInspector.jsx": [
    1,
    "Dismiss the deliberately opened warning popover."
  ],
  "MovementControllerRecomp.jsx": [
    1,
    "Cancel an object-name draft."
  ],
  "PaintViewport.jsx": [
    1,
    "Cancel the active paint/camera gesture."
  ],
  "ParticleCluelessControls.jsx": [
    4,
    "Cancel slider/color gestures or restore a numeric draft."
  ],
  "ParticleExampleComparison.jsx": [
    1,
    "Dismiss an inner Particle Editor comparison pane."
  ],
  "ParticleIngredients.jsx": [
    1,
    "Dismiss an inner Particle Editor ingredients pane."
  ],
  "ParticleLifeMarker.jsx": [
    1,
    "Cancel an active life-marker drag."
  ],
  "ParticlePlacementStage.jsx": [
    1,
    "Cancel an active placement-handle drag."
  ],
  "ParticleRibbonFields.jsx": [
    1,
    "Keep numeric draft cancellation inside the field."
  ],
  "ParticleSourceContext.jsx": [
    1,
    "Dismiss an inner source-context pane."
  ],
  "ParticleStageTools.jsx": [
    1,
    "Cancel the active emitter-handle drag."
  ],
  "ParticleTestView.jsx": [
    1,
    "Dismiss an inner effect-test pane."
  ],
  "PortraitToolbar.jsx": [
    1,
    "Cancel the portrait-camera field draft."
  ],
  "Settings.jsx": [
    1,
    "Decline the asset-preload confirmation, leaving Settings open."
  ],
  "UVEditor.jsx": [
    1,
    "Cancel the current UV gesture."
  ],
  "Viewport.jsx": [
    2,
    "Cancel the active editor gesture."
  ]
};

test('window keys use the catalog or documented inner-state claims',()=>{
  for(const file of readdirSync(new URL('../app/',import.meta.url)).filter(file=>file.endsWith('.jsx')&&file!=='Hotkeys.jsx')){
    const source=readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
    const withoutClaims=source.replace(/useWindowKeyClaim\([^\n]*\);/g,'').replace(/useWindowKeyClaim\([\s\S]*?\n  \}(?:,\s*\d+)?\);/g,'');
    const escapes=[...withoutClaims.matchAll(/\b(?:event|e|input)\.key\s*={2,3}\s*['"]Escape['"]/g)];
    assert.equal(escapes.length,documentedClaims[file]?.[0]||0,file+': '+(documentedClaims[file]?.[1]||'use the catalog or a window claim'));
    assert.doesNotMatch(withoutClaims,/ctrlKey[^\n]*&&[^\n]*(?:key\s*===?\s*['"]z['"]|\[['"]z['"], ?['"]y['"]\]\.includes)/i,file+' has raw history dispatch');
  }
});

test('generic claims preserve Escape ordering and replace named workspace events',()=>{
  const source=readFileSync(new URL('../app/Hotkeys.jsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/mdlxl-(?:showcase|uv|paint)-key|\.learn-menu|\.bone-create-menu/);
  assert.ok(source.indexOf("'mdlxl-escape-key'")<source.indexOf("new CustomEvent('mdlxl-window-key'"));
  assert.match(source,/scope: localWindow/);
  assert.match(source,/claims\.sort/);
  for(const [file,priority]of [['AppToolbar.jsx',-20],['MovementControllerRecomp.jsx',-10]])assert.match(readFileSync(new URL('../app/'+file,import.meta.url),'utf8'),new RegExp('escapePriority:'+priority));
});
