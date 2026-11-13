// أدوات مساعدة مشتركة

// تحويل الأرقام العربية/الفارسية لإنجليزية وإزالة أي رموز
export function normalizeDigits(str = "") {
  return String(str)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/\D/g, "");
}

// بناء رقم دولي كامل: كود الدولة + الرقم بدون الصفر الأول
export function buildIntlPhone(countryCode, local) {
  let n = normalizeDigits(local);
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith(countryCode) && n.length > countryCode.length + 6) return n;
  n = n.replace(/^0+/, "");
  return countryCode + n;
}

export function waLink(phone, text = "") {
  const t = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${phone}${t}`;
}

// قراءة كود المسوّق من الرابط وحفظه للزيارات اللاحقة
export function getRef() {
  try {
    const p = new URLSearchParams(window.location.search);
    const fromUrl = (p.get("ref") || "").trim().toLowerCase().replace(/[^a-z0-9_\-؀-ۿ]/g, "").slice(0, 40);
    if (fromUrl) {
      localStorage.setItem("ref", fromUrl);
      return fromUrl;
    }
    return localStorage.getItem("ref") || "direct";
  } catch {
    return "direct";
  }
}

export function getUtmSource() {
  try {
    const p = new URLSearchParams(window.location.search);
    return (p.get("src") || p.get("utm_source") || "").slice(0, 40);
  } catch {
    return "";
  }
}

// ===== التواريخ =====
export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function startOfWeek(d, weekStart = 6) {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStart + 7) % 7;
  return addDays(x, -diff);
}
export function toInputDate(d) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}
export function fromInputDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function fmtDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function fmtDay(d) {
  return new Date(d).toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "numeric" });
}

// ===== أدوات لوحة التحكم =====
export const toDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null);
export const toMs = (ts) => (ts?.toMillis ? ts.toMillis() : typeof ts === "number" ? ts : ts ? new Date(ts).getTime() : 0);

export function fmtTs(ts) {
  const d = toDate(ts);
  return d ? fmtDateTime(d) : "—";
}

export function fmtAgo(ts) {
  const t = toMs(ts);
  if (!t) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "الآن";
  if (s < 3600) return `قبل ${Math.round(s / 60)} د`;
  if (s < 86400) return `قبل ${Math.round(s / 3600)} س`;
  return `قبل ${Math.round(s / 86400)} يوم`;
}

export function fmtDuration(sec) {
  if (!isFinite(sec)) return "—";
  if (sec < 60) return `${Math.round(sec)} ثانية`;
  if (sec < 3600) return `${Math.round(sec / 60)} دقيقة`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h} ساعة${m ? ` و${m} دقيقة` : ""}`;
}

export function spin(text) {
  let out = String(text || "");
  const re = /\{([^{}]*)\}/;
  let guard = 0;
  while (re.test(out) && guard++ < 500) {
    out = out.replace(re, (_, inner) => {
      const o = inner.split("|");
      return o[Math.floor(Math.random() * o.length)];
    });
  }
  return out;
}

export function fillVars(text, vars = {}) {
  let out = String(text || "");
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? "");
  return out;
}

export function parseInviteCode(link) {
  const s = String(link || "").trim();
  const m = s.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return s;
  return null;
}

export function randomKey(n = 6) {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export const cairoDayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("انسخ:", text);
    return false;
  }
}

export function downloadFile(name, content, type = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const linesOf = (v) =>
  (Array.isArray(v) ? v : String(v || "").split(/[\n,،]+/)).map((x) => String(x).trim()).filter(Boolean);

// ===== عدّاد الضغطات على روابط منشورات الواتساب (src=منشور-مجموعة) =====
export const TRACK_SRC_RE = /^([a-z0-9]{6})-([a-z0-9]{6})$/;
export async function countClick(db, fs) {
  try {
    const src = getUtmSource();
    const m = TRACK_SRC_RE.exec(src);
    if (!m) return;
    const k = `clk_${src}`;
    if (localStorage.getItem(k)) return; // نفس الزائر مرة وحدة
    localStorage.setItem(k, "1");
    await fs.setDoc(fs.doc(db, "track_clicks", src), { pk: m[1], gk: m[2], n: fs.increment(1), at: fs.serverTimestamp() }, { merge: true });
  } catch {
    /* تجاهل */
  }
}
