// ============================================================
//  واجهة المتجر (موقع منفصل) — عربي + עברית، أقسام، الأكثر مبيعاً،
//  منتج بمعرض صور، سلة، طلب، تقييم، Facebook Pixel
// ============================================================
import { StrictMode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { initializeApp } from "firebase/app";
import { collection, doc, getDoc, getFirestore, serverTimestamp, setDoc, writeBatch } from "firebase/firestore/lite";
import { firebaseConfig } from "../src/config";
import {
  calcTotals,
  discountPct,
  displayPhone,
  mergeStorePublic,
  money,
  normOptions,
  normPhone,
  orderCode,
  regionsForCity,
  waLinkTo,
  waOrderText,
  trackDoc,
  last4,
  normPhone as normPhoneTrack,
  TRACK_STAGE,
} from "../src/store/shared";
import { LANGS, initialLang, makeT } from "./i18n";
import "./store.css";

const db = getFirestore(initializeApp(firebaseConfig));

// ---------- تخزين محلي آمن ----------
const ls = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* تجاهل */
    }
  },
};

// ---------- Facebook Pixel ----------
const CURRENCY_CODE = { "₪": "ILS", "شيكل": "ILS", "$": "USD", "د.أ": "JOD" };
function initPixel(id) {
  if (!id || window.fbq) return;
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", String(id).replace(/\D/g, ""));
}
const track = (ev, data) => {
  try {
    window.fbq?.("track", ev, data);
  } catch {
    /* تجاهل */
  }
};

const Ctx = createContext(null);
const useStore = () => useContext(Ctx);

function App() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [cart, setCart] = useState(() => ls.get("cart", []).filter((x) => x && x.key));
  const [toast, setToast] = useState("");
  const [lang, setLang] = useState(initialLang);
  const i18n = useMemo(() => makeT(lang), [lang]);
  LANG = lang;
  useEffect(() => ls.set("cart", cart), [cart]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGS[lang]?.dir || "rtl";
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* تجاهل */
    }
  }, [lang]);

  useEffect(() => {
    // أول إشي ملف الكتالوج على GitHub (ما بيستهلك من حصة Firebase)، وإذا ما لقاه بيقرأ من Firebase
    loadCatalogFile()
      .catch(() => getDoc(doc(db, "store", "catalog")).then((s) => s.data() || {}))
      .then((d) => {
        const settings = mergeStorePublic(d.settings);
        const products = (d.products || [])
          .filter((p) => p && p.id)
          .map((p) => withFlash({ ...p, options: normOptions(p.options), reviews: p.reviews || [] }))
          .sort((a, b) => (b.order || 0) - (a.order || 0) || (b.createdAt || 0) - (a.createdAt || 0));
        const feedback = (Array.isArray(d.feedbackFeed) ? d.feedbackFeed : []).filter((f) => f && f.img);
        setData({ settings, products, feedback, byId: Object.fromEntries(products.map((p) => [p.id, p])) });
        if (settings.pixelId) initPixel(settings.pixelId);
      })
      .catch(() => setErr("تعذّر تحميل المتجر، تأكد من الإنترنت وجرب مرة تانية."));
  }, []);

  useEffect(() => {
    if (data) document.title = siteName(data.settings);
  }, [data, lang]);

  // تحديث أسعار السلة لو تغيّرت بالكتالوج + شيل المنتجات المحذوفة
  useEffect(() => {
    if (!data) return;
    setCart((c) =>
      c
        .filter((it) => data.byId[it.id])
        .map((it) => {
          const p = data.byId[it.id];
          return { ...it, name: p.name, price: p.price, delivery: p.delivery, deliveryPrice: p.deliveryPrice, image: p.images?.[0] || "" };
        })
    );
  }, [data]);

  const showToast = useCallback((t) => {
    setToast(t);
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => setToast(""), 2200);
  }, []);

  const currency = data?.settings.currency || "₪";
  const cartApi = useMemo(
    () => ({
      items: cart,
      count: cart.reduce((s, it) => s + it.qty, 0),
      add(p, qty = 1, option = "", optionKey = "") {
        track("AddToCart", { content_ids: [p.id], content_type: "product", value: p.price * qty, currency: CURRENCY_CODE[currency] || "ILS" });
        setCart((c) => {
          const key = `${p.id}|${optionKey || option}`;
          const ex = c.find((it) => it.key === key);
          if (ex) return c.map((it) => (it.key === key ? { ...it, qty: Math.min(20, it.qty + qty) } : it));
          return [
            ...c,
            { key, id: p.id, name: p.name, price: p.price, qty, option, sel: optionKey ? JSON.parse(optionKey) : null, image: p.images?.[0] || "", delivery: p.delivery, deliveryPrice: p.deliveryPrice },
          ];
        });
      },
      setQty: (key, qty) => setCart((c) => c.map((it) => (it.key === key ? { ...it, qty: Math.max(1, Math.min(20, qty)) } : it))),
      remove: (key) => setCart((c) => c.filter((it) => it.key !== key)),
      clear: () => setCart([]),
    }),
    [cart, currency]
  );

  if (err) return <div className="center-msg">{makeT(lang).t(err)}</div>;
  if (!data)
    return (
      <div className="center-msg">
        <div className="spinner" />
      </div>
    );

  return (
    <Ctx.Provider value={{ ...data, ...i18n, setLang, cart: cartApi, toast: showToast, cur: CURRENCY_CODE[currency] || "ILS" }}>
      <RouteEffects />
      <TopBar />
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/c/:cat" element={<Category />} />
          <Route path="/search" element={<Search />} />
          <Route path="/p/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/done" element={<Done />} />
          <Route path="/rate/:oid/:code" element={<Rate />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:code" element={<Track />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
      <WaFloat />
      {toast && <div className="toast">{toast}</div>}
    </Ctx.Provider>
  );
}

function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    track("PageView");
  }, [pathname]);
  return null;
}

// عرض بوقت محدد: لحد flashUntil السعر بيصير flashPrice والسعر الأصلي بيبين مشطوب
function withFlash(p) {
  if (Number(p.flashUntil) > Date.now() && Number(p.flashPrice) > 0 && Number(p.flashPrice) < Number(p.price)) {
    return { ...p, oldPrice: Math.max(Number(p.oldPrice) || 0, Number(p.price)), price: Number(p.flashPrice), flash: true };
  }
  return { ...p, flash: false };
}

