import {decodeDds} from '../../src/dds.js';
// Study-only decoder for BC4/BC5 normal-map bytes not covered by the app's BC1-3 decoder.
function channel(bytes,offset,signed=false){
 const a=signed?Math.max(-127,bytes[offset]<<24>>24):bytes[offset],b=signed?Math.max(-127,bytes[offset+1]<<24>>24):bytes[offset+1],p=[a,b];
 if(a>b)for(let i=1;i<=6;i++)p.push(((7-i)*a+i*b)/7);else{for(let i=1;i<=4;i++)p.push(((5-i)*a+i*b)/5);p.push(signed?-127:0,signed?127:255);}
 let bits=0n;for(let i=0;i<6;i++)bits|=BigInt(bytes[offset+2+i])<<BigInt(i*8);return Array.from({length:16},(_,i)=>p[Number((bits>>BigInt(i*3))&7n)]);
}
export function decodeResearchDds(input){
 const b=new Uint8Array(input),v=new DataView(input),cc=String.fromCharCode(...b.subarray(84,88));
 let format=cc,offset=128,signed=false;
 if(cc==='DX10'){const dx=v.getUint32(128,true);offset=148;format=({80:'BC4U',81:'BC4S',83:'BC5U',84:'BC5S'})[dx];if(!format&&[71,72,74,75,77,78].includes(dx)){const copy=new Uint8Array(128+b.length-148);copy.set(b.subarray(0,128));copy.set(b.subarray(148),128);new DataView(copy.buffer).setUint32(84,dx<=72?0x31545844:dx<=75?0x33545844:0x35545844,true);return decodeDds(copy.buffer);}}
 if(!['ATI1','ATI2','BC4U','BC4S','BC5U','BC5S'].includes(format))return decodeDds(input);
 const width=v.getUint32(16,true),height=v.getUint32(12,true),two=['ATI2','BC5U','BC5S'].includes(format),size=two?16:8,data=new Uint8ClampedArray(width*height*4);signed=format.endsWith('S');
 if(width*height>64*1024*1024||offset+Math.ceil(width/4)*Math.ceil(height/4)*size>b.length)throw Error('Invalid BC4/BC5 texture dimensions.');
 for(let by=0;by<height;by+=4)for(let bx=0;bx<width;bx+=4){const red=channel(b,offset,signed),green=two?channel(b,offset+8,signed):red;offset+=size;for(let y=0;y<4;y++)for(let x=0;x<4;x++){if(bx+x>=width||by+y>=height)continue;const i=y*4+x,p=((by+y)*width+bx+x)*4,r=signed?(red[i]/127*.5+.5)*255:red[i],g=signed?(green[i]/127*.5+.5)*255:green[i],nx=r/127.5-1,ny=g/127.5-1;data[p]=r;data[p+1]=g;data[p+2]=two?(Math.sqrt(Math.max(0,1-nx*nx-ny*ny))*.5+.5)*255:r;data[p+3]=255;}}
 return {data,width,height};
}
