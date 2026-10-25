"""Regenerate the custom-sheet survey from curated visual observations, not filenames."""
from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
R=Path('D:/Codex/sd-research');D=R/'repo/docs/SD-RESEARCH';rows=json.loads((D/'data/lpw-custom-paint-observations.json').read_text('utf-8'));decoded=json.loads((R/'data/lpw-custom-decode.json').read_text('utf-8'));models={m['id']:m for m in json.loads((R/'data/lpw-manifest.json').read_text('utf-8'))};font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16);small=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',12)
for st in range(0,len(decoded),6):
 sheet=Image.new('RGB',(1500,1080),'#24292e');draw=ImageDraw.Draw(sheet)
 for i,t in enumerate(decoded[st:st+6]):
  x=(i%3)*500;y=(i//3)*540;im=Image.open(R/t['png']).convert('RGB');im.thumbnail((480,440));sheet.paste(im,(x+(500-im.width)//2,y+75));draw.text((x+8,y+5),str(st+i+1)+'. '+t['path']+' ('+str(t['width'])+'x'+str(t['height'])+')',font=font,fill='white');draw.text((x+8,y+30),models[t['modelIds'][0]]['name'][:65],font=small,fill='white');draw.text((x+8,y+48),', '.join(t['modelIds'])[:75],font=small,fill='white')
 sheet.save(R/f'pictures/lpw-custom-sheets-{st//6+1}.webp')
text='# Painting comparisons across every supplied Gluma/HerrDave custom image\n\nThe 81 model-specific custom-texture references for models attributed to Gluma or HerrDave resolve to 42 distinct images. Every one is viewed below; most are 256 by 256 pixels, with Ratling and Stormvermin using 512 by 256. Model attribution is preserved from the catalogue; it is not independent proof of who painted every source stroke. The extra Diablocar override supplied for Maximal models is recorded separately and is not counted as a Gluma/HerrDave custom painting.\n\n'
for i,row in enumerate(rows):
 text+='## '+row['texturePath']+'\n\nSources: '+', '.join('['+models[mid]['name']+']('+(R/f'captures/models/{mid}/view-1.webp').as_posix()+')' for mid in row['modelIds'])+'. '+row['observation']+'\n\n'
 if i%6==0:text+='![Source-sheet comparison page '+str(i//6+1)+']('+(R/row['contactSheet']).as_posix()+')\n\n'
text+='## Where the numbers attach\n\nThe companion `lpw-region-pixel-measurements.json` contains the real UV footprint, source alpha histogram, area fraction and material layers per component/texture pair. These records distinguish overlapping UV reuse from unique allocated pixels: adding all part fractions can exceed 100% because multiple parts deliberately share paint. Source alpha does not by itself equal team-colour share; filter mode, layer order and visibility determine the composited result. The four-model detailed painting chapter and `custom-painting-parts.json` provide direct part labels for the Saurus, Black Orc and Witch Hunter examples.\n'
(D/'subjects/lpw-custom-painting-survey.md').write_text(text,'utf-8')
print('Custom paintings:',len(rows))
