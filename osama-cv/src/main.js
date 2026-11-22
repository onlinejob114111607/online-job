import "@fontsource/michroma/400.css";
import "@fontsource/sora/300.css";
import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "@fontsource/alexandria/300.css";
import "@fontsource/alexandria/400.css";
import "@fontsource/alexandria/600.css";
import "@fontsource/alexandria/800.css";
import "./style.css";
import Lenis from "lenis";
import { T, SKILLS } from "./i18n.js";
import { CONFIG } from "./config.js";
import { icon } from "./icons.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
const app = document.getElementById("app");
const printEl = document.getElementById("print-cv");
const IMG = { job: "./p-job.webp", joudi: "./p-joudi.webp" };
const YEAR = new Date().getFullYear();

// شعار OB
const LOGO = `<svg class="logo" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="lg1" cx="22" cy="32" r="13"/><path class="lg2" d="M38 19v26h9.5a6.5 6.5 0 000-13H38h8.5a6.5 6.5 0 000-13z"/></svg>`;

function getLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "ar" || q === "en") return q;
  try {
    const s = localStorage.getItem("lang");
    if (s === "ar" || s === "en") return s;
  } catch {}
  return "en";
}
let lang = getLang();

const waLink = () => (CONFIG.whatsapp ? `https://wa.me/${CONFIG.whatsapp}` : "");
const socialLinks = () => {
  const out = [];
  for (const k of ["linkedin", "github", "instagram", "facebook"]) if (CONFIG.social[k]) out.push([k, CONFIG.social[k]]);
  return out;
};

function projectArt(key) {
  if (IMG[key]) return `<img src="${IMG[key]}" alt="" loading="lazy" />`;
  if (key === "dash")
    return `<div class="art art-dash"><div class="a-side"><i></i><i></i><i></i><i></i><i></i></div><div class="a-main"><div class="a-row"><b></b><b></b><b></b></div><svg viewBox="0 0 200 70" preserveAspectRatio="none"><path d="M0 60 L30 48 L60 52 L90 30 L120 36 L150 16 L200 22" fill="none" stroke="currentColor" stroke-width="2"/><path d="M0 60 L30 48 L60 52 L90 30 L120 36 L150 16 L200 22 L200 70 L0 70Z" fill="currentColor" opacity=".08"/></svg><div class="a-table"><i></i><i></i><i></i></div></div></div>`;
  return `<div class="art art-bot"><div class="bub b1">${icon("wa")}<span></span></div><div class="bub b2"><span></span><span></span></div><div class="bub b3">${icon("chat")}<span></span></div><div class="bot-core">${icon("bot")}</div></div>`;
}

const SKILL_MARK = { html: "H5", css: "C3", js: "JS", react: "Re", vite: "Vi", tw: "Tw", three: "3D", gsap: "GS", fire: "Fb", supa: "Sb", node: "No", gh: "GA", term: "Tx", net: "Nw" };

function cert(t, i, [field, proof]) {
  return `
  <div class="cert" data-cert="${i}">
    <div class="cert-in">
      <div class="cert-top">${LOGO}<span>No. OB-${String(i + 1).padStart(3, "0")}</span></div>
      <h4>${t.certs.head}</h4>
      <p class="cert-sub">${t.certs.sub}</p>
      <p class="cert-small">${t.certs.awarded}</p>
      <p class="cert-name">${t.hero.name}</p>
      <p class="cert-small">${t.certs.field}</p>
      <p class="cert-field">${field}</p>
      <p class="cert-proof"><span>${t.certs.proven}:</span> ${proof}</p>
      <div class="cert-foot">
        <div><b class="sig">O. Bawadi</b><span>${t.certs.sign}</span></div>
        <div class="seal">${LOGO}</div>
        <div><b>${YEAR}</b><span>${t.certs.date}</span></div>
      </div>
    </div>
  </div>`;
}

