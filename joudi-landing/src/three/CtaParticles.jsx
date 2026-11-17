import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Q, reducedMotion } from "../lib/device";
import { scroll, inputXY } from "../lib/store";

// نقاط من شكل كلمة «جودي» (مرسومة بخط El Messiri على canvas مخفي)
function sampleWord(count) {
  const W = 900,
    H = 420;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.direction = "rtl";
  g.font = "700 300px 'El Messiri', serif";
  g.fillText("جودي", W / 2, H / 2 + 20);
  const data = g.getImageData(0, 0, W, H).data;
  const pts = [];
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (data[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = pts[Math.floor(Math.random() * pts.length)] || [W / 2, H / 2];
    out[i * 3] = ((p[0] - W / 2) / H) * 2 + (Math.random() - 0.5) * 0.01;
    out[i * 3 + 1] = (-(p[1] - H / 2) / H) * 2;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
  }
  return out;
}

const vert = /* glsl */ `
  uniform float uTime; uniform float uP; uniform float uPixel; uniform float uScale; uniform vec2 uMouse;
  attribute vec3 aTarget; attribute float aSeed;
  varying float vA;
  void main(){
    float delay = aSeed * 0.35;
    float t = clamp((uP - delay) / (1.0 - 0.35), 0.0, 1.0);
    t = 1.0 - pow(1.0 - t, 3.0);
    vec3 target = aTarget * uScale;
    // حركة دائمة خفيفة حتى بعد التشكّل
    target.x += sin(uTime * 0.8 + aSeed * 50.0) * 0.012 * uScale;
    target.y += cos(uTime * 0.7 + aSeed * 40.0) * 0.012 * uScale;
    vec3 p = mix(position, target, t);
    // يتنحّى عن الماوس
    vec2 d = p.xy - uMouse;
    float f = exp(-dot(d, d) * 3.0) * 0.18 * t;
    p.xy += normalize(d + 0.0001) * f;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 80.0);
    gl_PointSize = (3.5 + aSeed * 5.5) * uPixel * (1.0 + (1.0 - t) * 0.6) * (4.0 / -mv.z);
    vA = tw * (0.4 + t * 0.6) * 1.25;
  }
`;
const frag = /* glsl */ `
  varying float vA;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.0);
    vec3 c = mix(vec3(0.79, 0.64, 0.42), vec3(1.0, 0.93, 0.78), a);
    gl_FragColor = vec4(c, a * vA);
  }
`;

function Word({ count }) {
  const mat = useRef();
  const { viewport, size } = useThree();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const start = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 2 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      start[i * 3] = Math.cos(a) * r * 1.4;
      start[i * 3 + 1] = Math.sin(a) * r * 0.8;
      start[i * 3 + 2] = (Math.random() - 0.5) * 3;
      seed[i] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aTarget", new THREE.BufferAttribute(sampleWord(count), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uP: { value: 0 }, uPixel: { value: 1 }, uScale: { value: 1 }, uMouse: { value: new THREE.Vector2(9, 9) } }), []);
  useFrame((_, dt) => {
    const u = mat.current.uniforms;
    u.uTime.value += reducedMotion ? 0 : Math.min(dt, 0.05);
    const target = reducedMotion ? 1 : scroll.cta;
    u.uP.value += (target - u.uP.value) * Math.min(1, dt * 2.2);
    u.uPixel.value = viewport.dpr;
    u.uScale.value = Math.min(viewport.width * 0.3, 0.82);
    const m = inputXY();
    u.uMouse.value.set((m.x * viewport.width) / 2, (m.y * viewport.height) / 2);
  });
  return (
    <points geometry={geo} frustumCulled={false} position-y={viewport.height * (size.width < 768 ? 0.2 : 0.17)}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={vert} fragmentShader={frag} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export default function CtaParticles({ active }) {
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    const f = document.fonts;
    if (!f) return setFontReady(true);
    f.load("700 300px 'El Messiri'", "جودي").finally(() => setFontReady(true));
  }, []);
  return (
    <Canvas dpr={Q.dpr} frameloop={active ? "always" : "never"} camera={{ position: [0, 0, 4], fov: 45 }} gl={{ antialias: false, alpha: true }} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      {fontReady && <Word count={Q.ctaParticles} />}
    </Canvas>
  );
}
