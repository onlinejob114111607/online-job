import { Environment, Lightformer } from "@react-three/drei";

// إضاءة استوديو ناعمة (HDRI مولّد بالكود — بدون تحميل ملفات)
export default function StudioEnv({ resolution = 256 }) {
  return (
    <Environment resolution={resolution} frames={1}>
      <color attach="background" args={["#6b4c3b"]} />
      <Lightformer form="rect" intensity={2.6} color="#FFF4E2" position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
      <Lightformer form="rect" intensity={1.6} color="#FFE7C2" position={[-6, 2, 3]} rotation-y={Math.PI / 2.4} scale={[4, 8, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#F2C98F" position={[6, 1.5, -1]} rotation-y={-Math.PI / 2.2} scale={[3, 8, 1]} />
      <Lightformer form="ring" intensity={2.2} color="#FFF0D6" position={[2, 3, 6]} scale={2.2} onUpdate={(s) => s.lookAt(0, 0, 0)} />
      <Lightformer form="rect" intensity={0.8} color="#6D4FD6" position={[0, -3, -5]} scale={[12, 4, 1]} />
      <Lightformer form="rect" intensity={1.4} color="#FFE3B5" position={[0, -4, 3]} rotation-x={-Math.PI / 2} scale={[10, 6, 1]} />
    </Environment>
  );
}
