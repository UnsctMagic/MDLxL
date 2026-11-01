import {worldEditorRaceOrder} from './world-editor-catalog.js';
// Presentation only: cached associations and recipe files remain untouched.
const paths=item=>(item.sources||[]).map(source=>(source.logicalPath||source.physicalPath||'').toLowerCase());
export const bloodEffect=item=>paths(item).some(path=>/objects\\spawnmodels\\/.test(path)&&/blood|gore|gib|corpse|death|explode/.test(path));
export function particleWorldEffects(browse,stock){
  const associations=new Map();
  for(const object of browse?.objects||[])for(const group of object.groups)for(const id of group.refs.flatMap(ref=>browse.buckets[ref]||[])){
    if(!associations.has(id))associations.set(id,new Set());associations.get(id).add(object.name+' · '+group.title);
  }
  const folder=(name,key,children=[])=>({name,key,children}),leaf=(item,key,origin)=>{
    const links=[...(associations.get(item.id)||[])];
    return {name:origin&&!item.name.includes(origin)?item.name+' · '+origin:item.name,key:key+'/'+item.id,status:item.blocked?'Unavailable':item.previewError?'Preview unavailable':item.unsupported?.length?'Incomplete preview':'',item:{...item,associations:links,aliases:[...(item.aliases||[]),...links]}};
  };
  const root=folder('Warcraft','Warcraft'),claimed=new Set(),available=new Map(stock.filter(item=>!item.empty).map(item=>[item.id,item]));
  const get=(parent,name)=>{let node=parent.children.find(node=>node.name===name);if(!node){node=folder(name,parent.key+'/'+name);parent.children.push(node);}return node;};
  const blood=folder('Blood & death','Warcraft/Blood & death');
  for(const item of stock)if(bloodEffect(item)){blood.children.push(leaf(item,blood.key));claimed.add(item.id);}
  const types=['Units','Buildings','Heroes','Spells','Items','Doodads','Destructibles'],races=[...worldEditorRaceOrder,'Neutral'];
  const position=o=>o.folders?.[0]||[];
  // Stock neutral structures use the n... object namespace, including the
  // campaign fountains. Keep playable shipyards in their own race even when
  // their model happens to live in buildings/other.
  const editorRace=o=>{const [type,race]=position(o);return type==='Buildings'&&(/Neutral/.test(race||'')||race==='Naga'||/^n/i.test(o.id))?'Neutral':race||'Neutral';};
  const campaign=o=>position(o).some(name=>/Campaign|Special/.test(name))?1:0;
  const owner=o=>['Units','Buildings','Heroes'].includes(position(o)[0])?0:1;
  const raceOrder=o=>{const index=races.indexOf(editorRace(o));return index<0?6:index;};
  const objects=[...(browse?.objects||[])].sort((a,b)=>owner(a)-owner(b)||campaign(a)-campaign(b)||types.indexOf(position(a)[0])-types.indexOf(position(b)[0])||raceOrder(a)-raceOrder(b)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  for(const object of objects){
    const [type,race]=position(object),building=type==='Buildings',scenery=['Doodads','Destructibles'].includes(type),groups=new Map(),icons=new Map();
    for(const group of object.groups){
      if(group.title==='Death/Special'||group.title==='Model'&&!building&&!scenery)continue;
      const name=group.title==='Attack/Missile'?'Attack':group.title.split(' · ')[0];
      if(group.icon)icons.set(name,group.icon);
      for(const id of new Set(group.refs.flatMap(ref=>browse.buckets[ref]||[]))){const item=available.get(id);if(!item||claimed.has(id))continue;
        claimed.add(id);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(item);
      }
    }
    if(!groups.size)continue;
    const all=[...groups.values()].flat();
    let parent=get(root,type);
    parent=get(parent,editorRace(object));
    if(building){for(const item of all)parent.children.push(leaf(item,parent.key,object.name));continue;}
    const node=get(parent,object.name);node.icon=object.icon;
    for(const [name,items]of groups){const target=groups.size===1?node:get(node,name);if(target!==node)target.icon=icons.get(name);target.children.push(...items.map(item=>leaf(item,target.key)));}
  }
  const other=folder('Other effects','Warcraft/Other effects');
  for(const item of stock)if(!claimed.has(item.id)&&(!paths(item).length||paths(item).some(path=>/abilities\\/.test(path)))){claimed.add(item.id);other.children.push(leaf(item,other.key));}
  if(blood.children.length)root.children.push(blood);if(other.children.length)root.children.push(other);
  const count=node=>{if(node.item)return 1;node.total=node.children.reduce((n,child)=>n+count(child),0);return node.total;};count(root);
  return root;
}