function render() {
  const t = T[lang];
  const h = document.documentElement;
  h.lang = lang;
  h.dir = t.dir;
  document.title = lang === "en" ? "Osama Bawadi | Web Developer" : "أسامة بوادي | مطوّر مواقع إلكترونية";

  const nav = t.nav.map(([id, l]) => `<a href="#${id}" data-nav="${id}">${l}</a>`).join("");
  const socials = socialLinks().map(([k, v]) => `<a class="soc" href="${v}" target="_blank" rel="noopener" aria-label="${k}">${icon(k)}</a>`).join("");

  const contactCards = [
    ["email", `mailto:${CONFIG.email}`, "mail"],
    waLink() && ["wa", waLink(), "wa"],
    ...socialLinks().map(([k, v]) => [k, v, k]),
  ].filter(Boolean);

  app.innerHTML = `
  <header class="top">
    <a class="brand" href="#top" aria-label="${t.hero.name}">${LOGO}</a>
    <nav class="nav">${nav}</nav>
    <div class="top-act">
      <button class="lang" id="lang">${t.switchTo}</button>
      <button class="burger" id="burger" aria-label="Menu"><span></span><span></span></button>
    </div>
  </header>
  <div class="menu" id="menu"><nav>${t.nav.map(([id, l], i) => `<a href="#${id}" style="--i:${i}">${l}</a>`).join("")}</nav></div>
  <div class="rail"><i id="rail"></i></div>

  <main>
    <section class="hero" id="top">
      <div class="hero-text">
        <p class="hi rv">${t.hero.hi}</p>
        <h1 class="name rv" style="--d:.08s">${t.hero.name}</h1>
        <p class="full rv" style="--d:.16s">${t.hero.full}</p>
        <p class="role rv" style="--d:.24s"><span id="typed"></span><span class="caret"></span></p>
        <p class="lead rv" style="--d:.32s">${t.hero.text}</p>
        <div class="socs rv" style="--d:.4s">${socials}<a class="soc" href="mailto:${CONFIG.email}" aria-label="email">${icon("mail")}</a></div>
        <div class="ctas rv" style="--d:.48s">
          <a class="btn solid" href="#contact">${t.hero.hire}</a>
          <button class="btn line" id="cv">${icon("download")} ${t.hero.cv}</button>
        </div>
      </div>
      <div class="photo-wrap rv" style="--d:.2s">
        <div class="photo tilt" id="photo">
          <img src="./osama.webp" alt="${t.hero.name}" width="900" height="1200" />
          <span class="badge">${icon("code")} ${t.hero.badge}</span>
        </div>
        <div class="orbit"><i></i></div>
      </div>
    </section>

    <section class="statement" id="statement" style="--n:${t.statement.length}">
      <div class="st-stick">
        <div class="st-frame"></div>
        ${t.statement.map(([w, s], i) => `
          <div class="st-item${i === t.statement.length - 1 ? " last" : ""}" data-i="${i}">
            <p class="st-k">0${i + 1} / 0${t.statement.length}</p>
            <h2 class="st-w">${i === t.statement.length - 1 ? `<span class="dim">${lang === "en" ? "DIGITAL" : "أنظمة"}</span><br>${lang === "en" ? "SYSTEMS." : "رقمية."}` : w}</h2>
            ${i === t.statement.length - 1 ? `<p class="st-tag">${t.statementTag}</p>` : ""}
            <p class="st-s">${s}</p>
          </div>`).join("")}
        <div class="st-dots">${t.statement.map(() => "<i></i>").join("")}</div>
      </div>
    </section>

    <section id="about" class="sec">
      <h2 class="title rv">${t.about.title}</h2>
      <div class="about">
        <div class="about-p">${t.about.p.map((p, i) => `<p class="rv" style="--d:${i * 0.1}s">${p}</p>`).join("")}</div>
        <div class="stats">
          ${t.about.stats.map(([n, a, b], i) => `<div class="card stat rv" style="--d:${i * 0.08}s"><b>${n}</b><strong>${a}</strong><span>${b}</span></div>`).join("")}
        </div>
      </div>
    </section>

    <section id="services" class="sec">
      <p class="kicker rv">${t.services.kicker}</p>
      <h2 class="title rv">${t.services.title}</h2>
      <div class="svc-grid">
        ${t.services.items.map(([ic, a, b], i) => `
          <article class="card svc rv" style="--d:${(i % 3) * 0.08}s">
            <div class="svc-ic">${icon(ic)}</div>
            <h3>${a}</h3><p>${b}</p>
          </article>`).join("")}
      </div>
    </section>

    <section id="projects" class="sec">
      <p class="kicker rv">${t.projects.kicker}</p>
      <h2 class="title rv">${t.projects.title}</h2>
      <div class="proj-grid">
        ${t.projects.items.map((p, i) => `
          <article class="card proj rv" style="--d:${(i % 2) * 0.1}s" data-proj="${i}" tabindex="0">
            <div class="shot">${projectArt(p.key)}</div>
            <div class="proj-b">
              <h3>${p.title}</h3>
              <p>${p.short}</p>
              <div class="tags">${p.tags.map((s) => `<span>${s}</span>`).join("")}</div>
              <div class="proj-act">
                <button class="mini">${t.projects.more} ${icon("plus", "ic sm")}</button>
                ${CONFIG.links[p.key] ? `<a class="ico" href="${CONFIG.links[p.key]}" target="_blank" rel="noopener" aria-label="${t.projects.visit}">${icon("ext", "ic sm")}</a>` : ""}
              </div>
            </div>
          </article>`).join("")}
      </div>
    </section>

    <section id="skills" class="sec">
      <p class="kicker rv">${t.skills.kicker}</p>
      <h2 class="title rv">${t.skills.title}</h2>
      <div class="skill-grid">
        ${SKILLS.map(([k, n], i) => `<div class="card skill rv" style="--d:${(i % 7) * 0.05}s"><span class="mk">${SKILL_MARK[k]}</span><span class="sn">${n}</span></div>`).join("")}
      </div>
    </section>

    <section id="certs" class="sec">
      <p class="kicker rv">${t.certs.kicker}</p>
      <h2 class="title rv">${t.certs.title}</h2>
      <p class="sub rv">${t.certs.note}</p>
      <div class="cert-grid">
        ${t.certs.items.map((c, i) => `<button class="cert-btn rv" style="--d:${i * 0.08}s" data-open-cert="${i}">${cert(t, i, c)}</button>`).join("")}
      </div>
    </section>

    <section id="edu" class="sec">
      <p class="kicker rv">${t.edu.kicker}</p>
      <h2 class="title rv">${t.edu.title}</h2>
      <div class="card edu rv">
        <div class="edu-ic">${icon("cap")}</div>
        <div><h3>${t.edu.degree}</h3><p class="uni">${icon("pin", "ic sm")} ${t.edu.uni}</p><p>${t.edu.desc}</p></div>
      </div>
    </section>

    <section id="contact" class="sec contact">
      <h2 class="title rv">${t.contact.title}</h2>
      <p class="sub rv">${t.contact.text}</p>
      <div class="c-grid">
        ${contactCards.map(([k, href, ic], i) => `
          <a class="card c-card rv" style="--d:${i * 0.07}s" href="${href}" ${href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>
            <span class="c-ic">${icon(ic)}</span>
            <span><strong>${t.contact.cards[k][0]}</strong><small>${k === "email" ? `<span dir="ltr">${CONFIG.email}</span>` : t.contact.cards[k][1]}</small></span>
          </a>`).join("")}
      </div>
      <div class="center rv"><a class="btn solid" href="mailto:${CONFIG.email}">${t.contact.cta}</a></div>
    </section>
  </main>

  <footer class="foot">
    <div class="foot-in">
      <div class="foot-l">
        <h2 class="big">${t.footer.big.map((l, i) => `<span class="ln rv" style="--d:${i * 0.1}s"><span class="${i === 0 ? "dim" : ""}">${l}</span></span>`).join("")}</h2>
        <p class="rv">${t.footer.text}</p>
      </div>
      <nav class="foot-nav rv">${t.nav.map(([id, l]) => `<a href="#${id}">${l}</a>`).join("")}</nav>
    </div>
    <div class="foot-meta"><span>${t.footer.stack}</span><span>${t.footer.built}</span></div>
    <p class="foot-k">${t.footer.socials}</p>
    <div class="foot-socs">${socials}<a class="soc" href="mailto:${CONFIG.email}" aria-label="email">${icon("mail")}</a></div>
    <p class="copy">© ${YEAR} Osama Moen Bawadi</p>
  </footer>

  <dialog class="modal" id="modal"><div class="modal-in" id="modal-in"></div></dialog>
  `;

  renderPrint(t);
  wire(t);
}

function renderPrint(t) {
  printEl.innerHTML = `
    <div class="p-head"><img src="./osama.webp" alt="" />
      <div><h1>${lang === "en" ? "Eng. Osama Moen Bawadi" : "م. أسامة معين بوادي"}</h1><p class="p-role">${t.hero.roles[0]}</p>
      <p class="p-contact">${CONFIG.email}${CONFIG.whatsapp ? " · +" + CONFIG.whatsapp : ""}</p></div></div>
    <h2>${t.about.title}</h2>${t.about.p.map((p) => `<p>${p}</p>`).join("")}
    <h2>${t.edu.title}</h2><p><b>${t.edu.degree}</b>: ${t.edu.uni}</p>
    <h2>${t.services.title}</h2><ul>${t.services.items.map(([, a, b]) => `<li><b>${a}:</b> ${b}</li>`).join("")}</ul>
    <h2>${t.skills.title}</h2><p>${SKILLS.map((s) => s[1]).join(" · ")}</p>
    <h2>${t.projects.title}</h2><ul>${t.projects.items.map((p) => `<li><b>${p.title}:</b> ${p.short}${CONFIG.links[p.key] ? `<br><span class="p-link">${CONFIG.links[p.key]}</span>` : ""}</li>`).join("")}</ul>`;
}

let io, lenis, typedTimer, statementEls = null;

function wire(t) {
  // ظهور العناصر
  io?.disconnect();
  io = new IntersectionObserver(
    (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll(".rv").forEach((el) => io.observe(el));

  // القائمة النشطة
  const links = [...document.querySelectorAll(".nav [data-nav]")];
  const secIO = new IntersectionObserver(
    (es) => es.forEach((e) => e.isIntersecting && links.forEach((a) => a.classList.toggle("on", a.dataset.nav === e.target.id))),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  document.querySelectorAll("main section[id]").forEach((s) => secIO.observe(s));

  // اللغة
  document.getElementById("lang").onclick = () => {
    lang = lang === "en" ? "ar" : "en";
    try { localStorage.setItem("lang", lang); } catch {}
    const anchor = [...document.querySelectorAll("main section[id]")].find((s) => s.getBoundingClientRect().bottom > innerHeight * 0.3);
    document.body.classList.add("swap");
    setTimeout(() => {
      render();
      if (anchor) document.getElementById(anchor.id)?.scrollIntoView();
      document.querySelectorAll(".rv").forEach((el) => el.getBoundingClientRect().top < innerHeight && el.classList.add("in"));
      onScroll();
      document.body.classList.remove("swap");
    }, 300);
  };

  // قائمة الموبايل
  document.getElementById("burger").onclick = () => document.body.classList.toggle("menu-open");
  document.querySelectorAll("#menu a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));

  // تمرير ناعم للروابط الداخلية
  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const el = id === "#top" ? document.body : document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis ? lenis.scrollTo(el, { offset: id === "#top" ? 0 : -80, duration: 1.4 }) : el.scrollIntoView({ behavior: "smooth" });
    })
  );

  document.getElementById("cv").onclick = () => window.print();

  // النص المتبدّل
  clearTimeout(typedTimer);
  const typed = document.getElementById("typed");
  const roles = t.hero.roles;
  let r = 0, c = 0, del = false;
  const tick = () => {
    const word = roles[r];
    if (reduced) { typed.textContent = word; return; }
    c += del ? -1 : 1;
    typed.textContent = word.slice(0, c);
    let wait = del ? 40 : 85;
    if (!del && c === word.length) { del = true; wait = 1700; }
    else if (del && c === 0) { del = false; r = (r + 1) % roles.length; wait = 350; }
    typedTimer = setTimeout(tick, wait);
  };
  typedTimer = setTimeout(tick, 1200);

  // النوافذ: المشاريع والشهادات
  const modal = document.getElementById("modal");
  const mIn = document.getElementById("modal-in");
  const openModal = (html, cls) => {
    mIn.className = "modal-in " + cls;
    mIn.innerHTML = `<button class="m-close" aria-label="${t.projects.close}">${icon("close")}</button>${html}`;
    mIn.querySelector(".m-close").onclick = () => modal.close();
    modal.showModal();
    lenis?.stop();
  };
  modal.addEventListener("close", () => lenis?.start());
  modal.addEventListener("click", (e) => e.target === modal && modal.close());

  document.querySelectorAll("[data-proj]").forEach((card) => {
    const p = t.projects.items[+card.dataset.proj];
    const open = (e) => {
      if (e.target.closest("a")) return;
      openModal(`
        <div class="m-shot">${projectArt(p.key)}</div>
        <div class="m-body">
          <h3>${p.title}</h3><p>${p.long}</p>
          <h4>${t.projects.features}</h4>
          <ul>${p.features.map((f) => `<li>${f}</li>`).join("")}</ul>
          <div class="tags">${p.tags.map((s) => `<span>${s}</span>`).join("")}</div>
          ${CONFIG.links[p.key] ? `<a class="btn solid sm" href="${CONFIG.links[p.key]}" target="_blank" rel="noopener">${t.projects.visit} ${icon("ext", "ic sm")}</a>` : ""}
        </div>`, "m-proj");
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => e.key === "Enter" && open(e));
  });
  document.querySelectorAll("[data-open-cert]").forEach((b) => {
    b.onclick = () => openModal(cert(t, +b.dataset.openCert, t.certs.items[+b.dataset.openCert]), "m-cert");
  });

  // ميلان الصورة والبطاقات
  if (fine && !reduced) {
    document.querySelectorAll(".tilt, .card").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const b = el.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
        el.style.setProperty("--mx", `${x * 100}%`);
        el.style.setProperty("--my", `${y * 100}%`);
        if (el.classList.contains("tilt")) {
          el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
          el.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
        }
      });
      el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
    });
  }

  statementEls = {
    sec: document.getElementById("statement"),
    items: [...document.querySelectorAll(".st-item")],
    dots: [...document.querySelectorAll(".st-dots i")],
    frame: document.querySelector(".st-frame"),
  };
}

