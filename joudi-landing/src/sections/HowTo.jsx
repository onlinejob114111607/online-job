import { createRef, lazy, Suspense, useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import SectionHeading from "../components/SectionHeading";
import Reveal from "../components/Reveal";
import { reducedMotion, webgl } from "../lib/device";
import useInView from "../lib/useInView";

const StepDigits = lazy(() => import("../three/StepDigits"));

const STEPS = [
  { n: "١", t: "اختاري", e: "Choose", s: "تجوّلي في المتجر على راحتكِ، واختاري ما يشبهكِ." },
  { n: "٢", t: "اطلبي", e: "Order", s: "أكملي طلبكِ من المتجر، أو أرسليه لنا على واتساب بكلمتين." },
  { n: "٣", t: "استلمي وافحصي وادفعي", e: "Receive · Inspect · Pay", s: "يصلكِ الطلب إلى باب بيتكِ، تفحصينه بعينكِ، ثم تدفعين." },
];

export default function HowTo() {
  const sec = useRef(null);
  const grid = useRef(null);
  const anchors = useMemo(() => STEPS.map(() => createRef()), []);
  const inView = useInView(sec);

  useLayoutEffect(() => {
    const paths = sec.current.querySelectorAll(".thread");
    if (reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(paths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: grid.current, start: "top 75%", end: "bottom 55%", scrub: 1.2 } });
      gsap.utils.toArray(".step").forEach((el, i) => {
        gsap.fromTo(el.querySelectorAll(".step-txt"), { opacity: 0, y: 40, filter: "blur(10px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.4, stagger: 0.1, scrollTrigger: { trigger: el, start: "top 78%", once: true } });
      });
    }, sec);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sec} id="how" className="relative overflow-hidden bg-ivory py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ivory-2 to-transparent" />
      <div className="container-lux relative">
        <SectionHeading eyebrow="HOW TO ORDER" title="كيف تطلبين؟" sub="ثلاث خطوات بسيطة… وطلبكِ في الطريق إليكِ." />

        <div ref={grid} className="relative mt-16 sm:mt-24">
          {webgl && (
            <Suspense fallback={null}>
              <StepDigits anchors={anchors} container={grid} active={inView} />
            </Suspense>
          )}
          {/* الخيط الذهبي — أفقي على الكمبيوتر */}
          <svg className="pointer-events-none absolute inset-x-0 top-[5.5rem] hidden h-40 w-full md:block" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="thg" x1="1" x2="0">
                <stop offset="0" stopColor="#C48A12" />
                <stop offset=".5" stopColor="#FFEBB8" />
                <stop offset="1" stopColor="#EDB23A" />
              </linearGradient>
            </defs>
            <path className="thread" pathLength="1" strokeDasharray="1" d="M 1000 80 C 920 10, 860 150, 780 80 S 620 0, 500 80 S 300 170, 220 80 S 60 20, 0 80" fill="none" stroke="url(#thg)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* عمودي على الموبايل */}
          <svg className="pointer-events-none absolute inset-y-0 left-1/2 w-24 -translate-x-1/2 md:hidden" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden="true">
            <path className="thread" pathLength="1" strokeDasharray="1" d="M 50 0 C 0 120, 100 200, 50 330 S 0 520, 50 660 S 100 860, 50 1000" fill="none" stroke="#EDB23A" strokeWidth="1.4" vectorEffect="non-scaling-stroke" opacity=".8" />
          </svg>

          <ol className="relative grid gap-20 md:grid-cols-3 md:gap-10">
            {STEPS.map((s, i) => (
              <li key={i} className="step flex flex-col items-center text-center">
                <div className="relative mb-8 h-44 w-44 sm:h-52 sm:w-52">
                  <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle,rgba(242,227,196,.95),rgba(247,244,255,0)_70%)]" />
                  <div ref={anchors[i]} className="absolute inset-0" />
                  {!webgl && <span className="absolute inset-0 grid place-items-center bg-clip-text font-display text-[9rem] font-bold leading-none text-transparent" style={{ backgroundImage: "linear-gradient(160deg,#FFD677 10%,#D39A1C 45%,#7A5A2E 90%)", WebkitBackgroundClip: "text" }}>{s.n}</span>}
                </div>
                <div className="relative rounded-3xl bg-ivory/80 px-4 py-2 backdrop-blur-sm">
                  <p className="step-txt eyebrow !text-[0.72rem] text-gold-deep">STEP 0{i + 1} — {s.e}</p>
                  <h3 className="step-txt mt-2 font-display text-[1.7rem] font-bold text-wine">{s.t}</h3>
                  <p className="step-txt mx-auto mt-3 max-w-[18rem] text-[1.02rem] leading-8 text-ink/75">{s.s}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
