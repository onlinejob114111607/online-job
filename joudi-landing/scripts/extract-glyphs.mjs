// يستخرج أشكال الأرقام ١ ٢ ٣ من خط El Messiri كمسارات SVG، عشان تنبني منها أرقام ذهبية ثلاثية الأبعاد (Extrude).
import opentype from "opentype.js";
import fs from "node:fs";
const file = new URL("../node_modules/@fontsource/el-messiri/files/el-messiri-arabic-700-normal.woff", import.meta.url);
const buf = fs.readFileSync(file);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const out = {};
for (const ch of ["١", "٢", "٣"]) {
  const g = font.charToGlyph(ch);
  const p = g.getPath(0, 0, 100);
  const bb = p.getBoundingBox();
  out[ch] = { d: p.toPathData(2), w: +(bb.x2 - bb.x1).toFixed(2), h: +(bb.y2 - bb.y1).toFixed(2), x: +bb.x1.toFixed(2), y: +bb.y1.toFixed(2), name: g.name };
}
fs.writeFileSync(new URL("../src/three/digits.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [v.name, v.w, v.h, v.d.length]])));
