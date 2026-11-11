import React, { useSyncExternalStore, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tool } from './EditorControls.jsx';
import useDismiss from './useDismiss.js';
import { parseDraftNumber, useDraftNumber } from './Fields.jsx';
import { sketchStore } from '../src/ai-sketch.js';
import { SHAPE_TOOLS } from '../src/shaping.js';
import { COMMANDS } from '../src/commands.js';
import VIEW_MENU from '../src/view-menu.json';
import { TEAM_COLORS } from '../src/team-colors.js';
import { paintMessage } from '../src/paint-messages.js';
import QuickDisplay from './QuickDisplay.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
import { LANGUAGES, translate } from '../src/localization.js';
import { TOOLBAR_MODES, TOOLBAR_MODE_LABELS } from '../src/toolbar-mode.js';
import { setToolbarTabStops } from './toolbar-tab-order.js';
import { QUAD_VIEW_OPTIONS } from './quad-view.js';

const teamColors = TEAM_COLORS.map(row => [row.index === null ? row.name : `${row.index} · ${row.name}`, row.rgbHex]);
function neutralTextColor(hex) {
  const rgb = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  return luminance > .36 ? '#111111' : '#ffffff';
}
function PressedKeysTool({ active, onClick, icon }) {
  return <button type="button" className="pressed-keys-tool" data-hotkey="pressedKeys" title="Show pressed keys" aria-label="Show pressed keys" aria-pressed={active} onClick={onClick}><img src={icon} alt="" draggable={false}/><span aria-hidden="true"><b>K</b><b>E</b><b>Y</b></span></button>;
}

/** The browser menu, the top toolbar and the editor row.
 * Every prop is the App value of the same name, so this markup reads exactly as it did inline. */
