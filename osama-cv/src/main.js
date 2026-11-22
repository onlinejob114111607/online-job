import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/500.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./style.css";
import Lenis from "lenis";
import { T } from "./i18n.js";
import { CONFIG } from "./config.js";
import { icon } from "./icons.js";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const app = document.getElementById("app");
const printEl = document.getElementById("print-cv");

const IMG = { job: "./p-job.webp", joudi: "./p-joudi.webp" };
const year = new Date().getFullYear();

function getLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "ar" || q === "en") return q;
  try {
    const s = localStorage.getItem("lang");
    if (s === "ar" || s === "en") return s;
  } catch {}
  return "ar";
}

const words = (str, base = 0) =>
  str
    .split(" ")
    .map((w, i) => `<span class="w"><span style="--i:${base + i}">${w}</span></span>`)
    .join(" ");

function socials() {
  return Object.entries(CONFIG.social)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a class="soc" href="${v}" target="_blank" rel="noopener" aria-label="${k}">${icon(k)}</a>`)
    .join("");
}

function waLink() {
  return CONFIG.whatsapp ? `https://wa.me/${CONFIG.whatsapp}` : "";
}

function projectArt(key) {
  if (IMG[key]) return `<img src="${IMG[key]}" alt="" loading="lazy" />`;
  // رسم بديل للمشاريع اللي ما إلها صورة عامة
  if (key === "dash")
    return `<div class="art art-dash"><div class="a-side"><i></i><i></i><i></i><i></i><i></i></div><div class="a-main"><div class="a-row"><b></b><b></b><b></b></div><svg viewBox="0 0 200 70" preserveAspectRatio="none"><path d="M0 60 L30 48 L60 52 L90 30 L120 36 L150 16 L200 22" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M0 60 L30 48 L60 52 L90 30 L120 36 L150 16 L200 22 L200 70 L0 70Z" fill="currentColor" opacity=".12"/></svg><div class="a-table"><i></i><i></i><i></i></div></div></div>`;
  return `<div class="art art-bot"><div class="bub b1">${icon("wa")}<span></span></div><div class="bub b2"><span></span><span></span></div><div class="bub b3">${icon("chat")}<span></span></div><div class="bot-core">${icon("bot")}</div></div>`;
}

