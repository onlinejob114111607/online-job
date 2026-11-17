// كشف قدرات الجهاز مرة وحدة: دعم WebGL، تقليل الحركة، ومستوى الجودة.
const mq = (q) => typeof window !== "undefined" && window.matchMedia && window.matchMedia(q).matches;

export const reducedMotion = mq("(prefers-reduced-motion: reduce)");
export const finePointer = mq("(hover: hover) and (pointer: fine)");
export const isTouch = !finePointer;

function detectWebGL() {
  if (typeof window !== "undefined" && new URLSearchParams(location.search).has("nogl")) return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    lose && lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

export const webgl = detectWebGL();

function detectTier() {
  if (!webgl) return "none";
  const q = new URLSearchParams(location.search).get("tier");
  if (q === "low" || q === "mid" || q === "high") return q;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (cores <= 4 || mem <= 2) return "low";
  if (small || isTouch) return "mid";
  return "high";
}

export const tier = detectTier();

// إعدادات الجودة حسب المستوى
export const Q = {
  high: { dpr: [1, 1.75], particles: 900, silkSeg: 180, shadows: 1024, bloom: true, glass: "transmission", ctaParticles: 6500 },
  mid: { dpr: [1, 1.5], particles: 420, silkSeg: 120, shadows: 512, bloom: false, glass: "physical", ctaParticles: 4200 },
  low: { dpr: [1, 1], particles: 180, silkSeg: 64, shadows: 0, bloom: false, glass: "simple", ctaParticles: 2400 },
  none: { dpr: [1, 1], particles: 0, silkSeg: 0, shadows: 0, bloom: false, glass: "none", ctaParticles: 0 },
}[tier];
