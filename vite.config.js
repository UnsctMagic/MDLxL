import { defineConfig } from 'vite';
import { build as bundleNode } from 'esbuild';

export default defineConfig({ base: './', esbuild:{jsxFactory:'localizedCreateElement',jsxInject:"import { localizedCreateElement } from '/app/localized-element.js'"}, build: {outDir:'dist', emptyOutDir:true,rollupOptions:{input:{index:'index.html',aiSandbox:'ai-sandbox.html'}}}, server:{host:'127.0.0.1',watch:{ignored:['**/electron/**']}}, plugins:[{
  name:'optimizexl-desktop-validation',
  async generateBundle() {
    const particles=await bundleNode({entryPoints:['electron/particle-runtime.js'],bundle:true,platform:'node',format:'esm',target:'node22',minify:true,write:false});
    this.emitFile({type:'asset',fileName:'particle-runtime.mjs',source:particles.outputFiles[0].contents});
    const popupEffects=await bundleNode({entryPoints:['app/welcome-popup-effects.js'],bundle:true,platform:'browser',format:'iife',target:'chrome144',minify:true,write:false});
    this.emitFile({type:'asset',fileName:'update-popup-effects.js',source:popupEffects.outputFiles[0].contents});
  },
}] });
