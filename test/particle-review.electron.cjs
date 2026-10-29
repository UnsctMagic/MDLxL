const { launchApp, closeApp } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path');
(async()=>{const root=process.cwd(),out=path.join(root,'out','particle-prototype'),{createServer}=await import('vite'),server=await createServer({root,configFile:false,esbuild:{jsxFactory:'localizedCreateElement',jsxInject:"import { localizedCreateElement } from '/app/localized-element.js'"},cacheDir:path.join(out,'review-vite'),server:{host:'127.0.0.1',port:8062,strictPort:true,watch:null},logLevel:'error'});await server.listen();let app;
 fs.mkdirSync(out,{recursive:true});
 try{if(!fs.existsSync(path.join(out,'review-candidates.json'))){const current=JSON.parse(fs.readFileSync(path.join(root,'profile','particles','current.json'))),catalog=JSON.parse(fs.readFileSync(path.join(root,'profile','particles',current.sourceKey,'catalog.json'))),{reviewFor}=require(path.join(root,'electron','particle-review.cjs'));fs.writeFileSync(path.join(out,'review-candidates.json'),JSON.stringify(catalog.filter(item=>reviewFor(item))));}
 const profile=path.join(out,'review-profile-'+Date.now());fs.mkdirSync(profile,{recursive:true});fs.symlinkSync(path.join(root,'profile','particles'),path.join(profile,'particles'),'junction');
 const launched = await launchApp({ out, profile, timeout: 60000, bounds: { x: -3000, y: 0, width: 1080, height: 620 }, show: 'inactive', pageTimeout: 30000 }); app = launched.app;const page=launched.page;await page.goto('http://127.0.0.1:8062/test/particle-review.html');await page.waitForFunction(()=>window.review?.done,{},{timeout:180000});
 const results=await page.evaluate(()=>window.review.images);fs.writeFileSync(path.join(out,'review-results.json'),JSON.stringify(Object.fromEntries(Object.entries(results).map(([i,r])=>[i,{...r,url:undefined}])),null,2));
 for(let part=0;part<Math.ceil(Object.keys(results).length/8);part++){await page.evaluate(part=>{document.querySelectorAll('.tile').forEach(tile=>tile.style.display=Math.floor(Number(tile.dataset.index)/8)===part?'':'none');},part);await page.screenshot({path:path.join(out,'review-'+part+'.png')});}
 console.log(JSON.stringify({rendered:Object.values(results).filter(r=>r.url).length,errors:Object.entries(results).filter(([i,r])=>r.error)}));
 }finally{if(app)await closeApp(app);await server.close();}
})().catch(error=>{console.error(error);process.exit(1);});
