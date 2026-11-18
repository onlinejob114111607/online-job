import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { silkVertex, silkFragment } from "./materials";
import { inputXY } from "../lib/store";
import { reducedMotion } from "../lib/device";

// قماش حرير عنابي متموّج بحركة دائمة
export default function Silk({ segments = 140, color = "#4C2BB0", deep = "#140E33", width = 15, height = 8, opacity = 1, amp = 1, ...props }) {
  const mat = useRef();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 3 },
      uAmp: { value: amp },
      uMouse: { value: new THREE.Vector2() },
      uColor: { value: new THREE.Color(color) },
      uDeep: { value: new THREE.Color(deep) },
      uSheen: { value: new THREE.Color("#FFE9D2") },
      uGold: { value: new THREE.Color("#EDB23A") },
      uOpacity: { value: opacity },
    }),
    []
  );
  useFrame((_, dt) => {
    const u = mat.current.uniforms;
    if (!reducedMotion) u.uTime.value += Math.min(dt, 0.05);
    const m = inputXY();
    u.uMouse.value.x += (m.x - u.uMouse.value.x) * 0.03;
    u.uMouse.value.y += (m.y - u.uMouse.value.y) * 0.03;
  });
  const seg = Math.max(16, segments);
  return (
    <mesh {...props}>
      <planeGeometry args={[width, height, seg, Math.round(seg * (height / width))]} />
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={silkVertex} fragmentShader={silkFragment} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
