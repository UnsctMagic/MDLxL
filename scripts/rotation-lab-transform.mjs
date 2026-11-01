// Lab-only compiler hooks. Ordinary product sources and their Vite entry are untouched.
export function transformLabSource(source,id){
 source=source.replace(/\r\n/g,"\n");
 const replace=(from,to)=>{if(source.split(from).length!==2)throw Error(`Gizmo Lab hook drifted in ${id}: ${from.slice(0,90)}`);source=source.replace(from,to);};
 const block=(from,to,update)=>{const start=source.indexOf(from),end=source.indexOf(to,start+from.length);if(start<0||end<0)throw Error(`Gizmo Lab block drifted in ${id}: ${from}`);source=source.slice(0,start)+update(source.slice(start,end))+source.slice(end);};
 if(id.endsWith('/app/App.jsx')){
  source="import {labSessions,LabButtons} from './rotation-lab.jsx';\n"+source;
  replace('useState(newSession)','useState(() => labSessions(newSession)[0])');
  replace('useState(() => [session])','useState(() => labSessions(newSession))');
  replace('[quadView, setQuadView] = useState(false)','[quadView, setQuadView] = useState(true)');
  replace('[storedWorkplaneEnabled, setStoredWorkplaneEnabled] = useState(true)','[storedWorkplaneEnabled, setStoredWorkplaneEnabled] = useState(false)');
  replace("[tool, setTool] = useState('select')","[tool, setTool] = useState('rotate')");
  replace('[checkedGeosets, setSelectable] = useState(new Set()), [selection, setSelection] = useState({})','[checkedGeosets, setSelectable] = useState(() => session.viewState.selectable), [selection, setSelection] = useState(() => session.viewState.selection)');
  replace('<Viewport onCaptureReady=', '<Viewport rotationLab onCaptureReady=');
  replace('    <main className=', '    <LabButtons doc={doc} edit={edit} refresh={refresh}/>\n    <main className=');
 }
 if(id.endsWith('/app/AppSidebar.jsx'))replace('<WorkplaneControls enabled=',"<WorkplaneControls lab={mode==='vertices'} enabled=");
 if(id.endsWith('/app/EditorControls.jsx')){
  replace('export function WorkplaneControls({ enabled, onEnabled, value, onChange, locked })','export function WorkplaneControls({ enabled, onEnabled, value, onChange, locked, lab = false })');
  replace('<fieldset className="classic-planes"><legend><label>', '<fieldset className="classic-planes"><legend><label title={lab ? "On: Move and Rotate stay locked to the chosen plane. Off: pick the axis or plane with the handles." : undefined}>');
  replace('aria-label="Workplane"','aria-label={lab ? "Workplane Constraints" : "Workplane"}');
  replace('/>Workplane</label>', '/>{lab ? "Workplane Constraints" : "Workplane"}</label>');
 }
 if(id.endsWith('/app/Viewport.jsx')){
  source="import {pickLabHandle,hoverLab,leaveLab,releaseLabPointer,beginLabDrag,sampleLabDrag,moveLabDrag,rotateLabDrag,logLabDrag,drawGizmoLab,disposeGizmoLab} from './gizmo-lab.js';\n"+source;
  replace('controls.enableRotate = !(quad && boundPane.workplane)','controls.enableRotate = !(quad && boundPane.workplane && !latest.current.rotationLab)');
  replace("action === 'pan' || quad && boundPane.workplane && action === 'rotate'","action === 'pan' || quad && boundPane.workplane && !p.rotationLab && action === 'rotate'");
  replace('rotateAsPan: !!(quad && boundPane.workplane)','rotateAsPan: !!(quad && boundPane.workplane && !latest.current.rotationLab)');
  replace('activePane = quad ? panes[1] : singlePane;', 'activePane = quad ? panes[latest.current.rotationLab ? 4 : 1] : singlePane;');
  replace('      if (down) return;',"      if(down && event.button===2 && latest.current.rotationLab){event.preventDefault();event.stopImmediatePropagation();cancelGesture();return;}\n      if (down) return;");
  replace("const gizmoHandle = state.gizmoHandles?.length ? pickMovementHandle(state.gizmoHandles, start.x, start.y, 'move') : null;", "const gizmoHandle = p.rotationLab ? pickLabHandle(state,boundPane,start) : state.gizmoHandles?.length ? pickMovementHandle(state.gizmoHandles, start.x, start.y, 'move') : null;");
  block('      if (quad || p.transformMode', '\n      const active = editableGeosets(p), pivot',original=>`      if(p.rotationLab){if(!['translate','rotate'].includes(p.transformMode)||!p.onTransform||p.normalizer||p.sequenceIndex>=0||p.playing)return null;}else {\n${original}\n      }`);
  replace('const anchor = p.zoomAnchor, anchorEntry', 'const anchor = p.rotationLab ? null : p.zoomAnchor, anchorEntry');
  replace('const anchor = p.zoomAnchor, anchorIndices', "const anchor = p.rotationLab && ['translate','rotate'].includes(down.action) ? null : p.zoomAnchor, anchorIndices");
  replace("if (down.action === 'rotate') {", "if (down.action === 'rotate' && !p.rotationLab) {");
  const dragLine=source.split('\n').find(line=>line.startsWith('      state.drag = { ...down, selections:'));
  replace(dragLine,dragLine+'\n      beginLabDrag(p,state,state.drag,{...start,shift:event.shiftKey},camera,boundPane,quad,gizmoHandle);');
  replace('      hoverParts(move.event); inspectHoveredGeoset(move.event);','      hoverParts(move.event); inspectHoveredGeoset(move.event); hoverLab(latest.current,state,camera,boundPane,move.event,quad);');
  replace('      if (state.drag.rotationDrag) rotationDragDegrees', `      // Swept angle needs every coalesced sample; all geometry stays in transformFrame.\n      if(state.drag.gizmoLab){for(const sample of event.getCoalescedEvents?.()||[])sampleLabDrag(state.drag,point(sample));sampleLabDrag(state.drag,rawEnd);}\n      if (state.drag.rotationDrag) rotationDragDegrees`);
  block("      if (drag.action === 'translate') {", '\n      // Align only pulls',original=>`      if(drag.gizmoLab && drag.action==='translate'){\n        translation.copy(moveLabDrag(drag,end,rawEnd,event.shiftKey,(axis,from,to)=>gizmoTranslation({...from,width:rawEnd.width,height:rawEnd.height},{...to,width:rawEnd.width,height:rawEnd.height},{...drag,handle:drag.gizmoLab.poseHandles.find(h=>h.axis===axis&&!h.plane)}).toArray(),quad));\n        payload.translation=translation.toArray();\n      }else {${original}\n      }`);
  block("      if (drag.action === 'rotate') {", '\n      const constrained=',original=>`      if(drag.gizmoLab && drag.action==='rotate'){\n        const degrees=rotateLabDrag(drag,rawEnd,event.shiftKey);payload.rotation=degrees;rotation.set(...degrees.map(THREE.MathUtils.degToRad));\n      }else {${original}\n      }`);
  replace("      drag.payload = payload; drag.moved = drag.action === 'translate' && quad ? Math.hypot(drag.move.point.x - down.x, drag.move.point.y - down.y) > 1 : Math.hypot(dx, dy) > 1;", "      drag.payload = payload; drag.moved = drag.gizmoLab ? (drag.action==='rotate'?Math.abs(drag.gizmoLab.angle)>1e-8:drag.gizmoLab.distance>1e-8) : drag.action === 'translate' && quad ? Math.hypot(drag.move.point.x - down.x, drag.move.point.y - down.y) > 1 : Math.hypot(dx, dy) > 1;");
  replace('      const { down, rawEnd, end, dx, dy } = move, event = move;', '      const { down, rawEnd, end, dx, dy } = move, event = move; if(drag.gizmoLab)drag.gizmoLab.lastMove=move;');
  replace('    function pointerUp(event) {', '    function pointerUp(event) {\n      if(latest.current.rotationLab)releaseLabPointer(state,boundPane,point(event),event.altKey);');
  replace('        if (drag.moved && drag.payload) latest.current.onTransform?.(drag.payload);', '        logLabDrag(drag);\n        if (drag.moved && drag.payload) latest.current.onTransform?.(drag.payload);');
  replace('      editClicks = 0;\n      partsFrame.cancel();', '      if(state.drag?.gizmoLab){releaseLabPointer(state,boundPane,state.drag.gizmoLab.pointer);logLabDrag(state.drag,true);}\n      editClicks = 0;\n      partsFrame.cancel();');
  replace("      if(event.key==='Shift') {", "      if(event.key==='Shift' && state.drag?.gizmoLab){transformFrame.flush();const last=state.drag.gizmoLab.lastMove;if(last){transformMove={...last,shiftKey:event.type==='keydown'};transformFrame.schedule();}invalidate();return;}\n      if(event.key==='Shift') {");
  block('        const gizmoAt = gizmoPivot(p),', '\n        if(p.detailMagnet',original=>`        if(p.rotationLab)drawGizmoLab(p,state,camera,boundPane,quad,gizmoPivot(p),overlayHost,renderer.getPixelRatio());else {${original}\n        }`);
  replace('    const pointerLeave = () => { if (!down) {', "    const pointerLeave = event => { if(latest.current.rotationLab && !down)leaveLab(state,quad?panes.find(pane=>pane.surface===event.currentTarget):singlePane); if (!down) {");
  replace('    const contextMenu = event => event.preventDefault();', "    const labChanged=()=>{if(latest.current.rotationLab){cancelGesture();invalidate();}};window.addEventListener('mdlxl-gizmo-lab-change',labChanged);\n    const contextMenu = event => event.preventDefault();");
  replace('      state.disposed = true; sketch.dispose();', "      window.removeEventListener('mdlxl-gizmo-lab-change',labChanged);disposeGizmoLab(state);\n      state.disposed = true; sketch.dispose();");
 }
 return source;
}
