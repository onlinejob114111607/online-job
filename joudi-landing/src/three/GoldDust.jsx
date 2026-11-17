import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { dustVertex, dustFragment } from "./materials";
import { reducedMotion } from "../lib/device";

// جزيئات ذهبية طايرة بالهوا
export default function GoldDust({ count = 400, box = [10, 7, 6], size = 34, color = "#F2D9A6", opacity = 1, additive = true, ...props }) {
  const mat = useRef();
  const dpr = useThree((s) => s.viewport.dpr);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * box[0];
      pos[i * 3 + 1] = (Math.random() - 0.5) * box[1];
      pos[i * 3 + 2] = (Math.random() - 0.5) * box[2];
      seed[i] = Math.random();
      scale[i] = Math.pow(Math.random(), 2.2) * 1.4 + 0.25;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
    return g;
  }, [count]);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: size },
      uPixel: { value: dpr },
      uBox: { value: new THREE.Vector3(...box) },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
    }),
    []
  );
  useFrame((_, dt) => {
    if (!reducedMotion) mat.current.uniforms.uTime.value += Math.min(dt, 0.05);
    mat.current.uniforms.uPixel.value = dpr;
  });
  return (
    <points geometry={geo} {...props} frustumCulled={false}>
      <shaderMaterial ref={mat} uniforms={uniforms} vertexShader={dustVertex} fragmentShader={dustFragment} transparent depthWrite={false} blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending} />
    </points>
  );
}
