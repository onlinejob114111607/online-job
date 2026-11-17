import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import Silk from "./Silk";
import GoldDust from "./GoldDust";
import Pedestal, { PEDESTAL_TOP } from "./Pedestal";
import GiftBox from "./GiftBox";
import Perfume from "./Perfume";
import StudioEnv from "./StudioEnv";
import { Q, reducedMotion } from "../lib/device";
import { scroll, inputXY, markHeroReady } from "../lib/store";

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

// خلفية عاجية بتدرّج ناعم وعمق خفيف
function Backdrop() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { uA: { value: new THREE.Color("#FBF7F1") }, uB: { value: new THREE.Color("#E9DCC8") } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.); }`,
        fragmentShader: `uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
          void main(){ float d=distance(vUv, vec2(0.5,0.58)); vec3 c=mix(uA,uB,smoothstep(0.1,0.95,d)); gl_FragColor=vec4(c,1.);
          #include <colorspace_fragment>
          }`,
      }),
    []
  );
  return (
    <mesh material={mat} frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

// ظل ناعم (مخبوز) تحت العناصر — أخف وأثبت من الظلال الحيّة
let shadowTex;
function getShadowTex() {
  if (shadowTex) return shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(50,18,14,0.75)");
  r.addColorStop(0.45, "rgba(50,18,14,0.3)");
  r.addColorStop(1, "rgba(50,18,14,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return (shadowTex = new THREE.CanvasTexture(c));
}
function SoftShadow({ scale = 1, opacity = 0.5, ...props }) {
  return (
    <mesh rotation-x={-Math.PI / 2} scale={[scale, scale, 1]} {...props}>
      <planeGeometry />
      <meshBasicMaterial map={getShadowTex()} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ظل ناعم تحت المنصة
function FloorShadow() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(60,25,20,0.55)");
    r.addColorStop(0.55, "rgba(60,25,20,0.18)");
    r.addColorStop(1, "rgba(60,25,20,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={-0.01} scale={[5.4, 5.4, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function Rig({ open, boxRef }) {
  const boxW = useRef(new THREE.Vector3(0, PEDESTAL_TOP, 0));
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3());
  const cur = useRef({ x: 0, y: 0 });
  useFrame((state, dt) => {
    const k = 1 - Math.pow(0.0018, Math.min(dt, 0.05)); // damping مستقل عن الـ fps
    open.current = reducedMotion ? scroll.hero : lerp(open.current, scroll.hero, k * 0.9);
    const p = open.current;
    const aspect = size.width / size.height;
    const portrait = aspect < 0.85;

    const m = inputXY();
    cur.current.x = lerp(cur.current.x, reducedMotion ? 0 : m.x, k * 0.35);
    cur.current.y = lerp(cur.current.y, reducedMotion ? 0 : m.y, k * 0.35);

    const dolly = smooth(0.06, 0.78, p);
    // التأطير: على الكمبيوتر المشهد لليسار (النص يمين)، على الموبايل لتحت
    const baseZ = portrait ? 12.8 : 10.4;
    const offX = portrait ? 0 : aspect > 1.3 ? 2.1 : 1.3;
    const offY = portrait ? 1.95 : 0.1;
    const z = lerp(baseZ, 1.5, dolly);
    const y = lerp(portrait ? 3.4 : 2.9, PEDESTAL_TOP + 3.1, dolly);
    const par = 1 - dolly * 0.7;
    if (boxRef.current) boxRef.current.getWorldPosition(boxW.current);
    const bx = boxW.current.x,
      bz = boxW.current.z;
    camera.position.set(cur.current.x * 0.7 * par + lerp(offX * 0.25, bx, dolly), y + cur.current.y * 0.35 * par, lerp(z, bz + 1.5, dolly * dolly));
    look.current.set(lerp(offX, bx, dolly), lerp(1.05 + offY, PEDESTAL_TOP + 0.6, dolly), lerp(0, bz, dolly));
    camera.lookAt(look.current);
    camera.rotation.z += cur.current.x * -0.02 * par; // ميلان خفيف
  });
  return null;
}

function Stage({ open, boxRef }) {
  const spin = useRef();
  useFrame((_, dt) => {
    if (reducedMotion) return;
    const slow = 1 - smooth(0.0, 0.35, open.current);
    spin.current.rotation.y += Math.min(dt, 0.05) * 0.16 * slow;
  });
  return (
    <group ref={spin} rotation-y={-0.5}>
      <Pedestal />
      <GiftBox ref={boxRef} open={open} position={[-0.2, PEDESTAL_TOP, -0.1]} rotation-y={0.35} />
      <Perfume glass={Q.glass} position={[0.82, PEDESTAL_TOP, 0.5]} scale={0.95} />
      {/* لؤلؤ صغير على المنصة */}
      {[
        [0.6, 1.05],
        [0.74, 1.0],
        [0.86, 0.9],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x - 1.65, PEDESTAL_TOP + 0.055, z - 0.25]}>
          <sphereGeometry args={[0.055, 24, 24]} />
          <meshPhysicalMaterial color="#FFF8EE" roughness={0.18} clearcoat={1} sheen={1} sheenColor="#F2D9C0" iridescence={0.6} iridescenceIOR={1.6} />
        </mesh>
      ))}
      <SoftShadow position={[-0.2, PEDESTAL_TOP + 0.004, -0.1]} scale={1.9} opacity={0.6} />
      <SoftShadow position={[0.82, PEDESTAL_TOP + 0.004, 0.5]} scale={1} opacity={0.45} />
    </group>
  );
}

function Ready() {
  const n = useRef(0);
  useFrame(() => {
    if (++n.current === 3) markHeroReady();
  });
  return null;
}

export default function HeroScene({ active = true }) {
  const open = useRef(0);
  const boxRef = useRef(null);
  const [dpr, setDpr] = useState(Q.dpr[1]);
  const [fx, setFx] = useState(Q.bloom);

  useEffect(() => {
    const t = setTimeout(markHeroReady, 7000); // احتياط
    return () => clearTimeout(t);
  }, []);

  return (
    <Canvas
      dpr={dpr}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: !fx, alpha: false, powerPreference: "high-performance", toneMapping: THREE.NeutralToneMapping, preserveDrawingBuffer: false }}
      camera={{ fov: 34, near: 0.1, far: 60, position: [0, 2.4, 7.4] }}
      onCreated={({ gl }) => gl.setClearColor("#F6EFE4")}
      aria-hidden="true"
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr((d) => Math.max(1, d - 0.25));
          setFx(false);
        }}
        flipflops={3}
      />
      <Backdrop />
      <fog attach="fog" args={["#EFE4D4", 14, 34]} />
      <ambientLight intensity={0.35} color="#FFF1E0" />
      <directionalLight position={[3, 6, 5]} intensity={1.4} color="#FFF0DC" />
      <directionalLight position={[-5, 3, -2]} intensity={0.6} color="#E6B98A" />
      <Suspense fallback={null}>
        <StudioEnv resolution={Q.dpr[1] > 1.5 ? 256 : 128} />
        <Silk segments={Q.silkSeg} position={[0, 3, -4.2]} rotation={[-0.1, 0, 0.08]} width={22} height={12} deep="#24070D" amp={1.35} />
        <Silk segments={Math.round(Q.silkSeg * 0.5)} position={[-3.2, 0.6, -2.2]} rotation={[-0.3, 0.5, 0.35]} width={6} height={3.6} color="#7A2C3D" amp={0.55} opacity={0.85} />
        <Stage open={open} boxRef={boxRef} />
        <FloorShadow />
        <GoldDust count={Q.particles} box={[11, 7, 7]} position={[0, 2.6, 0]} size={26} color="#B8894A" additive={false} opacity={0.9} />
        <GoldDust count={Math.round(Q.particles * 0.35)} box={[3, 4, 3]} position={[0, 3, 0]} size={38} color="#FFE2A8" opacity={0.8} />
        <Rig open={open} boxRef={boxRef} />
        <Ready />
      </Suspense>
      {fx && (
        <EffectComposer multisampling={4} disableNormalPass>
          <Bloom mipmapBlur luminanceThreshold={0.92} luminanceSmoothing={0.2} intensity={0.55} radius={0.7} />
          <Vignette offset={0.32} darkness={0.35} eskil={false} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
