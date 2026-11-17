import { useLayoutEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import gsap from "gsap";
import SectionHeading from "../components/SectionHeading";
import Reveal from "../components/Reveal";
import { CardIcons } from "../components/Icons";
import { finePointer, reducedMotion } from "../lib/device";

const CARDS = [
  { t: "مختارة بعناية", e: "Curated with love", s: "كل قطعة نختارها كأنها لكِ وحدكِ، فلا يصلكِ إلا ما يستحقّكِ.", depth: 1 },
  { t: "أمانكِ أولاً", e: "Peace of mind", s: "لا تدفعين شيكلاً قبل أن تلمسي طلبكِ وتطمئنّي إليه.", depth: 2.2 },
  { t: "قريبة منكِ أينما كنتِ", e: "Wherever you are", s: "من جنين إلى الخليل، ومن القدس إلى الداخل… طلبكِ يعرف طريقه إليكِ.", depth: 0.6 },
  { t: "صوتٌ يسمعكِ", e: "A voice that cares", s: "على واتساب نجيبكِ بأنفسنا، ننصحكِ، ونتابع طلبكِ حتى يصل.", depth: 1.7 },
];

function TiltCard({ c, i }) {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const cfg = { stiffness: 120, damping: 18, mass: 0.6 };
  const rx = useSpring(useTransform(my, [0, 1], [9, -9]), cfg);
  const ry = useSpring(useTransform(mx, [0, 1], [-11, 11]), cfg);
  const gx = useTransform(mx, (v) => `${v * 100}%`);
  const gy = useTransform(my, (v) => `${v * 100}%`);
  const shine = useTransform([gx, gy], ([x, y]) => `radial-gradient(420px circle at ${x} ${y}, rgba(255,246,228,.75), rgba(242,227,196,.15) 40%, transparent 65%)`);
  const Icon = CardIcons[i];
  const on = finePointer && !reducedMotion;

  return (
    <div>
     <div className="why-card h-full" data-depth={c.depth} style={{ perspective: 1100 }}>
      <motion.article
        ref={ref}
        onPointerMove={(e) => {
          if (!on) return;
          const r = ref.current.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width);
          my.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => (mx.set(0.5), my.set(0.5))}
        style={{ rotateX: on ? rx : 0, rotateY: on ? ry : 0, transformStyle: "preserve-3d" }}
        className="glass gold-frame group relative h-full overflow-hidden rounded-[2rem] p-7 sm:p-8"
        data-cursor="hover"
      >
        {/* لمعة تتبع الماوس */}
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
          style={{ background: shine }}
        />
        <div style={{ transform: "translateZ(50px)" }} className="relative">
          <div className="mb-8 flex items-center justify-between">
            <Icon className="h-12 w-12 text-gold-deep transition-transform duration-1000 ease-lux group-hover:scale-110 group-hover:-rotate-6" />
            <span className="font-latin text-4xl font-light italic text-gold/60" dir="ltr">
              0{i + 1}
            </span>
          </div>
          <h3 className="font-display text-2xl font-bold text-wine">{c.t}</h3>
          <p className="eyebrow mt-1 !text-[0.72rem] !tracking-[0.24em] text-gold-deep">{c.e}</p>
          <p className="mt-5 text-[1.02rem] leading-8 text-ink/80">{c.s}</p>
        </div>
      </motion.article>
     </div>
    </div>
  );
}

export default function Why() {
  const sec = useRef(null);
  useLayoutEffect(() => {
    if (reducedMotion) return;
    const ctx = gsap.context(() => {
      // كل بطاقة بعمق مختلف (parallax)
      gsap.utils.toArray(".why-card").forEach((el) => {
        const d = parseFloat(el.dataset.depth);
        gsap.fromTo(el, { y: d * 60 }, { y: -d * 60, ease: "none", scrollTrigger: { trigger: sec.current, start: "top bottom", end: "bottom top", scrub: true } });
      });
      gsap.to(".why-blob", { yPercent: -30, ease: "none", scrollTrigger: { trigger: sec.current, start: "top bottom", end: "bottom top", scrub: true } });
    }, sec);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sec} id="why" className="grain relative overflow-hidden bg-ivory py-28 sm:py-36">
      <div className="why-blob pointer-events-none absolute -right-40 top-10 h-[34rem] w-[34rem] rounded-full bg-wine/25 blur-[110px]" style={{ animation: "float-blob 16s ease-in-out infinite" }} />
      <div className="why-blob pointer-events-none absolute -left-32 bottom-0 h-[30rem] w-[30rem] rounded-full bg-gold/35 blur-[110px]" style={{ animation: "float-blob 19s ease-in-out infinite reverse" }} />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-wine-soft/20 blur-[90px]" />

      <div className="container-lux relative">
        <SectionHeading eyebrow="WHY JOUDI STORE" title="لماذا جودي ستور؟" sub="لأن التسوّق عندنا ليس صفقة… بل وعدٌ صغير نحفظه في كل طلب." />
        <Reveal stagger={0.14} className="mt-16 grid gap-6 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {CARDS.map((c, i) => (
            <TiltCard key={i} c={c} i={i} />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
