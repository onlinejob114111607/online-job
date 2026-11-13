import { useEffect, useRef, useState } from "react";
import { doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { countClick, getRef, waLink } from "../utils";
import { useSiteContent } from "../siteContent";
import RegisterForm from "../components/RegisterForm";
import HeroArt from "../components/HeroArt";
import Icon, { WaIcon, iconKey } from "../components/Icons";
import "../landing.css";

const DEFAULT_ICONS = ["home", "clock", "cap", "chart", "users", "rocket"];

export default function Landing() {
  const { site, ready } = useSiteContent();
  const formRef = useRef(null);
  const [formVisible, setFormVisible] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    getRef(); // حفظ كود المسوّق من أول زيارة
    countClick(db, { doc, increment, serverTimestamp, setDoc }); // ضغطة على رابط منشور متتبَّع
  }, []);

  useEffect(() => {
    document.title = site.name;
  }, [site.name]);

  // زر "سجّل" الثابت تحت الشاشة بيختفي لما الاستمارة تكون ظاهرة
  useEffect(() => {
    const el = formRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setFormVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ready]);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 520);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const goForm = () => document.getElementById("register")?.scrollIntoView({ behavior: "smooth" });

  if (!ready) {
    return (
      <div className="center-screen lp-bg">
        <div className="loader" aria-label="جاري التحميل" />
      </div>
    );
  }

  const paragraphs = (site.intro || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const stats = (site.stats || []).filter((s) => s && String(s.value || "").trim());
  const faq = (site.faq || []).filter((f) => f && String(f.q || "").trim());

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-container lp-top-in">
          <a className="lp-logo" href="#/" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <img src="./logo-192.png" alt="" width="34" height="34" />
            <span>{site.name}</span>
          </a>
          <button className="lp-btn lp-btn-gold sm" onClick={goForm}>
            {site.ctaText}
          </button>
        </div>
      </header>

      {/* ===== الواجهة ===== */}
      <section className="lp-hero">
        <div className="lp-container lp-hero-grid">
          <div className="lp-hero-text">
            {site.badge && (
              <span className="lp-badge">
                <i /> {site.badge}
              </span>
            )}
            <h1>{site.headline}</h1>
            {site.subheadline && <p className="lp-lead">{site.subheadline}</p>}
            <div className="lp-hero-actions">
              <button className="lp-btn lp-btn-gold lg" onClick={goForm}>
                {site.ctaText}
                <Icon name="arrow" size={20} stroke={2.2} />
              </button>
              {faq.length > 0 && (
                <a className="lp-btn lp-btn-ghost lg" href="#faq" onClick={(e) => { e.preventDefault(); document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" }); }}>
                  أسئلة شائعة
                </a>
              )}
            </div>
            {site.requirements.length > 0 && (
              <ul className="lp-mini-checks">
                {site.requirements.slice(0, 3).map((r, i) => (
                  <li key={i}>
                    <Icon name="check" size={16} stroke={2.6} />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="lp-hero-art">
            <HeroArt />
          </div>
        </div>
        {stats.length > 0 && (
          <div className="lp-container">
            <div className="lp-stats">
              {stats.map((s, i) => (
                <div className="lp-stat" key={i}>
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ===== التعريف ===== */}
      {paragraphs.length > 0 && (
        <section className="lp-section">
          <div className="lp-container lp-narrow">
            {site.introTitle && <h2 className="lp-title">{site.introTitle}</h2>}
            <div className="lp-intro glass">
              {paragraphs.map((p, i) => (
                <p key={i} className={i === paragraphs.length - 1 && paragraphs.length > 1 ? "lp-intro-cta" : ""}>
                  {p}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== المميزات ===== */}
      {site.benefits.length > 0 && (
        <section className="lp-section">
          <div className="lp-container">
            {site.benefitsTitle && <h2 className="lp-title">{site.benefitsTitle}</h2>}
            <div className="lp-benefits">
              {site.benefits.map((b, i) => (
                <article className="lp-benefit glass" key={i}>
                  <div className="lp-icon">
                    <Icon name={iconKey(b.icon, DEFAULT_ICONS[i % DEFAULT_ICONS.length])} size={26} />
                  </div>
                  <h3>{b.title}</h3>
                  {b.text && <p>{b.text}</p>}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== الخطوات ===== */}
      {site.steps.length > 0 && (
        <section className="lp-section">
          <div className="lp-container">
            {site.stepsTitle && <h2 className="lp-title">{site.stepsTitle}</h2>}
            <ol className="lp-steps">
              {site.steps.map((s, i) => (
                <li key={i} className="glass">
                  <span className="lp-step-num">{i + 1}</span>
                  <h3>{s.title}</h3>
                  {s.text && <p>{s.text}</p>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* ===== التسجيل ===== */}
      <section className="lp-section lp-register" id="register" ref={formRef}>
        <div className="lp-container lp-register-grid">
          <div className="lp-register-side">
            {site.requirementsTitle && <h2 className="lp-title start">{site.requirementsTitle}</h2>}
            <ul className="lp-checks">
              {site.requirements.map((r, i) => (
                <li key={i}>
                  <span><Icon name="check" size={15} stroke={2.8} /></span>
                  {r}
                </li>
              ))}
            </ul>
            {site.contactWhatsapp && (
              <a className="lp-wa-line" href={waLink(site.contactWhatsapp)} target="_blank" rel="noreferrer">
                <WaIcon size={20} /> عندك سؤال قبل التسجيل؟ راسلنا
              </a>
            )}
          </div>
          <RegisterForm site={site} />
        </div>
      </section>

      {/* ===== أسئلة شائعة ===== */}
      {faq.length > 0 && (
        <section className="lp-section" id="faq">
          <div className="lp-container lp-narrow">
            <h2 className="lp-title">{site.faqTitle || "أسئلة شائعة"}</h2>
            <div className="lp-faq">
              {faq.map((f, i) => (
                <details key={i} className="glass">
                  <summary>
                    {f.q}
                    <Icon name="plus" size={18} stroke={2.2} />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="lp-footer">
        <div className="lp-container">
          © {new Date().getFullYear()} {site.name}
          {site.footer ? ` · ${site.footer}` : ""}
        </div>
      </footer>

      {/* زر التسجيل الثابت (موبايل) */}
      <div className={"lp-sticky" + (formVisible || !scrolled ? " hide" : "")}>
        <button className="lp-btn lp-btn-gold block" onClick={goForm}>
          {site.ctaText}
        </button>
      </div>

      {site.contactWhatsapp && (
        <a className="lp-wa-float" href={waLink(site.contactWhatsapp)} target="_blank" rel="noreferrer" aria-label="واتساب">
          <WaIcon />
        </a>
      )}
    </div>
  );
}
