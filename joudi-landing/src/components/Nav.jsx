import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { STORE_URL } from "../config";
import { scrollToEl } from "../lib/smooth";

export default function Nav({ show }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 80);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={show ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 1.4, delay: 1.6, ease: [0.19, 1, 0.22, 1] }}
      className="fixed inset-x-0 top-0 z-[80] py-3 sm:py-4"
    >
      <div className={`container-lux flex items-center justify-between rounded-full transition-all duration-700 ease-lux ${solid ? "bg-ivory/75 shadow-[0_10px_40px_-20px_rgba(90,30,43,.4)] backdrop-blur-xl" : "bg-ivory/25 backdrop-blur-md"}`} style={{ paddingBlock: solid ? 8 : 6 }}>
        <a href="#top" onClick={(e) => (e.preventDefault(), scrollToEl("#top"))} className="flex items-baseline gap-2" data-cursor="hover" aria-label="جودي ستور">
          <span className="text-gold-grad font-display text-3xl font-bold leading-none">جودي</span>
          <span className="eyebrow hidden !text-[0.62rem] text-gold-deep xs:inline">JOUDI STORE</span>
        </a>
        <nav className="hidden items-center gap-8 text-[0.95rem] text-wine md:flex" aria-label="أقسام الصفحة">
          {[
            ["لماذا جودي", "#why"],
            ["التشكيلات", "#collections"],
            ["كيف تطلبين", "#how"],
          ].map(([t, h]) => (
            <a key={h} href={h} onClick={(e) => (e.preventDefault(), scrollToEl(h))} className="group relative" data-cursor="hover">
              {t}
              <span className="absolute -bottom-1 right-0 h-px w-full origin-right scale-x-0 bg-gold transition-transform duration-700 ease-lux group-hover:scale-x-100" />
            </a>
          ))}
        </nav>
        <a href={STORE_URL} target="_blank" rel="noopener" className="rounded-full border border-wine/40 px-5 py-2 font-display text-sm font-bold text-wine transition-colors duration-500 hover:bg-wine hover:text-gold-pale" data-cursor="hover">
          المتجر
        </a>
      </div>
    </motion.header>
  );
}