// قسم الكلمات الكبيرة المثبّتة
function updateStatement() {
  if (!statementEls?.sec) return;
  const { sec, items, dots, frame } = statementEls;
  const b = sec.getBoundingClientRect();
  const total = sec.offsetHeight - innerHeight;
  const p = Math.min(Math.max(-b.top / total, 0), 1) * items.length; // 0..n
  items.forEach((el, i) => {
    const d = p - i - 0.5; // -0.5 عند الدخول، 0 بالمنتصف، 0.5 عند الخروج
    const last = i === items.length - 1;
    const vis = i === 0 && d < 0 ? 1 : last ? Math.min(1, Math.max(0, 1 - Math.abs(Math.min(d, 0)) * 2.2)) : Math.max(0, 1 - Math.abs(d) * 2.2);
    const out = last ? 0 : Math.max(0, d);
    el.style.opacity = vis.toFixed(3);
    const dd = i === 0 && d < 0 ? 0 : d;
    el.style.transform = `translateY(${(-dd * 80).toFixed(1)}px) scale(${(1 + out * 0.35 - Math.max(0, -dd) * 0.15).toFixed(3)})`;
    const bd = (i === 0 && d < 0) || (last && d > 0) ? 0 : Math.abs(d);
    el.style.filter = `blur(${(bd * 14).toFixed(1)}px)`;
    el.style.visibility = vis < 0.01 ? "hidden" : "visible";
  });
  const cur = Math.min(items.length - 1, Math.floor(p));
  dots.forEach((d, i) => d.classList.toggle("on", i === cur));
  frame.style.opacity = Math.min(1, Math.max(0, (p - (items.length - 1)) * 2)).toFixed(2);
}

