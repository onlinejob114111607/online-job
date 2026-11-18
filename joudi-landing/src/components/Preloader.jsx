import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { reducedMotion } from "../lib/device";
import { heroReady } from "../lib/store";

// خيوط ذهبية حلزونية بتلتف حول المركز
function spiral(k, n) {
  const cx = 300,
    cy = 150;
  const a0 = (k / n) * Math.PI * 2;
  const R = 250 - k * 9;
  const turns = Math.PI * 1.7;
  let d = "";
  for (let i = 0; i <= 90; i++) {
    const t = (i / 90) * turns;
    const r = R * (1 - (0.62 * t) / turns);
    const ang = a0 + t;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r * 0.42 + Math.sin(t * 2 + k) * 6;
    d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d;
}

export default function Preloader({ onReveal, onDone }) {
  const root = useRef(null);
  const [gone, setGone] = useState(false);
  const counter = useRef(null);
  const bar = useRef(null);
  const threads = useMemo(() => Array.from({ length: 7 }, (_, k) => spiral(k, 7)), []);

  useLayoutEffect(() => {
    const q = gsap.utils.selector(root);
    const prog = { v: 0 };
    const render = () => {
      if (counter.current) counter.current.textContent = String(Math.round(prog.v)).padStart(2, "0");
      if (bar.current) bar.current.style.transform = `scaleX(${prog.v / 100})`;
    };

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(q(".pl-fill"), { opacity: 1 });
        Promise.race([heroReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
          onReveal?.();
          gsap.to(root.current, { opacity: 0, duration: 0.4, onComplete: () => (setGone(true), onDone?.()) });
        });
        return;
      }

      gsap.set(q(".pl-thread"), { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set(q(".pl-stroke"), { strokeDasharray: 900, strokeDashoffset: 900 });
      gsap.set(q(".pl-fill"), { opacity: 0 });

      const intro = gsap.timeline();
      intro
        .to(q(".pl-thread"), { strokeDashoffset: 0, duration: 2.1, ease: "power2.inOut", stagger: 0.09 }, 0)
        .to(q(".pl-threads"), { rotate: 38, duration: 3.6, ease: "power1.inOut", transformOrigin: "300px 150px" }, 0)
        .to(q(".pl-stroke"), { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut" }, 0.9)
        .to(q(".pl-threads"), { scale: 0.28, opacity: 0, duration: 1.5, ease: "expo.in", transformOrigin: "300px 150px" }, 1.7)
        .to(q(".pl-fill"), { opacity: 1, duration: 1.4, ease: "power2.out" }, 2.4)
        .to(q(".pl-stroke"), { opacity: 0.35, duration: 1 }, 2.6)
        .fromTo(q(".pl-sub"), { opacity: 0, y: 10, letterSpacing: "0.6em" }, { opacity: 1, y: 0, letterSpacing: "0.42em", duration: 1.6, ease: "expo.out" }, 2.4);

      // العدّاد: بيوصل 88% مع الحركة، والباقي لما يجهز المشهد
      gsap.to(prog, { v: 88, duration: 3.2, ease: "power2.inOut", onUpdate: render });
      const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
      const minTime = new Promise((r) => setTimeout(r, 3400));
      const cap = new Promise((r) => setTimeout(r, 9000));
      Promise.race([Promise.all([fonts, heroReady, minTime]), cap]).then(() => {
        gsap.to(prog, {
          v: 100,
          duration: 0.7,
          ease: "power3.out",
          onUpdate: render,
          onComplete: () => {
            const out = gsap.timeline({ onComplete: () => (setGone(true), onDone?.()) });
            out
              .to(q(".pl-content"), { opacity: 0, scale: 1.06, filter: "blur(14px)", duration: 1.1, ease: "power3.in" })
              .add(() => onReveal?.(), "-=0.2")
              .to(q(".pl-edge"), { opacity: 1, duration: 0.4 }, "-=0.3")
              .to(q(".pl-curtain-r"), { scaleX: 0, duration: 2, ease: "expo.inOut" }, "-=0.25")
              .to(q(".pl-curtain-l"), { scaleX: 0, duration: 2, ease: "expo.inOut" }, "<")
              .to(q(".pl-curtain"), { skewY: (i) => (i ? -1.5 : 1.5), duration: 1, ease: "sine.inOut", yoyo: true, repeat: 1 }, "<");
          },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    document.body.style.overflow = gone ? "" : "hidden";
  }, [gone]);

  if (gone) return null;

  const drape = {
    background:
      "linear-gradient(180deg, rgba(0,0,0,.25), transparent 18%, transparent 75%, rgba(0,0,0,.35)), repeating-linear-gradient(90deg, #3d111b 0px, #3b2496 22px, #5b3cc4 34px, #3b2496 48px, #3a0f19 70px, #2f1d78 84px)",
  };

  return (
    <div ref={root} className="fixed inset-0 z-[200]" role="status" aria-live="polite" aria-label="جاري تحميل جودي ستور">
      <div className="pl-curtain pl-curtain-r absolute inset-y-0 right-0 w-1/2 origin-right" style={drape}>
        <div className="pl-edge absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-gold/70 to-transparent opacity-0" />
      </div>
      <div className="pl-curtain pl-curtain-l absolute inset-y-0 left-0 w-1/2 origin-left" style={drape}>
        <div className="pl-edge absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-gold/70 to-transparent opacity-0" />
      </div>

      <div className="pl-content absolute inset-0 grid place-items-center" style={{ background: "radial-gradient(60% 50% at 50% 50%, rgba(59,36,150,.0), rgba(30,10,16,.55))" }}>
        <div className="w-[min(92vw,640px)]">
          <svg viewBox="0 0 600 300" className="w-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id="plg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#C48A12" />
                <stop offset=".35" stopColor="#FFEBB8" />
                <stop offset=".55" stopColor="#EDB23A" />
                <stop offset=".8" stopColor="#FFF3D1" />
                <stop offset="1" stopColor="#D39A1C" />
              </linearGradient>
              <filter id="plglow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g className="pl-threads" filter="url(#plglow)">
              {threads.map((d, i) => (
                <path key={i} d={d} pathLength="1" className="pl-thread" fill="none" stroke="url(#plg)" strokeWidth={i % 2 ? 0.7 : 1.1} strokeLinecap="round" opacity={0.55 + (i % 3) * 0.15} />
              ))}
            </g>
            <text x="300" y="185" textAnchor="middle" className="pl-stroke" fontFamily="'El Messiri', serif" fontWeight="700" fontSize="150" fill="none" stroke="url(#plg)" strokeWidth="1.2">
              جودي
            </text>
            <text x="300" y="185" textAnchor="middle" className="pl-fill" fontFamily="'El Messiri', serif" fontWeight="700" fontSize="150" fill="url(#plg)" filter="url(#plglow)">
              جودي
            </text>
          </svg>
          <p className="pl-sub -mt-2 text-center font-latin text-xs font-light uppercase tracking-[0.42em] text-gold-pale/80 sm:text-sm" dir="ltr">
            Joudi Store
          </p>
        </div>

        <div className="absolute inset-x-0 bottom-[9vh] mx-auto w-[min(70vw,320px)]">
          <div className="mb-3 flex items-end justify-between font-latin text-gold-pale/70" dir="ltr">
            <span className="text-[0.7rem] italic tracking-[0.3em]">LOADING ELEGANCE</span>
            <span className="text-2xl font-light tabular-nums">
              <span ref={counter}>00</span>
              <span className="text-sm">%</span>
            </span>
          </div>
          <div className="h-px w-full bg-gold/15">
            <div ref={bar} className="h-px w-full origin-left bg-gradient-to-r from-gold-deep via-gold-pale to-gold" style={{ transform: "scaleX(0)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
