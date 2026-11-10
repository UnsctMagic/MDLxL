import { poseBodyDriverMotion } from './pose-body-drivers.js';

const mass = shape => shape?.mass || 0;
const unique = values => [...new Set(values)];
const endpoint = limb => limb.ids.at(-1);

/** Locate trunk attachment stations before appendage hypotheses compete.
 * Surface centers locate the body even when its imported pivots sit at the
 * waist; native ancestry supplies the relation between those regions.
 */
export function poseTorsoStations({ tree, children, parent, junctions, geometry, pivot, jointSurface, heads }) {
  const roles = new Map(), evidence = new Map(), departures = new Map();
  for (const id of new Set([...junctions, ...[...junctions].flatMap(node=>tree.ancestors(node))])) {
    const roots=(children.get(id)||[]).filter(child=>(children.get(child)||[]).length && !heads.some(head=>tree.isAncestor(head.id,child)));
    const point=roots.length?roots.reduce((sum,root)=>sum.add(pivot(root)),pivot(id).multiplyScalar(0)).multiplyScalar(1/roots.length):pivot(id);
    departures.set(id,{point,roots});
  }
  const upright = delta => (delta.z-Math.hypot(delta.x,delta.y))/Math.max(delta.length(),1e-5);
  for (const origin of junctions) {
    const station=jointSurface(origin),native=departures.get(origin).point;
    const localHeads=heads.filter(head=>tree.isAncestor(head.id,origin)&&![...junctions].some(other=>other!==origin&&other!==head.id&&tree.isAncestor(other,origin)&&tree.isAncestor(head.id,other)));
    const descendantHeads=heads.filter(head=>tree.isAncestor(head.id,origin));
    const headVote=localHeads.length?Math.max(...localHeads.map(head=>{const delta=(head.shape?.center||pivot(head.id)).clone().sub(pivot(origin));return upright(delta);})):descendantHeads.length?-2:0;
    let best=-Infinity,bestEvidence=null;
    const siblings=[...junctions].filter(id=>id!==origin&&parent.get(id)===parent.get(origin));
    const stations=siblings.length?siblings:[...junctions,...tree.ancestors(origin),...(children.get(parent.get(origin))||[])];
    for(const other of new Set(stations)){
      if(other===origin||tree.root(other)!==tree.root(origin))continue;
      if(!tree.isAncestor(other,origin)&&!tree.isAncestor(origin,other)&&parent.get(other)!==parent.get(origin))continue;
      const shape=jointSurface(other),departure=departures.get(other);
      if(!mass(shape)&&!departure?.roots.length)continue;
      const skeleton=upright(native.clone().sub(departure?.point||pivot(other)));
      const surface=station?.center&&shape?.center?upright(station.center.clone().sub(shape.center)):0;
      const score=skeleton+surface+headVote;
      if(score>best){best=score;bestEvidence={other,skeleton,surface,head:headVote,score};}
    }
    roles.set(origin,best>0?'Chest':'Pelvis');evidence.set(origin,bestEvidence||{score:0,head:headVote});
  }
  return {roles,evidence};
}

/** Group body assemblies and retain their chest/pelvis ownership separately.
 * A front and rear pair standing on the same ground belong to one body even
 * when only the front half carries a head. An elevated rider can retain a body
 * of its own. Long tails also contribute to the complete body's ancestry.
 */
