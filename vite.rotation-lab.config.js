import {defineConfig} from 'vite';
import normalConfig from './vite.config.js';
import {transformLabSource} from './scripts/rotation-lab-transform.mjs';
export default defineConfig({...normalConfig,build:{...normalConfig.build,outDir:'out/rotation-lab-dist',rollupOptions:{input:{rotationLab:'rotation-lab.html'}}},plugins:[{name:'isolated-rotation-lab',enforce:'pre',transform(code,id){if(id.endsWith('/app/App.jsx')||id.endsWith('/app/Viewport.jsx'))return transformLabSource(code,id);}},...normalConfig.plugins]});