function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const rail = document.getElementById("rail");
  if (rail) rail.style.transform = `scaleY(${max > 0 ? scrollY / max : 0})`;
  document.body.classList.toggle("scrolled", scrollY > 30);
  updateStatement();
}
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);

// مؤشر الماوس
if (fine && !reduced) {
  const dot = document.getElementById("cur-dot");
  const ring = document.getElementById("cur-ring");
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  addEventListener("pointermove", (e) => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate(${x}px, ${y}px)`;
    document.body.classList.toggle("cur-hover", !!e.target.closest("a, button, [data-proj]"));
  });
  const loop = () => {
    rx += (x - rx) * 0.16; ry += (y - ry) * 0.16;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(loop);
  };
  loop();
  document.body.classList.add("has-cursor");
}

render();
onScroll();

if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
  lenis.on("scroll", onScroll);
  const raf = (tm) => { lenis.raf(tm); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

// الشاشة الافتتاحية
const loader = document.getElementById("loader");
document.getElementById("ld-role").textContent = T[lang].loader;
const done = () => {
  loader.classList.add("out");
  document.body.classList.add("ready");
  setTimeout(() => loader.remove(), 1000);
};
const minTime = new Promise((r) => setTimeout(r, reduced ? 0 : 2300));
Promise.all([minTime, document.fonts?.ready]).then(done);
