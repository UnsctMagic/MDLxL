// Convert a 32-bit top-left TGA to PNG for viewing.
const fs = require('fs'), zlib = require('zlib');
const [src, dst] = process.argv.slice(2), b = fs.readFileSync(src), w = b.readUInt16LE(12), h = b.readUInt16LE(14);
const raw = Buffer.alloc((w * 4 + 1) * h);
for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const s = 18 + (y * w + x) * 4, d = y * (w * 4 + 1) + 1 + x * 4; raw[d] = b[s + 2]; raw[d + 1] = b[s + 1]; raw[d + 2] = b[s]; raw[d + 3] = b[s + 3]; } }
const crc = buf => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of buf) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(dst, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
