// حالة مشتركة خفيفة (بدون re-render) بين التمرير والمشاهد ثلاثية الأبعاد
export const scroll = {
  hero: 0, // تقدّم انتقال الهيرو (0 → 1)
  velocity: 0,
  cta: 0, // تقدّم تجمّع الجزيئات بالنداء الأخير
};

export const pointer = { x: 0, y: 0 }; // -1 → 1
export const gyro = { x: 0, y: 0, active: false };

let listening = false;
export function listenPointer() {
  if (listening) return;
  listening = true;
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true }
  );

  const onOrient = (e) => {
    if (e.gamma == null) return;
    gyro.active = true;
    gyro.x = Math.max(-1, Math.min(1, e.gamma / 30));
    gyro.y = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 30));
  };
  const start = () => window.addEventListener("deviceorientation", onOrient, { passive: true });
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    // iOS: لازم إذن بعد لمسة من المستخدمة
    const ask = () => {
      DOE.requestPermission()
        .then((s) => s === "granted" && start())
        .catch(() => {});
      window.removeEventListener("touchend", ask);
    };
    window.addEventListener("touchend", ask, { once: true });
  } else if (DOE) start();
}

// قيمة الإدخال الموحّدة (ماوس على الكمبيوتر، ميلان على الموبايل)
export function inputXY() {
  return gyro.active ? gyro : pointer;
}

// إشارة جاهزية المشهد للـ preloader
let readyResolve;
export const heroReady = new Promise((r) => (readyResolve = r));
export const markHeroReady = () => readyResolve && readyResolve();