function render(lang) {
  const t = T[lang];
  const html = document.documentElement;
  html.lang = lang;
  html.dir = t.dir;
  document.title = lang === "ar" ? "م. أسامة معين بوادي | مطوّر مواقع" : "Eng. Osama Moen Bawadi | Web Developer";

  const nav = Object.entries(t.nav)
    .map(([id, label]) => `<a href="#${id}" data-nav="${id}">${label}</a>`)
    .join("");

  app.innerHTML = `
  <header class="top">
    <a class="brand" href="#top" aria-label="${t.hero.name}"><span class="mono">OB</span></a>
    <nav class="nav">${nav}</nav>
    <div class="top-act">
      <button class="lang" id="lang" aria-label="Language">${t.switchTo}</button>
      <button class="burger" id="burger" aria-label="Menu"><span></span><span></span></button>
    </div>
  </header>
  <div class="drawer" id="drawer">${nav}</div>
  <div class="progress" id="progress"></div>

  <main>
    <section class="hero" id="top">
      <div class="hero-text">
        <p class="hello" data-reveal>${t.hero.hello}</p>
        <h1 class="name">${words(t.hero.name)}</h1>
        <p class="alt" data-reveal style="--d:.5s">${t.hero.alt}</p>
        <p class="role" data-reveal style="--d:.6s"><span class="dot"></span>${t.hero.role}</p>
        <p class="lead" data-reveal style="--d:.7s">${t.hero.text}</p>
        <div class="ctas" data-reveal style="--d:.8s">
          <a class="btn gold" href="#work">${t.hero.cta1} ${icon("arrow", "ic flip")}</a>
          <a class="btn ghost" href="#contact">${t.hero.cta2}</a>
          <button class="btn link" id="cv">${icon("download")} ${t.hero.cv}</button>
        </div>
      </div>
      <div class="hero-photo" data-reveal="scale" style="--d:.3s">
        <div class="ring r1"></div><div class="ring r2"></div>
        <div class="halo"></div>
        <img src="./osama.webp" alt="${t.hero.name}" width="900" height="984" />
        <div class="chip c1">${icon("code")}</div>
        <div class="chip c2">${icon("phone")}</div>
        <div class="chip c3">${icon("wifi")}</div>
      </div>
      <a class="scroll-hint" href="#about"><span></span>${t.hero.scroll}</a>
    </section>

    <section id="about" class="sec">
      <div class="head"><p class="kicker" data-reveal>${t.about.kicker}</p><h2>${t.about.title}</h2></div>
      <div class="about">
        <p class="glass about-text" data-reveal="side">${t.about.text}</p>
        <div class="stats">
          ${t.about.stats.map(([n, l], i) => `<div class="glass stat" data-reveal="scale" style="--d:${i * 0.1}s"><b>${n}</b><span>${l}</span></div>`).join("")}
        </div>
      </div>
    </section>

    <section id="services" class="sec">
      <div class="head"><p class="kicker" data-reveal>${t.services.kicker}</p><h2>${t.services.title}</h2></div>
      <div class="cards4">
        ${t.services.items.map(([ic, h, p], i) => `
          <article class="glass svc tilt" data-reveal style="--d:${i * 0.12}s">
            <div class="svc-ic">${icon(ic)}</div>
            <h3>${h}</h3><p>${p}</p>
          </article>`).join("")}
      </div>
    </section>

    <section id="skills" class="sec">
      <div class="head"><p class="kicker" data-reveal>${t.skills.kicker}</p><h2>${t.skills.title}</h2></div>
      <div class="skills">
        ${t.skills.groups.map(([h, arr], i) => `
          <div class="glass sk" data-reveal="side" style="--d:${i * 0.1}s">
            <h3>${h}</h3>
            <div class="tags">${arr.map((s, j) => `<span class="tag" style="--j:${j}">${s}</span>`).join("")}</div>
          </div>`).join("")}
      </div>
    </section>

    <section id="work" class="sec">
      <div class="head"><p class="kicker" data-reveal>${t.work.kicker}</p><h2>${t.work.title}</h2></div>
      <div class="work">
        ${t.work.items.map(([key, h, p, tags], i) => `
          <article class="glass proj tilt" data-reveal="${i % 2 ? "side-r" : "side"}">
            <div class="shot">${projectArt(key)}<span class="num">0${i + 1}</span></div>
            <div class="proj-body">
              <h3>${h}</h3><p>${p}</p>
              <div class="tags">${tags.map((s) => `<span class="tag">${s}</span>`).join("")}</div>
              ${CONFIG.links[key] ? `<a class="more" href="${CONFIG.links[key]}" target="_blank" rel="noopener">${t.work.visit} ${icon("ext")}</a>` : ""}
            </div>
          </article>`).join("")}
      </div>
    </section>

    <section id="edu" class="sec">
      <div class="head"><p class="kicker" data-reveal>${t.edu.kicker}</p><h2>${t.edu.title}</h2></div>
      <div class="timeline">
        <div class="glass edu" data-reveal="scale">
          <div class="edu-ic">${icon("cap")}</div>
          <div><h3>${t.edu.major}</h3><p class="uni">${icon("pin", "ic sm")} ${t.edu.uni}</p><p>${t.edu.desc}</p></div>
        </div>
      </div>
    </section>

    <section id="contact" class="sec contact">
      <div class="glass contact-box" data-reveal="scale">
        <p class="kicker">${t.contact.kicker}</p>
        <h2>${t.contact.title}</h2>
        <p class="lead">${t.contact.text}</p>
        <div class="c-actions">
          <a class="btn gold" href="mailto:${CONFIG.email}">${icon("mail")} ${t.contact.email}</a>
          ${waLink() ? `<a class="btn ghost" href="${waLink()}" target="_blank" rel="noopener">${icon("wa")} ${t.contact.wa}</a>` : ""}
        </div>
        <div class="mail-row"><span dir="ltr">${CONFIG.email}</span><button id="copy" data-ok="${t.contact.copied}">${icon("copy", "ic sm")} ${t.contact.copy}</button></div>
        <div class="socs">${socials()}</div>
      </div>
    </section>
  </main>
  <footer class="foot"><span>© ${year} ${t.hero.name}</span><span>${t.footer}</span></footer>
  `;

  renderPrint(t);
  wire(lang);
}