export function inferPoseTorso({ model, tree, joints, children, parent, geometry, pivot, jointSurface, heads, limbs, tails = [], nameRole }) {
  const parts = [...limbs, ...tails], candidates = [], roles = {}, controls = new Set();
  const below = (id, root) => tree.isAncestor(id, root);
  const ownLimbs = id => limbs.filter(limb => below(limb.ids[0], id));
  const ownHeads = id => heads.filter(head => below(head.id, id));
  const endsHeight = list => {
    const legs = list.filter(limb => limb.kind === 'leg' && !limb.label);
    return Math.min(...(legs.length ? legs : list).map(limb => pivot(endpoint(limb)).z));
  };
  for (const id of joints) {
    const own = ownLimbs(id), skulls = ownHeads(id), pieces = parts.filter(part => below(part.ids[0], id));
    const branches = (children.get(id) || []).filter(child => pieces.some(part => below(part.ids[0], child)) || skulls.some(head => below(head.id, child)));
    const skinBranches = (geometry.children.get(id) || []).filter(child => mass(geometry.subtree.get(child.ObjectId)) > 0);
    // An independently weighted robe or belly still belongs to the complete
    // body, even when every limb and head hangs from its single spine child.
    const completeSkin = own.length && branches.length && (skinBranches.length > 1 || mass(geometry.profiles.get(id)) > 0);
    if (own.length && branches.length >= 2 || completeSkin || pieces.some(part => tails.includes(part)) && skulls.length && branches.length >= 2) candidates.push({ id, heads:skulls, limbs:own });
  }
  // Limbless bodies still have a torso carrying a skull. Its directly owned
  // region distinguishes that torso from an unsupported parent transform.
  for (const head of heads) {
    const id = head.origin, surface = jointSurface(id);
    if (!joints.has(id) || !surface?.center || !mass(surface) || candidates.some(candidate => below(head.id, candidate.id))) continue;
    candidates.push({ id, heads:ownHeads(id), limbs:ownLimbs(id) });
  }
  const sameHeads = (a,b) => a.heads.length === b.heads.length && a.heads.every(head => b.heads.some(item => item.id === head.id));
  const boundaryContinuity = new Map();
  for (const candidate of candidates) {
    let shared = 0;
    for (const [owner, links] of geometry.surfaceLinks) if (below(owner, candidate.id))
      for (const [other, area] of links) if (!below(other, candidate.id)) shared += area;
    boundaryContinuity.set(candidate.id, shared / Math.max(mass(geometry.subtree.get(candidate.id)), 1e-12));
  }
  const grounded = candidates.filter(candidate => !candidates.some(other => {
    if (other === candidate || !below(candidate.id, other.id) || sameHeads(candidate,other)) return false;
    // The ancestor's ground evidence must come from its own legs. A mount's
    // chest may contain only the rider's legs; those cannot prove that rider
    // is standing on the mount's ground.
    const independentLegs = other.limbs.filter(limb => limb.kind === 'leg' && !limb.label && !below(limb.ids[0], candidate.id));
    if (!independentLegs.length) return false;
    // Hands are not floor samples. With no supporting legs, connected skin
    // supplies the ownership evidence for an upper torso.
    const ownLegs = candidate.limbs.filter(limb => limb.kind === 'leg' && !limb.label);
    if (!ownLegs.length) return (boundaryContinuity.get(candidate.id) || 0) > .15;
    const ownFloor = endsHeight(ownLegs), sharedFloor = endsHeight(independentLegs);
    const height = Math.max(1e-6, ...candidate.heads.map(head => Math.abs(pivot(head.id).z - ownFloor)));
    // A continuous weighted trunk contributes even when its upper hands
    // sit well above the ground (for example a centaur's upright torso).
    const continuity = 2 * Math.sqrt(boundaryContinuity.get(candidate.id) || 0);
    return Number.isFinite(ownFloor) && Number.isFinite(sharedFloor) && (ownFloor - sharedFloor) / height - continuity < .15;
  }));
  const actors = grounded.filter(candidate => !grounded.some(other => other !== candidate && below(candidate.id,other.id) && (!candidate.heads.length || sameHeads(candidate,other))));
  for (const actor of actors) {
    actor.limbs = actor.limbs.filter(limb => !actors.some(other => other !== actor && below(other.id, actor.id) && below(limb.ids[0], other.id)));
    actor.heads = actor.heads.filter(head => !actors.some(other => other !== actor && below(other.id, actor.id) && below(head.id, other.id)));
    const unary = [actor.id];
    for (let ancestor = parent.get(actor.id); ancestor != null; ancestor = parent.get(ancestor)) {
      if ((children.get(ancestor) || []).filter(id => mass(geometry.subtree.get(id)) > 0).length !== 1) break;
      unary.push(ancestor);
    }
    const motion = poseBodyDriverMotion(model, unary, { scale:geometry.subtree.get(actor.id)?.extent.length() || 1, tree });
    const driver = unary.reduce((best,id) => {
      const difference = (motion.get(id)?.score || 0) - (motion.get(best)?.score || 0);
      if (difference > 1e-8) return id;
      // Coincident alternatives owning the same assembly are genuinely
      // ambiguous; a Body label may help without overriding geometry/motion.
      if (Math.abs(difference) <= 1e-8 && pivot(id).distanceTo(pivot(best)) < 1e-7 && typeof nameRole === 'function' && nameRole(tree.byId.get(id)) === 'Body' && nameRole(tree.byId.get(best)) !== 'Body') return id;
      return best;
    }, actor.id);
    actor.body = driver; actor.span = geometry.subtree.get(driver)?.extent.length() || 0;
    roles[driver] = 'Body'; controls.add(driver);
    const arms = actor.limbs.filter(limb => limb.kind === 'arm' && limb.label !== 'Chain');
    const common = ids => ids.length ? tree.ancestors(ids[0], true).find(id => ids.every(other => below(other, id))) : null;
    const headOrigins = actor.heads.map(head => head.origin).filter(id => below(id, actor.id));
    const stations = unique(actor.limbs.map(limb => limb.origin));
    let chest = arms.length ? common([...arms.map(limb => limb.ids[0]), ...actor.heads.map(head => head.id)]) : null;
    if (chest == null && headOrigins.length) chest = common(headOrigins);
    if (chest == null && actor.heads.length && stations.length) chest = stations.slice().sort((a,b) => {
      const distance = id => Math.min(...actor.heads.map(head => pivot(id).distanceTo(pivot(head.id))));
      return distance(a)-distance(b);
    })[0];
    if (chest != null && chest !== driver) { roles[chest] = 'Chest'; controls.add(chest); }
    const legs = actor.limbs.filter(limb => limb.kind === 'leg' && !limb.label);
    const legStations = unique(legs.map(limb => limb.origin));
    for (const id of legStations) if (id !== driver && id !== chest) {
      // A head can attach through an upright spine above the front trunk.
      // Retain that front station separately from the body's hind station;
      // a single pelvis carrying the entire spine is still a pelvis.
      const headBearing = headOrigins.some(origin => below(origin, id));
      const independentStation = legStations.some(other => other !== id && !below(other, id));
      roles[id] = headOrigins.includes(id) || headBearing && independentStation ? 'Chest' : 'Pelvis';
      controls.add(id);
    }
    // Spine controls belong only to the path joining real trunk stations,
    // never to the proximal links of a limb or a tail.
    if (chest != null) for (const id of tree.ancestors(chest)) {
      if (id === driver || !below(id, driver)) break;
      if (joints.has(id) && !roles[id] && mass(jointSurface(id)) > 0) { roles[id] = 'Spine'; controls.add(id); }
    }
  }
  actors.sort((a,b)=>b.span-a.span || a.body-b.body);
  const body = actors[0]?.body ?? null;
  if (body != null) controls.delete(body);
  return { actors, roles, controls:[...controls], body };
}
