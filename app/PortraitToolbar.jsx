import { isPortraitSequence } from '../src/sequence-editor.js';
import React, { useEffect, useRef, useState } from 'react';
import useDismiss from './useDismiss.js';
import { evaluateModelCamera, portraitPreviewSequences, MODEL_CAMERA_FOV_FACTOR } from './portrait-view.js';
import { CAMERA_NAME_LIMIT } from './portrait-camera-edit.js';
import { BACKDROP_LOOK, BACKDROP_HEIGHT_RANGE, BACKDROP_SIZE_RANGE, normalizeBackdropLook } from './portrait-background.js';

/** The game crop with the team glow as war3-model draws it (the shader of the
 * preview), plus a faint bust for scale. */
function BackdropPreview({ look, teamColor }) {
  const canvas = useRef(null);
  useEffect(() => {
    const element = canvas.current, context = element?.getContext('2d');
    if (!context) return;
    const { width, height } = element, image = context.createImageData(width, height);
    const hex = /^#?([0-9a-f]{6})$/i.exec(String(teamColor || ''))?.[1] || 'ff0303', color = [0, 2, 4].map(at => parseInt(hex.slice(at, at + 2), 16));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      // Crop coordinates ±1 vertically; the glow card is square in the world.
      const sx = (2 * (x + .5) / width - 1) * width / height, sy = 1 - 2 * (y + .5) / height;
      const distance = Math.hypot(sx, sy - look.height) / look.size, glow = Math.sin(Math.min(1, Math.max(0, 1 - distance * 1.4)));
      image.data.set([...color.map(value => value * glow), 255], (y * width + x) * 4);
    }
    context.putImageData(image, 0, 0);
    context.fillStyle = '#fff3';
    context.beginPath(); context.arc(width / 2, height * .4, width * .13, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.ellipse(width / 2, height * 1.02, width * .36, height * .42, 0, Math.PI, 0); context.fill();
  }, [look.size, look.height, teamColor]);
  return <canvas ref={canvas} className="portrait-backdrop-preview" width={98} height={100} aria-label="Background preview" role="img"/>;
}

