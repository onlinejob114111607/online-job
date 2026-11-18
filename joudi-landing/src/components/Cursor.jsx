import { useEffect, useRef } from "react";
import { finePointer, reducedMotion } from "../lib/device";

// مؤشر ذهبي ناعم (للكمبيوتر فقط)
export default function Cursor() {
  const ring = useRef(null);
  const dot = useRef(null);
  const label = useRef(null);

  useEffect(() => {
    if (!finePointer) return;
    document.documentElement.classList.add("has-cursor");
    let x = innerWidth / 2,
      y = innerHeight / 2,
      rx = x,
      ry = y,
      s = 1,
      ts = 1,
      raf;
    let visible = false;
    const move = (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        rx = x;
        ry = y;
        ring.current.style.opacity = dot.current.style.opacity = 1;
      }
    };
    const over = (e) => {
      const t = e.target.closest?.("a, button, [data-cursor], input, textarea");
      const r = ring.current;
      if (t) {
        const kind = t.dataset.cursor;
        ts = kind === "view" ? 3.2 : 2.1;
        r.classList.add("is-hover");
        label.current.textContent = kind === "view" ? t.dataset.cursorLabel || "اكتشفي" : "";
      } else {
        ts = 1;
        r.classList.remove("is-hover");
        label.current.textContent = "";
      }
    };
    const down = () => (ts *= 0.82);
    const up = () => (ts /= 0.82);
    const leave = () => {
      visible = false;
      ring.current.style.opacity = dot.current.style.opacity = 0;
    };
    const k = reducedMotion ? 1 : 0.16;
    const loop = () => {
      rx += (x - rx) * k;
      ry += (y - ry) * k;
      s += (ts - s) * 0.14;
      ring.current.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%) scale(${s})`;
      dot.current.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-cursor");
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  if (!finePointer) return null;
  return (
    <>
      <style>{`
        .lux-ring{position:fixed;left:0;top:0;width:34px;height:34px;border-radius:50%;pointer-events:none;z-index:9999;opacity:0;
          border:1px solid rgba(237,178,58,.85);transition:opacity .4s, background-color .6s var(--ease-lux), border-color .6s, box-shadow .6s;
          mix-blend-mode:normal;display:grid;place-items:center}
        .lux-ring.is-hover{background:radial-gradient(circle at 35% 30%,rgba(255,244,220,.55),rgba(237,178,58,.22) 55%,rgba(237,178,58,.08));
          border-color:rgba(242,227,196,.95);box-shadow:0 0 24px rgba(237,178,58,.55), inset 0 0 10px rgba(255,255,255,.35);backdrop-filter:blur(2px)}
        .lux-ring span{font:500 4.2px/1 Tajawal,sans-serif;color:#3B2496;letter-spacing:.02em;white-space:nowrap}
        .lux-dot{position:fixed;left:0;top:0;width:5px;height:5px;border-radius:50%;background:#EDB23A;pointer-events:none;z-index:9999;opacity:0;transition:opacity .3s;box-shadow:0 0 8px rgba(230,204,154,.9)}
      `}</style>
      <div ref={ring} className="lux-ring" aria-hidden="true">
        <span ref={label} />
      </div>
      <div ref={dot} className="lux-dot" aria-hidden="true" />
    </>
  );
}
