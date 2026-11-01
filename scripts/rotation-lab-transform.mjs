// Build-only hooks: product source and the ordinary Vite entry stay byte-for-byte unchanged.
export function transformLabSource(source,id){
  const replace=(from,to)=>{if(source.split(from).length!==2)throw Error(`Rotation Lab hook drifted in ${id}: ${from.slice(0,90)}`);source=source.replace(from,to);};
  if(id.endsWith('/app/App.jsx')){
    source="import {labSessions,LabButtons} from './rotation-lab.jsx';\n"+source;
    replace('useState(newSession)','useState(() => labSessions(newSession)[0])');
    replace('useState(() => [session])','useState(() => labSessions(newSession))');
    replace('[quadView, setQuadView] = useState(false)','[quadView, setQuadView] = useState(true)');
    replace("[tool, setTool] = useState('select')","[tool, setTool] = useState('rotate')");
    replace('[checkedGeosets, setSelectable] = useState(new Set()), [selection, setSelection] = useState({})','[checkedGeosets, setSelectable] = useState(() => session.viewState.selectable), [selection, setSelection] = useState(() => session.viewState.selection)');
    replace('<Viewport onCaptureReady=', '<Viewport rotationLab onCaptureReady=');
    replace('    <main className=', '    <LabButtons doc={doc} edit={edit} refresh={refresh}/>\n    <main className=');
  }
  if(id.endsWith('/app/Viewport.jsx')){
    replace("import { beginRotationDrag, rotationDragDegrees, rotationOptions } from '../src/rotation-drag.js';","import { rotationOptions } from '../src/rotation-drag.js';\nimport {beginRotationDrag,rotationDragDegrees,labEuler,logLabDrag} from './rotation-lab.jsx';");
    replace('controls.enableRotate = !(quad && boundPane.workplane)','controls.enableRotate = !(quad && boundPane.workplane && !latest.current.rotationLab)');
    replace("action === 'pan' || quad && boundPane.workplane && action === 'rotate'","action === 'pan' || quad && boundPane.workplane && !p.rotationLab && action === 'rotate'");
    replace('rotateAsPan: !!(quad && boundPane.workplane)','rotateAsPan: !!(quad && boundPane.workplane && !latest.current.rotationLab)');
    replace('down.rotationDrag = beginRotationDrag({', 'down.rotationDrag = beginRotationDrag({ lab: !!p.rotationLab,');
    const start=source.indexOf('        let angle = rotationDragDegrees(drag.rotationDrag,');
    const end=source.indexOf('\n      }',start);
    if(start<0||end<0)throw Error('Rotation Lab rotation hook drifted');
    const original=source.slice(start,end);
    source=source.slice(0,start)+`        if(drag.rotationDrag.labChoice){
        const axis = [0, 1, 2].find(i => !planeAxes(drag.workplane).includes(i));
        rotation.copy(labEuler(drag.rotationDrag,rawEnd.x-down.x,rawEnd.y-down.y,down.pointerSensitivity,event.shiftKey,camera,axis));
        payload.rotation=[rotation.x,rotation.y,rotation.z].map(THREE.MathUtils.radToDeg);
        } else {${original}
        }`+source.slice(end);
    replace('        if (drag.moved && drag.payload) latest.current.onTransform?.(drag.payload);','        logLabDrag(drag,quad?boundPane.id:"single",camera);\n        if (drag.moved && drag.payload) latest.current.onTransform?.(drag.payload);');
  }
  return source;
}
