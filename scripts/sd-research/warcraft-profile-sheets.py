from pathlib import Path
import json, math
from PIL import Image,ImageDraw,ImageFont
R=Path('D:/Codex/sd-research'); A=json.loads((R/'data/category-models.json').read_text('utf8'))
A=[x for x in A if x['source']=='blizzard' and x['tier']=='sd']
groups={
'human':['Footman','Knight','EX_HeroMountainKing','Rifleman','TownHall','HumanBarracks','Farm'],
'orc':['grunt','HeroBladeMaster','Tauren','Headhunter','Shaman','WitchDoctor','GreatHall','WatchTower'],
'undead':['Skeleton','Necromancer','HeroLich','HeroDeathKnight','CryptFiend','Gargoyle','Necropolis','Acolyte'],
'nightelf':['Archer','EX_Dryad','Huntress','DruidOfTheClaw','HeroDemonHunter','TreeofLife','AncientOfWar'],
'naga':['NagaMyrmidon','NagaRoyalGuard','NagaSiren','HeroNagaSeawitch','SnapDragon','TempleofTides','CoralBed','TidalGuardian'],
'creeps-humanoid':['Gnoll','Kobold','Ogre','OgreMagi','ForestTroll','IceTroll','DarkTroll','Murloc','Furbolg','Satyr','tuskar','Magnataur'],
'creeps-creature':['RedDragon','RedDragonWelp','AzureDragon','Harpy','Centaur','FacelessOne','Nerubian','RockGolem','SludgeMonster','Hydra','ThunderLizard','Revenant'],
'demons':['doomgaurd','felhound','Infernal','Demoness','Felgaurd','EredarWarlock','ChaosGrunt','HeroPitLord'],
'critters':['Sheep','Pig','Seal','BrownWolf','BlackStagMale','Albatross','Penguin','HermitCrab'],
'elf-commoner':['HighElfArcher','Priest','Sorceress','HeroBloodElf','BloodElfSpellThief','VillagerMan','VillagerWoman','VillagerKid']}
out=R/'pictures/warcraft-factions';out.mkdir(exist_ok=True,parents=True);data={};missing=[]
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
for group,names in groups.items():
 rows=[]
 for name in names:
  candidates=[r for r in A if r['name'].lower()==name.lower()]
  if not candidates: print('NAME MISSING',name);continue
  r=sorted(candidates,key=lambda r:(r['path'].count(':'),'_teen' in r['path'],r['path']))[0]
  rows.append(r)
 data[group]=[r['id'] for r in rows]
 sheet=Image.new('RGB',(4*350,math.ceil(len(rows)/4)*390),'#20232a');d=ImageDraw.Draw(sheet)
 for i,r in enumerate(rows):
  x=(i%4)*350;y=(i//4)*390;p=R/'captures/models'/r['id']/'view-1.webp'
  if p.exists():
   im=Image.open(p).convert('RGB');im.thumbnail((350,340));sheet.paste(im,(x+(350-im.width)//2,y))
  else:missing.append(r['id']);d.text((x+15,y+150),'Capture pending',font=font)
  d.text((x+8,y+342),r['name'],font=font)
  d.text((x+8,y+365),f"{r['sampleBodyTrianglesLod0']} body tris / {r['diffuseSheets']} sheets",font=font)
 sheet.save(out/(group+'.webp'),quality=90)
(R/'data/warcraft-profile-selection.json').write_text(json.dumps(data,indent=2),encoding='utf8')
print('Selected',sum(map(len,data.values())),'Missing captures',len(missing)); print('|'.join(missing))
