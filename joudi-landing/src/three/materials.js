import * as THREE from "three";

// ذهب مصقول بانعكاسات
export const goldMaterial = (rough = 0.16) =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#F7C75A"),
    metalness: 1,
    roughness: rough,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.35,
  });

// ساتان عنابي للعلبة
export const satinWine = () =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#3B2496"),
    roughness: 0.42,
    metalness: 0.05,
    sheen: 1,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color("#FFD677"),
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.9,
  });

// ===== رخام كريمي (texture مولّد بالكود) =====
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi),
    b = hash(xi + 1, yi),
    c = hash(xi, yi + 1),
    d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  let f = 0,
    amp = 0.5;
  for (let i = 0; i < 5; i++) {
    f += amp * vnoise(x, y);
    x *= 2.02;
    y *= 2.02;
    amp *= 0.5;
  }
  return f;
}

let marbleTex = null;
export function marbleTexture(size = 512) {
  if (marbleTex) return marbleTex;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size / 2;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(c.width, c.height);
  const base = [246, 239, 228];
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const nx = (x / c.width) * 6,
        ny = (y / c.height) * 3;
      const n = fbm(nx, ny);
      const vein = Math.abs(Math.sin((nx * 0.9 + ny * 1.7 + n * 5.5) * 1.6));
      const v = Math.pow(1 - vein, 14); // عروق رفيعة
      const v2 = Math.pow(1 - Math.abs(Math.sin((nx * 1.9 - ny * 0.6 + n * 7) * 2.2)), 30) * 0.5;
      const cloud = (fbm(nx * 1.3 + 9, ny * 1.3) - 0.5) * 18;
      const i = (y * c.width + x) * 4;
      const dark = v * 70 + v2 * 50;
      img.data[i] = base[0] + cloud - dark * 0.75;
      img.data[i + 1] = base[1] + cloud - dark * 0.85;
      img.data[i + 2] = base[2] + cloud - dark * 0.8 + v * 6; // عرق رمادي دافئ
      // لمسة ذهبية بالعروق
      if (v > 0.6) {
        img.data[i] += 18 * v;
        img.data[i + 1] += 8 * v;
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  marbleTex = new THREE.CanvasTexture(c);
  marbleTex.colorSpace = THREE.SRGBColorSpace;
  marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;
  marbleTex.anisotropy = 4;
  return marbleTex;
}

export const marbleMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    map: marbleTexture(),
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.8,
  });

// ===== حرير وساتان متموّج (GLSL) =====
export const silkVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform vec2 uMouse;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vH;

  float wave(vec2 p){
    float t = uTime * 0.28;
    // طيّات كبيرة ناعمة متل الحرير المعلّق
    float warp = sin(p.y * 0.35 + t * 0.6) * 1.1;
    float h = sin(p.x * 0.95 + warp + t) * 0.42;
    h += sin(p.x * 1.9 - p.y * 0.45 + warp - t * 0.9) * 0.16;
    h += sin((p.x * 0.5 + p.y * 0.9) * 1.1 + t * 0.7) * 0.2;
    float d = length(p - uMouse * vec2(4.0, 2.5));
    h += sin(d * 2.0 - t * 4.0) * 0.05 * exp(-d * 0.35);
    return h * uAmp;
  }

  void main(){
    vUv = uv;
    vec3 p = position;
    // الطرف السفلي بيتدلّى أكتر
    float hang = smoothstep(0.0, 1.0, 1.0 - uv.y);
    float e = 0.02;
    float h  = wave(p.xy) * (0.6 + hang * 0.6);
    float hx = wave(p.xy + vec2(e, 0.0)) * (0.6 + hang * 0.6);
    float hy = wave(p.xy + vec2(0.0, e)) * (0.6 + hang * 0.6);
    p.z += h;
    vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
    vH = h;
    vN = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

export const silkFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform vec3 uSheen;
  uniform vec3 uGold;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vH;

  void main(){
    vec3 N = normalize(vN);
    if(!gl_FrontFacing) N = -N;
    vec3 V = normalize(vView);
    vec3 L1 = normalize(vec3(0.35, 0.8, 0.55));
    vec3 L2 = normalize(vec3(-0.8, 0.25, 0.45));
    float dif = max(dot(N, L1), 0.0);
    float wrap = max((dot(N, L2) + 0.4) / 1.4, 0.0) * 0.35;
    vec3 col = mix(uDeep, uColor, smoothstep(0.05, 0.95, dif) + wrap * 0.5);
    // لمعة الساتان: حزمة عريضة بلون الحرير + خط ضوء رفيع
    vec3 H = normalize(L1 + V);
    float nh = max(dot(N, H), 0.0);
    float broad = pow(nh, 14.0);
    float sharp = pow(nh, 160.0);
    col += uColor * 1.15 * broad;
    col += uSheen * sharp * 0.9;
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uGold * fres * 0.12;
    // تلاشي ناعم عند الأطراف
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    gl_FragColor = vec4(col, edge * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ===== غبار ذهبي (particles) =====
export const dustVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixel;
  uniform vec3 uBox;
  attribute float aSeed;
  attribute float aScale;
  varying float vAlpha;
  void main(){
    vec3 p = position;
    float t = uTime * (0.05 + aSeed * 0.06);
    p.y = mod(p.y + t * uBox.y + uBox.y * 0.5, uBox.y) - uBox.y * 0.5;
    p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.25;
    p.z += cos(uTime * 0.25 + aSeed * 30.0) * 0.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixel * (1.0 / -mv.z);
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 90.0);
    float fadeY = smoothstep(uBox.y * 0.5, uBox.y * 0.3, abs(p.y));
    vAlpha = tw * fadeY;
  }
`;

export const dustFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(core, 2.4);
    gl_FragColor = vec4(uColor * (0.8 + glow * 0.8), glow * vAlpha * uOpacity);
  }
`;
