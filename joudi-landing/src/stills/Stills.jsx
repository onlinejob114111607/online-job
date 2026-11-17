// صفحة داخلية (مش منشورة) لتوليد صور التشكيلات كصور ثابتة WebP — شغّليها بـ npm run stills
import { createRoot } from "react-dom/client";
import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import "@fontsource/el-messiri/700.css";
import StudioEnv from "../three/StudioEnv";
import Silk from "../three/Silk";
import GoldDust from "../three/GoldDust";
import Perfume from "../three/Perfume";
import Pedestal, { PEDESTAL_TOP } from "../three/Pedestal";
import { goldMaterial, marbleMaterial } from "../three/materials";
import HeroScene from "../three/HeroScene";

const scene = new URLSearchParams(location.search).get("scene") || "beauty";
const gold = goldMaterial(0.14);
const pearlMat = new THREE.MeshPhysicalMaterial({ color: "#FFF8EE", roughness: 0.16, clearcoat: 1, sheen: 1, sheenColor: "#F2D9C0", iridescence: 0.7, iridescenceIOR: 1.6 });

function Backdrop({ a = "#3a1420", b = "#120c0b" }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.); }`,
        fragmentShader: `uniform vec3 uA; uniform vec3 uB; varying vec2 vUv; void main(){ float d=distance(vUv, vec2(0.55,0.62)); gl_FragColor=vec4(mix(uA,uB,smoothstep(0.0,0.85,d)),1.);
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

function Slab(props) {
  const m = useMemo(() => marbleMaterial(), []);
  return (
    <mesh material={m} {...props}>
      <boxGeometry args={[5, 0.25, 3.2]} />
    </mesh>
  );
}

function Hanger() {
  const geo = useMemo(() => {
    const pts = [
      [-1.25, 0], [-0.6, 0.32], [-0.12, 0.55], [0, 0.62], [0.12, 0.55], [0.6, 0.32], [1.25, 0], [1.1, -0.06], [-1.1, -0.06], [-1.25, 0],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.2), 160, 0.035, 16, true);
  }, []);
  const hook = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.62, 0), new THREE.Vector3(0, 0.85, 0), new THREE.Vector3(0.05, 1.05, 0), new THREE.Vector3(0.2, 1.1, 0), new THREE.Vector3(0.28, 0.98, 0)]);
    return new THREE.TubeGeometry(c, 64, 0.025, 12, false);
  }, []);
  return (
    <group>
      <mesh geometry={geo} material={gold} />
      <mesh geometry={hook} material={gold} />
    </group>
  );
}

function Fashion() {
  return (
    <>
      <group position={[0, 1.55, 0]} rotation-z={0.04}>
        <Hanger />
      </group>
      <Silk position={[0, -0.75, 0.1]} rotation={[0.05, -0.25, 0]} scale={0.36} width={7.5} height={12.8} segments={200} amp={1.5} color="#8A2B40" deep="#2A0910" />
      <Silk position={[0.6, -1, -1.2]} rotation={[0, 0.5, 0.15]} scale={0.5} width={8} height={10} segments={140} amp={1.3} color="#5A1E2B" deep="#1e070c" opacity={0.75} />
      <GoldDust count={160} box={[5, 6, 2]} size={30} />
    </>
  );
}

function Necklace() {
  const pts = useMemo(() => {
    const out = [];
    const n = 46;
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * Math.PI * 1.15 - 0.15;
      out.push([Math.cos(t) * 1.15 - 0.1, 0.06, Math.sin(t) * 0.75 - 0.1]);
    }
    return out;
  }, []);
  return pts.map((p, i) => (
    <mesh key={i} material={pearlMat} position={p}>
      <sphereGeometry args={[0.06, 24, 24]} />
    </mesh>
  ));
}

function Accessories() {
  return (
    <>
      <Slab position={[0, -0.13, 0]} />
      <Necklace />
      <mesh material={gold} position={[0.15, 0.065, 0.35]} rotation={[Math.PI / 2 - 0.05, 0, 0]}>
        <torusGeometry args={[0.32, 0.06, 32, 128]} />
      </mesh>
      <mesh material={gold} position={[0.55, 0.3, 0.05]} rotation={[0.25, -0.6, 0.1]}>
        <torusGeometry args={[0.28, 0.05, 32, 128]} />
        <mesh position={[0, 0.3, 0]} scale={[1, 1.2, 1]}>
          <octahedronGeometry args={[0.1, 0]} />
          <meshPhysicalMaterial color="#FFFFFF" transmission={1} thickness={0.2} roughness={0} ior={2.4} />
        </mesh>
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[-0.9 + s * 0.22, 0.04, 0.55]} rotation-x={Math.PI / 2}>
          <mesh material={gold}>
            <torusGeometry args={[0.1, 0.02, 16, 64]} />
          </mesh>
          <mesh material={pearlMat} position-y={-0.15}>
            <sphereGeometry args={[0.065, 24, 24]} />
          </mesh>
        </group>
      ))}
      <GoldDust count={120} box={[5, 4, 3]} position={[0, 1.4, 0]} size={30} />
    </>
  );
}