export default function AppToolbar({
  animationPanel, changePreferences, clearDisplay, commandEnabled, commands,
  dialog, displayMode, doc, inputStrength, menuChecks, mode, model, openLibrary,
  openOptimizeXL, openParticles, preferences, pressedKeysIcon, resources,
  runCommand, runLatest, saving, selectAnimationPanel, selectMode,
  setDialog, setRenderMode,
  setTeamColor, setVisUI, settingsTab, setSettingsTab, teamColor, visUI, aiControl, placeCorpse, onHiddenTeamColor
}) {
  const editorRow = useRef(null), toolbarHidden = preferences.toolbarMode === 'hidden' && !visUI;
  useLayoutEffect(() => {
    if (!toolbarHidden) return undefined;
    const roots = [dock.current.closest('.classic-toolbar'), editorRow.current.closest('.classic-modules')], apply = () => roots.forEach(root => setToolbarTabStops(root, true));
    apply();
    // Buttons come and go with the active editor.
    const observer = new MutationObserver(apply);
    roots.forEach(root => observer.observe(root, { childList: true, subtree: true }));
    return () => { observer.disconnect(); roots.forEach(root => setToolbarTabStops(root, false)); };
  }, [toolbarHidden]);
  const dock = useRef(null), [learnOpen, setLearnOpen] = useState(false), [learnPosition, setLearnPosition] = useState({});
  useLayoutEffect(() => {
    if (!learnOpen) return;
    const position = () => {
      const rect = dock.current.querySelector('.learner-tool').getBoundingClientRect();
      setLearnPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [learnOpen, visUI]);
  useEffect(() => { if (learnOpen) dock.current.querySelector('.learn-menu')?.focus({ preventScroll: true }); }, [learnOpen]);
  useDismiss(learnOpen, [() => dock.current?.querySelector('.learner-tool'), () => dock.current?.querySelector('.learn-menu')], () => setLearnOpen(false), {claimEscape:true, escapePriority:-20});
  const [emtrMenu, setEmtrMenu] = useState(null);
  const emtrTrigger = useRef(null), emtrPopup = useRef(null);
  useEffect(() => { if (emtrMenu) emtrPopup.current?.focus({ preventScroll: true }); }, [emtrMenu]);
  useDismiss(!!emtrMenu, [emtrPopup], event => {
    setEmtrMenu(null);
    if (event.key === 'Escape') emtrTrigger.current?.focus();
  }, { claimEscape: true, escapePriority: -20 });
  const openEmtrMenu = event => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setEmtrMenu({ left: Math.max(0, Math.min(rect.left, window.innerWidth - 156)), top: Math.min(rect.bottom + 4, window.innerHeight - 96) });
  };
  const chooseEmtrOption = action => {
    setEmtrMenu(null);
    emtrTrigger.current?.focus();
    if (action === 'manager') setDialog({ type: 'resource', kind: 'Nodes', emittersOnly: true });
    else openParticles(undefined, action);
  };
  useLayoutEffect(() => {
    const row = editorRow.current;
    row.removeAttribute('data-short-editors');
    if (visUI) return;
    const measure = () => {
      row.removeAttribute('data-short-editors');
      if (row.scrollWidth > row.clientWidth) row.setAttribute('data-short-editors', '');
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [mode, animationPanel, visUI, preferences.language]);
  // Trim draws the row's buttons at another width, which the observer above cannot see.
  useLayoutEffect(() => {
    const row = editorRow.current;
    row.removeAttribute('data-short-editors');
    if (!visUI && row.scrollWidth > row.clientWidth) row.setAttribute('data-short-editors', '');
  }, [preferences.toolbarMode]);
  // Both looks keep view controls beside the editor buttons.
  const quickDisplay = mode !== 'uv' && mode !== 'paint' && mode !== 'showcase' && mode !== 'manager' && <QuickDisplay key={displayMode} vanilla={visUI} viewMode={displayMode} checks={menuChecks} onCommand={runCommand} isEnabled={commandEnabled} onClear={clearDisplay}/>;
  // With the toolbar hidden this select cannot be seen, so its key searches for a colour instead of taking the keyboard.
  const teamPicker = <div className="classic-toolbar-group toolbar-team-color"><label className="team-picker" style={{'--team':teamColor}}><select data-hotkey="teamColor" aria-label="Team color" value={teamColor} style={{backgroundColor:teamColor,color:neutralTextColor(teamColor)}} onChange={event => { setTeamColor(event.target.value); setRenderMode('textured'); }} onFocus={event => { if (preferences.toolbarMode === 'hidden' && !visUI) { event.currentTarget.blur(); onHiddenTeamColor(); } }}>{teamColors.map(([name,color]) => <option key={color} value={color} style={{backgroundColor:color,color:neutralTextColor(color)}}>{name}</option>)}</select></label></div>;
  const moduleDock = <div className="classic-toolbar-group toolbar-modules" ref={dock}>{aiControl}<Tool action="textureLibrary" className="library-tool" icon="wc3-library" badge="LIBR" title="Material and Texture Library" onClick={() => openLibrary(undefined, true)}/><Tool action="forge" className="forge-tool" icon="wc3-forge.gif" badge="FRG" title="Forge" disabled={doc.readOnly||saving} onClick={()=>setDialog({type:'forge'})}/><Tool action="bitsAndParts" className="bits-tool" icon="wc3-bits-and-parts" badge="BITZ" title="BitsAndParts / Clockwork" disabled={doc.readOnly||saving} onClick={()=>setDialog({type:'bitsAndParts'})}/><Tool action="optimizeModel" className="optimizer-tool" icon="wc3-gather-gold" badge="OPXL" title="OptimizeXL" disabled={!commandEnabled('optimizeModel')} onClick={openOptimizeXL}/><Tool action="particles" className="emitter-tool" icon="btn-mana-flare" badge={<><b>E</b><b>M</b><b>T</b><b>R</b></>} title="Emitter Editor" description="Emitter Editor. Right-click for Glow Up, EMTR Library, and Manager." disabled={!commandEnabled('particles')} ref={emtrTrigger} aria-haspopup="menu" aria-expanded={!!emtrMenu} onContextMenu={openEmtrMenu} onClick={()=>{setEmtrMenu(null);openParticles();}}/><Tool action="surfaceEffects" className="surface-effects-tool" icon="btn-magical-sentry" badge="FX" title="Surface Effects" disabled={!commandEnabled('surfaceEffects')} onClick={()=>runCommand('surfaceEffects')}/><Tool action="animXL" className="animxl-tool" icon="btn-animate-dead" badge="ANIM" title="AnimXL: shape an animation with sliders" disabled={!commandEnabled('animXL')} onClick={()=>setDialog({type:'animXL'})}/><Tool className="auto-corpse-tool" icon="btn-exhume-corpses" badge="CORP" title="Auto Corpse (test)" description="Preview a corpse fitted under the last Death frame, adjust its Size and Height, then create it with flesh and bone decay. Undo restores the model." disabled={doc.readOnly||saving||!!dialog||!!settingsTab||mode==='paint'||mode==='showcase'} onClick={placeCorpse}/><PressedKeysTool icon={pressedKeysIcon} active={preferences.showPressedKeys} onClick={()=>commands.current.pressedKeys()}/><Tool action="learn" className="learner-tool" icon="btn-ancient-of-lore" badge="LER" title="Learn" description="Learn: open learning controls and settings." onContextMenu={event => { event.preventDefault(); setLearnOpen(value => !value); }} active={preferences.learn.enabled} onClick={event => { if (event.isTrusted) setLearnOpen(value => !value); else commands.current.learn(); }}/>{learnOpen && <div className="learn-menu" role="menu" aria-label="Learn" tabIndex={-1} data-hotkey-window="" data-hotkey-scope="editor" data-hotkey-prefix="learn-menu" style={learnPosition}><button role="menuitemcheckbox" aria-checked={preferences.learn.enabled} data-hotkey="mode" data-hotkey-label="Learn mode" onClick={() => commands.current.learn()}><span aria-hidden="true">{preferences.learn.enabled ? '✓' : ''}</span>Learn mode</button><button role="menuitemcheckbox" aria-checked={preferences.showHotkeys} data-hotkey="show-hotkeys" data-hotkey-label="Show hotkeys" onClick={() => changePreferences(previous => ({ ...previous, showHotkeys: !previous.showHotkeys }))}><span aria-hidden="true">{preferences.showHotkeys ? '✓' : ''}</span>Show hotkeys</button>{mode === 'paint' && <button role="menuitemcheckbox" aria-checked={preferences.paintKeyLabels} data-hotkey="paint-key-labels" data-hotkey-label="Paint key labels" onClick={() => changePreferences(previous => ({ ...previous, paintKeyLabels: !previous.paintKeyLabels }))}><span aria-hidden="true">{preferences.paintKeyLabels ? '✓' : ''}</span>Paint key labels</button>}<button role="menuitem" data-hotkey="settings" data-hotkey-label="Learn settings" onClick={() => { setLearnOpen(false); setSettingsTab('learn'); }}><span aria-hidden="true"/>Learn settings…</button></div>}<Tool className="vis-toggle" icon={visUI ? 'wc3-xl' : 'wc3-vis'} badge={visUI ? 'XL' : 'VIS'} title={visUI ? 'XL' : 'VIS'} active={visUI} onClick={() => setVisUI(value => !value)}/></div>;
  const settingChecks = Object.fromEntries([...TOOLBAR_MODES.map(value => ['toolbar:' + value, preferences.toolbarMode === value]), ...LANGUAGES.map(item => ['language:' + item.id, preferences.language === item.id]), ['visToggle', visUI], ['showHotkeys', preferences.showHotkeys]]);
  return <>
    {!window.desktop && <nav className="classic-menu">{[['File', [['New', 'new'], ['Open...', 'open'], ['Save', 'save'], ['Save as...', 'saveAs'], ['Convert MDX800 / MDX1000', 'convertVersion'], ['Recovery...', 'recovery']]], ['Edit', [['Undo', 'undo'], ['Redo', 'redo'], ['Copy', 'copy'], ['Paste', 'paste'], ['Special paste...', 'pasteSpecial'], ['Select all', 'selectAll'], ['Clear selection', 'clear'], ['Undo settings...', 'history'], ['Copy keyframes','keyframe:copy'], ['Copy Frame','keyframe:copyPose'], ['Paste keyframes','keyframe:paste'], ['Delete keyframes','keyframe:delete'], ['Clear keyframes','keyframe:clear']]], ['View', VIEW_MENU[displayMode] || []], ['Modules', [['Vertices', 'vertices'], ['Bones', 'bones'], ['UV-maps', 'uv'], ['Movement', 'animation'], ['Animations', 'animations'], ['Citadel Paint', 'paint'], ['Managers', 'managers'], ['Showcase', 'showcase'], ['Forge…', 'forge'], ['BitsAndParts…', 'bitsAndParts'], ['OptimizeXL…', 'optimizeModel'], ['Auto Corpse…', 'autoCorpse'], ['AI console', 'ai:open']]], ['Shape', SHAPE_TOOLS.map(tool=>[tool,'shape:'+tool.toLowerCase()])], ['Managers', [['Material & Texture Library', 'textureLibrary'], ['Particle Editor', 'particles'], ['Surface Effects','surfaceEffects'], ['AnimXL', 'animXL'], ...resources.map(v => [v, v])]], ['Settings', [['Mouse and general…', 'settings'], ['Keyboard Shortcuts…', 'hotkeys'], ['Graphical settings…', 'graphics'], ['Recording and screenshots…','captureSettings'], ['Appearance…','appearanceSettings'], ['Configuration…','configurationSettings'], ['Grid…','gridSettings'], ['Warcraft III…','gameDataSettings'], ['Add-ons…','addons'], null, ...TOOLBAR_MODES.map(value => [`Toolbar: ${translate(TOOLBAR_MODE_LABELS[value])}`, 'toolbar:' + value]), ...LANGUAGES.map(item => [item.nativeLabel, 'language:' + item.id]), ['VIS look','visToggle'], null, ['Undo cache…', 'history'], ['Show pressed keys','pressedKeys'], ['Show hotkeys','showHotkeys'], ['Learn settings…','learnSettings'], ['Choose Warcraft III folder…','gameData']]], ['Help', [['Search commands…','launcher'], ['Help', 'help'], ['Sanity Check', 'sanityCheck'], ['About', 'about']]]].map(([name, items]) => <details key={name}><summary>{name}</summary><div role="menu">{items.map((row,index) => { if(!row)return <hr key={index}/>; const [label,action]=row, checked=name==='View'?menuChecks[action]:settingChecks[action], checkable=name==='View'?action!=='clearDisplay':action in settingChecks; return <button data-hotkey={/^(toolbar|language|ai):|^(showHotkeys|learnSettings)$/.test(action)?undefined:action} role={checkable?'menuitemcheckbox':'menuitem'} aria-checked={checkable?!!checked:undefined} disabled={!commandEnabled(action)} key={action} onClick={event => { event.currentTarget.closest('details').open = false; runLatest.current(action); }}><span>{name==='View'||checkable?(checked?'✓ ':'　 '):''}{label}</span>{['frame','frameSelection','normals'].includes(action)&&<kbd>{(preferences.hotkeys[action]||COMMANDS.find(item=>item.id===action)?.defaultKeys||[]).find(key=>key.length===1)||''}</kbd>}</button>;})}</div></details>)}</nav>}
    <div className="classic-toolbar">
      <div className="toolbar-primary">
      <div className="classic-toolbar-group"><Tool action="save" look icon="sb_save" title="Save" onClick={() => runLatest.current('save')}/></div>
      {!visUI && <div className="toolbar-model"><LanguageSwitch language={preferences.language} onChange={language => changePreferences(previous => ({ ...previous, language }))}/>{teamPicker}<Tool className="smooth-edges-toggle" title={translate(preferences.graphics.antialias ? 'Smooth' : 'Classic MDLVis')} description={translate('Smooth edges: switch between Smooth and Classic MDLVis. Bones and lines stay sharp.')} active={preferences.graphics.antialias} onClick={() => changePreferences(previous => ({ ...previous, graphics: { ...previous.graphics, antialias: !previous.graphics.antialias } }))}><span aria-hidden="true">{preferences.graphics.antialias ? '◒' : '▧'}</span></Tool><button data-hotkey="convertVersion" title="Convert between MDX800 and MDX1000; unsupported data blocks conversion" disabled={doc.readOnly||saving} onClick={()=>commands.current.convertVersion()}>MDX{model.Version} ⇄</button>{inputStrength}</div>}
      {visUI && teamPicker}
      {visUI && inputStrength}
      </div>
      {moduleDock}
    </div>
    {emtrMenu && <div ref={emtrPopup} className="classic-context" role="menu" aria-label="EMTR" tabIndex={-1} style={{ position: 'fixed', width: 146, ...emtrMenu }}>
      <button type="button" role="menuitem" disabled={doc.readOnly} onClick={() => chooseEmtrOption('glow')}>Glow Up</button>
      <button type="button" role="menuitem" onClick={() => chooseEmtrOption('library')}>EMTR Library</button>
      <button type="button" role="menuitem" onClick={() => chooseEmtrOption('manager')}>Manager</button>
    </div>}
    <div className="classic-modules" role="group" aria-label="Editors">
      <div className="editor-modules" ref={editorRow} role="group" aria-label="Editor modules">
        <button data-hotkey="vertices" aria-pressed={mode === 'vertices'} onClick={() => selectMode('vertices')} title="Vertices" aria-label="Vertices"><span className="editor-name">Vertices</span><span className="editor-initial" aria-hidden="true">V</span></button>
        <button data-hotkey="bones" aria-pressed={mode === 'bones'} onClick={() => commands.current.bones()} title="Bones" aria-label="Bones"><span className="editor-name">Bones</span><span className="editor-initial" aria-hidden="true">B</span></button>
        <button data-hotkey="animation" aria-pressed={mode === 'animation' && animationPanel === 'movement'} onClick={() => selectAnimationPanel('movement')} title="Movement" aria-label="Movement"><span className="editor-name">Movement</span><span className="editor-initial" aria-hidden="true">M</span></button>
        <button data-hotkey="animations" aria-pressed={mode === 'animation' && animationPanel === 'animations'} onClick={() => selectAnimationPanel('animations')} title="Animations" aria-label="Animations"><span className="editor-name">Animations</span><span className="editor-initial" aria-hidden="true">A</span></button>
        <button aria-pressed={mode === 'manager'} onClick={() => selectMode('manager')} title="Open the managers at Materials" aria-label="Managers"><span className="editor-name">Managers</span><span className="editor-initial" aria-hidden="true">G</span></button>
        <button data-hotkey="paint" aria-pressed={mode === 'paint'} disabled={!commandEnabled('paint')&&mode!=='paint'} onClick={() => commands.current.paint()} title={paintMessage('paint.module')} aria-label={paintMessage('paint.module')}><span className="editor-name">{paintMessage('paint.module')}</span><span className="editor-initial" aria-hidden="true">{paintMessage('paint.module').slice(0, 1)}</span></button>
        <button aria-pressed={mode === 'showcase'} onClick={() => selectMode('showcase')} title="Showcase" aria-label="Showcase"><span className="editor-name">Showcase</span><span className="editor-initial" aria-hidden="true">S</span></button>
        {quickDisplay}
      </div>
    </div>
  </>;
}

/** What the status row keeps of a hidden toolbar: the model format, the active editor, and DPI / Scroll only while they change. */
export function ToolbarHiddenStatus({ adjustingInput, animationPanel, commands, doc, mode, model, preferences, saving }) {
  const { pointerSensitivity: pointer, scrollSensitivity: scroll } = preferences;
  const [changed, setChanged] = useState(null), seen = useRef({ pointer, scroll });
  useEffect(() => {
    const kind = pointer !== seen.current.pointer ? 'pointer' : scroll !== seen.current.scroll ? 'scroll' : null;
    seen.current = { pointer, scroll };
    if (!kind) return;
    setChanged(kind);
    const timer = setTimeout(() => setChanged(null), 1500);
    return () => clearTimeout(timer);
  }, [pointer, scroll]);
  const adjusting = adjustingInput?.kind || changed;
  const editor = mode === 'animation' ? (animationPanel === 'movement' ? 'Movement' : 'Animations') : mode === 'paint' ? paintMessage('paint.module') : { vertices: 'Vertices', bones: 'Bones', uv: 'UV-maps', manager: 'Managers', showcase: 'Showcase' }[mode];
  return <div className="toolbar-hidden-status">
    {adjusting && <span role="status" className="toolbar-hidden-input">{adjusting === 'pointer' ? `DPI ${pointer}×` : `Scroll ${scroll}×`}</span>}
    <span className="toolbar-hidden-editor">{editor}</span>
    <button type="button" title="Convert between MDX800 and MDX1000; unsupported data blocks conversion" disabled={doc.readOnly || saving} onClick={() => commands.current.convertVersion()}>MDX{model.Version} ⇄</button>
  </div>;
}

import { BONE_INFLUENCE_TIP } from './bone-display.js';
export { BONE_INFLUENCE_TIP };

function VertexAnimationFrame({ frame, interval, onFrame, onClose }) {
  const input = useRef(null);
  const [start, end] = interval;
  const parse = text => {
    const value = Math.round(parseDraftNumber(text));
    return value >= start && value <= end ? value : undefined;
  };
  const field = useDraftNumber({ value: frame, parse, onCommit: onFrame });
  useLayoutEffect(() => { input.current.focus({ preventScroll: true }); input.current.select(); }, []);
  return <label className="vertex-animation-frame">
    <span>Frame</span>
    <input ref={input} type="text" inputMode="numeric" title={`${start}–${end}`} value={field.value} onChange={field.onChange} onKeyDown={event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (parse(event.currentTarget.value) === undefined) return;
      field.onKeyDown(event);
      onClose();
    }}/>
  </label>;
}

function VertexAnimationControl({ sequences, index, frame, active, disabled, onToggle, onChoose, onFrame }) {
  const control = useRef(null), button = useRef(null);
  const [showFrame, setShowFrame] = useState(false);
  const open = showFrame && !disabled;
  const closeFrame = () => { setShowFrame(false); button.current?.focus({ preventScroll: true }); };
  useDismiss(open, [control], event => {
    if (event.type === 'keydown') closeFrame();
    else setShowFrame(false);
  }, { claimEscape: true, escapePriority: -20 });
  const label = translate('Choose animation');
  const name = sequences[index]?.Name;
  return <span ref={control} className="vertex-animation-control">
    <button ref={button} type="button" data-hotkey="vertexAnimated" title="Preview the selected frame while editing the base pose. Right-click to choose a frame." aria-pressed={active} disabled={disabled}
      onClick={() => { setShowFrame(false); onToggle(); }}
      onContextMenu={event => { event.preventDefault(); if (open) closeFrame(); else setShowFrame(true); }}>Animated</button>
    <label className="vertex-animation-picker">
      <span aria-hidden="true">▾</span>
      <select aria-label="Choose animation" title={name ? label + ' · ' + name : label} value={index} disabled={disabled} onChange={event => { setShowFrame(false); onChoose(Number(event.target.value)); }}>
        {sequences.map((sequence, i) => <option key={i} value={i} translate="no">{sequence.Name}</option>)}
      </select>
    </label>
    {open && <VertexAnimationFrame frame={frame} interval={sequences[index].Interval} onFrame={onFrame} onClose={closeFrame}/>}
  </span>;
}

/** The view direction / render mode row above the editor viewport. Props as for AppToolbar. */
export function AppViewLabel({
  activeVertexPane, boneInfluenceAvailable, cameraPortraitActive, cleanAnimationPreview, frame, mode, portraitView, quadView, renderMode,
  setCleanViews, setPortraitView, setRenderMode, setView, toggleQuadView, vertexAnimation, view, views
}) {
  // The one sign on the viewport that left-dragging draws for the AI rather than editing.
  const drawingTool = useSyncExternalStore(sketchStore.subscribe, sketchStore.get, sketchStore.get).tool;
  return <>
      {mode !== 'uv' && mode !== 'paint' && mode !== 'showcase' && mode !== 'manager' && <div className="classic-view-label"><select data-hotkey="viewDirection" aria-label="View direction" value={cameraPortraitActive ? portraitView : mode === 'vertices' && quadView ? activeVertexPane?.view || 'front' : view} onChange={event => cameraPortraitActive ? setPortraitView(event.target.value) : setView(event.target.value)}>{(mode === 'vertices' && quadView ? QUAD_VIEW_OPTIONS : views.map(name => [name, name[0].toUpperCase() + name.slice(1)])).map(([name, label]) => <option key={name} value={name}>{label}</option>)}</select>{!cleanAnimationPreview && <select aria-label="Render mode" title={renderMode === 'influence' ? BONE_INFLUENCE_TIP : undefined} value={renderMode} onChange={event=>{setRenderMode(event.target.value);setCleanViews(previous=>({...previous,[mode]:false}));}}><option value="wireframe">Wireframe</option><option value="solid">Surface</option><option value="textured">Textured View</option>{boneInfluenceAvailable && <option value="influence" title={BONE_INFLUENCE_TIP}>Bone influence</option>}</select>}{mode === 'vertices' && <button aria-pressed={quadView} onClick={toggleQuadView}>Quad View</button>}<button data-hotkey="fit" title="Fit model" onClick={()=>frame(false)}>Fit</button><button data-hotkey="fitSelection" title="Fit selection" onClick={()=>frame(true)}>Fit selection</button>{vertexAnimation && <VertexAnimationControl {...vertexAnimation}/>}{mode === 'vertices' && drawingTool && <button className="ai-drawing-tag" title="Left-dragging on the model draws for the AI instead of editing it. Click, press Esc or pick an editor tool to stop." onClick={() => sketchStore.clearTool()}>{{ marker: 'Marker', pen: 'Pen', eraser: 'Eraser' }[drawingTool]}: drawing for the AI ✕</button>}</div>}
  </>;
}