function CameraFields({ view, name, disabled, onEdit, onPause }) {
  const values = { name, position: view.position, target: view.target, fieldOfView: view.fieldOfView * 180 / Math.PI, near: view.near, far: view.far };
  const key = JSON.stringify(values), [draft, setDraft] = useState(values);
  useEffect(() => setDraft(JSON.parse(key)), [key]);
  const commit = field => {
    const raw = draft[field];
    if (field === 'name') {
      // Unchanged or emptied names are not edits.
      if (!String(raw).trim() || String(raw).trim() === values.name) { setDraft(values); return; }
      if (onEdit({ name: raw }) === false) setDraft(values);
      return;
    }
    const number = item => String(item).trim() === '' ? NaN : Number(item);
    const typed = Array.isArray(raw) ? raw.map(number) : number(raw), list = Array.isArray(typed) ? typed : [typed];
    // A cleared or invalid field restores the current value instead of writing 0.
    if (!list.every(Number.isFinite)) { setDraft(values); return; }
    const current = Array.isArray(values[field]) ? values[field] : [values[field]];
    if (list.every((item, index) => Math.abs(item - current[index]) <= 1e-6 * Math.max(1, Math.abs(current[index])))) { setDraft(values); return; }
    const value = field === 'fieldOfView' ? typed * Math.PI / 180 : typed;
    if (onEdit({ [field]: value }) === false) setDraft(values);
  };
  const input = (field, axis) => <input aria-label={axis === undefined ? ({name:'Camera name',fieldOfView:'Field of view',near:'Near clip',far:'Far clip'}[field]) : (field === 'position' ? 'Camera' : 'Target') + ' ' + ['X','Y','Z'][axis]} disabled={disabled} type={field === 'name' ? 'text' : 'number'} step="any" maxLength={field === 'name' ? CAMERA_NAME_LIMIT : undefined} min={field === 'fieldOfView' ? 1 : field === 'near' || field === 'far' ? 0 : undefined} max={field === 'fieldOfView' ? 179 : undefined} value={axis === undefined ? draft[field] : draft[field][axis]} onChange={event => setDraft(previous => ({ ...previous, [field]: axis === undefined ? event.target.value : previous[field].map((v, i) => i === axis ? event.target.value : v) }))} onBlur={() => commit(field)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { event.stopPropagation(); setDraft(values); } }}/>;
  return <div className="portrait-camera-fields" onFocusCapture={onPause}>
    <label className="portrait-camera-field" title="The name saved in the model (up to 79 characters)">Name{input('name')}</label>
    {['position','target'].map(field => <label key={field} className="portrait-camera-vector" title={field === 'position' ? 'Camera location at the current animation time. Animated movement is preserved.' : 'The point the camera looks at, at the current animation time.'}><span>{field === 'position' ? 'Position X / Y / Z' : 'Target X / Y / Z'}</span>{[0,1,2].map(axis => <React.Fragment key={axis}>{input(field,axis)}</React.Fragment>)}</label>)}
    <label className="portrait-camera-field" title="The model camera viewing angle in degrees. A smaller angle makes the subject appear larger without moving the camera.">FOV °{input('fieldOfView')}</label>
    <label className="portrait-camera-field" title="Lens presets change the viewing angle without moving the camera. Millimetres use a 24 mm picture height.">Lens<select aria-label="Lens preset" disabled={disabled} value="" onChange={event => onEdit({ fieldOfView: 2 * Math.atan(12 / Number(event.target.value)) / MODEL_CAMERA_FOV_FACTOR })}><option value="">Custom</option>{[24,35,50,85,135].map(mm => <option key={mm} value={mm}>{mm} mm</option>)}</select></label>
    <label className="portrait-camera-field" title="Objects closer than this distance are clipped. Must be above zero.">Near{input('near')}</label>
    <label className="portrait-camera-field" title="Objects beyond this distance are clipped. Must exceed Near clip.">Far{input('far')}</label>
  </div>;
}

