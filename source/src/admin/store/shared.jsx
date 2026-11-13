// مشترك بين ملفات StoreAdmin (ثوابت ودوال مساعدة)
import { useMemo } from "react";
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { db } from "../../firebase";
import { toDate, toMs } from "../../utils";
import { STORE_PRIVATE_DEFAULTS, fillTpl, mergeStorePrivate, mergeStorePublic, orderVars, publicProduct, normPhone, trackDoc, fbCatalogCsv } from "../../store/shared";
import { useDocData, useQuery } from "../hooks";

export const prodCol = collection(db, "store_products");

export const LATE_MS = 60 * 60_000;

// ---------- نشر الكتالوج (قراءة وحدة لكل زائر) ----------
export const SOLD_STATUSES = ["confirmed", "sent", "shipping", "delivered"];

export async function catalogStats() {
  const sold = {};
  const revs = {};
  try {
    const os = await getDocs(query(collection(db, "orders"), where("status", "in", SOLD_STATUSES)));
    os.docs.forEach((d) => (d.data().items || []).forEach((it) => (sold[it.id] = (sold[it.id] || 0) + (Number(it.qty) || 1))));
  } catch (e) {
    console.error(e);
  }
  try {
    const rs = await getDocs(query(collection(db, "reviews"), where("approved", "==", true)));
    rs.docs
      .map((d) => d.data())
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .forEach((r) => {
        const x = (revs[r.productId] = revs[r.productId] || { sum: 0, count: 0, list: [] });
        x.sum += Number(r.stars) || 0;
        x.count++;
        if (x.list.length < 12) x.list.push({ name: r.name || "", stars: r.stars, text: r.text || "", at: toMs(r.createdAt) });
      });
  } catch (e) {
    console.error(e);
  }
  return { sold, revs };
}

export async function publishCatalog(products, pub) {
  // حماية: لو المنتجات ما انقرت (مثلاً حصة Firebase خلصت) ما منمسح المتجر
  if (STORE_LOAD_ERR) throw new Error("المنتجات ما انقرت من Firebase (ممكن الحصة اليومية خلصت) — جرب بعد الساعة 10 الصبح");
  if (!products.some((p) => p.status !== "draft") && !window.confirm("المتجر رح يصير فاضي بدون منتجات. متأكد؟")) throw new Error("انلغى النشر");
  const { sold, revs } = await catalogStats();
  const list = products
    .filter((p) => p.visible !== false && p.name && p.status !== "draft")
    .map((p) => {
      const r = revs[p.id];
      return publicProduct(p, { sold: sold[p.id] || 0, rating: r ? { avg: Math.round((r.sum / r.count) * 10) / 10, count: r.count } : null, reviews: r?.list || [] });
    });
  const settings = mergeStorePublic(pub);
  // صور آراء الزباين (من قناة الفيدباك)
  const feedbackFeed = await getDocs(query(collection(db, "store_feedback"), orderBy("at", "desc"), limit(120)))
    .then((s) => s.docs.map((d) => d.data()).filter((f) => f.img && !f.hidden).map((f) => ({ img: f.img, text: f.text || "", at: f.at || 0 })))
    .catch(() => []);
  // نسخة ملف على GitHub (المتجر بيقرأها أول — بدون أي قراءة من Firebase)، والنسخة بـ Firebase احتياط
  let fileErr = "";
  const fileOk = await publishCatalogFile({ settings, products: list, feedbackFeed, at: Date.now() }).catch((e) => (console.error(e), (fileErr = e.message || String(e)), false));
  // نسخة احتياط بـ Firebase — بس لو حجمها أقل من حد Firestore (1MB)، وإلا بنكتب الإعدادات بس
  const full = { settings, products: list };
  const small = new Blob([JSON.stringify(full)]).size < 900_000;
  const fsErr = await setDoc(doc(db, "store", "catalog"), { ...(small ? full : { settings, products: [] }), updatedAt: serverTimestamp() })
    .then(() => "")
    .catch((e) => e.message || String(e));
  // ملف المتجر (catalog.json) هو اللي الزباين بيشوفوه — لو ما تحدّث لازم تعرف السبب
  // كتالوج فيسبوك/إنستغرام (على فرع الصور — ما بيعمل إعادة بناء للموقع)
  if (fileOk) await publishFbFeed(list, settings).catch((e) => console.warn("fb feed", e));
  if (!fileOk && PRIV?.ghToken) throw new Error(`ملف المتجر على GitHub ما تحدّث${fileErr ? ` (${fileErr})` : " (تعارض مع رفع الصور)"} — اكبس «إعادة نشر» كمان مرة`);
  if (!fileOk && fsErr) throw new Error(fsErr);
  return list.length;
}

// رابط كامل (لو كتب بدون https)
export const cleanUrl = (u) => {
  const v = String(u || "").trim();
  return !v ? "" : /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
};

