import React, { useEffect, useMemo, useState } from 'react';
import { Folder, FolderOpen, Volume2, ChevronDown, ChevronRight } from 'lucide-react';
import { FOLDER_COLORS } from '../src/tree-appearance.js';
import { soundFolders } from './node-event-data.js';

const colors = Object.fromEntries(FOLDER_COLORS.map(([key]) => [key, `var(--tree-folders-${key})`]));
const folderLabel = value => ({NightElf:'Night Elf', UI:'UI', AI:'AI'}[value] || value.replace(/([a-z])([A-Z])/g, '$1 $2'));
const groupColors = { Spells: 'Abilities', 'Weapons & missiles': 'Abilities', Interface: 'Sound' };

export default function EventSoundTree({ rows, selectedId, query, onSelect }) {
  const [expanded, setExpanded] = useState(new Set());
  const selected = rows.find(row => row.id === selectedId);
  useEffect(() => {
    const folders = selected ? soundFolders(selected) : [];
    setExpanded(previous => new Set([...previous, ...folders.map((_, index) => folders.slice(0, index + 1).join('/'))]));
  }, [selected]);
  const root = useMemo(() => {
    const root = {folders:new Map(), sounds:[], count:0}, search = query.trim().toLowerCase();
    for (const row of rows) {
      const folders = soundFolders(row);
      if (search && !`${row.label} ${folders.join(' ')}`.toLowerCase().includes(search)) continue;
      let branch = root; root.count++;
      for (const name of folders) { if (!branch.folders.has(name)) branch.folders.set(name, {folders:new Map(), sounds:[], count:0}); branch = branch.folders.get(name); branch.count++; }
      branch.sounds.push(row);
    }
    return root;
  }, [rows, query]);
  const render = (branch, parent = '', level = 0, color = colors.default) => <>
    {[...branch.folders].sort(([a], [b]) => level ? a.localeCompare(b) : (a === 'Other') - (b === 'Other') || a.localeCompare(b)).map(([name, folder]) => {
      const path = parent ? `${parent}/${name}` : name, open = !!query.trim() || expanded.has(path), tint = colors[groupColors[name] || name] || color;
      const Icon = open ? FolderOpen : Folder, Chevron = open ? ChevronDown : ChevronRight;
      return <div key={path} role="treeitem" aria-label={folderLabel(name)} aria-expanded={open}>
        <button type="button" className="re-sound-folder" aria-label={folderLabel(name)} style={{paddingLeft:5 + level * 14, color:tint}} onClick={() => setExpanded(previous => { const next = new Set(previous); if (open) next.delete(path); else next.add(path); return next; })}><Chevron/><Icon/><span>{folderLabel(name)}</span><small>{folder.count}</small></button>
        {open && <div role="group">{render(folder, path, level + 1, tint)}</div>}
      </div>;
    })}
    {branch.sounds.map(row => <button type="button" role="treeitem" aria-selected={row.id === selectedId} aria-label={row.label} data-sound-id={row.id} key={row.id} className="re-sound-item" style={{paddingLeft:19 + level * 14}} onClick={() => onSelect(row.id)}><Volume2 style={{color}}/><span>{row.label.split(' · ')[0]}</span><small>{row.expansion ? `${row.expansion} · ` : ''}{row.id}</small></button>)}
  </>;
  return <div className="re-sound-tree" role="tree" aria-label="Sound categories">{root.count ? render(root) : <p className="re-sound-empty">No sounds match.</p>}</div>;
}
