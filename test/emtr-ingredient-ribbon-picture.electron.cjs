// EMTR Ingredients shows a picture of every ingredient, ribbons included.
// A Footman gets a particle and a ribbon effect; the ribbon's node stands still,
// so its picture needs the same preview-only trail motion the Library uses.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {launchApp,closeApp,clickMenu,waitForInfo}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
(async()=>{
  const out=path.resolve('out','emtr-ingredient-ribbon-picture');fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'Textures'),{recursive:true});
  const source=fixturePath('footman');assert.ok(fs.existsSync(source),`Required permanent fixture: ${source}`);
  for(const name of fs.readdirSync(path.join(path.dirname(source),'Textures')))fs.copyFileSync(path.join(path.dirname(source),'Textures',name),path.join(out,'Textures',name));
  const {openDocument}=await import('../src/editor-document.js'),{createStarterRecipe}=await import('../src/particle-starters.js'),{placeParticleRecipe}=await import('../src/particle-recipes.js');
  const doc=openDocument(fs.readFileSync(source));
  doc.apply('Test effects',['Nodes','PivotPoints','Textures','Materials'],m=>{
    const interval=Array.from(m.Sequences[0].Interval);
    placeParticleRecipe(m,createStarterRecipe(),{sourceInterval:[0,5000],targetInterval:interval,fit:true});
    placeParticleRecipe(m,createStarterRecipe('ribbon'),{sourceInterval:[0,5000],targetInterval:interval,fit:true});
  });
  const fixture=path.join(out,'TEST EMTR RIBBON PICTURE 01.mdx'),bytes=Buffer.from(doc.serialize('mdx'));fs.writeFileSync(fixture,bytes);
  const ribbon=openDocument(bytes).model.RibbonEmitters[0].ObjectId;
  const errors=[];let app;
  try{
    const launched=await launchApp({out,fixture,errors,bounds:{x:-3000,y:0,width:1400,height:920}});app=launched.app;const page=launched.page;
    await waitForInfo(page,'Opened TEST EMTR RIBBON PICTURE 01.mdx');
    await clickMenu(app,'Particle Editor…');await page.getByLabel('Particle context',{exact:true}).waitFor();
    if(await page.getByRole('button',{name:'Close Particle Library',exact:true}).count())await page.getByRole('button',{name:'Close Particle Library',exact:true}).click();
    await page.getByLabel('Particle context',{exact:true}).selectOption('On model');
    await page.getByLabel('Effect ingredient',{exact:true}).selectOption(String(ribbon));
    const before=fs.readFileSync(fixture);
    await page.getByRole('button',{name:'Ingredients',exact:true}).click();
    await page.waitForFunction(()=>{const e=[...document.querySelectorAll('.pe-ingredient-picture')];return e.length===2&&e.every(x=>x.querySelector('img'));},null,{timeout:30000});
    const pictures=await page.locator('.pe-ingredient-picture img').evaluateAll(async images=>{const result={};for(const image of images){await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>30)count++;result[image.alt]=count;}return result;});
    await page.locator('.pe-preview-pane').screenshot({path:path.join(out,'ingredients.png')});
    console.log(JSON.stringify({pictures}));
    assert.ok(pictures['Particle 1']>60,'The particle ingredient picture shows its sparks: '+pictures['Particle 1']);
    assert.ok(pictures['Ribbon 2']>60,'The ribbon ingredient picture shows a recognizable ribbon: '+pictures['Ribbon 2']);
    assert.deepEqual(fs.readFileSync(fixture),before,'Pictures never change the model file');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,out}));
  }finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
