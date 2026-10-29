import { decodeBlp2 } from './blp2.js';

// BC5 stores two BC3-style alpha blocks (red, green), 16 bytes per 4x4 tile.
// https://learn.microsoft.com/en-us/windows/win32/direct3d10/d3d10-graphics-programming-guide-resources-block-compression
function bc5Channel(source, offset) {
  const a=source[offset], b=source[offset+1], table=[a,b], values=new Uint8Array(16);
  if(a>b)for(let i=2;i<8;i++)table.push(Math.floor(((8-i)*a+(i-1)*b)/7));
  else {for(let i=2;i<6;i++)table.push(Math.floor(((6-i)*a+(i-1)*b)/5));table.push(0,255);}
  for(let i=0;i<16;i++) {
    const bit=i*3, byte=bit>>>3, packed=source[offset+2+byte]|((byte<5?source[offset+3+byte]:0)<<8);
    values[i]=table[(packed>>>(bit&7))&7];
  }
  return values;
}

/** Decode the first BC1/2/3 or unsigned BC5 DDS mip. BC5 normals reconstruct Z. */
export function decodeDds(input) {
  const source = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
  if (source.length < 128) throw Error('DDS header is truncated.');
  const view = new DataView(source.buffer,source.byteOffset,source.byteLength);
  if (view.getUint32(0,true) !== 0x20534444 || view.getUint32(4,true) !== 124) throw Error('Invalid DDS header.');
  const height=view.getUint32(12,true), width=view.getUint32(16,true), fourCC=view.getUint32(84,true);
  if(fourCC===0x32495441 || fourCC===0x55354342) {
    const size=Math.ceil(width/4)*Math.ceil(height/4)*16;
    if(!width || !height || width*height*4>256*1024*1024 || size>source.length-128)throw Error('Invalid or truncated DDS dimensions.');
    const data=new Uint8ClampedArray(width*height*4);let offset=128;
    for(let y=0;y<height;y+=4)for(let x=0;x<width;x+=4,offset+=16) {
      const red=bc5Channel(source,offset),green=bc5Channel(source,offset+8);
      for(let j=0;j<4&&y+j<height;j++)for(let i=0;i<4&&x+i<width;i++) {
        const pixel=j*4+i,dest=((y+j)*width+x+i)*4,nx=red[pixel]/127.5-1,ny=green[pixel]/127.5-1;
        data.set([red[pixel],green[pixel],Math.round((Math.sqrt(Math.max(0,1-nx*nx-ny*ny))+1)*127.5),255],dest);
      }
    }
    return {width,height,data};
  }
  const encoding=({[0x31545844]:0,[0x33545844]:1,[0x35545844]:7})[fourCC];
  if (encoding === undefined) throw Error('Unsupported DDS texture encoding.');
  const size=Math.ceil(width/4)*Math.ceil(height/4)*(encoding===0?8:16);
  if (!width || !height || width*height*4>256*1024*1024 || size>source.length-128) throw Error('Invalid or truncated DDS dimensions.');
  const blp=new Uint8Array(148+size), header=new DataView(blp.buffer);
  blp.set([66,76,80,50]); header.setUint32(4,1,true); blp[8]=2; blp[9]=encoding===0?1:8; blp[10]=encoding;
  header.setUint32(12,width,true); header.setUint32(16,height,true); header.setUint32(20,148,true); header.setUint32(84,size,true);
  blp.set(source.subarray(128,128+size),148);
  return decodeBlp2(blp);
}