export let STORE_LOAD_ERR = null; // خطأ بقراءة المنتجات

export let PRIV = null; // إعدادات المتجر الخاصة (للتوكن) — بتنحدث من الصفحة

export const utf8b64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

export async function publishCatalogFile(catalog) {
  const priv = PRIV;
  const repo = priv && priv.ghToken ? ghRepoOf(priv) : null;
  if (!repo) return false;
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/catalog.json`;
  const headers = { Authorization: `Bearer ${String(priv.ghToken).trim()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const branch = priv.ghBranch || "main";
  // عامل تيليجرام ممكن يكون عم يرفع صور بنفس الوقت ← تعارض (409) — بنعيد المحاولة كذا مرة
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt) await new Promise((res) => setTimeout(res, 1200 + Math.random() * 1800));
    const cur = await fetch(`${url}?ref=${branch}&t=${Date.now()}`, { headers, cache: "no-store" });
    const sha = cur.ok ? (await cur.json()).sha : undefined;
    const r = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: "تحديث الكتالوج", content: utf8b64(JSON.stringify(catalog)), branch, ...(sha ? { sha } : {}) }),
    });
    if (r.ok) return true;
    if (![409, 422, 500, 502, 503].includes(r.status)) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`${GH_ERR[r.status] || "GitHub"} ${r.status}${j.message ? `: ${j.message}` : ""}`);
    }
  }
  return false;
}

// ---------- ملف كتالوج فيسبوك ----------
export const CUR_ISO = { "₪": "ILS", "شيكل": "ILS", ILS: "ILS", "$": "USD", USD: "USD", "ج.م": "EGP", EGP: "EGP", "د.أ": "JOD", JOD: "JOD" };

export const FEED_PATH = "feeds/facebook.csv";

export function fbFeedUrl(priv) {
  const r = ghRepoOf(priv || {});
  return r ? `https://raw.githubusercontent.com/${r.owner}/${r.name}/img/${FEED_PATH}` : "";
}

