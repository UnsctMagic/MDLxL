import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDemoDocument, createNode } from '../src/editor-document.js';
import { animationTargets, sampleAnimationProperty } from '../src/animation-tracks.js';

// Execute the real JSX component, not a regex over source. This catches
// undefined render-time variables even when the production bundler succeeds.
async function component(file, onElement) {
  const result=await build({entryPoints:[new URL('../app/'+file,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
  const module={exports:{}};
  const require = createRequire(import.meta.url);
  const load = id => id === 'react' && onElement ? { ...React, createElement: (...args) => { onElement(...args); return React.createElement(...args); } } : require(id);
  new Function('require','module','exports',result.outputFiles[0].text)(load,module,module.exports);
  return module.exports.default;
}
const Movement=await component('MovementControllerRecomp.jsx');
const Animation=await component('AnimationController.jsx');
const Setup=await component('PortraitSetup.jsx');
const Toolbar=await component('PortraitToolbar.jsx');
const QuickDisplay=await component('QuickDisplay.jsx');
const Timeline=await component('KeyframeTimeline.jsx');
function fixture() {
  const model=createDemoDocument().model;
  model.Sequences=[{Name:'Stand',Interval:[0,1000]},{Name:'Portrait Talk',Interval:[2000,3000]},{Name:'Portrait',Interval:[4000,5000]}];
  model.GlobalSequences=[700];
  model.Cameras=[{Name:'Camera 01'}];
  return model;
}
test('actual Movement component renders normal and Portrait mode without exceptions',()=>{
  const model=fixture(),selectedNodeIds=[model.Bones[0].ObjectId];
  for(const portraitMode of [undefined,false,true]) {
    const html=renderToStaticMarkup(React.createElement(Movement,{model,portraitMode,sequenceIndex:portraitMode?1:0,selectedNodeIds,time:portraitMode?2000:0}));
    assert.match(html,/Movement controller/);
    const options=html.match(/aria-label="Movement current sequence"[\s\S]*?<\/select>/)[0];
    if(portraitMode){assert.doesNotMatch(options,/All line|Global 1/);assert.match(options,/Stand/);assert.match(options,/Portrait Talk/);assert.match(options,/>Portrait</);}
    else {assert.match(options,/Stand/);assert.match(options,/All line/);assert.match(options,/Global 1/);}
    assert.match(html,/aria-label="Move"/);assert.match(html,/aria-label="Rotate"/);assert.match(html,/aria-label="Scale"/);
    assert.doesNotMatch(html,/Portrait Camera|Set Current View/);
  }
});
test('Movement removes Own Axis, starts Restrictions minimized and Controller expanded',()=>{
  const model=fixture(), selectedNodeIds=[model.Bones[0].ObjectId];
  const html=renderToStaticMarkup(React.createElement(Movement,{model,sequenceIndex:0,selectedNodeIds,time:0,rotateOnOwnAxis:true}));
  assert.doesNotMatch(html,/Rotate on Own Axis/);
  assert.ok(html.indexOf('<summary>Controller<') < html.indexOf('<summary>Restrictions</summary>'));
  assert.match(html, /<summary>Controller<span class="movement-controller-select"><select aria-label="Controller type"/);
  assert.doesNotMatch(html, /Multiselect from List/);
  assert.doesNotMatch(html, /name="movement-controller-type"/);
  for(const title of ['Restrictions']) assert.match(html,new RegExp(`<details class="sidebar-section"><summary>${title}<\\/summary>`));
  for(const title of ['Current Sequence','Object','Workplane','Tools']) assert.match(html,new RegExp(`<details class="sidebar-section" open=""><summary>${title}<\\/summary>`));
  assert.match(html,/<details class="sidebar-section" open=""><summary>Controller<span/);
});

test('Movement workplanes do not disable XYZ rotation fields or bypass Rotation restrictions',()=>{
  const model=fixture(), selectedNodeIds=[model.Bones[0].ObjectId];
  for(const workplane of ['xy','xz','yz']) for(const transformMode of ['move','rotate','scale']) {
    const html=renderToStaticMarkup(React.createElement(Movement,{model,sequenceIndex:0,selectedNodeIds,time:0,workplaneEnabled:true,workplane,transformMode}));
    for(const [index,axis] of ['X','Y','Z'].entries()) {
      const field=html.match(new RegExp(`<input[^>]*aria-label="${axis} coordinate"[^>]*>`))[0];
      assert.equal(field.includes('disabled'),transformMode!=='rotate' && index===({xy:2,xz:1,yz:0})[workplane],`${workplane} ${transformMode} ${axis}`);
    }
  }
  const html=renderToStaticMarkup(React.createElement(Movement,{model,sequenceIndex:0,selectedNodeIds,time:0,workplaneEnabled:true,workplane:'xy',transformMode:'rotate',restrictions:{rotation:true}}));
  for(const axis of ['X','Y','Z'])assert.match(html,new RegExp(`<input[^>]*aria-label="${axis} coordinate"[^>]*disabled`));
});
test('Movement places Highlight Chain directly under Highlight KF and exposes collapsible groups',()=>{
  const model=fixture(), selectedNodeIds=[model.Bones[0].ObjectId];
  const html=renderToStaticMarkup(React.createElement(Movement,{model,sequenceIndex:0,selectedNodeIds,time:0,highlightKeyframes:true,highlightChain:true}));
  assert.ok(html.indexOf('Highlight KF') < html.indexOf('Highlight Chain'));
  assert.match(html,/Highlight KF<\/label><label[^>]*><input type="checkbox" checked=""\/>Highlight Chain/);
  for(const title of ['Current Sequence','Object','Workplane','Tools','Restrictions']) assert.match(html,new RegExp(`<summary>${title}<\\/summary>`));
});
test('Movement object list separates colored Bones from purple Helpers at the bottom',()=>{
  const model=fixture(),helper=createNode(model,'Helper');helper.Name='Bone_Chest';
  const html=renderToStaticMarkup(React.createElement(Movement,{model,sequenceIndex:0,selectedNodeIds:[helper.ObjectId],time:0}));
  const picker=html.match(/<select[^>]*aria-label="Movement bone or node"[\s\S]*?<\/select>/)[0];
  assert.ok(picker.indexOf('label="Bones"') < picker.indexOf('label="Other Objects"'));
  assert.ok(picker.indexOf('label="Other Objects"') < picker.indexOf('label="Helpers"'));
  assert.match(picker,/label="Bones" style="color:#166534"/);
  assert.match(picker,/label="Helpers" style="color:#6b21a8"/);
  assert.match(picker,/data-node-kind="helper" style="color:#6b21a8"/);
});
test('Animations remains editable with no selected vertices or checked geosets',()=>{
  const html=renderToStaticMarkup(React.createElement(Animation,{model:fixture(),sequenceIndex:0,time:0,selectedGeosets:[]}));
  assert.match(html,/Bake Sequence RGB/);assert.match(html,/Bake All RGB/);
  assert.doesNotMatch(html,/<input[^>]*aria-label="Animation R"[^>]*disabled/);
  assert.doesNotMatch(html,/<button[^>]*disabled[^>]*>Bake All RGB<\/button>/);
});
test('Animations exposes inline RGB fields on All line',()=>{
  const html=renderToStaticMarkup(React.createElement(Animation,{model:fixture(),sequenceIndex:-1,time:0,selectedGeosets:[0]}));
  assert.doesNotMatch(html,/<input[^>]*aria-label="Animation R"[^>]*disabled/);
  // renderToStaticMarkup never runs effects; the RGB fields are seeded after mount
  // from the All-line inline Color, so check that source value directly.
  const model=fixture(),[target]=animationTargets(model,{geosetIds:[0]}).filter(t=>t.property==='Color');
  assert.deepEqual(Array.from(sampleAnimationProperty(model,target,0,-1)).map(v=>Math.round(v*255)),[178,209,235]);
});
test('Animations enables RGB and visibility fields on a global sequence',()=>{
  const html=renderToStaticMarkup(React.createElement(Animation,{model:fixture(),sequenceIndex:-1,globalSeqId:0,time:0,selectedGeosets:[0]}));
  assert.doesNotMatch(html,/<input[^>]*aria-label="Animation R"[^>]*disabled/);
  assert.doesNotMatch(html,/<input[^>]*aria-label="Visibility alpha percent"[^>]*disabled/);
  assert.match(html,/<button disabled="">Bake Sequence RGB<\/button>/);
});
test('actual setup dialog renders every missing-requirement combination',()=>{
  for(const [missingSequence,missingCamera]of [[true,false],[false,true],[true,true]]) {
    const html=renderToStaticMarkup(React.createElement(Setup,{model:fixture(),missingSequence,missingCamera,sourceIndex:0}));
    assert.equal(html.includes('Create Sequence and Enter Portrait'),missingSequence);assert.match(html,/>Cancel</);
    assert.equal(html.includes('Portrait length (ms)'),missingSequence);
    assert.equal(html.includes('Portrait visibility/RGB source'),missingSequence);
    assert.equal(html.includes('Set Current View creates Camera 01'),missingCamera);
    assert.equal(html.includes('>Set Current View</button>'),missingCamera);
    if (missingCamera && missingSequence) assert.match(html,/<button disabled="">Create Sequence and Enter Portrait/);
  }
});

test('camera toolbar renders inside Movement with one create-or-update action and Portrait-only snap',()=>{
  for (const active of [false,true]) for (const hasCamera of [false,true]) {
    const model=fixture(); if(!hasCamera) model.Cameras=[];
    const html=renderToStaticMarkup(React.createElement(Toolbar,{model,active,cameraIndex:0}));
    assert.match(html,active?/Full Model View/:/Portrait Frame View/);
    assert.equal(html.includes('Snap to Camera'),active);
    assert.doesNotMatch(html,/>Create<\/button>/);
    assert.match(html,/<button[^>]*>Set Current View<\/button>/);
    assert.doesNotMatch(html,/<button disabled[^>]*>Set Current View/);
    assert.match(html,hasCamera?/Camera 01/:/No camera/);
  }
  const html=renderToStaticMarkup(React.createElement(Toolbar,{model:fixture(),active:true,cameraIndex:0,disabled:true}));
  assert.match(html,/<button disabled[^>]*>Set Current View/);
});

test('quick display shows only the active editor options without Reveal',()=>{
  const html=renderToStaticMarkup(React.createElement(QuickDisplay,{viewMode:'animations',checks:{'display:particles':true},isEnabled:()=>true,onCommand:()=>{},onClear:()=>{}}));
  assert.equal((html.match(/type="checkbox"/g)||[]).length,9);
  for(const label of ['Bones','Skeleton','Focused Skeleton','Nodes','Emitters','Events','Sounds','Wireframe','Grid','Clear']) assert.ok(html.includes(label));
  assert.doesNotMatch(html,/Reveal|Shadows|Vertices|Textured View/);
  assert.match(html,/<input[^>]*data-hotkey="display:particles"[^>]*checked=""/);
});

test('timeline displays the live frame without an effect-driven duplicate frame state',()=>{
  const html=renderToStaticMarkup(React.createElement(Timeline,{model:fixture(),sequenceIndex:0,time:375,playing:true}));
  assert.match(html,/<input[^>]*aria-label="Current animation frame"[^>]*value="375"/);
  assert.match(html,/<input[^>]*aria-label="Playback speed percent"[^>]*value="100"/);
});

test('Animations exposes every toolbox group as a default-open collapsible section',()=>{
  const html=renderToStaticMarkup(React.createElement(Animation,{model:fixture(),sequenceIndex:0,time:0,selectedGeosets:[]}));
  for(const title of ['Current Sequence','Sequence Properties','Visibility &amp; Color']) assert.match(html,new RegExp(`<summary>${title}<\\/summary>`));
  assert.equal((html.match(/<details class="sidebar-section" open=""/g)||[]).length,3);
});

test('Movement and Animations Create click the shared undoable action and switch to the first frame', async () => {
  for (const file of ['MovementControllerRecomp.jsx', 'AnimationController.jsx']) {
    const buttons = [];
    const Controller = await component(file, (type, props, ...children) => {
      if (type === 'button' && children[0] === 'Create') buttons.push(props);
    });
    for (const portraitMode of [false, true]) {
      const doc = createDemoDocument(), before = structuredClone(doc.model), changes = [], timeline = [], seeks = [], playing = [];
      buttons.length = 0;
      renderToStaticMarkup(React.createElement(Controller, {
        model: doc.model, sequenceIndex: 0, portraitMode,
        onEdit: (label, sections, mutate) => { changes.push({ label, sections }); return doc.apply(label, sections, mutate); },
        onTimelineChange: index => timeline.push(index), onSeek: time => seeks.push(time), onPlayingChange: value => playing.push(value),
      }));
      assert.equal(buttons.length, 1);
      assert.equal(buttons[0].disabled, false);
      buttons[0].onClick();
      const index = before.Sequences.length, interval = doc.model.Sequences[index].Interval;
      assert.deepEqual(changes, [{ label: 'Create animation sequence', sections: ['Sequences', 'Geosets'] }]);
      assert.deepEqual(timeline, [index]); assert.deepEqual(seeks, [interval[0]]);
      assert.equal(interval[1] - interval[0], 1000);
      assert.deepEqual(doc.model.Bones, before.Bones);
      assert.equal(doc.historyStats.undoSteps, 1);
      if (file.startsWith('Movement')) { assert.deepEqual(playing, [false]); assert.equal(buttons[0].title, 'Make a new blank one-second animation and switch to it.'); }
      doc.undo(); assert.deepEqual(doc.model, before);
    }
  }
});

test('Movement Create stays inside Current Sequence, is disabled for read-only/saving and absent in rest pose', () => {
  const model = fixture();
  for (const vanilla of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(Movement, { model, vanilla, disabled: true }));
    assert.match(html, /<summary>Current Sequence<\/summary>[\s\S]*?class="movement-sequence"[\s\S]*?<\/select><button disabled="" title="Make a new blank one-second animation and switch to it\.">Create<\/button><\/div><\/div><\/details>/);
    assert.doesNotMatch(html, />Create from current<|>Global<|>Delete<\/button>/);
  }
  const rest = renderToStaticMarkup(React.createElement(Movement, { model, restPose: true }));
  assert.doesNotMatch(rest, /Current Sequence|Make a new blank one-second/);
});