// نسخة السيرة الذاتية للطباعة / PDF
function renderPrint(t) {
  printEl.innerHTML = `
    <div class="p-head">
      <img src="./osama.webp" alt="" />
      <div><h1>${t.hero.name}</h1><p class="p-alt">${t.hero.alt}</p><p class="p-role">${t.hero.role}</p>
      <p class="p-contact">${CONFIG.email}${CONFIG.whatsapp ? " · +" + CONFIG.whatsapp : ""}</p></div>
    </div>
    <h2>${t.about.kicker}</h2><p>${t.about.text}</p>
    <h2>${t.edu.title}</h2><p><b>${t.edu.major}</b>: ${t.edu.uni}</p>
    <h2>${t.services.kicker}</h2><ul>${t.services.items.map(([, h, p]) => `<li><b>${h}:</b> ${p}</li>`).join("")}</ul>
    <h2>${t.skills.kicker}</h2><ul>${t.skills.groups.map(([h, a]) => `<li><b>${h}:</b> ${a.join(", ")}</li>`).join("")}</ul>
    <h2>${t.work.kicker}</h2><ul>${t.work.items.map(([k, h, p]) => `<li><b>${h}:</b> ${p}${CONFIG.links[k] ? `<br><span class="p-link">${CONFIG.links[k]}</span>` : ""}</li>`).join("")}</ul>`;
}

let io, lenis;
function wire(lang) {
  // ظهور العناصر أثناء النزول
  io?.disconnect();
  io = new IntersectionObserver(
    (es) => es.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }),
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  document.querySelectorAll("[data-reveal], .head, .name").forEach((el) => io.observe(el));

  // القائمة النشطة
  const links = [...document.querySelectorAll("[data-nav]")];
  const secIO = new IntersectionObserver(
    (es) => es.forEach((e) => {
      if (e.isIntersecting) links.forEach((a) => a.classList.toggle("on", a.dataset.nav === e.target.id));
    }),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  document.querySelectorAll("main section[id]").forEach((s) => secIO.observe(s));

  // تبديل اللغة
  document.getElementById("lang").onclick = () => {
    const next = lang === "ar" ? "en" : "ar";
    try { localStorage.setItem("lang", next); } catch {}
    const anchor = [...document.querySelectorAll("main section[id]")].find((s) => s.getBoundingClientRect().bottom > innerHeight * 0.3);
    document.body.classList.add("swap");
    setTimeout(() => {
      render(next);
      if (anchor) document.getElementById(anchor.id)?.scrollIntoView();
      document.querySelectorAll("[data-reveal], .head, .name").forEach((el) => {
        if (el.getBoundingClientRect().top < innerHeight) el.classList.add("in");
      });
      document.body.classList.remove("swap");
    }, 280);
  };

  // القائمة على الموبايل
  const drawer = document.getElementById("drawer");
  document.getElementById("burger").onclick = () => document.body.classList.toggle("menu");
  drawer.querySelectorAll("a").forEach((a) => (a.onclick = () => document.body.classList.remove("menu")));

  // الروابط الداخلية بتمرير ناعم
  document.querySelectorAll('a[href^="#"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const el = id === "#top" ? document.body : document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis ? lenis.scrollTo(el, { offset: id === "#top" ? 0 : -70 }) : el.scrollIntoView({ behavior: "smooth" });
    })
  );

  document.getElementById("cv").onclick = () => window.print();

  const copy = document.getElementById("copy");
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(CONFIG.email);
      const old = copy.innerHTML;
      copy.textContent = copy.dataset.ok;
      setTimeout(() => (copy.innerHTML = old), 1600);
    } catch {}
  };

  // ميلان البطاقات مع الماوس
  if (!reduced && matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".tilt").forEach((c) => {
      c.addEventListener("pointermove", (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        c.style.setProperty("--rx", `${-y * 6}deg`);
        c.style.setProperty("--ry", `${x * 8}deg`);
        c.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
        c.style.setProperty("--my", `${(y + 0.5) * 100}%`);
      });
      c.addEventListener("pointerleave", () => {
        c.style.setProperty("--rx", "0deg");
        c.style.setProperty("--ry", "0deg");
      });
    });
  }
}

// شريط التقدم + الهيدر
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = document.getElementById("progress");
  if (p) p.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
  document.body.classList.toggle("scrolled", scrollY > 40);
}
addEventListener("scroll", onScroll, { passive: true });

// توهج يتبع الماوس
const glow = document.getElementById("glow");
if (matchMedia("(hover: hover)").matches && !reduced) {
  addEventListener("pointermove", (e) => {
    glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
} else glow.remove();

render(getLang());
onScroll();
requestAnimationFrame(() => document.body.classList.add("ready"));

if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

// المشهد ثلاثي الأبعاد (بيتحمّل بعد الصفحة)
const params = new URLSearchParams(location.search);
if (!params.has("nogl")) {
  import("./scene.js").then(({ startScene }) => {
    const r = startScene(document.getElementById("bg3d"), { reduced });
    if (r) document.body.classList.add("gl");
  });
}
