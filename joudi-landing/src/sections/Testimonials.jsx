import { useEffect, useRef } from "react";
import SectionHeading from "../components/SectionHeading";
import Reveal from "../components/Reveal";
import { TESTIMONIALS } from "../config";
import { reducedMotion } from "../lib/device";
import { scroll } from "../lib/store";

// بطاقات آراء بتلف بشكل دائري ثلاثي الأبعاد — الآراء من config.js فقط (حقيقية)
function Card({ t }) {
  const empty = !t.text;
  return (
    <figure className="glass gold-frame flex h-full flex-col justify-between rounded-[1.75rem] p-7 text-right">
      <div>
        <svg viewBox="0 0 40 30" className="mb-5 h-7 w-9 text-gold" aria-hidden="true">
          <path fill="currentColor" d="M0 30V17C0 7 6 1.5 15 0l1.6 3.6C11 5.4 8.5 9 8.3 13H16v17H0Zm24 0V17C24 7 30 1.5 39 0l1.6 3.6C35 5.4 32.5 9 32.3 13H40v17H24Z" opacity=".75" />
        </svg>
        {empty ? (
          <blockquote className="grid min-h-[7.5rem] place-items-center rounded-2xl border border-dashed border-gold/60 bg-ivory/40 p-4 text-center font-display text-lg text-wine/70">
            [رأي عميلة حقيقي]
          </blockquote>
        ) : (
          <blockquote className="min-h-[7.5rem] font-display text-lg leading-9 text-wine">«{t.text}»</blockquote>
        )}
      </div>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-gold/25 pt-5">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold-deep font-display text-wine-3">{empty ? "؟" : t.name.trim()[0]}</span>
        <span>
          <span className="block font-display font-bold text-wine">{empty ? "[اسم العميلة]" : t.name}</span>
          <span className="block text-sm text-ink/60">{empty ? "[المدينة]" : t.city}</span>
        </span>
      </figcaption>
    </figure>
  );
}

export default function Testimonials() {
  const stage = useRef(null);
  const ring = useRef(null);
  const n = TESTIMONIALS.length;

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
      drag = { x: e.clientX, a: angle, t: performance.now() };
      stage.current.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
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
  }, []);

  return (
    <section id="reviews" className="relative overflow-hidden bg-ivory-2 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_60%,rgba(201,163,106,.22),transparent_70%)]" />
      <div className="container-lux relative">
        <SectionHeading eyebrow="IN THEIR WORDS" title="بكلماتهنّ" sub="هنا نحفظ كلمات عميلاتنا كما قلنها… حقيقيةً، بلا تجميل." />
      </div>
      <Reveal className="relative mt-14 sm:mt-20">
        <div ref={stage} className="relative mx-auto h-[25rem] w-full touch-pan-y select-none sm:h-[27rem]" style={{ perspective: "1600px" }} data-cursor="hover" aria-roledescription="carousel">
          <div ref={ring} className="absolute left-1/2 top-0 h-full w-[17rem] -translate-x-1/2 sm:w-[20rem]" style={{ transformStyle: "preserve-3d" }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="absolute inset-x-0 top-4 h-[22rem] sm:h-[23rem]" style={{ backfaceVisibility: "hidden" }}>
                <Card t={t} />
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-ink/50">اسحبي البطاقات لتدويرها</p>
      </Reveal>
    </section>
  );
}
