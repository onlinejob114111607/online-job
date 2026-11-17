import { createRef, lazy, Suspense, useMemo, useRef } from "react";
import { webgl } from "../lib/device";
import { TrustFallbackIcons } from "../components/Icons";
import Reveal from "../components/Reveal";

const TrustIcons = lazy(() => import("../three/TrustIcons"));

const ITEMS = [
  { t: "توصيل لكل المناطق", e: "Delivered everywhere", s: "الضفة الغربية، القدس، والداخل" },
  { t: "الدفع عند الاستلام", e: "Cash on delivery", s: "لا تدفعين إلا حين يصلكِ طلبكِ" },
  { t: "افحصي قبل ما تدفعي", e: "Inspect first", s: "اطمئني بعينكِ قبل أي شيء" },
  { t: "خدمة شخصية على واتساب", e: "Personal care", s: "نجيبكِ بأنفسنا، وبكل ودّ" },
];

export default function TrustStrip({ active, embedded = false }) {
  const container = useRef(null);
  const hover = useRef(-1);
  const anchors = useMemo(() => ITEMS.map(() => createRef()), []);
  const Wrap = embedded ? "div" : Reveal;

  return (
    <section ref={container} className={`relative w-full ${embedded ? "" : "bg-ivory py-24 sm:py-28"}`} aria-labelledby="trust-title">
      {webgl && (
        <Suspense fallback={null}>
          <TrustIcons anchors={anchors} container={container} hover={hover} active={active} />
        </Suspense>
      )}
      <div className="container-lux relative">
        <div className="trust-head mb-12 text-center sm:mb-16">
          <p className="eyebrow mb-3 text-gold-deep">OUR PROMISE TO YOU</p>
          <h2 id="trust-title" className="h-display text-3xl text-wine sm:text-5xl">
            وعدُنا لكِ
          </h2>
          <div className="hairline mx-auto mt-6 w-40" />
        </div>
        <Wrap {...(embedded ? {} : { stagger: 0.12 })} className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-4 md:gap-8">
          {ITEMS.map((it, i) => {
            const Fallback = TrustFallbackIcons[i];
            return (
              <div key={i} className="trust-item group flex flex-col items-center text-center" onPointerEnter={() => (hover.current = i)} onPointerLeave={() => (hover.current = -1)} data-cursor="hover">
                <div className="relative mb-5 grid h-24 w-24 place-items-center sm:h-28 sm:w-28">
                  <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(242,227,196,.9),rgba(242,227,196,0)_70%)] transition-transform duration-1000 ease-lux group-hover:scale-125" />
                  <div className="absolute inset-1 rounded-full border border-gold/30 transition-colors duration-700 group-hover:border-gold/70" />
                  <div ref={anchors[i]} className="absolute inset-0" />
                  {!webgl && <Fallback className="relative h-12 w-12 text-gold-deep" />}
                </div>
                <h3 className="font-display text-[1.08rem] font-bold text-wine sm:text-xl">{it.t}</h3>
                <p className="eyebrow mt-1 !text-[0.7rem] !tracking-[0.22em] text-gold-deep">{it.e}</p>
                <p className="mt-2 text-sm leading-6 text-ink/70">{it.s}</p>
              </div>
            );
          })}
        </Wrap>
      </div>
    </section>
  );
}
