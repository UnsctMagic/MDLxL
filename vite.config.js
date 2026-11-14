import { defineConfig } from 'vite';
import { build as bundleNode } from 'esbuild';
import { access, mkdir, mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';

import path from 'node:path';
import { promisify } from 'node:util';

export default defineConfig({ base: './', esbuild:{jsxFactory:'localizedCreateElement',jsxInject:"import { localizedCreateElement } from '/app/localized-element.js'"}, build: {outDir:'dist', emptyOutDir:true,rollupOptions:{input:{index:'index.html',aiSandbox:'ai-sandbox.html'}}}, server:{host:'127.0.0.1',watch:{ignored:['**/electron/**']}}, plugins:[{
  name:'optimizexl-desktop-validation',
  async generateBundle() {
    const particles=await bundleNode({entryPoints:['electron/particle-runtime.js'],bundle:true,platform:'node',format:'esm',target:'node22',minify:true,write:false});
    this.emitFile({type:'asset',fileName:'particle-runtime.mjs',source:particles.outputFiles[0].contents});
    const popupEffects=await bundleNode({entryPoints:['app/welcome-popup-effects.js'],bundle:true,platform:'browser',format:'iife',target:'chrome144',minify:true,write:false});
    this.emitFile({type:'asset',fileName:'update-popup-effects.js',source:popupEffects.outputFiles[0].contents});
    // The update installer's window shows the popup's Shredder bird from these files.
    for(const [from,to] of [['0','shredder-sheet'],['1','shredder-wings']])this.emitFile({type:'asset',fileName:`update/${to}.png`,source:await readFile(`app/assets/update/${from}.png`)});
  },
}, {
  name: 'windows-capture-regions',
  async generateBundle() {
    if (process.platform !== 'win32') return;
    const csc = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
    try { await access(csc); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.warn('Capture regions helper skipped because csc.exe was not found.');
      return;
    }
    const out = path.resolve('out');
    await mkdir(out, { recursive: true });
    const temp = await mkdtemp(path.join(out, 'capture-regions-'));
    const output = path.join(temp, 'capture-regions.exe');
    try {
      await promisify(execFile)(csc, [
        '/nologo', '/optimize+', '/target:winexe', '/platform:x64',
        '/reference:System.Windows.Forms.dll', `/win32manifest:${path.resolve('electron/capture-regions.manifest')}`,
        `/out:${output}`, path.resolve('electron/capture-regions.cs')
      ], { windowsHide: true });
      this.emitFile({ type: 'asset', fileName: 'capture-regions.exe', source: await readFile(output) });
    } finally {
      await rm(output, { force: true });
      await rmdir(temp);
    }
  }
}] });
