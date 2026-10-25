/** Starting budgets for new, ordinary game-camera SD parts, not global caps.
 * Measured evidence and uncertainty: docs/AI-SD-PART-DATA.json. Ranges below
 * are authoring targets informed by that evidence, not invented percentiles. */
export const SD_PART_TARGETS = {
  head:{triangles:[40,90],sides:6}, hand:{triangles:[8,24],sides:4}, foot:{triangles:[8,20],sides:4},
  torso:{triangles:[24,70],sides:6}, arm:{triangles:[8,24],sides:5},leg:{triangles:[8,24],sides:5},
  shoulder:{triangles:[8,24],sides:5},helmet:{triangles:[20,64],sides:6},blade:{triangles:[8,32]},
  axe:{triangles:[8,32]},hammer:{triangles:[12,32]},shaft:{triangles:[8,24],sides:5},
  guard:{triangles:[8,20]},pommel:{triangles:[4,16],sides:5},shield:{triangles:[8,32],sides:8},
  cape:{triangles:[4,16]},cloth:{triangles:[2,16]},hair:{triangles:[4,24]},horn:{triangles:[6,24],sides:5},
  wing:{triangles:[6,24]},tail:{triangles:[8,32],sides:5},trunk:{triangles:[16,48],sides:6},roof:{triangles:[4,24]},
};
export const SD_CHAPTERS = [
  ['basics','Game scale and part budgets',/./],
  ['bodies','Bodies and proportions',/body|knight|footman|grunt|warrior|humanoid|person|character|orc|paladin|hero/],
  ['heads','Heads and faces',/head|face|knight|footman|body|character|grunt|warrior/],
  ['hands-feet','Hands and feet',/hand|foot|feet|knight|body|character|grunt|warrior/],
  ['muscles','Muscles',/muscle|bicep|torso|chest|body|grunt/],
  ['human-swords','Human swords',/sword|longsword|dagger|rapier|knight/],
  ['orc-weapons','Orc axes and cleavers',/orc.*(?:axe|cleaver)|axe|cleaver/],
  ['elven-weapons','Elven glaives and moonblades',/glaive|moonblade|elven.*(?:blade|weapon)|crescent/],
  ['dwarven-weapons','Dwarven hammers and maces',/dwarf|dwarven|hammer|mace/],
  ['undead-weapons','Undead runeblades',/undead|runeblade|deathknight|death knight/],
  ['staffs-bows-polearms','Staffs, bows and polearms',/staff|stave|bow|spear|polearm|halberd|wizard/],
  ['shields','Shields',/shield|knight|footman/],
  ['armour','Armour',/armou?r|pauldron|helmet|knight|footman|hat/],
  ['skulls-bones','Skulls and bones',/skull|bone|skeleton/],
  ['cloth-hair','Cloth, capes, banners and hair',/cloth|cape|cloak|banner|flag|hair|beard|hat|robe/],
  ['creatures-wings','Creatures and wings',/creature|beast|dragon|wing|tail|horn|animal|wolf|bird|bat/],
  ['buildings','Buildings',/building|castle|house|tower|roof|fort|temple|barrack/],
  ['trees-doodads','Trees and doodads',/tree|trunk|foliage|rock|doodad|bush|grass|mushroom/],
  ['props-items','Props and items',/chalice|cup|goblet|mordor|item|prop|barrel|bottle|chest|crate|torch/],
  ['effects','Effects',/effect|particle|spell|aura|missile|flame|smoke/],
  ['textures','Native textures',/texture|paint|material|colou?r/],
  ['uv','UV mapping',/uv|unwrap|map.*properly/],
  ['edits','Editing existing models',/this|these|edit|adjust|fix|clean|cooler|uv|unwrap|recolou?r/],
].map(([id,title,match])=>({id,title,match,topic:`docs/AI-SD-HANDBOOK/${id}.md`}));
export function sdChaptersForPrompt(text,{existing=false}={}) {
  const request=String(text).toLowerCase();
  const subjects=SD_CHAPTERS.filter(c=>c.id!=='basics'&&c.match.test(request));
  const selected=[SD_CHAPTERS[0],...subjects];
  if(existing&&!selected.some(c=>c.id==='edits'))selected.push(SD_CHAPTERS.find(c=>c.id==='edits'));
  if(!selected.some(c=>c.id==='textures'))selected.push(SD_CHAPTERS.find(c=>c.id==='textures'));
  // All selected chapter ids remain discoverable to the builder; the art turn
  // receives only the chapters relevant to this request, never the entire book.
  return selected;
}
