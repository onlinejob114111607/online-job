import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import LiquidImage from "../components/LiquidImage";
import SplitText from "../components/SplitText";
import Reveal from "../components/Reveal";
import Magnetic from "../components/Magnetic";
import { ArrowIcon } from "../components/Icons";
import { STORE_URL } from "../config";
import { useCatalog } from "../lib/catalog";
import { reducedMotion } from "../lib/device";

const img = (n) => `${import.meta.env.BASE_URL}images/${n}.webp`;

// احتياط لحد ما توصل أقسام المتجر الحقيقية
const FALLBACK = [
  { k: "fashion", t: "أزياء", e: "Fashion", s: "قصّات تليق بحضوركِ، من إطلالة النهار إلى سهرة العيد.", alt: "حرير عنابي على علّاقة ذهبية" },
  { k: "accessories", t: "إكسسوارات", e: "Accessories", s: "تفاصيل صغيرة تصنع فرقاً كبيراً في إطلالتكِ.", alt: "خواتم ذهبية وعقد لؤلؤ على رخام" },
  { k: "beauty", t: "عناية وجمال", e: "Beauty & Care", s: "طقوس عناية تمنحكِ لحظة هدوء لكِ وحدكِ.", alt: "زجاجة عطر زجاجية بغطاء ذهبي" },
  { k: "home", t: "للبيت والعائلة", e: "Home & Family", s: "لمسات دافئة تجعل البيت أجمل لمن تحبّين.", alt: "مزهرية خزفية وشمعة على صينية رخامية" },
];

function Panel({ c, i }) {
  return (
    <a href={c.link} target="_blank" rel="noopener" className="col-panel group block w-[78vw] shrink-0 sm:w-[46vw] lg:w-[30vw] xl:w-[27vw]" data-cursor="view" data-cursor-label="اكتشفي">
      <div className="col-media relative aspect-[3/4] overflow-hidden rounded-[1.6rem] ring-1 ring-gold/20">
        <LiquidImage src={c.img} alt={c.alt} className="h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-coal/80 via-coal/10 to-transparent" />
        <span className="absolute left-5 top-5 font-latin text-5xl font-light italic text-gold-pale/80 sm:text-6xl" dir="ltr">
          0{i + 1}
        </span>
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
          <p className="eyebrow !text-[0.72rem] text-gold">{c.e}</p>
          <h3 className="mt-1 font-display text-3xl font-bold text-ivory sm:text-4xl">{c.t}</h3>
          <p className="mt-3 max-w-xs text-sm leading-7 text-ivory/75 sm:text-[0.95rem]">{c.s}</p>
          <span className="mt-5 inline-flex items-center gap-2 font-display text-sm font-bold text-gold-light">
            <span className="relative">
              اكتشف التشكيلة
              <span className="absolute -bottom-1 right-0 h-px w-full origin-right scale-x-0 bg-gold transition-transform duration-700 ease-lux group-hover:scale-x-100" />
            </span>
            <ArrowIcon className="transition-transform duration-700 ease-lux group-hover:-translate-x-2" />
          </span>
        </div>
      </div>
    </a>
  );
}

export default function Collections() {
  const sec = useRef(null);
  const track = useRef(null);
  const data = useCatalog();
  const live = data?.cats?.length
    ? data.cats.map((c) => ({ k: c.name, t: c.name, e: `${c.count}+ PRODUCTS`, s: `${c.count} منتج بانتظارك بأسعار مناسبة والدفع عند الاستلام.`, alt: c.name, img: c.img, link: c.link }))
    : null;
  const CATS = live || FALLBACK.map((c) => ({ ...c, img: img(c.k), link: STORE_URL }));

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const ctx = gsap.context(() => {
      const dist = () => Math.max(0, track.current.scrollWidth - window.innerWidth);
      const tween = gsap.to(track.current, {
        x: () => dist(), // RTL: المسار بيتحرك يمين
        ease: "none",
        scrollTrigger: { trigger: sec.current, start: "top top", end: () => "+=" + dist() * 1.1, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
      });
      // كل صورة بتتحرك جوّا إطارها + البطاقات بتصحى لما توصل للنص
      const panels = gsap.utils.toArray(".col-panel");
      const imgs = panels.map((p) => p.querySelector(".col-media img"));
      const setters = panels.map((p, i) => ({
        o: gsap.quickSetter(p, "opacity"),
        y: gsap.quickSetter(p, "y", "px"),
        ix: imgs[i] && gsap.quickSetter(imgs[i], "xPercent"),
      }));
      if (imgs[0]) gsap.set(imgs, { scale: 1.14 });
      const update = () => {
        const vw = window.innerWidth;
        panels.forEach((p, i) => {
          const r = p.getBoundingClientRect();
          const c = (r.left + r.width / 2) / vw - 0.5; // -0.5 يسار، 0.5 يمين
          const vis = Math.max(0, 1 - Math.max(0, Math.abs(c) - 0.3) * 1.6);
          setters[i].o(0.35 + vis * 0.65);
          setters[i].y((1 - vis) * 40);
          setters[i].ix && setters[i].ix(c * -12);
        });
      };
      tween.eventCallback("onUpdate", update);
      update();
    }, sec);
    return () => ctx.revert();
  }, [CATS.length, !!live]);

  return (
    <section ref={sec} id="collections" className="grain relative overflow-hidden bg-coal text-ivory">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_80%_20%,rgba(76,43,176,.55),transparent_70%)]" />
      <div className={`relative flex min-h-[100svh] flex-col justify-center py-20 ${reducedMotion ? "" : ""}`}>
        <div className="container-lux mb-10 flex flex-col gap-6 sm:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <Reveal as="p" className="eyebrow mb-4 text-gold" y={20}>
              THE COLLECTIONS
            </Reveal>
            <SplitText as="h2" text="تشكيلات تشبهك" className="h-display text-[2.15rem] text-ivory sm:text-5xl lg:text-6xl" />
          </div>
          <Reveal as="p" delay={0.2} className="max-w-sm text-base leading-8 text-ivory/65">
            مرّر للأسفل… ودع أقسام المتجر تمرّ أمامك واحداً تلو الآخر.
          </Reveal>
        </div>
        <div className={reducedMotion ? "overflow-x-auto pb-4 [scrollbar-width:none]" : ""}>
          <div ref={track} className="flex w-max gap-5 px-5 sm:gap-7 sm:px-8 lg:px-12">
            {CATS.map((c, i) => (
              <Panel key={c.k} c={c} i={i} />
            ))}
            <div className="flex w-[70vw] shrink-0 flex-col items-center justify-center gap-6 rounded-[1.6rem] border border-gold/25 p-8 text-center sm:w-[40vw] lg:w-[24vw]">
              <p className="eyebrow text-gold">AND MUCH MORE</p>
              <p className="font-display text-3xl font-bold leading-snug text-ivory">
                والمزيد
                <br />
                بانتظارك في المتجر
              </p>
              <Magnetic href={STORE_URL} className="btn-gold">
                ادخل المتجر
              </Magnetic>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
