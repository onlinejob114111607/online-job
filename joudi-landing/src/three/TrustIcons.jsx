import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import StudioEnv from "./StudioEnv";
import { goldMaterial } from "./materials";
import { Q, reducedMotion } from "../lib/device";

const gold = goldMaterial(0.15);
const goldSoft = goldMaterial(0.32);
const wine = new THREE.MeshPhysicalMaterial({ color: "#5A1E2B", roughness: 0.3, clearcoat: 1 });
const glass =
  Q.glass === "simple"
    ? new THREE.MeshPhysicalMaterial({ color: "#FFF7EC", roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.4, envMapIntensity: 2 })
    : new THREE.MeshPhysicalMaterial({ color: "#FFF7EC", transmission: 1, thickness: 0.2, roughness: 0.04, ior: 1.5, envMapIntensity: 1.5 });
const dark = new THREE.MeshPhysicalMaterial({ color: "#2a1614", roughness: 0.15, metalness: 0.4 });

function Truck() {
  const wheel = useMemo(() => new THREE.CylinderGeometry(0.17, 0.17, 0.12, 32), []);
  return (
    <group position={[0, 0.05, 0]}>
      <RoundedBox args={[1.05, 0.66, 0.62]} radius={0.06} position={[-0.2, 0.08, 0]} material={gold} />
      <RoundedBox args={[0.46, 0.5, 0.6]} radius={0.08} position={[0.58, -0.003, 0]} material={gold} />
      <mesh material={dark} position={[0.7, 0.08, 0]}>
        <boxGeometry args={[0.25, 0.2, 0.61]} />
      </mesh>
      <mesh material={wine} position={[-0.2, 0.08, 0.315]}>
        <boxGeometry args={[0.7, 0.04, 0.01]} />
      </mesh>
      {[
        [-0.45, 0.31],
        [0.55, 0.31],
        [-0.45, -0.31],
        [0.55, -0.31],
      ].map(([x, z], i) => (
        <mesh key={i} geometry={wheel} material={dark} position={[x, -0.3, z]} rotation-x={Math.PI / 2}>
          <mesh material={gold} position-y={z > 0 ? 0.065 : -0.065}>
            <cylinderGeometry args={[0.08, 0.08, 0.01, 24]} />
          </mesh>
        </mesh>
      ))}
    </group>
  );
}

function HandCoin() {
  const coin = useRef();
  useFrame((_, dt) => !reducedMotion && (coin.current.rotation.y += dt * 2.2));
  return (
    <group position-y={-0.15}>
      {/* كفّ مبسّط */}
      <RoundedBox args={[0.78, 0.16, 0.5]} radius={0.075} smoothness={4} position={[0, -0.25, 0]} rotation-z={0.08} material={goldSoft} />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={goldSoft} position={[-0.27 + i * 0.18, -0.2 + Math.sin(i * 0.9) * 0.02, 0.32]} rotation-x={Math.PI / 2 - 0.35}>
          <capsuleGeometry args={[0.07, 0.24 - Math.abs(i - 1.5) * 0.04, 8, 16]} />
        </mesh>
      ))}
      <mesh material={goldSoft} position={[0.46, -0.12, 0.05]} rotation={[0, 0, -0.9]}>
        <capsuleGeometry args={[0.075, 0.22, 8, 16]} />
      </mesh>
      {/* العملة */}
      <group ref={coin} position-y={0.32}>
        <mesh material={gold} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.32, 0.32, 0.07, 64]} />
        </mesh>
        <mesh material={goldSoft} position-z={0.036}>
          <torusGeometry args={[0.24, 0.018, 12, 64]} />
        </mesh>
        <mesh material={goldSoft} position-z={-0.036}>
          <torusGeometry args={[0.24, 0.018, 12, 64]} />
        </mesh>
      </group>
    </group>
  );
}

function Lens() {
  return (
    <group rotation-z={0.15} position={[-0.08, 0.1, 0]}>
      <mesh material={gold}>
        <torusGeometry args={[0.38, 0.075, 24, 96]} />
      </mesh>
      <mesh material={glass} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.36, 0.36, 0.04, 64]} />
      </mesh>
      <group rotation-z={Math.PI / 4} position={[0.42, -0.42, 0]}>
        <mesh material={gold} position-y={-0.05}>
          <cylinderGeometry args={[0.075, 0.09, 0.5, 32]} />
        </mesh>
        <mesh material={wine} position-y={-0.33}>
          <sphereGeometry args={[0.095, 24, 24]} />
        </mesh>
      </group>
    </group>
  );
}

function Chat() {
  const geo = useMemo(() => {
    const w = 1.1,
      h = 0.74,
      r = 0.26;
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(-0.05, -h / 2);
    s.lineTo(-0.3, -h / 2 - 0.26); // ذيل الفقاعة
    s.lineTo(-0.28, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 6, curveSegments: 24 });
    g.center();
    return g;
  }, []);
  const dots = useRef();
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    dots.current.children.forEach((d, i) => (d.position.y = 0.06 + Math.max(0, Math.sin(clock.elapsedTime * 4 - i * 0.7)) * 0.07));
  });
  return (
    <group>
      <mesh geometry={geo} material={gold} />
      <group ref={dots} position-z={0.14}>
        {[-0.25, 0, 0.25].map((x) => (
          <mesh key={x} material={wine} position={[x, 0.06, 0]}>
            <sphereGeometry args={[0.07, 24, 24]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const MODELS = [Truck, HandCoin, Lens, Chat];

function Icon({ index, anchor, container, hover }) {
  const g = useRef();
  const spin = useRef(0);
  const { size } = useThree();
  const Model = MODELS[index];
  useFrame((state, dt) => {
    const a = anchor.current,
      c = container.current;
    if (!a || !c) return;
    // موقع الأيقونة = مركز العنصر بالـ DOM (كاميرا orthographic: وحدة = بكسل)
    const ar = a.getBoundingClientRect(),
      cr = c.getBoundingClientRect();
    const x = ar.left + ar.width / 2 - cr.left - size.width / 2;
    const y = -(ar.top + ar.height / 2 - cr.top - size.height / 2);
    g.current.position.set(x, y, 0);
    g.current.scale.setScalar(ar.width * 0.58);
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    const isHover = hover.current === index;
    spin.current += dt * (isHover ? 2.4 : 0.55);
    g.current.rotation.y = spin.current + index;
    g.current.rotation.x = Math.sin(t * 0.8 + index) * 0.12 + 0.12;
    g.current.position.y += Math.sin(t * 1.2 + index * 1.4) * ar.width * 0.03;
  });
  return (
    <group ref={g}>
      <Model />
    </group>
  );
}

export default function TrustIcons({ anchors, container, hover, active }) {
  return (
    <Canvas
      orthographic
      dpr={Q.dpr}
      frameloop={active ? "always" : "never"}
      camera={{ zoom: 1, position: [0, 0, 500], near: 1, far: 2000 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[200, 400, 500]} intensity={1.6} color="#FFF3DF" />
      <StudioEnv resolution={128} />
      {anchors.map((a, i) => (
        <Icon key={i} index={i} anchor={a} container={container} hover={hover} />
      ))}
    </Canvas>
  );
}
