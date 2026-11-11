import React,{useState} from 'react';

const FORMATS=['dds','blp','png'];
const fileName=path=>String(path).split(/[\\/:]/).at(-1);

export async function saveConvertedLibraryTexture(asset,format) {
  const {decodePaintImage}=await import('./paint-raster.js');
  const raster=await decodePaintImage(asset.bytes,asset.name);
  let bytes;
  if(format==='png'){
    const {encodePaintPng}=await import('../src/paint-project.js');
    bytes=await encodePaintPng(raster);
  }else{
    const {encodePaintBlp1,encodePaintDds}=await import('../src/paint-blp.js');
    bytes=await (format==='blp'?encodePaintBlp1(raster):encodePaintDds(raster));
  }
  const name=fileName(asset.name).replace(/\.[^.]+$/,'')+'.'+format;
  return (await window.desktop.exportPaintTexture({name,bytes}))?.path;
}

export default function LibrarySaveCopy({textureName,disabled,selectClassName,children}) {
  const original=textureName?fileName(textureName).split('.').at(-1).toLowerCase():'';
  const [format,setFormat]=useState(original);
  const save=children(textureName&&format!==original?format:undefined);
  if(!textureName)return save;
  return <span className="gf-save-copy">
    <select className={selectClassName} aria-label="Texture save format" title="Texture save format" value={format} disabled={disabled} onChange={event=>setFormat(event.target.value)}>
      {!FORMATS.includes(original)&&<option value={original}>Original ({original.toUpperCase()})</option>}
      {FORMATS.map(value=><option key={value} value={value}>{value.toUpperCase()}</option>)}
    </select>{save}
  </span>;
}
