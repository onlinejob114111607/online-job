import { useMemo } from "react";
import { marbleMaterial, goldMaterial } from "./materials";

// منصة رخامية دائرية بطبقتين وحواف ذهبية
export const PEDESTAL_TOP = 0.62;

export default function Pedestal(props) {
  const marble = useMemo(() => marbleMaterial(), []);
  const gold = useMemo(() => goldMaterial(0.2), []);
  return (
    <group {...props}>
      <mesh material={marble} position-y={0.17} castShadow receiveShadow>
        <cylinderGeometry args={[1.75, 1.8, 0.34, 96]} />
      </mesh>
      <mesh material={gold} position-y={0.34} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.75, 0.022, 12, 160]} />
      </mesh>
      <mesh material={gold} position-y={0.005} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.8, 0.018, 12, 160]} />
      </mesh>
      <mesh material={marble} position-y={0.34 + 0.14} receiveShadow>
        <cylinderGeometry args={[1.45, 1.47, 0.28, 96]} />
      </mesh>
      <mesh material={gold} position-y={PEDESTAL_TOP} rotation-x={Math.PI / 2}>
        <torusGeometry args={[1.45, 0.02, 12, 160]} />
      </mesh>
    </group>
  );
}