export async function publishFbFeed(list, settings) {
  const priv = PRIV;
  const repo = priv?.ghToken ? ghRepoOf(priv) : null;
  if (!repo) return false;
  const csv = fbCatalogCsv(list, settings, storeUrlOf(priv), CUR_ISO[String(settings.currency || "").trim()] || "ILS");
  const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${FEED_PATH}`;
  const headers = { Authorization: `Bearer ${String(priv.ghToken).trim()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const content = utf8b64(csv);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((res) => setTimeout(res, 1500 + Math.random() * 1500));
    const cur = await fetch(`${url}?ref=img&t=${Date.now()}`, { headers, cache: "no-store" });
    if (cur.status === 404) {
      // فرع الصور لسا مش موجود؟
      const br = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/branches/img`, { headers });
      if (!br.ok) return false;
    }
    const j = cur.ok ? await cur.json() : null;
    if (j && String(j.content || "").replace(/\n/g, "") === content) return true; // ما تغيّر
    const r = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ message: "كتالوج فيسبوك", content, branch: "img", ...(j?.sha ? { sha: j.sha } : {}) }) });
    if (r.ok) return true;
    if (![409, 422, 500, 502, 503].includes(r.status)) return false;
  }
  return false;
}

// ---------- القائمة السوداء (أرقام رفضت الاستلام) ----------
export const blCol = collection(db, "store_blacklist");

export async function blacklistAdd(phones, o, reason = "رفض الاستلام") {
  for (const raw of phones) {
    const ph = normPhone(raw) || String(raw || "").replace(/\D/g, "");
    if (!ph) continue;
    await setDoc(doc(blCol, ph), { phone: ph, name: o?.name || "", code: o?.code || "", reason, createdAt: serverTimestamp() }, { merge: true });
  }
}

// تتبع الطلب للزبون (نسخة بدون اسم وعنوان)
export const syncTrack = (o, status) => (o.code ? setDoc(doc(db, "order_track", o.code), { ...trackDoc(o, status), updatedAt: serverTimestamp() }, { merge: true }).catch((e) => console.warn("track", e)) : null);

export function useStoreData() {
  const pubRaw = useDocData("store/public");
  const privRaw = useDocData("store/settings");
  const [products, loadingP, errP] = useQuery(() => prodCol, []);
  STORE_LOAD_ERR = errP || null;
  const pub = useMemo(() => mergeStorePublic(pubRaw), [pubRaw]);
  const priv = useMemo(() => mergeStorePrivate(privRaw), [privRaw]);
  PRIV = priv;
  const sorted = useMemo(() => [...products].sort((a, b) => (Number(b.order) || 0) - (Number(a.order) || 0) || toMs(b.createdAt) - toMs(a.createdAt)), [products]);
  const live = useMemo(() => sorted.filter((p) => p.status !== "draft"), [sorted]);
  const drafts = useMemo(() => sorted.filter((p) => p.status === "draft"), [sorted]);
  return { pub, priv, products: live, drafts, loaded: pubRaw !== undefined && privRaw !== undefined && !loadingP };
}

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthRange = (k) => {
  const [y, m] = k.split("-").map(Number);
  return [new Date(y, m - 1, 1), new Date(y, m, 1)];
};

export const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export const monthName = (k) => {
  const [y, m] = k.split("-").map(Number);
  return `${MONTHS_AR[m - 1]} ${y}`;
};

export function monthStats(rows, byId) {
  const st = { all: rows.length, delivered: 0, pending: 0, returned: 0, cancelled: 0, revenue: 0, profit: 0, expected: 0, items: 0 };
  const days = {};
  const prods = {};
  const regions = {};
  for (const o of rows) {
    const pr = orderProfit(o, byId);
    if (o.status === "delivered") {
      st.delivered++;
      st.revenue += Number(o.total) || 0;
      st.profit += pr;
      const d = toDate(o.deliveredAt || o.createdAt)?.getDate() || 0;
      days[d] = (days[d] || 0) + pr;
      const rg = (regions[o.regionName || "—"] = regions[o.regionName || "—"] || { n: 0, profit: 0 });
      rg.n++;
      rg.profit += pr;
      for (const it of o.items || []) {
        const x = (prods[it.id] = prods[it.id] || { name: it.name, qty: 0, profit: 0 });
        const q = Number(it.qty) || 1;
        x.qty += q;
        st.items += q;
        x.profit += (Number(byId[it.id]?.profit) || 0) * q;
      }
    } else if (["confirmed", "sent", "shipping"].includes(o.status)) {
      st.pending++;
      st.expected += pr;
    } else if (o.status === "returned") st.returned++;
    else if (o.status === "cancelled") st.cancelled++;
  }
  st.returnRate = st.delivered + st.returned ? Math.round((st.returned / (st.delivered + st.returned)) * 100) : 0;
  st.bonus = Math.floor(st.delivered / 5) * 10;
  return { st, days, prods: Object.values(prods).sort((a, b) => b.profit - a.profit || b.qty - a.qty), regions: Object.entries(regions).sort((a, b) => b[1].profit - a[1].profit) };
}

export const ORDER_FLOW = ["new", "confirm_queued", "awaiting", "confirmed", "sent", "shipping", "delivered", "returned", "cancelled"];

export function orderProfit(o, byId) {
  if (typeof o.profit === "number") return o.profit;
  return (o.items || []).reduce((s, it) => s + (Number(byId[it.id]?.profit) || 0) * (Number(it.qty) || 1), 0);
}

export function storeUrlOf(priv) {
  if (priv.storeUrl) return priv.storeUrl.replace(/#.*$/, "").replace(/\/?$/, "/");
  const r = ghRepoOf(priv);
  return r ? pagesUrl(r.owner, r.name, "") : "";
}

export function reviewText(o, priv) {
  const first = String(o.name || "").split(/\s+/)[0];
  const ids = [...new Set((o.items || []).map((it) => it.id))].join(",");
  const link = `${storeUrlOf(priv)}#/rate/${o.id}/${o.code}?p=${encodeURIComponent(ids)}&n=${encodeURIComponent(first)}`;
  return fillTpl(priv.reviewTpl || STORE_PRIVATE_DEFAULTS.reviewTpl, { ...orderVars(o), الاسم_الأول: first, رابط_التقييم: link });
}

// تصغير الصورة قبل الرفع (أسرع للمتجر وأخف على النت)
export async function shrink(file, max = 1600) {
  try {
    if (!/^image\/(jpeg|png|webp)/.test(file.type)) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 900_000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob || file;
  } catch {
    return file;
  }
}

// الصورة بتنبعت base64 (أضمن طريقة مع ImgBB)
export const toBase64 = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(new Error("تعذّر قراءة الصورة"));
    r.readAsDataURL(blob);
  });

export const IMGBB_ERR = [
  [/invalid api|api key|key/i, "مفتاح ImgBB غلط — انسخه من جديد من api.imgbb.com وتأكد ما في مسافات، واحفظ الإعدادات"],
  [/rate|limit|too many/i, "ImgBB طالب تهدئة — استنى دقيقة وجرب"],
  [/invalid image|source|type|format/i, "نوع الصورة مش مدعوم — جرب صورة JPG أو PNG"],
  [/failed to fetch|network|load failed/i, "ما في اتصال بـ ImgBB — تأكد من النت أو جرب متصفح تاني"],
];