function Beauty() {
  return (
    <>
      <Pedestal scale={0.8} position-y={-0.5} />
      <group position-y={-0.5 + PEDESTAL_TOP * 0.8}>
        <Perfume glass="transmission" scale={1.5} position={[0.1, 0, -0.1]} />
        <group position={[-0.75, 0, 0.35]}>
          <mesh material={gold} position-y={0.22}>
            <cylinderGeometry args={[0.13, 0.13, 0.44, 48]} />
          </mesh>
          <mesh position-y={0.55} rotation-z={0}>
            <cylinderGeometry args={[0.095, 0.1, 0.26, 48]} />
            <meshPhysicalMaterial color="#8E1F33" roughness={0.25} clearcoat={1} />
          </mesh>
        </group>
        <group position={[0.85, 0, 0.45]}>
          <mesh position-y={0.12}>
            <cylinderGeometry args={[0.3, 0.3, 0.24, 64]} />
            <meshPhysicalMaterial color="#F6EDE2" roughness={0.18} clearcoat={1} />
          </mesh>
          <mesh material={gold} position-y={0.29}>
            <cylinderGeometry args={[0.31, 0.31, 0.1, 64]} />
          </mesh>
        </group>
      </group>
      <GoldDust count={140} box={[5, 5, 3]} position={[0, 1.2, 0]} size={30} />
    </>
  );
}

function Home() {
  const vase = useMemo(() => {
    const pts = [[0, 0], [0.32, 0], [0.42, 0.25], [0.48, 0.6], [0.4, 0.95], [0.2, 1.25], [0.17, 1.45], [0.22, 1.55], [0.2, 1.56]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 96);
  }, []);
  const stems = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i - 3) * 0.16;
        const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 1.3, 0), new THREE.Vector3(Math.sin(a) * 0.4, 2.0, Math.cos(i) * 0.1), new THREE.Vector3(Math.sin(a) * 1.0, 2.7 - Math.abs(a), Math.cos(i * 2) * 0.2)]);
        return { geo: new THREE.TubeGeometry(c, 40, 0.012, 6, false), tip: c.getPoint(1) };
      }),
    []
  );
  const flame = useRef();
  return (
    <>
      <Slab position={[0, -0.13, 0]} scale={[0.9, 1, 0.9]} />
      <group position={[-0.45, 0, -0.2]}>
        <mesh geometry={vase}>
          <meshPhysicalMaterial color="#F3E9DC" roughness={0.3} clearcoat={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh material={gold} position-y={0.6} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.483, 0.012, 8, 96]} />
        </mesh>
        {stems.map((s, i) => (
          <group key={i}>
            <mesh geometry={s.geo} material={gold} />
            <mesh position={s.tip} scale={[0.6, 1.4, 0.6]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color="#E9D2A8" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>
      <group position={[0.75, 0, 0.35]}>
        <mesh position-y={0.32}>
          <cylinderGeometry args={[0.26, 0.26, 0.64, 64]} />
          <meshPhysicalMaterial color="#5A1E2B" roughness={0.35} clearcoat={0.6} />
        </mesh>
        <mesh material={gold} position-y={0.64} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.26, 0.015, 8, 64]} />
        </mesh>
        <mesh ref={flame} position-y={0.78} scale={[0.5, 1, 0.5]}>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshBasicMaterial color={[6, 4, 1.8]} toneMapped={false} />
        </mesh>
        <pointLight position-y={0.85} intensity={3} color="#FFC37A" distance={4} />
      </group>
      <GoldDust count={120} box={[5, 5, 3]} position={[0, 1.6, 0]} size={30} />
    </>
  );
}

const SCENES = {
  fashion: { C: Fashion, cam: [0.6, 0.4, 9.5], look: [0, 0.15, 0], bg: ["#4a1622", "#100a09"] },
  accessories: { C: Accessories, cam: [0.3, 3.6, 4.4], look: [-0.15, 0, 0.2], bg: ["#3a1420", "#100a09"] },
  beauty: { C: Beauty, cam: [0.3, 1.9, 6.4], look: [0, 0.6, 0], bg: ["#4a1622", "#120c0b"] },
  home: { C: Home, cam: [0.4, 1.7, 5.2], look: [0, 0.95, 0], bg: ["#3a1a14", "#100a09"] },
  hero: null,
};

function Cam({ pos, look }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...pos);
    camera.lookAt(...look);
  }, []);
  const n = useRef(0);
  useFrame(() => {
    if (++n.current === 40) window.__ready = true;
  });
  return null;
}

function App() {
  if (scene === "hero") {
    setTimeout(() => (window.__ready = true), 6000);
    return (
      <div style={{ position: "fixed", inset: 0 }}>
        <HeroScene active />
      </div>
    );
  }
  const s = SCENES[scene];
  return (
    <Canvas style={{ position: "fixed", inset: 0 }} dpr={1} camera={{ fov: 32 }} gl={{ antialias: false, preserveDrawingBuffer: true }}>
      <Backdrop a={s.bg[0]} b={s.bg[1]} />
      <ambientLight intensity={0.25} />
      <spotLight position={[2, 6, 4]} angle={0.5} penumbra={1} intensity={60} color="#FFE9C8" />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#E6B98A" />
      <StudioEnv resolution={256} />
      <s.C />
      <Cam pos={s.cam} look={s.look} />
      <EffectComposer multisampling={8}>
        <Bloom mipmapBlur luminanceThreshold={0.9} intensity={0.7} radius={0.7} />
        <Vignette offset={0.25} darkness={0.55} />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      </EffectComposer>
    </Canvas>
  );
}

createRoot(document.getElementById("root")).render(<App />);
