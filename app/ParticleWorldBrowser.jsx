import {appearanceTypes} from '../src/particle-library-browse.js';
import {worldEditorRaceOrder} from '../src/world-editor-catalog.js';
import {FOLDER_ICONS} from './GameIcon.jsx';

const order=['Units','Buildings','Heroes','Items','Doodads','Destructibles',...worldEditorRaceOrder];
const status=item=>item.blocked?'Unavailable':item.previewError?'Preview unavailable':item.unsupported?.length?'Incomplete preview':item.empty?'Empty effect':'';
const leaf=(item,key)=>({key:key+'/'+item.id,name:item.name,item,status:status(item)});
const folder=(name,key,children=[])=>({name,key,children,icon:FOLDER_ICONS[name]});

/** Row data only. GameFileBrowser owns all rendering, navigation and scrolling. */
export function particleBrowserTree(catalog,style,query=''){
  const sorted=[...catalog.items].sort((a,b)=>Number(!!a.blocked)-Number(!!b.blocked)||Number(['reviewed','user-reviewed'].includes(b.naming?.state))-Number(['reviewed','user-reviewed'].includes(a.naming?.state)));
  const stock=sorted.filter(item=>item.collection==='Warcraft'),available=new Map(stock.map(item=>[item.id,item]));
  const warcraft=folder('Warcraft','Warcraft');
  if(style==='worldeditor'){
    const browse=catalog.browse||{objects:[],buckets:[],other:stock.map(item=>item.id)};
    for(const object of browse.objects){
      const groups=object.groups.map(group=>({...group,items:[...new Set(group.refs.flatMap(ref=>browse.buckets[ref]||[]))].map(id=>available.get(id)).filter(Boolean)}));
      if(!groups.some(group=>group.items.length))continue;
      for(const path of object.folders||[[]]){
        let parent=warcraft;
        for(const name of path){let next=parent.children.find(node=>node.name===name);if(!next){next=folder(name,parent.key+'/'+name);parent.children.push(next);}parent=next;}
        const node=folder(object.name,parent.key+'/'+object.id);node.icon=object.icon;parent.children.push(node);
        for(const group of groups){
          const art=folder(group.title,node.key+'/'+group.title);
          art.children=group.items.map(item=>leaf(item,art.key));
          if(!art.children.length)art.status='No indexed emitters';
          node.children.push(art);
        }
      }
    }
    const sort=nodes=>{nodes.sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name)||a.name.localeCompare(b.name));for(const node of nodes)if(node.children&&!node.children.some(child=>child.item))sort(node.children);};
    sort(warcraft.children);
    const other=folder('Other effects','Warcraft/Other effects');
    other.children=browse.other.map(id=>available.get(id)).filter(Boolean).map(item=>leaf(item,other.key));warcraft.children.push(other);
  }else{
    for(const name of appearanceTypes){const node=folder(name,'Warcraft/'+name);node.children=stock.filter(item=>(item.categories?.[0]||'Other')===name).map(item=>leaf(item,node.key));warcraft.children.push(node);}
  }
  const root=[warcraft,...['My presets','My work','Favorites'].map(name=>{
    const node=folder(name,name),items=sorted.filter(item=>name==='Favorites'?item.favorite:item.collection===name);
    if(name==='My work')items.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    node.children=items.map(item=>leaf(item,node.key));return node;
  })];
  const terms=query.toLowerCase().split(/\s+/).filter(Boolean),autoExpanded=new Set();
  const filter=(node,trail='')=>{
    const text=trail+' '+node.name;
    if(node.item){const item=node.item,haystack=[text,...item.tags||[],...item.aliases||[],...(item.sources||[]).flatMap(source=>[source.emitterName,source.physicalPath])].join(' ').toLowerCase();return terms.every(term=>haystack.includes(term))?node:null;}
    node.children=node.children.map(child=>filter(child,text)).filter(Boolean);
    const ids=new Set();const count=child=>{if(child.item)ids.add(child.item.id);else child.children.forEach(count);};node.children.forEach(count);node.total=ids.size;
    if(terms.length&&node.children.length)autoExpanded.add(node.key);
    return !terms.length||node.children.length||node.status&&terms.every(term=>text.toLowerCase().includes(term))?node:null;
  };
  return {nodes:root.map(node=>filter(node)).filter(Boolean),autoExpanded};
}
