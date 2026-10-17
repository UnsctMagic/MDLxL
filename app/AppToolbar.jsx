import React from 'react';
import Addons from './Addons.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
import { Tool, CameraTools } from './EditorControls.jsx';
import { SHAPE_TOOLS } from '../src/shaping.js';
import { COMMANDS } from '../src/commands.js';
import VIEW_MENU from '../src/view-menu.json';
import { TEAM_COLORS } from '../src/team-colors.js';
import { paintMessage } from '../src/paint-messages.js';
import VIS_VIEW_MENU from '../src/vis-view-menu.json';
import QuickDisplay from './QuickDisplay.jsx';
import { QUAD_VIEW_OPTIONS } from './quad-view.js';

const teamColors = TEAM_COLORS.map(row => [row.index === null ? row.name : `${row.index} · ${row.name}`, row.rgbHex]);
export function neutralTextColor(hex) {
  const rgb = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  return luminance > .36 ? '#111111' : '#ffffff';
}
function PressedKeysTool({ active, onClick, icon }) {
  return <button type="button" className="pressed-keys-tool" data-hotkey="pressedKeys" title="Show pressed keys" aria-label="Show pressed keys" aria-pressed={active} onClick={onClick}><img src={icon} alt="" draggable={false}/><span aria-hidden="true"><b>K</b><b>E</b><b>Y</b></span></button>;
}

/** The browser menu, the top toolbar and the module row with the open-model tabs.
 * Every prop is the App value of the same name, so this markup reads exactly as it did inline. */