export async function uploadImgbb(key, file) {
  const k = String(key || "").trim();
  const fd = new FormData();
  fd.append("key", k);
  fd.append("image", await toBase64(await shrink(file)));
  fd.append("name", String(file.name || "image").replace(/\.[^.]+$/, "").slice(0, 60));
  let r, j;
  try {
    r = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
    j = await r.json().catch(() => ({}));
  } catch (e) {
    const m = e.message || String(e);
    throw new Error(IMGBB_ERR.find(([re]) => re.test(m))?.[1] || m);
  }
  if (!j.success) {
    const m = j.error?.message || j.status_txt || `HTTP ${r.status}`;
    throw new Error(`${IMGBB_ERR.find(([re]) => re.test(m))?.[1] || ""} (${m})`.trim());
  }
  return j.data.display_url || j.data.url;
}

// ---------- GitHub: الصور بتنحفظ بريبو المتجر وبتنخدم من GitHub Pages ----------
export function ghRepoOf(priv) {
  const r = String(priv.ghRepo || "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  const [owner, name] = r.split("/");
  return owner && name ? { owner, name } : null;
}

export function pagesUrl(owner, name, path) {
  const host = `${owner.toLowerCase()}.github.io`;
  return name.toLowerCase() === host ? `https://${host}/${path}` : `https://${host}/${name}/${path}`;
}

export const GH_ERR = {
  401: "توكن GitHub غلط أو انتهت صلاحيته — اعمل توكن جديد وحطه بإعدادات المتجر",
  403: "التوكن ما إله صلاحية كتابة — لازم Contents: Read and write على ريبو المتجر",
  404: "الريبو مش موجود أو التوكن مش مسموحله عليه — تأكد من اسم الريبو (حسابك/shop) ومن اختيار الريبو بالتوكن",
  409: "تعارض بالريبو — جرب مرة تانية",
  422: "GitHub رفض الملف — جرب صورة تانية",
};

export async function uploadGithub(priv, file) {
  const repo = ghRepoOf(priv);
  if (!repo) throw new Error("اكتب اسم ريبو المتجر بالإعدادات (مثال: حسابك/shop)");
  const blob = await shrink(file);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const d = new Date();
  const path = `img/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
  let r;
  try {
    r = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${String(priv.ghToken || "").trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ message: `صورة منتج ${path}`, content: await toBase64(blob), branch: priv.ghBranch || "main" }),
    });
  } catch (e) {
    throw new Error("ما في اتصال بـ GitHub — تأكد من النت (" + (e.message || e) + ")");
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(`${GH_ERR[r.status] || "فشل الرفع"} (${r.status}${j.message ? `: ${j.message}` : ""})`);
  }
  return pagesUrl(repo.owner, repo.name, path);
}

export function uploaderOf(priv) {
  const prov = priv.imgProvider || "github";
  if (prov === "github") return priv.ghToken && ghRepoOf(priv) ? (f) => uploadGithub(priv, f) : null;
  if (prov === "imgbb") return priv.imgbbKey ? (f) => uploadImgbb(priv.imgbbKey, f) : null;
  return null;
}

export const splitVals = (t) =>
  String(t || "")
    .split(/[,،\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export const OPT_PRESETS = [
  ["المقاس", "S، M، L، XL، 2XL"],
  ["المقاس", "36، 38، 40، 42، 44، 46"],
  ["المقاس", "فري سايز"],
  ["مقاس الحذاء", "36، 37، 38، 39، 40، 41"],
  ["اللون", "أسود، أبيض، بيج"],
];

export const EMPTY_PRODUCT = {
  name: "",
  category: "",
  cost: "",
  profit: "",
  oldPrice: "",
  images: [],
  feedback: [],
  features: [],
  desc: "",
  options: null,
  featured: false,
  sizeGuide: "",
  nameHe: "",
  featuresHe: [],
  descHe: "",
  nameEn: "",
  featuresEn: [],
  descEn: "",
  delivery: "normal",
  deliveryPrice: "",
  related: [],
  available: true,
  visible: true,
  badge: "",
  order: 0,
  tgLink: "",
  privateNote: "",
  flashPrice: "",
  flashUntil: 0,
};

export const SKIP_CHANNELS = /نصائح|ارشاد|إرشاد|نماذج|التوصيل|فيدباك|feedback|النافذة|نفدت/i;

export const KINDS = { products: "📦 منتجات", soldout: "🚫 المنتجات النافدة", feedback: "💬 آراء الزباين (فيدباك)" };

export const guessKind = (t) => (/فيدباك|feedback|آراء|اراء|تقييم/i.test(t) ? "feedback" : /النافذة|النافدة|نفدت|نفذت|نافد|sold/i.test(t) ? "soldout" : "products");

export const SORT_KEYS = [
  ["women", "👗 حريمي"],
  ["men", "👔 رجالي"],
  ["kids", "🧒 أطفال"],
  ["shoes", "👟 أحذية"],
];

/* صور آراء الزباين — إخفاء صورة من المتجر */
