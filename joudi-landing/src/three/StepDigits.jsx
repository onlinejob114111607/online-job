import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import * as THREE from "three";
import StudioEnv from "./StudioEnv";
import { goldMaterial } from "./materials";
import digits from "./digits.json";
import { Q, reducedMotion } from "../lib/device";
import { inputXY } from "../lib/store";

const gold = goldMaterial(0.13);
const KEYS = ["١", "٢", "٣"];

// أرقام ذهبية ضخمة من خط El Messiri، مجسّمة (Extrude) بحواف مشطوفة
function useDigitGeometry(ch) {
  return useMemo(() => {
    const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${digits[ch].d}"/></svg>`);
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    const g = new THREE.ExtrudeGeometry(shapes, { depth: 14, bevelEnabled: true, bevelThickness: 3.2, bevelSize: 1.6, bevelSegments: 5, curveSegments: 18 });
    g.center();
    g.scale(1 / 61.4, -1 / 61.4, 1 / 61.4); // SVG محور y معكوس
    g.computeVertexNormals();
    return g;
  }, [ch]);
}

function Digit({ index, anchor, container }) {
  const geo = useDigitGeometry(KEYS[index]);
  const g = useRef();
  const { size } = useThree();
  useFrame((state) => {
    const a = anchor.current,
      c = container.current;
    if (!a || !c) return;
    const ar = a.getBoundingClientRect(),
      cr = c.getBoundingClientRect();
    g.current.position.set(ar.left + ar.width / 2 - cr.left - size.width / 2, -(ar.top + ar.height / 2 - cr.top - size.height / 2), 0);
    g.current.scale.setScalar(ar.height * 0.86);
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    const m = inputXY();
    // ميلان مع التمرير (موقع العنصر بالشاشة) ومع الماوس
    const screenY = (ar.top + ar.height / 2) / window.innerHeight - 0.5;
    g.current.rotation.y = Math.sin(t * 0.5 + index * 1.7) * 0.35 + m.x * 0.25;
    g.current.rotation.x = screenY * -0.7 + m.y * -0.15;
  });
  return <mesh ref={g} geometry={geo} material={gold} />;
}

export default function StepDigits({ anchors, container, active }) {
  return (
    <Canvas
      orthographic
      dpr={Q.dpr}
      frameloop={active ? "always" : "never"}
      camera={{ zoom: 1, position: [0, 0, 800], near: 1, far: 3000 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[300, 500, 600]} intensity={1.5} color="#FFF3DF" />
      <StudioEnv resolution={128} />
      {anchors.map((a, i) => (
        <Digit key={i} index={i} anchor={a} container={container} />
      ))}
    </Canvas>
  );
}
