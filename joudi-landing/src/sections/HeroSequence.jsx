import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import SplitText from "../components/SplitText";
import Magnetic from "../components/Magnetic";
import { WhatsAppIcon, BagIcon } from "../components/Icons";
import TrustStrip from "./TrustStrip";
import { STORE_URL, waLink } from "../config";
import { reducedMotion, webgl } from "../lib/device";
import { scroll, markHeroReady } from "../lib/store";
import useInView from "../lib/useInView";

const HeroScene = lazy(() => import("../three/HeroScene"));
const still = `${import.meta.env.BASE_URL}images/hero-still.webp`;

function HeroCopy({ revealed }) {
  const fade = (d) => ({
    initial: { opacity: 0, y: 26, filter: "blur(10px)" },
    animate: revealed ? { opacity: 1, y: 0, filter: "blur(0px)" } : {},
    transition: { duration: 1.6, delay: d, ease: [0.19, 1, 0.22, 1] },
  });
  return (
    <div className="hero-copy pointer-events-none absolute inset-0 z-10">
      <div className="container-lux flex h-full flex-col items-center pt-[12svh] text-center md:items-start md:justify-center md:pt-0 md:text-right">
        <div className="pointer-events-auto max-w-[34rem] md:max-w-[44rem]">
          <motion.p {...fade(0.15)} className="eyebrow mb-5 text-wine/70">
            THE ART OF ELEGANCE — DELIVERED
          </motion.p>
          <SplitText as="h1" text={"أناقتكِ…\nتصلكِ حتى باب بيتكِ"} play={revealed} delay={0.3} stagger={0.11} className="h-display text-[2.1rem] leading-[1.35] text-wine xs:text-[2.3rem] sm:text-6xl lg:text-[4.4rem] lg:leading-[1.2]" />
          <motion.p {...fade(0.95)} className="mx-auto mt-4 max-w-[28rem] text-[0.98rem] leading-7 text-ink/85 sm:mt-5 sm:text-lg sm:leading-9 md:mx-0">
            تشكيلة مختارة بعناية لكِ ولعائلتكِ، توصيل لكل الضفة والقدس والداخل، وادفعي بس بعد ما تشوفي طلبكِ بعينكِ.
          </motion.p>
          <motion.div {...fade(1.2)} className="hero-ctas mt-6 flex flex-wrap items-center justify-center gap-2 xs:gap-3 sm:mt-8 sm:gap-4 md:justify-start">
            <Magnetic href={STORE_URL} className="btn-gold max-sm:!gap-2 max-sm:!px-4 max-sm:!py-3 max-sm:!text-[0.9rem]">
              <BagIcon className="max-[380px]:hidden" />
              تسوّقي الآن
            </Magnetic>
            <Magnetic href={waLink()} className="btn-wine max-sm:!gap-2 max-sm:!px-4 max-sm:!py-3 max-sm:!text-[0.9rem]">
              <WhatsAppIcon width="20" height="20" />
              اطلبي عبر واتساب
            </Magnetic>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ScrollCue({ revealed }) {
  return (
    <div className="hero-cue absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 md:block" aria-hidden="true">
    <motion.div initial={{ opacity: 0 }} animate={revealed ? { opacity: 1 } : {}} transition={{ delay: 2, duration: 1.4 }} className="flex flex-col items-center gap-3">
      <span className="font-latin text-[0.7rem] italic tracking-[0.4em] text-gold-deep" dir="ltr">
        SCROLL
      </span>
      <span className="relative h-14 w-px overflow-hidden bg-gold/25">
        <motion.span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent to-gold" animate={reducedMotion ? {} : { y: ["-100%", "200%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: [0.65, 0, 0.35, 1] }} />
      </span>
    </motion.div>
    </div>
  );
}

export default function HeroSequence({ revealed }) {
  const cinematic = webgl && !reducedMotion;
  const sec = useRef(null);
  const stage = useRef(null);
  const inView = useInView(sec, "100px");
  const [phase, setPhase] = useState({ hero: true, trust: !cinematic });

  useLayoutEffect(() => {
    if (!webgl) markHeroReady();
    if (!cinematic) return;
    const q = gsap.utils.selector(stage);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: sec.current,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.1,
          onUpdate: (self) => {
            const p = self.progress;
            scroll.hero = Math.min(1, p / 0.82);
            const next = { hero: p < 0.84, trust: p > 0.6 };
            setPhase((s) => (s.hero === next.hero && s.trust === next.trust ? s : next));
          },
        },
      });
      tl.to(q(".hero-copy"), { opacity: 0, y: -60, filter: "blur(14px)", duration: 0.16, ease: "power2.in" }, 0.02)
        .to(q(".hero-cue"), { opacity: 0, duration: 0.05 }, 0)
        .fromTo(q(".hero-flash"), { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1.4, duration: 0.2, ease: "power2.in" }, 0.6)
        .fromTo(q(".hero-wash"), { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.72)
        .fromTo(q(".trust-overlay"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0.74)
        .fromTo(q(".trust-head"), { opacity: 0, y: 40, filter: "blur(12px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.1, ease: "power3.out" }, 0.76)
        .fromTo(
          q(".trust-item"),
          { opacity: 0, y: 70, scale: 0.6, filter: "blur(14px)" },
          { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.12, stagger: 0.025, ease: "power3.out" },
          0.8
        )
        .to({}, { duration: 0.06 }); // وقفة قصيرة قبل ما يكمّل التمرير
    }, stage);
    return () => ctx.revert();
  }, []);

  return (
    <>
      <section ref={sec} id="top" className={cinematic ? "relative h-[360svh]" : "relative"} aria-label="جودي ستور">
        <div ref={stage} className={cinematic ? "sticky top-0 h-[100svh] overflow-hidden" : "relative h-[100svh] min-h-[620px] overflow-hidden"}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_58%,#FBF7F1,#E9DCC8)]">
            {webgl ? (
              <Suspense fallback={null}>
                <HeroScene active={inView && phase.hero} />
              </Suspense>
            ) : (
              <img src={still} alt="علبة هدايا عنابية بشرائط ذهبية على منصة رخامية أمام حرير عنابي" className="absolute inset-0 h-full w-full object-cover object-[30%_60%] md:object-left" />
            )}
          </div>
          {/* غشاوة ناعمة خلف النص للقراءة */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(250,246,240,.94)_0%,rgba(250,246,240,.86)_38%,rgba(250,246,240,.35)_52%,transparent_62%)] md:bg-[linear-gradient(270deg,rgba(250,246,240,.85)_0%,rgba(250,246,240,.35)_38%,transparent_58%)]" />
          <HeroCopy revealed={revealed} />
          <ScrollCue revealed={revealed} />

          {cinematic && (
            <>
              <div className="hero-flash pointer-events-none absolute left-1/2 top-1/2 h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0" style={{ background: "radial-gradient(circle, #FFF8EC 0%, #FAF1E2 30%, rgba(246,232,206,.85) 45%, rgba(242,227,196,0) 62%)" }} />
              <div className="hero-wash pointer-events-none absolute inset-0 bg-ivory opacity-0" />
              <div className="trust-overlay invisible absolute inset-0 z-20 flex items-center">
                <TrustStrip active={phase.trust && inView} embedded />
              </div>
            </>
          )}
        </div>
      </section>
      {!cinematic && <TrustStrip active />}
    </>
  );
}