export default function PortraitToolbar({ model, active, cameraIndex, disabled, allowControlModel = true, controlModel, controlGroups = [], controlModelGroup = 'all', onToggle, onCameraIndex, onSetView, onSnap, onControlModel, onControlModelGroup, frame = 0, sequenceIndex = -1, onSequence, onNew, onMakePortrait, onEdit, onShot, onPause, settings, onSettings, previewChanged, lightingStatus, onCreatePortraitSequence, hasBackground = false, onBackground, backgroundLook, teamColor }) {
  const cameras = model.Cameras || [], camera = cameras[cameraIndex], choices = portraitPreviewSequences(model);
  const missingPortrait = active && !(model.Sequences || []).some(isPortraitSequence);
  // false, 'settings' or 'background': one popover at a time.
  const [open, setOpen] = useState(false), container = useRef(null), [look, setLook] = useState(BACKDROP_LOOK);
  const openBackground = () => { if (open === 'background') { setOpen(false); return; } setLook(normalizeBackdropLook(backgroundLook?.())); setOpen('background'); };
  const placeLabel = hasBackground ? 'Refresh Background' : 'Add Background';
  useDismiss(open, [container], () => setOpen(false), { capture: false, stopEscape: false });
  return <div className="portrait-toolbar" aria-label="Animation view" ref={container}>
    <div className="portrait-view-buttons">
      <button onClick={onToggle}>{active ? 'Full Model View' : 'Portrait Frame View'}</button>
      {active && <button onClick={onSnap}>Snap to Camera</button>}
      {active && allowControlModel && <button disabled={disabled} aria-pressed={controlModel} onClick={onControlModel}>Control Model</button>}
      {active && allowControlModel && controlGroups.length > 1 && <select aria-label="Control Model group" value={controlModelGroup} disabled={disabled} onChange={event => onControlModelGroup(event.target.value)}>
        <option value="all">All</option>{controlGroups.map((group,index) => <option key={group.ids.join(',')} value={index}>Group {index+1}</option>)}
      </select>}
      {missingPortrait && onCreatePortraitSequence && <button className="portrait-missing-link" disabled={disabled} onClick={onCreatePortraitSequence} title="This model has no Portrait animation, so the preview plays Stand. Click to create a Portrait sequence.">No Portrait animation · Create</button>}
    </div>
    <select aria-label="Portrait camera" title="Preview a camera. The first camera is used by the game; use Make Portrait to change it." disabled={!cameras.length} value={camera ? cameraIndex : ''} onChange={event => onCameraIndex(Number(event.target.value))}>
      {!cameras.length && <option value="">No camera</option>}{cameras.map((item,index) => <option key={index} value={index}>{item.Name || 'Camera '+(index+1)}{index === 0 ? ' · Game' : ''}</option>)}
    </select>
    <button disabled={disabled} onClick={onSetView} title="Apply the preview to the selected camera, or create one. This edit can be undone. Save the model to keep it.">Set Current View{active && previewChanged ? ' *' : ''}</button>
    {onBackground && <span className="portrait-backdrop-split">
      <button disabled={disabled || !camera} onClick={() => onBackground()} title={!camera ? 'Add a camera first (Set Current View).' : (hasBackground ? 'Move the portrait background behind the model for the selected camera, keeping its size and height, and show it only in Portrait animations.' : 'Create a Warcraft-style team-color background behind the model for the selected camera, shown only in Portrait animations.') + ' ▾ adjusts its size and height. Uses the saved camera: apply preview changes with Set Current View first. This edit can be undone.'}>{placeLabel}</button>
      <button aria-label="Background options" aria-expanded={open === 'background'} disabled={disabled || !camera} title="Adjust the background size and height before placing it" onClick={openBackground}>▾</button>
    </span>}
    <button aria-label="Portrait settings" aria-expanded={open === 'settings'} title="Camera, animation, lighting and composition controls" onClick={() => setOpen(value => value === 'settings' ? false : 'settings')}>⋯</button>
    {open === 'background' && <div className="portrait-settings portrait-backdrop-options" role="dialog" aria-label="Background options">
      <div className="portrait-settings-heading"><strong>Background</strong><button aria-label="Close background options" onClick={() => setOpen(false)}>×</button></div>
      <div className="portrait-backdrop-body">
        <BackdropPreview look={look} teamColor={teamColor}/>
        <div className="portrait-backdrop-sliders">
          <label title="How far the glow spreads. Spotlight keeps black around the edges of the portrait; Fill covers it with color.">Size<input aria-label="Background size" type="range" min={BACKDROP_SIZE_RANGE[0]} max={BACKDROP_SIZE_RANGE[1]} step=".05" value={look.size} onChange={event => setLook(value => ({ ...value, size: Number(event.target.value) }))}/></label>
          <small className="portrait-backdrop-ends"><span>Spotlight</span><span>Fill</span></small>
          <label title="Move the brightest part of the glow up or down the portrait.">Height<input aria-label="Background height" type="range" min={BACKDROP_HEIGHT_RANGE[0]} max={BACKDROP_HEIGHT_RANGE[1]} step=".05" value={look.height} onChange={event => setLook(value => ({ ...value, height: Number(event.target.value) }))}/></label>
          <small className="portrait-backdrop-ends"><span>Lower</span><span>Higher</span></small>
          <button title="The size and height Blizzard's SD portraits use: the glow fills the whole portrait." onClick={() => setLook(BACKDROP_LOOK)}>Blizzard default</button>
        </div>
      </div>
      <button disabled={disabled || !camera} onClick={() => { onBackground(look); setOpen(false); }}>{placeLabel}</button>
    </div>}
    {open === 'settings' && <div className="portrait-settings" role="dialog" aria-label="Portrait settings">
      <div className="portrait-settings-heading"><strong>Portrait</strong><button aria-label="Close portrait settings" onClick={() => setOpen(false)}>×</button></div>
      <div className="portrait-camera-actions"><button disabled={disabled} onClick={onNew} title="Add a camera framed on the posed head and shoulders. Existing cameras are kept.">New Camera</button><button disabled={disabled || !camera || cameraIndex === 0} onClick={onMakePortrait} title="Move this camera to first place so the game uses it. Other cameras are kept.">Make Portrait</button></div>
      {camera && <>
        <div className="portrait-camera-actions portrait-shot-actions">{[['frame','Frame Subject'],['front','Front'],['level','Level']].map(([kind,label]) => <button key={kind} disabled={disabled} onClick={() => onShot(kind)} title={{frame:'Fit the posed head and shoulders, keeping the viewing direction. Models without a clear head are framed as a whole.',front:'Place the camera in front of the target, looking along the model’s X axis.',level:'Keep the viewing direction around the model and put the camera at the target’s height.'}[kind]}>{label}</button>)}</div>
        <CameraFields view={evaluateModelCamera(model,camera,frame,sequenceIndex)} name={camera.Name || ''} disabled={disabled} onEdit={onEdit} onPause={onPause}/>
      </>}
      <label title="Preview any local animation. Idle prefers Portrait, then Stand. Talk uses Portrait Talk.">Animation<select aria-label="Portrait preview animation" value={sequenceIndex} onChange={event => onSequence(Number(event.target.value))}>{(!active || !(model.Sequences || []).length) && <option value={-1}>All line</option>}{(model.Sequences || []).map((item,index) => <option key={index} value={index}>{item.Name}</option>)}</select></label>
      <div className="portrait-camera-actions"><button disabled={!(choices.idle.length || choices.stand.length)} onClick={() => onSequence(choices.idle[0] ?? choices.stand[0])}>Idle</button><button disabled={!choices.talk.length} onClick={() => onSequence(choices.talk[0])}>Talk</button></div>
      {settings && <>
        <label title="Shade the portrait with the classic Warcraft III portrait light. Turning this off shows textures without lighting."><input type="checkbox" checked={settings.lighting} onChange={event => onSettings({lighting:event.target.checked})}/>Game lighting</label>
        {settings.lighting && <label title="Experimental: approximate the game's DNC portrait light rig from your game data. Not verified against the game; the standard portrait light is used when this is off or unavailable."><input type="checkbox" checked={!!settings.dncLights} onChange={event => onSettings({dncLights:event.target.checked})}/>Experimental DNC lights</label>}
        {settings.lighting && settings.dncLights && lightingStatus && <small role="status">{lightingStatus}</small>}
        <label title="Show the area outside the game crop, with adjustable dimming."><input type="checkbox" checked={settings.composition} onChange={event => onSettings({composition:event.target.checked})}/>Show outside crop</label>
        {settings.composition && <label title="Darken the area outside the game portrait; this does not change the saved camera.">Outside dimming<input aria-label="Outside dimming" type="range" min="0" max="1" step=".05" value={settings.mask} onChange={event => onSettings({mask:Number(event.target.value)})}/></label>}
        <label title="Divide the game crop into thirds to help place the face. Guides are not saved or included in captures."><input type="checkbox" checked={settings.thirds} onChange={event => onSettings({thirds:event.target.checked})}/>Rule of thirds</label>
      </>}
      <small>Game crop: 167 × 170 · Wheel: move nearer/farther · Shift+wheel: lens zoom</small>
      <small role="status">{previewChanged ? 'Preview changed. Set Current View applies it; Snap to Camera discards it.' : 'Camera edits use Undo. Save the model to keep them.'}</small>
    </div>}
  </div>;
}
