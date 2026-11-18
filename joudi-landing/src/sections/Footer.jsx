import { STORE_URL, SOCIAL, waLink } from "../config";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "../components/Icons";
import { scrollToEl } from "../lib/smooth";

const AREAS = ["القدس", "رام الله والبيرة", "نابلس", "الخليل", "بيت لحم", "جنين", "طولكرم", "قلقيلية", "سلفيت", "طوباس", "أريحا", "الداخل"];

export default function Footer() {
  const socials = [
    { label: "فيسبوك", href: SOCIAL.facebook || STORE_URL, Icon: FacebookIcon },
    { label: "إنستغرام", href: SOCIAL.instagram || STORE_URL, Icon: InstagramIcon },
    { label: "واتساب", href: waLink(), Icon: WhatsAppIcon },
  ];
  return (
    <footer className="relative bg-coal pb-28 pt-20 text-ivory/80 sm:pb-12">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #C48A12, #FFEBB8, #EDB23A, transparent)", backgroundSize: "200% 100%", animation: "line-run 8s linear infinite" }} />
      <div className="container-lux grid gap-14 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <a href="#top" onClick={(e) => (e.preventDefault(), scrollToEl("#top"))} className="inline-block" data-cursor="hover">
            <span className="text-gold-grad font-display text-5xl font-bold">جودي</span>
            <span className="eyebrow mt-1 block !text-[0.7rem] text-gold/70">JOUDI STORE</span>
          </a>
          <p className="mt-6 max-w-xs leading-8 text-ivory/60">أناقة مختارة بعناية، تصلكِ حتى باب بيتكِ… وتدفعين بعد أن تطمئنّي.</p>
          <div className="mt-7 flex gap-3">
            {socials.map(({ label, href, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noopener" aria-label={label} className="grid h-11 w-11 place-items-center rounded-full border border-gold/30 text-gold transition-all duration-700 ease-lux hover:-translate-y-1 hover:border-gold hover:bg-gold hover:text-wine-3" data-cursor="hover">
                <Icon width="20" height="20" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-gold-light">مناطق التوصيل</h3>
          <p className="eyebrow mt-1 !text-[0.65rem] text-gold/60">WE DELIVER TO</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <li key={a} className="rounded-full border border-ivory/10 px-3 py-1 text-sm text-ivory/65">
                {a}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ivory/50">كل الضفة الغربية والقدس والداخل المحتل.</p>
        </div>
        <div>
          <h3 className="font-display text-lg font-bold text-gold-light">روابط</h3>
          <p className="eyebrow mt-1 !text-[0.65rem] text-gold/60">EXPLORE</p>
          <ul className="mt-5 space-y-3">
            {[
              ["المتجر", STORE_URL],
              ["اطلبي عبر واتساب", waLink()],
              ["لماذا جودي؟", "#why"],
              ["التشكيلات", "#collections"],
              ["كيف تطلبين؟", "#how"],
            ].map(([t, h]) => (
              <li key={t}>
                <a
                  href={h}
                  {...(h.startsWith("#") ? { onClick: (e) => (e.preventDefault(), scrollToEl(h)) } : { target: "_blank", rel: "noopener" })}
                  className="group relative inline-block text-ivory/70 transition-colors duration-500 hover:text-gold-light"
                  data-cursor="hover"
                >
                  {t}
                  <span className="absolute -bottom-0.5 right-0 h-px w-full origin-right scale-x-0 bg-gold transition-transform duration-700 ease-lux group-hover:scale-x-100" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container-lux mt-16 flex flex-col items-center justify-between gap-3 border-t border-ivory/10 pt-8 text-xs text-ivory/40 sm:flex-row">
        <p>© {new Date().getFullYear()} جودي ستور — Joudi Store. جميع الحقوق محفوظة.</p>
        <p>الدفع عند الاستلام • افحصي قبل ما تدفعي</p>
      </div>
    </footer>
  );
}
