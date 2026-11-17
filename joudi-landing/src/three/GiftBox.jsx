import { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { goldMaterial, satinWine } from "./materials";

const W = 1.05,
  H = 0.82,
  T = 0.035; // سماكة الجدار

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// شعاع الضوء الطالع من العلبة
const beamVert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const beamFrag = `uniform float uI; uniform float uTime; varying vec2 vUv;
  void main(){
    float fade = pow(1.0 - vUv.y, 1.6);
    float rays = 0.65 + 0.35 * sin(vUv.x * 62.83 + uTime * 0.6) * sin(vUv.x * 25.1 - uTime * 0.4);
    vec3 c = mix(vec3(1.0, 0.86, 0.6), vec3(1.0, 0.97, 0.9), fade);
    gl_FragColor = vec4(c * 1.6, fade * rays * uI * 0.55);
  }`;

function Bow({ gold }) {
  const loop = useMemo(() => new THREE.TorusGeometry(0.16, 0.042, 18, 64), []);
  return (
    <group position-y={0.12}>
      <mesh geometry={loop} material={gold} position={[0.15, 0.06, 0]} rotation={[0, 0, -0.5]} scale={[1, 0.62, 0.8]} castShadow />
      <mesh geometry={loop} material={gold} position={[-0.15, 0.06, 0]} rotation={[0, 0, 0.5]} scale={[1, 0.62, 0.8]} castShadow />
      <mesh geometry={loop} material={gold} position={[0, 0.05, 0.12]} rotation={[0, Math.PI / 2, -0.45]} scale={[0.85, 0.55, 0.7]} castShadow />
      <mesh material={gold} position-y={0.02}>
        <sphereGeometry args={[0.07, 24, 24]} />
      </mesh>
    </group>
  );
}

const GiftBox = forwardRef(function GiftBox({ open, ...props }, ref) {
  const gold = useMemo(() => goldMaterial(0.14), []);
  const satin = useMemo(() => satinWine(), []);
  const lid = useRef();
  const glow = useRef();
  const light = useRef();
  const beam = useRef();
  const warm = useMemo(() => new THREE.Color("#FFD9A0"), []);
  const beamU = useMemo(() => ({ uI: { value: 0 }, uTime: { value: 0 } }), []);

  useFrame((_, dt) => {
    const p = open.current; // 0 → 1
    const lp = smooth(0.32, 0.72, p);
    lid.current.position.y = H + 0.08 + lp * 2.2 + Math.sin(performance.now() / 900) * 0.01 * (1 - lp);
    lid.current.position.z = -lp * 0.9;
    lid.current.rotation.x = -lp * 0.9;
    lid.current.rotation.z = lp * 0.25;
    const g = smooth(0.38, 0.8, p);
    glow.current.material.color.copy(warm).multiplyScalar(0.2 + g * 4.5);
    glow.current.visible = g > 0.001;
    light.current.intensity = g * 14;
    beamU.uI.value = smooth(0.45, 0.9, p);
    beamU.uTime.value += dt;
    beam.current.visible = beamU.uI.value > 0.001;
  });

  const wall = (pos, size) => (
    <RoundedBox args={size} radius={0.012} smoothness={2} position={pos} material={satin} castShadow receiveShadow />
  );

  return (
    <group ref={ref} {...props}>
      {/* جسم العلبة (مفتوح من فوق) */}
      <group position-y={H / 2}>
        {wall([0, -H / 2 + T / 2, 0], [W, T, W])}
        {wall([W / 2 - T / 2, 0, 0], [T, H, W])}
        {wall([-W / 2 + T / 2, 0, 0], [T, H, W])}
        {wall([0, 0, W / 2 - T / 2], [W - 2 * T, H, T])}
        {wall([0, 0, -W / 2 + T / 2], [W - 2 * T, H, T])}
        {/* شرائط ذهبية على الجوانب */}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={gold} rotation-y={(i * Math.PI) / 2} position={[Math.sin((i * Math.PI) / 2) * (W / 2 + 0.004), 0, Math.cos((i * Math.PI) / 2) * (W / 2 + 0.004)]}>
            <boxGeometry args={[0.15, H + 0.004, 0.008]} />
          </mesh>
        ))}
      </group>

      {/* الضوء الداخلي */}
      <mesh ref={glow} position-y={H - 0.12} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[W - 0.08, W - 0.08]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <pointLight ref={light} position-y={H + 0.1} color="#FFD8A0" intensity={0} distance={6} decay={1.6} />
      <mesh ref={beam} position-y={H + 1.6}>
        <cylinderGeometry args={[1.25, 0.46, 3.2, 64, 1, true]} />
        <shaderMaterial uniforms={beamU} vertexShader={beamVert} fragmentShader={beamFrag} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>

      {/* الغطا */}
      <group ref={lid} position-y={H + 0.08}>
        <RoundedBox args={[W + 0.06, 0.2, W + 0.06]} radius={0.03} smoothness={3} material={satin} castShadow />
        <mesh material={gold}>
          <boxGeometry args={[0.15, 0.204, W + 0.068]} />
        </mesh>
        <mesh material={gold}>
          <boxGeometry args={[W + 0.068, 0.204, 0.15]} />
        </mesh>
        <Bow gold={gold} />
      </group>
    </group>
  );
});
export default GiftBox;
