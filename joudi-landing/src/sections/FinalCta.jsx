import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import SplitText from "../components/SplitText";
import Reveal from "../components/Reveal";
import Magnetic from "../components/Magnetic";
import { BagIcon } from "../components/Icons";
import { STORE_URL } from "../config";
import { webgl, reducedMotion } from "../lib/device";
import { scroll } from "../lib/store";
import useInView from "../lib/useInView";

const CtaParticles = lazy(() => import("../three/CtaParticles"));

export default function FinalCta() {
  const sec = useRef(null);
  const inView = useInView(sec);
  useLayoutEffect(() => {
    if (reducedMotion) return (scroll.cta = 1);
    const ctx = gsap.context(() => {
      gsap.to(scroll, { cta: 1, ease: "none", scrollTrigger: { trigger: sec.current, start: "top 85%", end: "top 15%", scrub: true } });
    }, sec);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sec} id="start" className="relative grid min-h-[100svh] place-items-center overflow-hidden text-center" style={{ background: "radial-gradient(90% 70% at 50% 35%, #4C2BB0 0%, #2F1D78 35%, #1A1240 70%, #0F0B1F 100%)" }}>
      <div className="grain absolute inset-0" />
      {webgl ? (
        <Suspense fallback={null}>
          <CtaParticles active={inView} />
        </Suspense>
      ) : (
        <div className="text-gold-grad absolute inset-x-0 top-[10%] font-display text-[30vw] font-bold leading-none opacity-90 sm:text-[18rem]" aria-hidden="true">
          جودي
        </div>
      )}
      <div className="container-lux relative z-10 mt-[28svh] sm:mt-[30svh]">
        <Reveal as="p" className="eyebrow mb-5 text-gold" y={20}>
          BECAUSE YOU DESERVE THE MOST BEAUTIFUL
        </Reveal>
        <SplitText as="h2" text={"لأنكِ تستحقين الأجمل…\nطلبكِ القادم بانتظاركِ"} className="h-display text-[2rem] text-ivory sm:text-5xl lg:text-6xl" stagger={0.09} />
        <Reveal delay={0.4} className="mt-10 flex justify-center">
          <Magnetic href={STORE_URL} className="btn-gold !px-10 !py-5 text-lg" style={{ animation: "glow-pulse 3.2s ease-in-out infinite" }}>
            <BagIcon />
            ابدئي التسوّق
          </Magnetic>
        </Reveal>
      </div>
    </section>
  );
}
