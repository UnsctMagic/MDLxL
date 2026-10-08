import React, { useMemo } from 'react';
import { Color } from 'three';
import ForgeEditor from './ForgeEditor.jsx';
import { encodeForgeTga } from '../src/forge.js';

// Projector previews use the same camera and Quad View as all other Forge work.
export default function ForgePreview({ geosets = [], image, wire = false, checker = false, trimColor = '#cca64d', preferences, editorState }) {
  const preview = useMemo(() => {
    const color = new Color(trimColor), trim = {width:1,height:1,data:new Uint8Array([Math.round(color.r*255),Math.round(color.g*255),Math.round(color.b*255),255])};
    const model={Version:800,Info:{Name:'Projector'},Nodes:[],Bones:[],PivotPoints:[],Sequences:[],GlobalSequences:[],GeosetAnims:[],TextureAnims:[],Textures:[{Image:'forge-image.tga'},{Image:'forge-trim.tga'}],Materials:[0,1].map(TextureID=>({Layers:[{TextureID,Alpha:1,Shading:16}]})),Geosets:geosets.map((g,i)=>({...g,MaterialID:i===0?0:1}))};
    const assets=new Map(); if(image&&!checker)assets.set('forge-image.tga',{name:'forge-image.tga',bytes:encodeForgeTga(image)});assets.set('forge-trim.tga',{name:'forge-trim.tga',bytes:encodeForgeTga(trim)});
    return {model,assets};
  },[geosets,image,checker,trimColor]);
  return <div className="forge-preview-canvas"><ForgeEditor model={preview.model} preferences={preferences} editorState={editorState} textureAssets={preview.assets} previewOnly initialView="top" initialRenderMode="textured" wire={wire}/></div>;
}
