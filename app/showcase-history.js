// Showcase state is immutable React data. Keep references to large model/take
// snapshots, and group a continuous drag or field edit into one undo step.
function sameView(a,b) {
  if(Object.is(a,b))return true;
  if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<=1e-7;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>sameView(a[key],b[key]));
}
export class ShowcaseHistory {
  constructor() { this.present=null;this.undo=[];this.redo=[];this.group=null; }
  begin(group) { if(this.group?.id!==group)this.group={id:group,entry:null}; }
  end() { this.group=null; }
  observe(next,record=true) {
    const before=this.present;this.present=next;
    if(!before||!record||Object.keys(next).every(key=>{
      if(key==='view')return sameView(next.view,before.view);
      if(key==='sequencePlaylist'||key==='portraitPlaylist')return JSON.stringify(next[key])===JSON.stringify(before[key]);
      return Object.is(next[key],before[key]);
    }))return false;
    if(this.group?.entry)this.group.entry.after=next;
    else {
      const entry={before,after:next};this.undo.push(entry);
      if(this.group)this.group.entry=entry;
    }
    this.redo=[];return true;
  }
  travel(redo=false) {
    this.end();const from=redo?this.redo:this.undo,to=redo?this.undo:this.redo,entry=from.pop();
    if(!entry)return null;
    to.push(entry);return this.present=redo?entry.after:entry.before;
  }
}
