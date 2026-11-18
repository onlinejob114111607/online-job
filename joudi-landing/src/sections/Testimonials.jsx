import { useEffect, useRef } from "react";
import SectionHeading from "../components/SectionHeading";
import Reveal from "../components/Reveal";
import { useState } from "react";
import { STORE_URL } from "../config";
import { useCatalog } from "../lib/catalog";
import { reducedMotion } from "../lib/device";
import { scroll } from "../lib/store";

// صور حقيقية لآراء الزبائن (من قسم "آراء زبائننا" بالمتجر) بشكل حلقة ثلاثية الأبعاد
function Card({ f, onOpen }) {
  return (
    <figure className="glass gold-frame h-full overflow-hidden rounded-[1.75rem] p-2" onClick={() => onOpen(f)}>
      <img src={f.img} alt={f.text || "رأي زبون"} loading="lazy" draggable="false" className="h-full w-full rounded-[1.4rem] object-cover object-top" />
    </figure>
  );
}

export default function Testimonials() {
  const data = useCatalog();
  const list = (data?.feedback || []).slice(0, 10);
  if (list.length < 3) return null;
  return <Ring list={list} />;
}

function Ring({ list }) {
  const stage = useRef(null);
  const ring = useRef(null);
  const [open, setOpen] = useState(null);
  const n = list.length;

  useEffect(() => {
    const el = ring.current;
    const cards = [...el.children];
    let angle = 0,
      vel = 0,
      drag = null,
      raf,
      visible = false,
      radius = 0;
    const layout = () => {
      const w = cards[0].offsetWidth;
      radius = Math.round((w / 2 / Math.tan(Math.PI / n)) * 1.12);
      cards.forEach((c, i) => (c.style.transform = `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)`));
      el.style.transform = `translateZ(${-radius}px) rotateY(${angle}deg)`;
    };
    const render = () => {
      el.style.transform = `translateZ(${-radius}px) rotateY(${angle}deg)`;
      cards.forEach((c, i) => {
        const a = (((360 / n) * i + angle) * Math.PI) / 180;
        const f = (Math.cos(a) + 1) / 2; // 1 = قدّام
        c.style.opacity = (0.18 + f * 0.82).toFixed(3);
        c.style.filter = f < 0.6 ? `blur(${((0.6 - f) * 6).toFixed(1)}px)` : "none";
      });
    };
    const loop = () => {
      if (!drag) {
        vel += ((reducedMotion ? 0 : -0.06) - vel) * 0.03;
        vel -= scroll.velocity * 0.004;
        angle += vel;
      }
      render();
      raf = visible ? requestAnimationFrame(loop) : 0;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) loop();
    });
    io.observe(stage.current);
    const down = (e) => {
      drag = { x: e.clientX, a: angle, t: performance.now(), moved: false };
      window.__ringDrag = false;
      stage.current.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      window.__ringDrag = drag.moved;
      const na = drag.a + dx * 0.25;
      vel = na - angle;
      angle = na;
    };
    const up = () => (drag = null);
    const s = stage.current;
    s.addEventListener("pointerdown", down);
    s.addEventListener("pointermove", move);
    s.addEventListener("pointerup", up);
    s.addEventListener("pointercancel", up);
    layout();
    render();
    const ro = new ResizeObserver(layout);
    ro.observe(s);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      s.removeEventListener("pointerdown", down);
      s.removeEventListener("pointermove", move);
      s.removeEventListener("pointerup", up);
      s.removeEventListener("pointercancel", up);
    };
  }, [n]);

  return (
    <section id="reviews" className="relative overflow-hidden bg-ivory-2 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_60%,rgba(245,179,1,.18),transparent_70%)]" />
      <div className="container-lux relative">
        <SectionHeading eyebrow="REAL CUSTOMERS" title="شو حكوا زبائننا" sub="صور حقيقية من رسائل زبائننا بعد ما وصلتهم طلبياتهم." />
      </div>
      <Reveal className="relative mt-14 sm:mt-20">
        <div ref={stage} className="relative mx-auto h-[25rem] w-full touch-pan-y select-none sm:h-[27rem]" style={{ perspective: "1600px" }} data-cursor="hover" aria-roledescription="carousel">
          <div ref={ring} className="absolute left-1/2 top-0 h-full w-[17rem] -translate-x-1/2 sm:w-[20rem]" style={{ transformStyle: "preserve-3d" }}>
            {list.map((f, i) => (
              <div key={i} className="absolute inset-x-0 top-4 h-[22rem] cursor-zoom-in sm:h-[23rem]" style={{ backfaceVisibility: "hidden" }}>
                <Card f={f} onOpen={(x) => !window.__ringDrag && setOpen(x)} />
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-ink/50">اسحب الصور لتدويرها، واضغط على أي صورة لتكبيرها</p>
        <p className="mt-4 text-center">
          <a href={`${STORE_URL}#/reviews`} target="_blank" rel="noopener" className="font-display font-bold text-wine underline decoration-gold underline-offset-8">
            شوف كل الآراء بالمتجر
          </a>
        </p>
      </Reveal>
      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-coal/90 p-4 backdrop-blur-sm" onClick={() => setOpen(null)} role="dialog" aria-modal="true">
          <img src={open.img} alt={open.text || "رأي زبون"} className="max-h-[88vh] max-w-full rounded-2xl shadow-2xl" />
          <button type="button" className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-ivory/15 text-2xl text-ivory" aria-label="إغلاق">
            ×
          </button>
        </div>
      )}
    </section>
  );
}
