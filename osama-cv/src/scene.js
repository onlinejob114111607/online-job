// المشهد ثلاثي الأبعاد: أيقونات زجاجية شفافة عائمة + غبار ذهبي
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PATHS } from "./icons.js";

function glyphTexture(name, color) {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.translate(s * 0.18, s * 0.18);
  g.scale((s * 0.64) / 24, (s * 0.64) / 24);
  g.lineCap = g.lineJoin = "round";
  const p = new Path2D(PATHS[name]);
  g.strokeStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 6;
  g.lineWidth = 1.6;
  g.stroke(p);
  g.shadowBlur = 0;
  g.lineWidth = 1.1;
  g.strokeStyle = "#fff";
  g.globalAlpha = 0.7;
  g.stroke(p);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function startScene(canvas, { reduced }) {
  const small = Math.min(innerWidth, innerHeight) < 700;
  const weak = small || (navigator.hardwareConcurrency || 4) <= 4;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !weak, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, weak ? 1.25 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const gold = new THREE.PointLight(0xe8b86a, 40, 30);
  gold.position.set(5, 3, 5);
  const blue = new THREE.PointLight(0x6f8cff, 30, 30);
  blue.position.set(-6, -3, 4);
  scene.add(gold, blue);

  const world = new THREE.Group();
  scene.add(world);

  // الأيقونات: [اسم، x، y، z، حجم، لون]
  // المواقع محسوبة للعربي (النص يمين = x موجب)، وبتنقلب لحالها بالإنجليزي
  const defs = [
    ["code", -4.6, 2.2, -1, 1.2, "#f3c77a"],
    ["db", 6.8, 3.9, -3, 1.0, "#8fb2ff"],
    ["phone", -1.4, -3.4, 0, 0.95, "#f3c77a"],
    ["wifi", -3.8, -2.4, -2.5, 1.1, "#8fb2ff"],
    ["chart", -1.2, 3.6, -4, 1.0, "#f3c77a"],
    ["cube", 1.4, 4.6, -4, 0.95, "#c9a6ff"],
    ["chat", -6.0, -0.2, -4.5, 1.0, "#7be3c4"],
    ["gear", 8.6, -3.8, -6, 1.1, "#f3c77a"],
    ["web", 2.6, -5.2, -4, 1.0, "#8fb2ff"],
    ["dash", -2.6, 0.6, -6.5, 1.2, "#c9a6ff"],
    ["bot", -7.8, -4.2, -7, 1.1, "#7be3c4"],
    ["land", -6.6, 3.6, -7, 1.0, "#f3c77a"],
  ];
  const list = weak ? defs.filter((_, i) => i % 3 !== 2) : defs;

  const boxGeo = new RoundedBoxGeometry(1, 1, 0.32, 5, 0.2);
  const planeGeo = new THREE.PlaneGeometry(0.78, 0.78);
  const items = [];

  // زجاج شفاف: لمعة على الحواف (fresnel) + انعكاس خفيف، والوسط شفاف عشان النص يضل مقروء
  const reflect = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.1,
    roughness: 0.08,
    transparent: true,
    opacity: 0.07,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    iridescence: 0.6,
    envMapIntensity: 2.2,
    depthWrite: false,
  });
  const rimMat = (color) =>
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          vec3 c = mix(uColor, vec3(1.0), 0.35) * f * 1.15 + uColor * 0.035; gl_FragColor = vec4(c, 1.0); }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

  for (const [name, x, y, z, size, color] of list) {
    const box = new THREE.Mesh(boxGeo, rimMat(color));
    box.add(new THREE.Mesh(boxGeo, reflect));
    const glyph = new THREE.Mesh(
      planeGeo,
      new THREE.MeshBasicMaterial({ map: glyphTexture(name, color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    glyph.position.z = 0.17;
    const back = glyph.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.17;
    const g = new THREE.Group();
    g.add(box, glyph, back);
    g.position.set(x, y, z);
    g.scale.setScalar(size);
    g.userData = { x, y, z, seed: Math.random() * 10, spin: (Math.random() - 0.5) * 0.4 };
    g.rotation.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.3);
    world.add(g);
    items.push(g);
  }

  // غبار ذهبي
  const N = weak ? 260 : 700;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 2] = -Math.random() * 14 + 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dot = document.createElement("canvas");
  dot.width = dot.height = 64;
  const dg = dot.getContext("2d");
  const grd = dg.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,230,180,1)");
  grd.addColorStop(1, "rgba(255,200,120,0)");
  dg.fillStyle = grd;
  dg.fillRect(0, 0, 64, 64);
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ size: 0.07, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })
  );
  scene.add(dust);

  // حجم الشاشة
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // على الشاشات الضيقة نبعد الكاميرا شوي عشان الأيقونات ما تطلع برا
    camera.position.z = w / h < 0.8 ? 15 : 11;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener("resize", resize);

  // الماوس والتمرير
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
  });
  let scrollT = 0, scrollS = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollT = max > 0 ? scrollY / max : 0;
  };
  addEventListener("scroll", readScroll, { passive: true });
  readScroll();

  let visible = true;
  document.addEventListener("visibilitychange", () => (visible = !document.hidden));

  const clock = new THREE.Clock();
  let flip = document.documentElement.dir === "rtl" ? 1 : -1;
  function frame() {
    const t = clock.getElapsedTime();
    flip += ((document.documentElement.dir === "rtl" ? 1 : -1) - flip) * 0.04;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    scrollS += (scrollT - scrollS) * 0.06;

    camera.position.x = mouse.x * 0.8;
    camera.position.y = -mouse.y * 0.5;
    camera.lookAt(0, 0, -3);

    // مع النزول: الأيقونات بتطلع لفوق وبتلف المجموعة بهدوء
    world.position.y = scrollS * 9;
    world.rotation.y = scrollS * 1.2;
    world.rotation.x = scrollS * 0.25;

    for (const g of items) {
      const u = g.userData;
      g.position.y = u.y + Math.sin(t * 0.6 + u.seed) * 0.35;
      g.position.x = (u.x + Math.cos(t * 0.4 + u.seed) * 0.15) * flip;
      g.rotation.y += u.spin * 0.01;
      g.rotation.x = Math.sin(t * 0.5 + u.seed) * 0.25;
    }
    dust.rotation.y = t * 0.02;
    dust.position.y = scrollS * 4;

    renderer.render(scene, camera);
  }

  if (reduced) {
    frame();
    addEventListener("resize", frame);
    addEventListener("scroll", () => requestAnimationFrame(frame), { passive: true });
  } else {
    renderer.setAnimationLoop(() => visible && frame());
  }
  return renderer;
}
