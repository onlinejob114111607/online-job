import { useMemo } from "react";
import { MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";
import { goldMaterial } from "./materials";

// زجاجة عطر زجاجية بغطا ذهبي مضلّع
export default function Perfume({ glass = "physical", ...props }) {
  const gold = useMemo(() => goldMaterial(0.12), []);
  const bodyGeo = useMemo(() => {
    const pts = [
      [0.0, 0.0], [0.3, 0.0], [0.345, 0.03], [0.36, 0.12], [0.355, 0.42], [0.33, 0.52],
      [0.24, 0.6], [0.12, 0.65], [0.1, 0.7], [0.0, 0.7],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, 8); // أوجه مسطّحة = زجاج مقطوع
    g.computeVertexNormals();
    return g;
  }, []);
  const liquidGeo = useMemo(() => {
    const pts = [[0, 0.05], [0.27, 0.05], [0.3, 0.12], [0.3, 0.38], [0, 0.38]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 8);
  }, []);

  return (
    <group {...props}>
      <mesh geometry={bodyGeo} castShadow>
        {glass === "transmission" ? (
          <MeshTransmissionMaterial samples={6} resolution={512} thickness={0.35} roughness={0.04} ior={1.45} chromaticAberration={0.05} anisotropicBlur={0.1} distortion={0.05} color="#FFF8F0" backside backsideThickness={0.2} />
        ) : glass === "simple" ? (
          <meshPhysicalMaterial color="#FFF3E6" roughness={0.05} metalness={0} clearcoat={1} envMapIntensity={2} transparent opacity={0.42} depthWrite={false} />
        ) : (
          <meshPhysicalMaterial transmission={1} thickness={0.4} roughness={0.05} ior={1.5} color="#FFF6EE" metalness={0} envMapIntensity={1.4} clearcoat={1} transparent opacity={glass === "none" ? 0.5 : 1} />
        )}
      </mesh>
      <mesh geometry={liquidGeo} scale={0.96}>
        <meshPhysicalMaterial color="#D9895F" transmission={0.55} roughness={0.15} thickness={0.6} ior={1.35} attenuationColor="#B5523B" attenuationDistance={0.6} envMapIntensity={1} />
      </mesh>
      <mesh material={gold} position-y={0.75}>
        <cylinderGeometry args={[0.11, 0.11, 0.1, 32]} />
      </mesh>
      <mesh material={gold} position-y={0.96} scale={[1, 1.25, 1]}>
        <icosahedronGeometry args={[0.16, 0]} />
      </mesh>
    </group>
  );
}