export default function AppToolbar({
  activateSession, animationPanel, cameraMode, changePreferences, clearDisplay, commandEnabled, commands, copy,
  dialog, displayMode, doc, hiddenCount, hide, inputStrength, menuChecks, mode, model, open, openLibrary,
  openOptimizeXL, openParticles, paste, preferences, pressedKeysIcon, requestCloseSession, resources, rgbPreview,
  rgbSequence, runCommand, runLatest, save, saving, selectAnimationPanel, selectMode, selectionCount, session,
  sessionDirty, sessions, setCameraMode, setDialog, setHidden, setRGBPreview, setRGBSequence, setRenderMode,
  setTeamColor, setVisUI, settingsTab, teamColor, undo, visUI
}) {
  return <>
    {!window.desktop && <nav className="classic-menu">{[['File', [['New', 'new'], ['Open...', 'open'], ['Save', 'save'], ['Save as...', 'saveAs'], ['Recovery...', 'recovery']]], ['Edit', [['Undo', 'undo'], ['Redo', 'redo'], ['Copy', 'copy'], ['Paste', 'paste'], ['Special paste...', 'pasteSpecial'], ['Select all', 'selectAll'], ['Clear selection', 'clear'], ['Undo settings...', 'history'], ['Copy keyframes','keyframe:copy'], ['Copy Frame','keyframe:copyPose'], ['Paste keyframes','keyframe:paste'], ['Delete keyframes','keyframe:delete'], ['Clear keyframes','keyframe:clear']]], ['View', (visUI?VIS_VIEW_MENU:VIEW_MENU)[displayMode] || []], ['Modules', [['Vertices', 'vertices'], ['Bones', 'bones'], ['UV-maps', 'uv'], ['Movement', 'animation'], ['Animations', 'animations']]], ['Shape', SHAPE_TOOLS.map(tool=>[tool,'shape:'+tool.toLowerCase()])], ['Windows', [['Material & Texture Library', 'textureLibrary'], ['Particle Editor', 'particles'], ...resources.map(v => [v, v])]], ['Settings', [['Mouse and general…', 'settings'], ['Keyboard Shortcuts…', 'hotkeys'], ['Graphical settings…', 'graphics'], ['Recording and screenshots…','captureSettings'], ['Appearance…','appearanceSettings'], ['Configuration…','configurationSettings'], ['Grid…','gridSettings'], ['Warcraft III…','gameDataSettings'], null, ['Undo cache…', 'history'], ['Show pressed keys','pressedKeys'], ['Choose Warcraft III folder…','gameData']]], ['Help', [['Help', 'help'], ['Diagnostics', 'diagnostics'], ['About', 'about']]]].map(([name, items]) => <details key={name}><summary>{name}</summary><div role="menu">{items.map((row,index) => { if(!row)return <hr key={index}/>; const [label,action]=row; return <button data-hotkey={action} role={name==='View' && action!=='clearDisplay'?'menuitemcheckbox':'menuitem'} aria-checked={name==='View' && action!=='clearDisplay'?!!menuChecks[action]:undefined} disabled={!commandEnabled(action)} key={action} onClick={event => { event.currentTarget.closest('details').open = false; runLatest.current(action); }}><span>{name==='View'?(menuChecks[action]?'✓ ':'　 '):''}{label}</span>{['frame','frameSelection','normals'].includes(action)&&<kbd>{(preferences.hotkeys[action]||COMMANDS.find(item=>item.id===action)?.defaultKeys||[]).find(key=>key.length===1)||''}</kbd>}</button>;})}</div></details>)}</nav>}
    <div className="classic-toolbar">
      <div className="classic-toolbar-group"><Tool action="new" icon="new-document" title="New" onClick={() => commands.current.new()}/><Tool action="open" icon="sb_open" title="Open" onClick={open}/><Tool action="save" icon="sb_save" title="Save" onClick={() => save()}/></div>
      <CameraTools value={cameraMode} onChange={setCameraMode}/>
      <div className="classic-toolbar-group"><Tool action="undo" icon="sb_undo" title="Undo" disabled={!commandEnabled('undo')} onClick={() => undo(false)}/><Tool action="redo" icon="sb_undo" flip title="Redo" disabled={!commandEnabled('redo')} onClick={() => undo(true)}/><Tool action="copy" icon="sb_copy" title="Copy" disabled={!commandEnabled('copy')} onClick={copy}/><Tool action="paste" icon="sb_paste" title="Paste" disabled={!commandEnabled('paste')} onClick={() => paste()}/></div>
      <div className="classic-toolbar-group toolbar-visibility"><button data-hotkey="hide" onClick={hide} disabled={!selectionCount}>Hide</button><button data-hotkey="show" onClick={() => setHidden({})} disabled={!hiddenCount}>Show</button></div>

      <Addons onCommand={runCommand} isEnabled={id=>!dialog&&!settingsTab&&commandEnabled(id)}/>
      <button data-hotkey="convertVersion" title="Convert between MDX800 and MDX1000; unsupported data blocks conversion" disabled={doc.readOnly||saving} onClick={()=>commands.current.convertVersion()}>MDX{model.Version} ⇄</button>
      <div className="classic-toolbar-group toolbar-team-color"><label className="team-picker"><select data-hotkey="teamColor" aria-label="Team color" value={teamColor} style={{backgroundColor:teamColor,color:neutralTextColor(teamColor)}} onChange={event => { setTeamColor(event.target.value); setRenderMode('textured'); }}>{teamColors.map(([name,color]) => <option key={color} value={color} style={{backgroundColor:color,color:neutralTextColor(color)}}>{name}</option>)}</select></label></div>
      {inputStrength}
      <LanguageSwitch language={preferences.language} onChange={language=>changePreferences(previous=>({...previous,language}))}/>
    </div>
    <div className="classic-modules" role="group" aria-label="Editors and open models">
      <div className="editor-modules" role="group" aria-label="Editor modules">
        <button data-hotkey="vertices" aria-pressed={mode === 'vertices'} onClick={() => selectMode('vertices')}>Vertices</button>
        <button data-hotkey="bones" aria-pressed={mode === 'bones'} onClick={() => commands.current.bones()}>Bones</button>
        <button data-hotkey="animation" aria-pressed={mode === 'animation' && animationPanel === 'movement'} onClick={() => selectAnimationPanel('movement')}>Movement</button>
        <button data-hotkey="animations" aria-pressed={mode === 'animation' && animationPanel === 'animations'} onClick={() => selectAnimationPanel('animations')}>Animations</button>
        <button data-hotkey="paint" aria-pressed={mode === 'paint'} disabled={!commandEnabled('paint')&&mode!=='paint'} onClick={() => commands.current.paint()}>{paintMessage('paint.module')}</button>
        <button aria-pressed={mode === 'showcase'} onClick={() => selectMode('showcase')}>Showcase</button>
        {mode === 'vertices' && <><label className="check"><input type="checkbox" aria-label="RGB Preview" checked={rgbPreview} onChange={event=>{setRGBPreview(event.target.checked);if(rgbSequence<0 && model.Sequences.length)setRGBSequence(0);}}/>RGB Preview</label><select aria-label="RGB preview animation" disabled={!rgbPreview} value={rgbSequence} onChange={event=>setRGBSequence(Number(event.target.value))}><option value={-1}>Static RGB</option>{model.Sequences.map((item,index)=><option key={index} value={index}>{item.Name}</option>)}</select></>}
        {mode !== 'uv' && mode !== 'paint' && mode !== 'showcase' && <QuickDisplay vanilla={visUI} viewMode={displayMode} checks={menuChecks} onCommand={runCommand} isEnabled={commandEnabled} onClear={clearDisplay}/>}
      </div>
      <div className="module-divider" aria-hidden="true"/>
      <div className="model-tabs" role="tablist" aria-label="Open models">{sessions.map(item => <div className={`model-tab${item === session ? ' active' : ''}`} key={item.id}><button type="button" role="tab" aria-selected={item === session} title={item.path || item.doc.name} onClick={() => activateSession(item)}><span className="model-tab-dirty" aria-hidden="true">{sessionDirty(item) ? '●' : ''}</span><span>{item.doc.name}</span></button><button type="button" className="model-tab-close" aria-label={`Close ${item.doc.name}`} title={`Close ${item.doc.name}`} onClick={event=>{event.stopPropagation();requestCloseSession(item);}}>×</button></div>)}</div>
      <div className="classic-toolbar-group toolbar-modules"><Tool action="textureLibrary" className="library-tool" icon="wc3-library" badge="LIBR" title="Material and Texture Library" onClick={() => openLibrary()}/><Tool action="forge" className="forge-tool" icon="wc3-forge.gif" badge="FRG" title="Forge" disabled={doc.readOnly||saving} onClick={()=>setDialog({type:'forge'})}/><Tool action="bitsAndParts" className="bits-tool" icon="wc3-bits-and-parts" badge="BITZ" title="BitsAndParts / Clockwork" disabled={doc.readOnly||saving} onClick={()=>setDialog({type:'bitsAndParts'})}/><Tool action="optimizeModel" className="optimizer-tool" icon="wc3-gather-gold" badge="OPXL" title="OptimizeXL" disabled={!commandEnabled('optimizeModel')} onClick={openOptimizeXL}/><Tool action="particles" className="emitter-tool" icon="btn-mana-flare" badge={<><b>E</b><b>M</b><b>T</b><b>R</b></>} title="Emitter Editor" disabled={!commandEnabled('particles')} onClick={event=>openParticles(undefined,event.currentTarget)}/><PressedKeysTool icon={pressedKeysIcon} active={preferences.showPressedKeys} onClick={()=>commands.current.pressedKeys()}/><Tool className="vis-toggle" icon={visUI ? 'wc3-xl' : 'wc3-vis'} badge={visUI ? 'XL' : 'VIS'} title={visUI ? 'XL' : 'VIS'} active={visUI} onClick={() => setVisUI(value => !value)}/></div>
    </div>
  </>;
}