// ---------- الكتالوج ----------
// نسخة الموقع (GitHub Pages) ممكن تتأخر لما ينرفع كتير صور، فمنقرأ كمان النسخة المباشرة من الريبو وبناخد الأحدث
function rawCatalogUrl() {
  const m = window.location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!m) return null;
  const repo = window.location.pathname.split("/").filter(Boolean)[0] || `${m[1]}.github.io`;
  return `https://raw.githubusercontent.com/${m[1]}/${repo}/main/catalog.json`;
}
async function loadCatalogFile() {
  const t = Math.floor(Date.now() / 60000);
  const get = (u) =>
    fetch(`${u}?t=${t}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
  const raw = rawCatalogUrl();
  const list = (await Promise.allSettled([get("./catalog.json"), ...(raw ? [get(raw)] : [])])).filter((x) => x.status === "fulfilled").map((x) => x.value);
  if (!list.length) throw new Error("no catalog");
  return list.sort((a, b) => (b.at || 0) - (a.at || 0))[0];
}

// ---------- مساعدات ترجمة المحتوى ----------
// اللغة الحالية (بتتحدث مع كل رسم) — المحتوى: الإنجليزي/العبري لو موجود، وإلا العربي
let LANG = "en";
const SFX = () => (LANG === "en" ? "En" : LANG === "he" ? "He" : "");
const HE_NOTES = ["✨ 90% מהמוצרים באחריות", "✨ משלוח לכל האזורים", "✨ נא לבדוק את המוצר בקבלה"];
const EN_NOTES = ["✨ 90% of our products come with a warranty", "✨ Delivery to all areas", "✨ Please inspect your order on delivery"];
const notesOf = (settings) => {
  const x = SFX();
  if (!x) return settings.notes;
  return settings[`notes${x}`]?.length ? settings[`notes${x}`] : x === "En" ? EN_NOTES : HE_NOTES;
};
const pName = (p) => (SFX() && p[`name${SFX()}`]) || p.name;
const pFeatures = (p) => (SFX() && p[`features${SFX()}`]?.length ? p[`features${SFX()}`] : p.features || []);
const pDesc = (p) => (SFX() && p[`desc${SFX()}`]) || p.desc || "";
const siteName = (settings) => (SFX() && settings[`name${SFX()}`]) || settings.name;
const siteTagline = (settings) => (SFX() && settings[`tagline${SFX()}`]) || settings.tagline;
const optText = (sel) =>
  Object.entries(sel || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("، ");

/* ======================= أجزاء عامة ======================= */
function TopBar() {
  const { settings, lang } = useStore();
  const src = notesOf(settings);
  const notes = src.length ? src : [settings.tagline];
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (notes.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % notes.length), 3500);
    return () => clearInterval(t);
  }, [notes.length, lang]);
  return (
    <div className="topbar">
      <span key={i + lang} className="topbar-txt">
        {notes[i % notes.length]}
      </span>
    </div>
  );
}

function Header() {
  const { settings, products, cart, t, w, lang, setLang } = useStore();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const name = siteName(settings);
  const langs = ["en", "ar", ...(settings.showHe ? ["he"] : [])];
  const cats = settings.categories.filter((c) => products.some((p) => p.category === c));
  const curCat = pathname.startsWith("/c/") ? decodeURIComponent(pathname.slice(3)) : "";
  const showCats = cats.length > 1 && (pathname === "/" || pathname.startsWith("/c/") || pathname === "/search");
  return (
    <header className="header">
      <div className="header-row">
        <Link to="/" className="brand" aria-label={name}>
          <span className="brand-logo-wrap">
            <img className="brand-logo" src="./logo-192.png" alt="" width="44" height="44" />
          </span>
          <span className="brand-text">
            <span className="brand-name">{name}</span>
            <span className="brand-tag">{siteTagline(settings)}</span>
          </span>
        </Link>
        <div className="header-actions">
          <div className="lang-switch" role="group" aria-label={t("اللغة")}>
            {langs.map((l) => (
              <button key={l} className={"lang-btn" + (l === lang ? " on" : "")} onClick={() => setLang(l)} aria-pressed={l === lang} lang={l}>
                {LANGS[l].label}
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={() => nav("/search")} aria-label={t("بحث")}>
            <Icon name="search" />
          </button>
          <Link to="/cart" className="icon-btn cart-btn" aria-label={t("السلة")}>
            <Icon name="bag" />
            {cart.count > 0 && (
              <span key={cart.count} className="cart-count">
                {cart.count}
              </span>
            )}
          </Link>
        </div>
      </div>
      {showCats && (
        <nav className="cat-bar" aria-label={t("تسوّق حسب القسم")}>
          <Link to="/" className={"cat-pill" + (pathname === "/" ? " on" : "")}>
            {t("الرئيسية")}
          </Link>
          {cats.map((c) => (
            <Link key={c} to={`/c/${encodeURIComponent(c)}`} className={"cat-pill" + (curCat === c ? " on" : "")}>
              {w(c)}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function Footer() {
  const { settings, products, feedback, t, w } = useStore();
  const notes = notesOf(settings);
  const cats = settings.categories.filter((c) => products.some((p) => p.category === c)).slice(0, 8);
  const so = settings.social || {};
  const socials = [
    ["fb", "Facebook", so.facebook],
    ["ig", "Instagram", so.instagram],
    ["tt", "TikTok", so.tiktok],
    ["wa", "WhatsApp", settings.whatsapp ? waLinkTo(settings.whatsapp, t("مرحبا، عندي استفسار 🌸")) : ""],
  ].filter((x) => x[2]);
  return (
    <footer className="footer">
      <div className="trust">
        <Trust icon="truck" title={t("توصيل لكل المناطق")} s={t("الضفة والقدس والداخل")} />
        <Trust icon="cash" title={t("الدفع عند الاستلام")} s={t("بدون أي دفع مسبق")} />
        <Trust icon="eye" title={t("تفقد المنتج عند الاستلام")} s={t("قبل ما تدفع")} />
      </div>
      <div className="footer-main">
        <div className="footer-col footer-about">
          <Link to="/" className="footer-logo">
            <img src="./logo-192.png" alt="" width="52" height="52" />
            <b>{siteName(settings)}</b>
          </Link>
          <p>{siteTagline(settings)}</p>
          {socials.length > 0 && (
            <div className="socials">
              {socials.map(([ic, label, url]) => (
                <a key={ic} href={url} target="_blank" rel="noreferrer" className={"social " + ic} aria-label={label} title={label} onClick={() => ic === "wa" && track("Contact")}>
                  <Icon name={ic} />
                </a>
              ))}
            </div>
          )}
        </div>
        {cats.length > 0 && (
          <div className="footer-col">
            <h4>{t("الأقسام")}</h4>
            <ul>
              {cats.map((c) => (
                <li key={c}>
                  <Link to={`/c/${encodeURIComponent(c)}`}>{w(c)}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="footer-col">
          <h4>{t("معلومات")}</h4>
          <ul className="footer-notes">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            {settings.noDeliveryDays && <li className="muted">{t(settings.noDeliveryDays)}</li>}
          </ul>
          <Link to="/track" className="footer-link">
            📦 {t("تتبع طلبك")}
          </Link>
          {feedback?.length > 0 && (
            <Link to="/reviews" className="footer-link">
              💬 {t("آراء زبائننا 💬").replace(" 💬", "")}
            </Link>
          )}
        </div>
      </div>
      <div className="footer-brand">
        © {new Date().getFullYear()} {siteName(settings)}
      </div>
    </footer>
  );
}

function Trust({ icon, title, s }) {
  return (
    <div className="trust-item">
      <span className="trust-ic">
        <Icon name={icon} />
      </span>
      <div>
        <b>{title}</b>
        <small>{s}</small>
      </div>
    </div>
  );
}

function WaFloat() {
  const { settings, t } = useStore();
  const { pathname } = useLocation();
  if (!settings.waFloat || !settings.whatsapp || pathname.startsWith("/checkout") || pathname.startsWith("/p/")) return null;
  return (
    <a className="wa-float" href={waLinkTo(settings.whatsapp, t("مرحبا، عندي استفسار 🌸"))} target="_blank" rel="noreferrer" aria-label="WhatsApp" onClick={() => track("Contact")}>
      <Icon name="wa" />
    </a>
  );
}

function Icon({ name }) {
  const p = {
    search: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3" />,
    bag: (
      <>
        <path d="M6 7h12l-1.2 12.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </>
    ),
    cash: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    left: <path d="m15 5-7 7 7 7" />,
    fb: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8z" />,
    ig: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" />
      </>
    ),
    tt: <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.5 2.6 2.4 4.5 5 5" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    right: <path d="m9 5 7 7-7 7" />,
    share: (
      <>
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </>
    ),
    wa: <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zm4.6 12.4c-.2.6-1.2 1.1-1.7 1.2-.4 0-1 .1-3-.7-2.5-1-4.1-3.6-4.2-3.7-.1-.2-1-1.3-1-2.5s.6-1.8.9-2 .5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.3.5-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.1 1 2.1 1.3 2.4 1.4.3.2.5.1.6 0l.9-1c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3z" />,
  }[name];
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill={name === "wa" ? "currentColor" : "none"} stroke={name === "wa" ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p}
    </svg>
  );
}

function Stars({ value = 0, count, size = "sm" }) {
  const { t } = useStore();
  const full = Math.round(value * 2) / 2;
  return (
    <span className={"stars " + size} aria-label={t("{n} من 5", { n: value })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "on" : i - 0.5 === full ? "half" : ""}>
          ★
        </span>
      ))}
      {count != null && <em>({count})</em>}
    </span>
  );
}

function Price({ p, big }) {
  const { settings, t } = useStore();
  const pct = discountPct(p);
  return (
    <div className={"price" + (big ? " big" : "")}>
      <b>
        {money(p.price)} <small>{settings.currency}</small>
      </b>
      {p.oldPrice > p.price && (
        <s>
          {money(p.oldPrice)} {settings.currency}
        </s>
      )}
      {big && pct > 0 && <span className="pct">{t("وفّر {n}%", { n: pct })}</span>}
    </div>
  );
}

function Img({ src, alt, className }) {
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setBad(false);
  }, [src]);
  if (!src || bad) return <div className={"img-ph " + (className || "")} aria-label={alt} />;
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" onError={() => setBad(true)} />;
}

function Card({ p }) {
  const { t, tr } = useStore();
  const pct = discountPct(p);
  return (
    <Link to={`/p/${p.id}`} className={"card" + (p.available ? "" : " soldout")}>
      <div className="card-img">
        <Img src={p.images?.[0]} alt={pName(p)} />
        {p.images?.[1] && <Img src={p.images[1]} alt="" className="card-img-2" />}
        <div className="card-badges">
          {pct > 0 && <span className="badge red">-{pct}%</span>}
          {p.badge && !tr && <span className="badge">{p.badge}</span>}
        </div>
        {p.flash && (
          <span className="card-timer">
            <Countdown until={p.flashUntil} small />
          </span>
        )}
        {!p.available && <span className="soldout-tag">{t("نفدت الكمية")}</span>}
      </div>
      <div className="card-body">
        <div className="card-name">{pName(p)}</div>
        {p.rating?.count > 0 && <Stars value={p.rating.avg} count={p.rating.count} />}
        <Price p={p} />
      </div>
    </Link>
  );
}

// شريط منتجات: أسهم تنقل + سحب بالماوس + سحب باللمس
function Row({ title, more, children, hot }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const x = Math.abs(el.scrollLeft);
    setEdge({ start: x < 24, end: x + el.clientWidth >= el.scrollWidth - 24 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, children]);
  // dir: +1 = للأمام (حسب اتجاه اللغة)
  const go = (dir) => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.85, behavior: "smooth" });
  };
  const onDown = (e) => {
    if (e.pointerType !== "mouse") return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 5) {
      d.moved = true;
      ref.current.classList.add("dragging");
    }
    ref.current.scrollLeft = d.left - dx;
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    ref.current?.classList.remove("dragging");
    if (d?.moved) {
      // ما نفتح المنتج بعد السحب
      const stop = (ev) => (ev.preventDefault(), ev.stopPropagation());
      ref.current?.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => ref.current?.removeEventListener("click", stop, { capture: true }), 50);
    }
  };
  return (
    <section className={"row" + (hot ? " row-hot" : "")}>
      <div className="row-head">
        <h2>{title}</h2>
        <div className="row-tools">
          {more}
          <button type="button" className="row-arrow prev" onClick={() => go(-1)} disabled={edge.start} aria-label="Previous">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" className="row-arrow next" onClick={() => go(1)} disabled={edge.end} aria-label="Next">
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <div className="row-wrap">
        <div className="row-scroll" ref={ref} onScroll={measure} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onDragStart={(e) => e.preventDefault()}>
          {children}
        </div>
        {!edge.start && <button type="button" tabIndex={-1} className="row-side prev" onClick={() => go(-1)} aria-hidden="true">‹</button>}
        {!edge.end && <button type="button" tabIndex={-1} className="row-side next" onClick={() => go(1)} aria-hidden="true">›</button>}
      </div>
    </section>
  );
}

const bestSellers = (products) =>
  products
    .filter((p) => p.available && (p.featured || p.sold > 0))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.sold || 0) - (a.sold || 0))
    .slice(0, 12);

/* ======================= الرئيسية ======================= */
function Home() {
  const { settings, products, byId, t, w } = useStore();
  const cats = settings.categories.filter((c) => products.some((p) => p.category === c));
  const best = bestSellers(products);
  const live = products.filter((p) => p.available);
  const flash = live.filter((p) => p.flash).sort((a, b) => a.flashUntil - b.flashUntil);
  const offers = [...flash, ...live.filter((p) => !p.flash && discountPct(p) > 0)].slice(0, 16);
  const latest = [...products].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 14);
  const seen = ls
    .get("seen", [])
    .map((id) => byId[id])
    .filter(Boolean)
    .slice(0, 10);
  const catImg = (c) => settings.catImages?.[c] || products.find((p) => p.category === c && p.images?.[0])?.images[0];
  const more = (to) => (
    <Link to={to} className="more">
      {t("الكل")} ‹
    </Link>
  );

  return (
    <>
      <Banners />
      <Spotlight />
      {cats.length > 0 && (
        <section className="section">
          <div className="row-head">
            <h2>{t("تسوّق حسب القسم")}</h2>
          </div>
          <div className="cats-grid">
            {cats.map((c) => (
              <Link key={c} to={`/c/${encodeURIComponent(c)}`} className="cat-tile">
                <span className="cat-circle">
                  <Img src={catImg(c)} alt={w(c)} />
                </span>
                <span className="cat-name">{w(c)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <Row title={t("وصل حديثاً ✨")} more={more("/search")}>
          {latest.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </Row>
      )}
      {offers.length > 0 && (
        <Row title={flash.length ? t("عروض اليوم ⏱️") : t("عروض وخصومات 🏷️")} more={flash.length ? <Countdown until={flash[0].flashUntil} label={t("بينتهي خلال")} /> : null} hot>
          {offers.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </Row>
      )}
      {cats.map((c) => {
        const list = products.filter((p) => p.category === c).slice(0, 14);
        return list.length ? (
          <Row key={c} title={w(c)} more={more(`/c/${encodeURIComponent(c)}`)}>
            {list.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </Row>
        ) : null;
      })}
      {best.length > 0 && (
        <Row title={t("الأكثر مبيعاً 🔥")}>
          {best.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </Row>
      )}
      <FeedbackStrip />
      {seen.length > 0 && (
        <Row title={t("شاهدتها مؤخراً")}>
          {seen.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </Row>
      )}
      {!products.length && <div className="empty">{t("المنتجات بتنضاف قريباً 🌸")}</div>}
    </>
  );
}

// ---------- آراء الزباين (صور من قناة الفيدباك) ----------
function FeedbackStrip() {
  const { feedback, t } = useStore();
  const [i, setI] = useState(null);
  if (!feedback?.length) return null;
  const list = feedback.slice(0, 14);
  return (
    <>
      <Row
        title={t("آراء زبائننا 💬")}
        more={
          <Link to="/reviews" className="more">
            {t("الكل")} ‹
          </Link>
        }
      >
        {list.map((f, k) => (
          <button key={f.img} type="button" className="fb-card" onClick={() => setI(k)} aria-label={t("آراء زبائننا 💬")}>
            <img src={f.img} alt="" loading="lazy" />
          </button>
        ))}
      </Row>
      {i !== null && <Lightbox imgs={list.map((f) => f.img)} i={i} setI={setI} onClose={() => setI(null)} />}
    </>
  );
}

function Reviews() {
  const { feedback, t } = useStore();
  const [i, setI] = useState(null);
  const [n, setN] = useState(24);
  const list = feedback || [];
  return (
    <section className="section reviews-page">
      <div className="page-head">
        <h1>{t("آراء زبائننا 💬")}</h1>
        <p className="muted">{t("صور حقيقية من زبائننا بعد ما وصلتهم طلباتهم")}</p>
      </div>
      {!list.length ? (
        <div className="empty">{t("الآراء بتنضاف قريباً 🌸")}</div>
      ) : (
        <>
          <div className="fb-grid">
            {list.slice(0, n).map((f, k) => (
              <button key={f.img} type="button" className="fb-tile" onClick={() => setI(k)}>
                <img src={f.img} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          {n < list.length && (
            <div className="center">
              <button className="btn" onClick={() => setN(n + 24)}>
                {t("عرض المزيد")}
              </button>
            </div>
          )}
        </>
      )}
      {i !== null && <Lightbox imgs={list.map((f) => f.img)} i={i} setI={setI} onClose={() => setI(null)} />}
    </section>
  );
}

// عدّاد تنازلي للعروض
function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
const pad2 = (n) => String(n).padStart(2, "0");
function Countdown({ until, label, small }) {
  const now = useNow();
  const left = Math.max(0, until - now);
  if (!left) return null;
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return (
    <span className={"countdown" + (small ? " small" : "")} dir="ltr">
      <Icon name="clock" />
      {label && !small && <em dir="auto">{label}</em>}
      <b>
        {pad2(h)}:{pad2(m)}:{pad2(sec)}
      </b>
    </span>
  );
}

// المساحة الإعلانية: منتج واحد كل 10 ثواني
const SPOT_MS = 10000;
function Spotlight() {
  const { products, settings, t, w } = useStore();
  const list = useMemo(() => {
    const live = products.filter((p) => p.available && p.images?.[0]);
    const pick = [
      ...live.filter((p) => p.flash),
      ...live.filter((p) => p.featured && !p.flash),
      ...live.filter((p) => !p.flash && !p.featured && discountPct(p) > 0),
      ...[...live].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    ];
    return [...new Map(pick.map((p) => [p.id, p])).values()].slice(0, 10);
  }, [products]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touch = useRef(null);
  useEffect(() => {
    if (list.length < 2 || paused) return undefined;
    const tm = setTimeout(() => setI((x) => (x + 1) % list.length), SPOT_MS);
    return () => clearTimeout(tm);
  }, [i, list.length, paused]);
  if (!list.length) return null;
  const p = list[i % list.length];
  const pct = discountPct(p);
  const go = (d) => setI((x) => (x + d + list.length) % list.length);
  return (
    <section
      className="spot"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touch.current ?? e.changedTouches[0].clientX);
        if (Math.abs(dx) > 40) go((dx < 0 ? 1 : -1) * (document.documentElement.dir === "rtl" ? -1 : 1));
      }}
    >
      <Link key={p.id} to={`/p/${p.id}`} className="spot-card">
        <div className="spot-media">
          <Img src={p.images[0]} alt={pName(p)} className="spot-img" />
          {pct > 0 && <span className="spot-pct">-{pct}%</span>}
        </div>
        <div className="spot-info">
          <span className="spot-kicker">{p.flash ? t("عرض لفترة محدودة ⏱️") : p.featured ? t("منتج مميز ⭐") : p.category ? w(p.category) : t("وصل حديثاً ✨")}</span>
          <h2 className="spot-name">{pName(p)}</h2>
          <div className="spot-price">
            <b>
              {money(p.price)} <small>{settings.currency}</small>
            </b>
            {p.oldPrice > p.price && (
              <s>
                {money(p.oldPrice)} {settings.currency}
              </s>
            )}
          </div>
          {p.flash && <Countdown until={p.flashUntil} label={t("بينتهي خلال")} />}
          <span className="btn primary spot-cta">{t("اطلب الآن")}</span>
        </div>
      </Link>
      {list.length > 1 && (
        <>
          <button type="button" className="spot-nav prev" onClick={() => go(-1)} aria-label={t("السابقة")}>
            ‹
          </button>
          <button type="button" className="spot-nav next" onClick={() => go(1)} aria-label={t("التالية")}>
            ›
          </button>
          <div className="spot-dots">
            {list.map((x, k) => (
              <button key={x.id} type="button" className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={String(k + 1)}>
                {k === i && <span key={i + String(paused)} className={"spot-bar" + (paused ? " paused" : "")} style={{ animationDuration: `${SPOT_MS}ms` }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Banners() {
  const { settings, products, t, tr } = useStore();
  const list = (settings.banners || []).filter((b) => b.img);
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const nav = useNavigate();
  useEffect(() => {
    if (list.length < 2) return undefined;
    const tm = setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const next = (Math.round(Math.abs(el.scrollLeft) / el.clientWidth) + 1) % list.length;
      el.scrollTo({ left: -next * el.clientWidth * (getComputedStyle(el).direction === "rtl" ? 1 : -1), behavior: "smooth" });
    }, 5000);
    return () => clearInterval(tm);
  }, [list.length]);
  // ما في بانرات: لو في منتجات، المساحة الإعلانية بتاخد مكان الواجهة
  if (!list.length && products.some((p) => p.available && p.images?.[0])) return null;
  if (!list.length)
    return (
      <section className="hero">
        <h1>{siteName(settings)}</h1>
        <p>{siteTagline(settings)}</p>
        <button className="btn light" onClick={() => document.querySelector(".cats-grid, .row")?.scrollIntoView({ behavior: "smooth" })}>
          {t("تسوّق الآن")}
        </button>
      </section>
    );
  const go = (b) => {
    if (!b.link) return;
    const [k, v] = [b.link.slice(0, 1), b.link.slice(2)];
    nav(k === "c" ? `/c/${encodeURIComponent(v)}` : `/p/${v}`);
  };
  return (
    <section className="banners">
      <div className="banner-track" ref={ref} onScroll={(e) => setI(Math.round(Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth))}>
        {list.map((b, k) => (
          <button key={b.img + k} className="banner" onClick={() => go(b)}>
            <Img src={b.img} alt={b.title || ""} />
            {b.title && !tr && <span className="banner-title">{b.title}</span>}
          </button>
        ))}
      </div>
      {list.length > 1 && (
        <div className="dots">
          {list.map((_, k) => (
            <span key={k} className={k === i ? "on" : ""} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ======================= قسم / بحث ======================= */
const SORTS = {
  new: ["الأحدث", (a, b) => (b.createdAt || 0) - (a.createdAt || 0)],
  best: ["الأكثر مبيعاً", (a, b) => (b.sold || 0) - (a.sold || 0)],
  low: ["السعر: من الأقل", (a, b) => a.price - b.price],
  high: ["السعر: من الأعلى", (a, b) => b.price - a.price],
};

function Grid({ list }) {
  const { t } = useStore();
  const [sort, setSort] = useState("new");
  const sorted = [...list].sort((a, b) => Number(b.available) - Number(a.available) || SORTS[sort][1](a, b));
  return (
    <>
      <div className="grid-tools">
        <span className="muted">{t("{n} منتج", { n: list.length })}</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, [l]]) => (
            <option key={k} value={k}>
              {t(l)}
            </option>
          ))}
        </select>
      </div>
      {list.length ? (
        <div className="grid">
          {sorted.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="empty">{t("ما في منتجات هون")}</div>
      )}
    </>
  );
}

function Category() {
  const { cat } = useParams();
  const { products, settings, w } = useStore();
  const c = decodeURIComponent(cat);
  const cats = settings.categories.filter((x) => products.some((p) => p.category === x));
  useEffect(() => {
    track("ViewContent", { content_category: c });
  }, [c]);
  return (
    <>
      <div className="cat-chips">
        {cats.map((x) => (
          <Link key={x} to={`/c/${encodeURIComponent(x)}`} className={"chip" + (x === c ? " on" : "")}>
            {w(x)}
          </Link>
        ))}
      </div>
      <h1 className="page-title">{w(c)}</h1>
      <Grid list={products.filter((p) => p.category === c)} />
    </>
  );
}

function Search() {
  const { products, t } = useStore();
  const [q, setQ] = useState("");
  const n = (s) => String(s || "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();
  const list = q.trim()
    ? products.filter((p) => n(`${p.name} ${p.nameHe || ""} ${p.category} ${p.desc} ${(p.features || []).join(" ")}`).includes(n(q.trim())))
    : products;
  useEffect(() => {
    if (!q.trim()) return undefined;
    const tm = setTimeout(() => track("Search", { search_string: q.trim() }), 1200);
    return () => clearTimeout(tm);
  }, [q]);
  return (
    <>
      <div className="search">
        <Icon name="search" />
        <input autoFocus type="search" placeholder={t("ابحث عن منتج...")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Grid list={list} />
    </>
  );
}

/* ======================= المنتج ======================= */
function Gallery({ images, name, badge, pct }) {
  const { t } = useStore();
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const imgs = images?.length ? images : [""];
  const go = (k) => {
    const el = ref.current;
    if (!el) return;
    const n = (k + imgs.length) % imgs.length;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollTo({ left: (rtl ? -1 : 1) * n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = (e) => setI(Math.round(Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth));
  useEffect(() => {
    if (!zoom) go(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);
  // الصورة المختارة بالمصغّرات تضل ظاهرة
  const thumbs = useRef(null);
  useEffect(() => {
    const el = thumbs.current?.children[i];
    if (el && thumbs.current) {
      const box = thumbs.current;
      const left = el.offsetLeft - (box.clientWidth - el.clientWidth) / 2;
      box.scrollTo({ left, behavior: "smooth" });
    }
  }, [i]);

  return (
    <div className="gallery">
      <div className="g-main">
        <div className="g-track" ref={ref} onScroll={onScroll}>
          {imgs.map((src, k) => (
            <button key={src + k} className="g-slide" onClick={() => src && (setI(k), setZoom(true))}>
              <Img src={src} alt={name} />
            </button>
          ))}
        </div>
        <div className="card-badges">
          {pct > 0 && <span className="badge red">-{pct}%</span>}
          {badge && <span className="badge">{badge}</span>}
        </div>
        {imgs.length > 1 && (
          <>
            <button className="g-arrow prev" onClick={() => go(i - 1)} aria-label={t("السابقة")}>
              <Icon name="right" />
            </button>
            <button className="g-arrow next" onClick={() => go(i + 1)} aria-label={t("التالية")}>
              <Icon name="left" />
            </button>
            <span className="g-count">
              {i + 1} / {imgs.length}
            </span>
          </>
        )}
      </div>
      {imgs.length > 1 && (
        <div className="thumbs" ref={thumbs}>
          {imgs.map((src, k) => (
            <button key={src + k} className={"thumb" + (k === i ? " on" : "")} onClick={() => go(k)}>
              <Img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      {zoom && <Lightbox imgs={imgs} i={i} setI={setI} onClose={() => setZoom(false)} />}
    </div>
  );
}

function Lightbox({ imgs, i, setI, onClose }) {
  const { t } = useStore();
  const start = useRef(null);
  const n = imgs.length;
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((x) => (x + 1) % n);
      if (e.key === "ArrowRight") setI((x) => (x - 1 + n) % n);
    };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [n, onClose, setI]);
  return (
    <div
      className="lightbox"
      onClick={onClose}
      onTouchStart={(e) => (start.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (start.current == null) return;
        const dx = e.changedTouches[0].clientX - start.current;
        if (Math.abs(dx) > 40) setI((x) => (dx > 0 ? (x + 1) % n : (x - 1 + n) % n));
        start.current = null;
      }}
    >
      <img src={imgs[i]} alt="" onClick={(e) => e.stopPropagation()} />
      {n > 1 && (
        <>
          <button className="lb-arrow prev" onClick={(e) => (e.stopPropagation(), setI((x) => (x - 1 + n) % n))} aria-label={t("السابقة")}>
            <Icon name="right" />
          </button>
          <button className="lb-arrow next" onClick={(e) => (e.stopPropagation(), setI((x) => (x + 1) % n))} aria-label={t("التالية")}>
            <Icon name="left" />
          </button>
          <span className="lb-count">
            {i + 1} / {n}
          </span>
        </>
      )}
      <button className="lb-close" onClick={onClose} aria-label={t("إغلاق")}>
        ✕
      </button>
    </div>
  );
}

function Product() {
  const { id } = useParams();
  const { byId, products, settings, cart, toast, t, w, tr, cur } = useStore();
  const nav = useNavigate();
  const p = byId[id];
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState({});
  const [optErr, setOptErr] = useState("");
  const [guide, setGuide] = useState(false);
  const [fb, setFb] = useState(null);
  const [moreFeat, setMoreFeat] = useState(false);
  const buyRef = useRef(null);

  useEffect(() => {
    setQty(1);
    setSel({});
    setOptErr("");
    setMoreFeat(false);
    if (p) {
      ls.set("seen", [p.id, ...ls.get("seen", []).filter((x) => x !== p.id)].slice(0, 20));
      track("ViewContent", { content_ids: [p.id], content_name: p.name, content_type: "product", value: p.price, currency: cur });
    }
  }, [id, p, cur]);

  if (!p)
    return (
      <div className="empty">
        {t("المنتج مش موجود.")} <Link to="/">{t("رجوع للمتجر")}</Link>
      </div>
    );

  const groups = p.options || [];
  const name = pName(p);
  const features = pFeatures(p);
  const desc = pDesc(p);
  function add(go) {
    const missing = groups.find((g) => !sel[g.label]);
    if (missing) {
      setOptErr(missing.label);
      buyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    cart.add(p, qty, optText(sel), groups.length ? JSON.stringify(sel) : "");
    if (go) nav("/cart");
    else toast(t("✓ انضاف للسلة"));
  }
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else window.open(`https://wa.me/?text=${encodeURIComponent(`${name}\n${url}`)}`, "_blank");
    } catch {
      /* ألغى */
    }
  }
  // طلب مباشر على واتساب (للي ما بحب يعبّي النموذج)
  function waOrder() {
    const missing = groups.find((g) => !sel[g.label]);
    if (missing) {
      setOptErr(missing.label);
      buyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const opt = optText(sel);
    const lines = [
      t("مرحبا، بدي أطلب:"),
      `🛍️ ${name}${opt ? ` (${opt})` : ""}`,
      `${t("الكمية")}: ${qty}`,
      `${t("السعر")}: ${money(p.price * qty)} ${settings.currency} ${t("+ التوصيل")}`,
      window.location.href,
      "",
      t("الاسم:"),
      t("العنوان:"),
    ];
    track("Lead", { content_ids: [p.id], value: p.price * qty, currency: cur });
    window.open(waLinkTo(settings.whatsapp, lines.join("\n")), "_blank");
  }
  const related = [...(p.related || []).map((r) => byId[r]).filter(Boolean)];
  const same = products.filter((x) => x.id !== p.id && x.category === p.category && !related.includes(x)).slice(0, 10);
  const pct = discountPct(p);
  const ask = settings.whatsapp ? waLinkTo(settings.whatsapp, `${t("مرحبا، بستفسر عن: {n}", { n: name })}\n${window.location.href}`) : "";
  const FEAT_MAX = 8;
  const shownFeat = moreFeat ? features : features.slice(0, FEAT_MAX);

  return (
    <div className="product">
      <div className="crumbs">
        <Link to="/">{t("الرئيسية")}</Link>
        {p.category && (
          <>
            <span>›</span>
            <Link to={`/c/${encodeURIComponent(p.category)}`}>{w(p.category)}</Link>
          </>
        )}
      </div>
      <div className="product-top">
        <Gallery images={p.images} name={name} badge={tr ? "" : p.badge} pct={pct} />

        <div className="info">
          <h1 className="p-name">{name}</h1>
          <div className="p-meta">
            {p.rating?.count > 0 && (
              <a href="#reviews" onClick={(e) => (e.preventDefault(), document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" }))}>
                <Stars value={p.rating.avg} count={p.rating.count} size="md" />
              </a>
            )}
            {p.sold > 2 && <span className="sold">🔥 {t("انطلب {n} مرة", { n: p.sold })}</span>}
          </div>
          <Price p={p} big />
          {p.flash && <Countdown until={p.flashUntil} label={t("العرض بينتهي خلال")} />}
          <div className="muted small">
            {p.delivery === "perPiece"
              ? t("+ التوصيل لكل قطعة حسب منطقتك")
              : p.delivery === "custom"
              ? t("+ توصيل خاص: {n} للقطعة", { n: `${money(p.deliveryPrice)} ${settings.currency}` })
              : t("+ التوصيل حسب منطقتك · الدفع عند الاستلام")}
          </div>

          {p.available ? (
            <div className="buy" ref={buyRef}>
              {groups.map((g) => (
                <div key={g.label} className={"opt" + (optErr === g.label ? " err" : "")}>
                  <div className="opt-head">
                    <label>
                      {w(g.label)}
                      {sel[g.label] && <b>: {w(sel[g.label])}</b>}
                    </label>
                    {p.sizeGuide && /مقاس/.test(g.label) && (
                      <button className="link" onClick={() => setGuide((x) => !x)}>
                        {t("📏 دليل المقاسات")}
                      </button>
                    )}
                  </div>
                  {guide && p.sizeGuide && /مقاس/.test(g.label) && <div className="guide">{p.sizeGuide}</div>}
                  <div className="opt-list">
                    {g.values.map((v) => {
                      const off = g.off?.includes(v);
                      return (
                        <button
                          key={v}
                          disabled={off}
                          className={"opt-btn" + (sel[g.label] === v ? " on" : "") + (off ? " off" : "")}
                          onClick={() => (setSel((s) => ({ ...s, [g.label]: v })), setOptErr(""))}
                          title={off ? t("مش متوفر حالياً") : ""}
                        >
                          {w(v)}
                        </button>
                      );
                    })}
                  </div>
                  {optErr === g.label && <div className="err-text">{t("اختر {x} أول", { x: w(g.label) })}</div>}
                </div>
              ))}
              <div className="qty-row">
                <span>{t("الكمية")}</span>
                <Qty value={qty} onChange={setQty} />
              </div>
              <div className="buy-btns">
                <button className="btn primary" onClick={() => add(true)}>
                  {t("اطلب الآن")}
                </button>
                <button className="btn outline" onClick={() => add(false)}>
                  {t("أضف للسلة")}
                </button>
              </div>
              {settings.whatsapp && (
                <button className="btn wa wa-order" onClick={waOrder}>
                  <Icon name="wa" /> {t("اطلب عن طريق واتساب")}
                </button>
              )}
              <div className="buy-links">
                {ask && (
                  <a href={ask} target="_blank" rel="noreferrer" onClick={() => track("Contact")}>
                    <Icon name="wa" /> {t("استفسر على واتساب")}
                  </a>
                )}
                <button onClick={share}>
                  <Icon name="share" /> {t("شارك المنتج")}
                </button>
              </div>
            </div>
          ) : (
            <div className="soldout-box">
              {t("نفدت الكمية حالياً")}
              {ask && (
                <a className="btn wa" href={waLinkTo(settings.whatsapp, t("مرحبا، بدي أعرف إذا رح يرجع: {n}", { n: name }))} target="_blank" rel="noreferrer">
                  {t("خبّرني لما يرجع")}
                </a>
              )}
            </div>
          )}

          <ul className="mini-trust">
            <li>{t("🚚 توصيل خلال 2–5 أيام لكل المناطق")}</li>
            <li>{t("💵 الدفع عند الاستلام")}</li>
            <li>{t("👀 تفقد المنتج عند الاستلام")}</li>
          </ul>

          {features.length > 0 && (
            <div className="box">
              <h3>{t("المميزات")}</h3>
              <ul className="features">
                {shownFeat.map((f, k) => (
                  <li key={k}>{f}</li>
                ))}
              </ul>
              {features.length > FEAT_MAX && (
                <button className="link more-btn" onClick={() => setMoreFeat((x) => !x)}>
                  {moreFeat ? "▲" : `▼ +${features.length - FEAT_MAX}`}
                </button>
              )}
            </div>
          )}
          {desc && (
            <div className="box">
              <h3>{t("الوصف")}</h3>
              <p className="desc">{desc}</p>
            </div>
          )}
        </div>
      </div>

      {(p.reviews?.length > 0 || p.feedback?.length > 0) && (
        <section className="section" id="reviews">
          <div className="row-head">
            <h2>{t("آراء زبائننا 💬")}</h2>
            {p.rating?.count > 0 && (
              <span className="rating-sum">
                <b>{p.rating.avg}</b> <Stars value={p.rating.avg} /> <span className="muted">{t("({n} تقييم)", { n: p.rating.count })}</span>
              </span>
            )}
          </div>
          {p.reviews?.length > 0 && (
            <div className="reviews">
              {p.reviews.map((r, k) => (
                <div key={k} className="review">
                  <div className="review-head">
                    <b>{r.name}</b>
                    <Stars value={r.stars} />
                  </div>
                  {r.text && <p>{r.text}</p>}
                </div>
              ))}
            </div>
          )}
          {p.feedback?.length > 0 && (
            <div className="feedback">
              {p.feedback.map((src, k) => (
                <button key={src + k} onClick={() => setFb(k)}>
                  <Img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {related.length > 0 && (
        <Row title={t("بيلبق معه")}>
          {related.map((r) => (
            <Card key={r.id} p={r} />
          ))}
        </Row>
      )}
      {same.length > 0 && (
        <Row title={t("ممكن يعجبك كمان")}>
          {same.map((r) => (
            <Card key={r.id} p={r} />
          ))}
        </Row>
      )}

      {p.available && (
        <div className="sticky-buy">
          <div className="sb-price">
            <b>
              {money(p.price)} {settings.currency}
            </b>
            {pct > 0 && <s>{money(p.oldPrice)}</s>}
          </div>
          <button className="btn primary" onClick={() => add(false)}>
            {t("أضف للسلة")}
          </button>
        </div>
      )}
      {fb !== null && <Lightbox imgs={p.feedback} i={fb} setI={setFb} onClose={() => setFb(null)} />}
    </div>
  );
}

function Qty({ value, onChange }) {
  const { t } = useStore();
  return (
    <div className="qty">
      <button onClick={() => onChange(Math.min(20, value + 1))} aria-label={t("زيادة")}>
        +
      </button>
      <span>{value}</span>
      <button onClick={() => onChange(Math.max(1, value - 1))} aria-label={t("نقص")}>
        −
      </button>
    </div>
  );
}

// اسم وخيار المنتج بالسلة حسب اللغة
function useItemText() {
  const { byId, tr, w } = useStore();
  return (it) => {
    const p = byId[it.id];
    const name = p ? pName(p) : it.name;
    const opt = it.sel
      ? Object.entries(it.sel)
          .map(([k, v]) => `${w(k)}: ${w(v)}`)
          .join("، ")
      : it.option;
    return { name, opt };
  };
}

/* ======================= السلة ======================= */
function Cart() {
  const { cart, settings, t } = useStore();
  const txt = useItemText();
  const { subtotal } = calcTotals(cart.items, null);
  if (!cart.items.length)
    return (
      <div className="empty">
        <div className="empty-ic">
          <Icon name="bag" />
        </div>
        {t("السلة فاضية")}
        <Link to="/" className="btn primary">
          {t("تسوّق الآن")}
        </Link>
      </div>
    );
  return (
    <div className="narrow">
      <h1 className="page-title">{t("السلة ({n})", { n: cart.count })}</h1>
      <div className="cart-list">
        {cart.items.map((it) => {
          const { name, opt } = txt(it);
          return (
            <div key={it.key} className="cart-item">
              <Link to={`/p/${it.id}`} className="ci-img">
                <Img src={it.image} alt={name} />
              </Link>
              <div className="ci-body">
                <div className="ci-name">{name}</div>
                {opt && <div className="ci-opt">{opt}</div>}
                <div className="ci-price">
                  {money(it.price * it.qty)} {settings.currency}
                </div>
                <div className="ci-row">
                  <Qty value={it.qty} onChange={(v) => cart.setQty(it.key, v)} />
                  <button className="link-btn" onClick={() => cart.remove(it.key)}>
                    {t("حذف")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sum-box">
        <div className="sum-row">
          <span>{t("المجموع")}</span>
          <b>
            {money(subtotal)} {settings.currency}
          </b>
        </div>
        <div className="muted small">{t("التوصيل بينحسب بالخطوة الجاية حسب منطقتك · الدفع عند الاستلام")}</div>
        <Link to="/checkout" className="btn primary block">
          {t("إتمام الطلب")}
        </Link>
        <Link to="/" className="btn ghost block">
          {t("كمّل تسوّق")}
        </Link>
      </div>
    </div>
  );
}

/* ======================= إتمام الطلب ======================= */
function Checkout() {
  const { cart, settings, t, w, dur, tr, lang, cur } = useStore();
  const txt = useItemText();
  const nav = useNavigate();
  const saved = ls.get("buyer", {});
  const [f, setF] = useState({
    name: saved.name || "",
    city: saved.city || "",
    regionId: saved.regionId || "",
    address: saved.address || "",
    phone1: saved.phone1 || "",
    phone2: saved.phone2 || "",
    notes: "",
  });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [fallback, setFallback] = useState(null);
  const set = (k, v) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrs((e) => (e[k] || (k === "city" && e.regionId) ? { ...e, [k]: undefined, ...(k === "city" ? { regionId: undefined } : {}) } : e));
  };

  const regions = settings.regions;
  const matches = regionsForCity(regions, f.city);
  useEffect(() => {
    if (matches.length && !matches.some((r) => r.id === f.regionId)) set("regionId", matches[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.city]);
  useEffect(() => {
    if (cart.items.length) track("InitiateCheckout", { num_items: cart.count, value: calcTotals(cart.items, null).subtotal, currency: cur });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const region = regions.find((r) => r.id === f.regionId) || null;
  const totals = calcTotals(cart.items, region);
  const allCities = useMemo(() => [...new Set(regions.flatMap((r) => r.cities || []))], [regions]);
  const rName = (r) => (tr ? w(r.id) : r.name);

  if (!cart.items.length) {
    return (
      <div className="empty">
        {t("السلة فاضية")} <Link to="/">{t("رجوع للمتجر")}</Link>
      </div>
    );
  }

  function validate() {
    const e = {};
    const words = f.name.trim().split(/\s+/).filter(Boolean);
    if (words.length < (tr ? 2 : 3)) e.name = t("اكتب الاسم الثلاثي أو الرباعي");
    if (!region) e.regionId = t("اختر المنطقة");
    if (f.city.trim().length < 2) e.city = t("اكتب البلد أو القرية");
    if (f.address.trim().length < 3) e.address = t("اكتب العنوان بالتفصيل");
    if (!normPhone(f.phone1)) e.phone1 = t("رقم جوال غير صحيح (مثال: 0591234567)");
    if (f.phone2.trim() && !normPhone(f.phone2)) e.phone2 = t("رقم جوال غير صحيح");
    setErrs(e);
    const first = Object.keys(e)[0];
    if (first) document.querySelector(`[data-f="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    return !first;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setSendErr("");
    const order = {
      code: orderCode(),
      name: f.name.trim().replace(/\s+/g, " ").slice(0, 80),
      phone1: normPhone(f.phone1),
      phone2: normPhone(f.phone2),
      regionId: region.id,
      regionName: region.name,
      city: f.city.trim().slice(0, 60),
      address: f.address.trim().slice(0, 200),
      notes: f.notes.trim().slice(0, 300),
      items: cart.items.slice(0, 30).map((it) => ({
        id: it.id,
        name: String(it.name).slice(0, 120),
        price: Number(it.price) || 0,
        qty: it.qty,
        option: it.option || "",
        delivery: it.delivery || "normal",
        deliveryPrice: Number(it.deliveryPrice) || 0,
      })),
      subtotal: totals.subtotal,
      delivery: totals.delivery,
      total: totals.total,
      lang,
      status: "new",
      createdAt: serverTimestamp(),
    };
    try {
      // الطلب + نسخة التتبع بخطوة وحدة؛ لو التتبع ما انقبل (قواعد قديمة) بنبعت الطلب لحاله
      const ref = doc(collection(db, "orders"));
      try {
        const b = writeBatch(db);
        b.set(ref, order);
        b.set(doc(db, "order_track", order.code), { ...trackDoc({ ...order, id: ref.id }), createdAt: serverTimestamp() });
        await b.commit();
      } catch (e1) {
        console.warn(e1);
        await setDoc(ref, order);
      }
      track("Purchase", { value: order.total, currency: cur, content_ids: order.items.map((x) => x.id), content_type: "product", num_items: cart.count });
      ls.set("buyer", { name: order.name, city: order.city, regionId: order.regionId, address: order.address, phone1: f.phone1, phone2: f.phone2 });
      ls.set("lastOrder", { ...order, createdAt: Date.now(), duration: region.duration, itemsText: cart.items.map((it) => txt(it)) });
      cart.clear();
      nav("/done");
    } catch (e) {
      console.error(e);
      setSendErr(t("ما قدرنا نبعت الطلب، تأكد من البيانات والإنترنت وجرب مرة تانية."));
      setFallback({ ...order, createdAt: Date.now(), itemsText: cart.items.map((it) => txt(it)) });
      setBusy(false);
    }
  }

  return (
    <form className="narrow" onSubmit={submit} noValidate>
      <div className="steps">
        <span className="done">{t("السلة")}</span>
        <span className="on">{t("بيانات التوصيل")}</span>
        <span>{t("تأكيد")}</span>
      </div>
      <h1 className="page-title">{t("بيانات التوصيل")}</h1>
      <Field k="name" label={t("الاسم (رباعي)")} err={errs.name}>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" />
      </Field>
      <Field k="city" label={t("البلد أو القرية")} err={errs.city}>
        <input value={f.city} onChange={(e) => set("city", e.target.value)} list="cities" placeholder={t("ابدأ الكتابة واختر من القائمة")} />
        <datalist id="cities">
          {allCities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field k="regionId" label={t("المنطقة")} err={errs.regionId} hint={matches.length > 1 ? t("هاد الاسم موجود بأكتر من منطقة، تأكد من الصح") : ""}>
        <select value={f.regionId} onChange={(e) => set("regionId", e.target.value)}>
          <option value="">{t("— اختر —")}</option>
          {(matches.length > 1 ? matches : regions).map((r) => (
            <option key={r.id} value={r.id}>
              {rName(r)} — {t("توصيل {n}", { n: `${money(r.price)} ${settings.currency}` })}
            </option>
          ))}
        </select>
      </Field>
      <Field k="address" label={t("العنوان بالتفصيل")} err={errs.address}>
        <input value={f.address} onChange={(e) => set("address", e.target.value)} placeholder={t("الحي، الشارع، علامة مميزة")} autoComplete="street-address" />
      </Field>
      <div className="two">
        <Field k="phone1" label={t("رقم جوال (عليه واتساب)")} err={errs.phone1}>
          <input value={f.phone1} onChange={(e) => set("phone1", e.target.value)} inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" autoComplete="tel" />
        </Field>
        <Field k="phone2" label={t("رقم جوال تاني (اختياري)")} err={errs.phone2}>
          <input value={f.phone2} onChange={(e) => set("phone2", e.target.value)} inputMode="tel" dir="ltr" placeholder="05xxxxxxxx" />
        </Field>
      </div>
      <Field label={t("ملاحظة (اختياري)")}>
        <textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <div className="sum-box">
        <h3>{t("ملخص الطلب")}</h3>
        {cart.items.map((it) => {
          const { name, opt } = txt(it);
          return (
            <div key={it.key} className="sum-item">
              <span className="si-img">
                <Img src={it.image} alt="" />
              </span>
              <span className="si-name">
                {name}
                {opt ? ` (${opt})` : ""}
                {it.qty > 1 ? ` × ${it.qty}` : ""}
              </span>
              <span className="nowrap">
                {money(it.price * it.qty)} {settings.currency}
              </span>
            </div>
          );
        })}
        <div className="sum-row">
          <span>
            {t("التوصيل")}
            {region ? ` (${rName(region)})` : ""}
          </span>
          <span className="nowrap">{region ? `${money(totals.delivery)} ${settings.currency}` : t("اختر المنطقة")}</span>
        </div>
        <div className="sum-row total">
          <span>{t("المجموع")}</span>
          <b className="nowrap">
            {money(totals.total)} {settings.currency}
          </b>
        </div>
        {region?.duration && (
          <div className="muted small">
            {t("مدة التوصيل: {n}", { n: dur(region.duration) })}
            {settings.noDeliveryDays && ` · ${t(settings.noDeliveryDays)}`}
          </div>
        )}
        <div className="muted small">{t("💵 الدفع عند الاستلام، والرجاء تفقد المنتج عند الاستلام.")}</div>
        {sendErr && <div className="err-text">{sendErr}</div>}
        {fallback && settings.whatsapp && (
          <a
            className="btn wa block"
            href={waLinkTo(settings.whatsapp, lang === "he" ? waOrderTextHe(fallback, settings.currency, fallback.itemsText) : waOrderText(fallback, settings.currency))}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              track("Purchase", { value: fallback.total, currency: cur });
              ls.set("lastOrder", { ...fallback, duration: region?.duration });
              cart.clear();
              setTimeout(() => nav("/done"), 400);
            }}
          >
            <Icon name="wa" /> {t("ابعت الطلب على واتساب")}
          </a>
        )}
        <button className="btn primary block" disabled={busy}>
          {busy ? t("جاري الإرسال...") : t("تأكيد الطلب")}
        </button>
      </div>
    </form>
  );
}

function Field({ k, label, err, hint, children }) {
  return (
    <label className={"field" + (err ? " has-err" : "")} data-f={k}>
      <span>{label}</span>
      {children}
      {err ? <em className="err-text">{err}</em> : hint ? <em className="hint">{hint}</em> : null}
    </label>
  );
}

// رسالة الطلب بالعبري (للزبون اللي طلب من النسخة العبرية)
function waOrderTextHe(o, currency, itemsText) {
  const lines = (o.items || []).map((it, k) => {
    const x = itemsText?.[k];
    return `▫️ ${x?.name || it.name}${x?.opt || it.option ? ` (${x?.opt || it.option})` : ""}${it.qty > 1 ? ` × ${it.qty}` : ""} — ${money(it.price * it.qty)} ${currency}`;
  });
  return [
    `🛒 הזמנה חדשה #${o.code}`,
    "",
    ...lines,
    "",
    `משלוח: ${money(o.delivery)} ${currency}`,
    `סה״כ: ${money(o.total)} ${currency}`,
    "",
    `שם: ${o.name}`,
    `כתובת: ${[o.city, o.address].filter(Boolean).join(" - ")}`,
    `טלפון: ${[displayPhone(o.phone1), displayPhone(o.phone2)].filter(Boolean).join(" / ")}`,
    o.notes ? `הערה: ${o.notes}` : "",
  ]
    .join("\n")
    .trim();
}

/* ======================= تم الطلب ======================= */
function Done() {
  const { settings, t, lang, dur } = useStore();
  const o = ls.get("lastOrder", null);
  if (!o)
    return (
      <div className="empty">
        <Link to="/">{t("رجوع للمتجر")}</Link>
      </div>
    );
  const text = lang === "he" ? waOrderTextHe(o, settings.currency, o.itemsText) : waOrderText(o, settings.currency);
  const link = settings.whatsapp ? waLinkTo(settings.whatsapp, text) : "";
  return (
    <div className="narrow done">
      <div className="done-icon">✓</div>
      <h1>{t("وصلنا طلبك، شكراً إلك 🌸")}</h1>
      <p>
        {t("رقم الطلب")} <b dir="ltr">#{o.code}</b>
      </p>
      <p className="muted">
        {t("المجموع {n} شامل التوصيل", { n: `${money(o.total)} ${settings.currency}` })}
        {o.duration ? t(" · التوصيل خلال {n}", { n: dur(o.duration) }) : ""}
      </p>
      <p>{t("رح توصلك رسالة تأكيد على الواتساب على رقم {n}، أكّد عليها عشان نجهّز طلبك.", { n: displayPhone(o.phone1) })}</p>
      <Link to={`/track/${o.code}`} className="btn ghost block">
        📦 {t("تتبع طلبك")}
      </Link>
      {link && (
        <a className="btn wa block" href={link} target="_blank" rel="noreferrer">
          <Icon name="wa" /> {t("ابعت الطلب على واتساب")}
        </a>
      )}
      <Link to="/" className="btn ghost block">
        {t("رجوع للمتجر")}
      </Link>
    </div>
  );
}

/* ======================= تتبع الطلب ======================= */
function Track() {
  const { code: codeParam } = useParams();
  const { settings, t, tr } = useStore();
  const nav = useNavigate();
  const last = ls.get("lastOrder", null);
  const [code, setCode] = useState(String(codeParam || "").toUpperCase());
  const [phone, setPhone] = useState(() => (last && (!codeParam || last.code === String(codeParam).toUpperCase()) ? String(ls.get("buyer", {})?.phone1 || last.phone1 || "") : ""));
  const [res, setRes] = useState(null); // {doc} | {err}
  const [busy, setBusy] = useState(false);
  async function look(c = code, ph = phone) {
    const k = String(c || "").trim().replace(/^#/, "").toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(k)) return setRes({ err: t("رقم الطلب 6 حروف وأرقام (موجود برسالة التأكيد)") });
    if (last4(normPhoneTrack(ph) || ph).length < 4) return setRes({ err: t("اكتب رقم الجوال اللي طلبت فيه") });
    setBusy(true);
    try {
      const s = await getDoc(doc(db, "order_track", k));
      const d = s.exists() ? s.data() : null;
      if (!d || d.p4 !== last4(normPhoneTrack(ph) || ph)) setRes({ err: t("ما لقينا طلب بهالرقم والجوال — تأكد منهم أو تواصل معنا") });
      else {
        setRes({ doc: { ...d, code: k } });
        if (k !== codeParam) nav(`/track/${k}`, { replace: true });
      }
    } catch {
      setRes({ err: t("تعذّر الوصول، تأكد من الإنترنت وجرب مرة تانية.") });
    }
    setBusy(false);
  }
  useEffect(() => {
    if (codeParam && phone) look(codeParam, phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const d = res?.doc;
  const stage = d ? TRACK_STAGE[d.status] ?? 0 : 0;
  const steps = [t("استلمنا طلبك"), t("تم التأكيد"), t("بالطريق إليك"), t("تم التسليم")];
  const wa = settings.whatsapp ? waLinkTo(settings.whatsapp, `${t("مرحبا، بستفسر عن طلبي")} #${d?.code || code}`) : "";
  return (
    <div className="narrow track-page">
      <h1 className="page-title">📦 {t("تتبع طلبك")}</h1>
      <form
        className="track-form"
        onSubmit={(e) => {
          e.preventDefault();
          look();
        }}
      >
        <label>
          {t("رقم الطلب")}
          <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3" maxLength={7} autoCapitalize="characters" />
        </label>
        <label>
          {t("رقم الجوال")}
          <input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" />
        </label>
        <button className="btn primary block" disabled={busy}>
          {busy ? t("جاري...") : t("تتبع")}
        </button>
      </form>
      {res?.err && <div className="track-err">{res.err}</div>}
      {d && (
        <div className="track-card">
          <div className="track-head">
            <b dir="ltr">#{d.code}</b>
            <span>
              {money(d.total)} {settings.currency}
            </span>
          </div>
          {stage < 0 ? (
            <div className="track-cancel">{d.status === "returned" ? t("الطلب رجع ✖") : t("الطلب ملغي ✖")}</div>
          ) : (
            <ol className="track-steps">
              {steps.map((x, i) => (
                <li key={x} className={i < stage ? "done" : i === stage ? "now" : ""}>
                  <span className="dot">{i < stage || stage === 3 ? "✓" : i + 1}</span>
                  <span>{x}</span>
                </li>
              ))}
            </ol>
          )}
          {stage === 0 && <p className="muted small">{t("بعتنالك رسالة تأكيد على الواتساب — ردّ عليها بـ «تم» عشان نجهّز طلبك.")}</p>}
          <ul className="track-items">
            {(d.items || []).map((it, i) => (
              <li key={i}>
                {it.name}
                {it.option ? ` (${it.option})` : ""}
                {it.qty > 1 ? ` × ${it.qty}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {wa && (
        <a className="btn wa block" href={wa} target="_blank" rel="noreferrer">
          <Icon name="wa" /> {t("استفسار عن طلب")}
        </a>
      )}
    </div>
  );
}

/* ======================= التقييم (رابط بعد الاستلام) ======================= */
function Rate() {
  const { oid, code } = useParams();
  const { search } = useLocation();
  const { byId, t, tr } = useStore();
  const qs = new URLSearchParams(search);
  const ids = (qs.get("p") || "").split(",").filter((x) => byId[x]);
  const [name, setName] = useState(qs.get("n") || "");
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const already = ls.get("rated", []).includes(oid);

  async function submit() {
    const list = ids.filter((id) => vals[id]?.stars);
    if (!list.length) return setErr(t("اختار عدد النجوم لمنتج واحد على الأقل"));
    if (name.trim().length < 2) return setErr(t("اكتب اسمك"));
    setBusy(true);
    setErr("");
    let ok = 0;
    let dup = 0;
    for (const id of list) {
      try {
        await setDoc(doc(db, "reviews", `${oid}_${id}`), {
          orderId: oid,
          code,
          productId: id,
          name: name.trim().slice(0, 40),
          stars: vals[id].stars,
          text: String(vals[id].text || "").trim().slice(0, 500),
          approved: false,
          createdAt: serverTimestamp(),
        });
        ok++;
      } catch {
        dup++;
      }
    }
    setBusy(false);
    if (ok) {
      ls.set("rated", [...ls.get("rated", []), oid]);
      setDone(true);
    } else setErr(dup ? t("يا إما قيّمت قبل، يا إما الرابط مش صحيح أو الطلب لسا ما انعلّم إنه وصل.") : t("صار خطأ، جرب مرة تانية."));
  }

  if (done || already)
    return (
      <div className="narrow done">
        <div className="done-icon">★</div>
        <h1>{t("شكراً على تقييمك 🤍")}</h1>
        <p className="muted">{t("رأيك بيساعد غيرك يختار صح.")}</p>
        <Link to="/" className="btn primary block">
          {t("تصفّح المتجر")}
        </Link>
      </div>
    );
  if (!ids.length)
    return (
      <div className="empty">
        {t("الرابط مش صحيح.")} <Link to="/">{t("رجوع للمتجر")}</Link>
      </div>
    );

  return (
    <div className="narrow">
      <h1 className="page-title">{t("قيّم طلبك ⭐")}</h1>
      <p className="muted">{t("رأيك بيهمنا، وبيساعد زبائن تانيين.")}</p>
      <Field label={t("اسمك")}>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {ids.map((id) => {
        const p = byId[id];
        const v = vals[id] || {};
        const setV = (patch) => setVals((x) => ({ ...x, [id]: { ...v, ...patch } }));
        return (
          <div key={id} className="rate-item">
            <div className="rate-head">
              <span className="si-img">
                <Img src={p.images?.[0]} alt="" />
              </span>
              <b>{pName(p)}</b>
            </div>
            <div className="rate-stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={n <= (v.stars || 0) ? "on" : ""} onClick={() => setV({ stars: n })} aria-label={String(n)}>
                  ★
                </button>
              ))}
            </div>
            <textarea rows={2} placeholder={t("شو رأيك بالمنتج؟ (اختياري)")} value={v.text || ""} onChange={(e) => setV({ text: e.target.value })} />
          </div>
        );
      })}
      {err && <div className="err-text">{err}</div>}
      <button className="btn primary block" onClick={submit} disabled={busy}>
        {busy ? t("جاري الإرسال...") : t("إرسال التقييم")}
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