/** The view direction / render mode row above the editor viewport. Props as for AppToolbar. */
export function AppViewLabel({
  activeVertexPane, cameraPortraitActive, cleanAnimationPreview, frame, mode, portraitView, quadView, renderMode,
  setCleanViews, setPortraitView, setRenderMode, setView, toggleQuadView, view, views
}) {
  return <>
      {mode !== 'uv' && mode !== 'paint' && mode !== 'showcase' && <div className="classic-view-label"><select data-hotkey="viewDirection" aria-label="View direction" value={cameraPortraitActive ? portraitView : mode === 'vertices' && quadView ? activeVertexPane?.view || 'front' : view} onChange={event => cameraPortraitActive ? setPortraitView(event.target.value) : setView(event.target.value)}>{(mode === 'vertices' && quadView ? QUAD_VIEW_OPTIONS : views.map(name => [name, name[0].toUpperCase() + name.slice(1)])).map(([name, label]) => <option key={name} value={name}>{label}</option>)}</select>{!cleanAnimationPreview && <select aria-label="Render mode" value={renderMode} onChange={event=>{setRenderMode(event.target.value);setCleanViews(previous=>({...previous,[mode]:false}));}}><option value="wireframe">Wireframe</option><option value="solid">Surface</option><option value="textured">Textured View</option></select>}{mode === 'vertices' && <button aria-pressed={quadView} onClick={toggleQuadView}>Quad View</button>}<button data-hotkey="fit" title="Fit model" onClick={()=>frame(false)}>Fit</button><button data-hotkey="fitSelection" title="Fit selection" onClick={()=>frame(true)}>Fit selection</button></div>}
  </>;
}
