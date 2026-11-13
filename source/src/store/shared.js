// ============================================================
//  أدوات مشتركة بين واجهة المتجر ولوحة التحكم
// ============================================================
import { DEFAULT_REGIONS } from "./regions";

export { DEFAULT_REGIONS };

export const DEFAULT_CATEGORIES = ["أثاث", "ملابس حريمي", "ملابس رجالي", "أدوات منزلية", "أحذية", "أطفال", "عناية وتجميل", "إكسسوارات"];

// إعدادات المتجر العامة (بتنعرض للزوار) — store/catalog.settings
export const STORE_PUBLIC_DEFAULTS = {
  name: "جودي ستور",
  nameEn: "Joudi Store",
  tagline: "توصيل لكل مناطق الضفة والقدس والداخل",
  taglineEn: "Delivery to the West Bank, Jerusalem & inside",
  notesEn: [],
  whatsapp: "", // رقم استقبال الطلبات بصيغة دولية بدون +
  currency: "₪",
  notes: ["✨ ٩٠٪ من منتجاتنا مكفولة", "✨ التوصيل متاح لجميع مناطق الضفة والقدس والداخل", "✨ الرجاء تفقد المنتج عند الاستلام"],
  noDeliveryDays: "لا يوجد توصيل يومي الجمعة والسبت",
  categories: DEFAULT_CATEGORIES,
  catImages: {}, // { "أثاث": "https://..." } — صورة لكل قسم (اختياري)
  banners: [], // [{ img, title, link }] — link: "c:اسم القسم" أو "p:معرف المنتج"
  waFloat: true, // زر واتساب عائم للاستفسار
  showHe: false, // زر עברית بالمتجر (الإنجليزي والعربي دايماً موجودين)
  nameHe: "",
  taglineHe: "",
  notesHe: [],
  pixelId: "", // Facebook Pixel ID
  social: { facebook: "", instagram: "", tiktok: "" }, // روابط التواصل بالفوتر
  regions: DEFAULT_REGIONS,
};

// إعدادات خاصة بالأدمن — store/settings
export const STORE_PRIVATE_DEFAULTS = {
  imgProvider: "github", // github | imgbb
  ghRepo: "", // owner/repo — نفس ريبو المتجر
  ghToken: "",
  ghBranch: "main",
  imgbbKey: "",
  repName: "",
  confirmAccountId: "",
  confirmTpl:
    "مرحباً، معك قسم المتابعة والتنسيق، لقد تم إرفاق طلبك، ونريد التحقق من البيانات التي وصلت إلينا:\n\nالاسم: {الاسم}\n\nالعنوان: {العنوان}\n\nالجوال: {الجوال}\n\nالطلب: {الطلب}\n\nالسعر: {السعر} ₪ شامل التوصيل\n\nحبيت أأكد على حضرتك بياناتك، وشكراً لتواصلك معنا 🤗\n\nلتأكيد الطلب ارسل *تم*",
  confirmTplEn: "",
  confirmTplHe:
    "שלום, כאן מחלקת המעקב והתיאום. ההזמנה שלך התקבלה, ונרצה לוודא את הפרטים שהגיעו אלינו:\n\nשם: {الاسم}\n\nכתובת: {العنوان}\n\nטלפון: {الجوال}\n\nהזמנה: {الطلب}\n\nמחיר: {السعر} ₪ כולל משלוח\n\nלאישור ההזמנה שלחו *מאשר* 🤗",
  supervisorTpl:
    "💐 اسم الزبون (رباعي) / {الاسم}\n\n💐 العنوان / {العنوان}\n\n💐 رقم جوال ١ / {جوال1}\n\n💐 رقم جوال ٢ / {جوال2}\n\n💐 اسم المنتج / {المنتج}\n\n💐 السعر شامل التوصيل / {السعر}\n\n💐 مربح المندوبة الأصلي / {الربح}\n\n💐 مربح زائد / 0\n\n💐 مربح ناقص / 0\n\n💐 اسم المندوبة / {المندوبة}\n\n🔥 ملاحظة / {ملاحظة}",
  reviewTpl:
    "مرحبا {الاسم_الأول} 🌸\nإن شاء الله وصلك طلبك وعجبك 😍\nبيهمنا رأيك، ممكن تقيّم المنتج من هون (دقيقة وحدة):\n{رابط_التقييم}\n\nشكراً إلك 🤍",
  storeUrl: "", // فاضي = من ريبو GitHub
  ledgerTpl:
    "💐 اسم الزبون / {الاسم}\n\n💐 العنوان / {العنوان}\n\n💐 اسم المنتج / {المنتج}\n\n💐 سعر المنتج حسب التليجرام / {سعر_الجملة}\n\n💐 السعر شامل التوصيل / {السعر}\n\n💐 مربح المندوبة / {الربح}",
};

export const ORDER_STATUS = {
  new: ["جديد", "info"],
  confirm_queued: ["رسالة التأكيد بالطابور", "wait"],
  awaiting: ["بانتظار تأكيد الزبون", "wait"],
  confirmed: ["مؤكد", "ok"],
  sent: ["انبعت للمشرف", "info"],
  shipping: ["بالتوصيل", "info"],
  delivered: ["استلم ✓", "ok"],
  returned: ["راجع", "bad"],
  cancelled: ["ملغي", "bad"],
};

export const money = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return String(v);
};

// رقم الزبون ← صيغة دولية (970 لجوال/الوطنية 059/056، و972 لباقي 05x)
export function normPhone(raw) {
  let s = String(raw || "")
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/\D/g, "");
  if (s.startsWith("00")) s = s.slice(2);
  if (/^(970|972)5\d{8}$/.test(s)) return s;
  if (/^05\d{8}$/.test(s)) s = s.slice(1);
  if (/^5\d{8}$/.test(s)) return (/^(59|56)/.test(s) ? "970" : "972") + s;
  return /^\d{9,15}$/.test(s) ? s : "";
}

export const displayPhone = (p) => {
  const s = String(p || "");
  if (/^(970|972)5\d{8}$/.test(s)) return "0" + s.slice(3);
  return s ? "+" + s : "";
};

// التوصيل: المنتجات العادية بطلب واحد = توصيل واحد، الأثاث = توصيل لكل قطعة، وفي منتجات إلها توصيل خاص
export function calcTotals(items, region) {
  const rp = Number(region?.price) || 0;
  let subtotal = 0;
  let hasNormal = false;
  let extra = 0;
  for (const it of items) {
    const q = Math.max(1, Number(it.qty) || 1);
    subtotal += (Number(it.price) || 0) * q;
    if (it.delivery === "perPiece") extra += rp * q;
    else if (it.delivery === "custom") extra += (Number(it.deliveryPrice) || 0) * q;
    else hasNormal = true;
  }
  const delivery = region ? (hasNormal ? rp : 0) + extra : 0;
  return { subtotal, delivery, total: subtotal + delivery };
}

export function fillTpl(tpl, vars) {
  let out = String(tpl || "");
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? "");
  return out;
}

export const itemLine = (it) => `${it.name}${it.option ? ` (${it.option})` : ""}${Number(it.qty) > 1 ? ` × ${it.qty}` : ""}`;
export const orderAddress = (o) => [o.city, o.address].filter(Boolean).join(" - ");

export function orderVars(o, base = "") {
  return {
    رابط_التتبع: base ? trackUrl(base, o.code) : "",
    الاسم: o.name,
    العنوان: orderAddress(o),
    الجوال: [displayPhone(o.phone1), displayPhone(o.phone2)].filter(Boolean).join(" / "),
    جوال1: displayPhone(o.phone1),
    جوال2: displayPhone(o.phone2) || "—",
    الطلب: (o.items || []).map(itemLine).join(" + "),
    السعر: money(o.total),
    رقم_الطلب: o.code,
    المنطقة: o.regionName || "",
    ملاحظة: o.notes || "",
  };
}

// رسالة الطلب اللي بيبعتها الزبون للواتساب
export function waOrderText(o, currency = "₪") {
  return [
    `🛒 طلب جديد #${o.code}`,
    "",
    ...(o.items || []).map((it) => `▫️ ${itemLine(it)} — ${money(it.price * it.qty)} ${currency}`),
    "",
    `التوصيل (${o.regionName}): ${money(o.delivery)} ${currency}`,
    `المجموع: ${money(o.total)} ${currency}`,
    "",
    `الاسم: ${o.name}`,
    `العنوان: ${orderAddress(o)}`,
    `الجوال: ${[displayPhone(o.phone1), displayPhone(o.phone2)].filter(Boolean).join(" / ")}`,
    o.notes ? `ملاحظة: ${o.notes}` : "",
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n")
    .trim();
}

export const waLinkTo = (phone, text) => `https://wa.me/${String(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export function orderCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

// مطابقة اسم البلد مع المناطق (ممكن أكتر من منطقة لنفس الاسم)
const normAr = (s) =>
  String(s || "")
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
export function regionsForCity(regions, city) {
  const c = normAr(city);
  if (!c) return [];
  return regions.filter((r) => (r.cities || []).some((x) => normAr(x) === c));
}

export function mergeStorePublic(d) {
  const x = { ...STORE_PUBLIC_DEFAULTS, ...(d || {}) };
  if (!Array.isArray(x.categories) || !x.categories.length) x.categories = DEFAULT_CATEGORIES;
  if (!Array.isArray(x.regions) || !x.regions.length) x.regions = DEFAULT_REGIONS;
  if (!Array.isArray(x.notes)) x.notes = STORE_PUBLIC_DEFAULTS.notes;
  x.social = { ...STORE_PUBLIC_DEFAULTS.social, ...(x.social || {}) };
  return x;
}
export const mergeStorePrivate = (d) => ({ ...STORE_PRIVATE_DEFAULTS, ...(d || {}) });

// خيارات المنتج: [{ label: "المقاس", values: ["S","M"], off: ["S"] }]  (off = مش متوفر)
export function normOptions(o) {
  const list = Array.isArray(o) ? o : o && Array.isArray(o.values) ? [o] : [];
  return list
    .map((g) => ({
      label: String(g.label || "اختر").trim(),
      values: (g.values || []).map((v) => String(v).trim()).filter(Boolean).slice(0, 40),
      off: (g.off || []).map((v) => String(v).trim()).filter(Boolean),
    }))
    .filter((g) => g.values.length)
    .slice(0, 3);
}

export const optionText = (sel) =>
  Object.entries(sel || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("، ");

export const discountPct = (p) => (p.oldPrice > p.price && p.price > 0 ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0);

// الحقول العامة للمنتج اللي بتروح للكتالوج (بدون سعر الجملة والربح)
export function publicProduct(p, extra = {}) {
  return {
    id: p.id,
    name: p.name,
    nameHe: p.nameHe || "",
    nameEn: p.nameEn || "",
    featuresEn: (p.featuresEn || []).slice(0, 15),
    descEn: p.descEn || "",
    featuresHe: (p.featuresHe || []).slice(0, 15),
    descHe: p.descHe || "",
    category: p.category || "",
    price: Number(p.price) || 0,
    oldPrice: Number(p.oldPrice) || 0,
    images: (p.images || []).slice(0, 12),
    feedback: (p.feedback || []).slice(0, 12),
    features: (p.features || []).slice(0, 15),
    desc: p.desc || "",
    sizeGuide: p.sizeGuide || "",
    options: normOptions(p.options),
    delivery: p.delivery || "normal",
    deliveryPrice: Number(p.deliveryPrice) || 0,
    related: (p.related || []).slice(0, 8),
    available: p.available !== false,
    featured: !!p.featured,
    flashPrice: Number(p.flashPrice) || 0, // عرض بوقت محدد
    flashUntil: Number(p.flashUntil) || 0,
    badge: p.badge || "",
    order: Number(p.order) || 0,
    createdAt: p.createdAt?.toMillis ? p.createdAt.toMillis() : Number(p.createdAt) || 0,
    sold: extra.sold || 0,
    rating: extra.rating || null, // { avg, count }
    reviews: extra.reviews || [], // [{ name, stars, text, at }]
  };
}


// ---------- تتبع الطلب (نسخة صغيرة للزبون بدون اسم أو عنوان) ----------
export const trackUrl = (base, code) => `${String(base || "").replace(/\/+$/, "")}/#/track/${code}`;
export const last4 = (p) => String(p || "").replace(/\D/g, "").slice(-4);
// خطوات التتبع اللي بيشوفها الزبون
export const TRACK_STAGE = { new: 0, confirm_queued: 0, awaiting: 0, confirmed: 1, sent: 2, shipping: 2, delivered: 3, returned: -1, cancelled: -1 };
export function trackDoc(o, status = o.status) {
  return {
    orderId: o.id || o.orderId || "",
    status,
    p4: last4(o.phone1),
    items: (o.items || []).slice(0, 30).map((it) => ({ name: String(it.name || "").slice(0, 120), qty: Number(it.qty) || 1, option: String(it.option || "").slice(0, 80) })),
    total: Number(o.total) || 0,
    regionName: o.regionName || "",
  };
}

// ---------- كتالوج فيسبوك/إنستغرام (CSV) ----------
const csvCell = (v) => {
  const s = String(v ?? "").replace(/\r?\n+/g, " ").trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function fbCatalogCsv(products, settings, base, currency = "ILS") {
  const head = ["id", "title", "description", "availability", "condition", "price", "sale_price", "link", "image_link", "additional_image_link", "brand", "product_type"];
  const rows = products
    .filter((p) => p && p.id && p.name && p.images?.[0] && Number(p.price) > 0)
    .map((p) => {
      const title = (p.nameEn || p.name).slice(0, 150);
      const desc = [p.descEn || p.desc, ...((p.featuresEn?.length ? p.featuresEn : p.features) || [])].filter(Boolean).join(" · ").slice(0, 4900) || title;
      const old = Number(p.oldPrice) > Number(p.price) ? Number(p.oldPrice) : 0;
      return [
        p.id,
        title,
        desc,
        p.available === false ? "out of stock" : "in stock",
        "new",
        `${old || Number(p.price)} ${currency}`,
        old ? `${Number(p.price)} ${currency}` : "",
        `${String(base).replace(/\/+$/, "")}/#/p/${encodeURIComponent(p.id)}`,
        p.images[0],
        p.images.slice(1, 10).join(","),
        settings?.nameEn || settings?.name || "",
        p.category || "",
      ].map(csvCell).join(",");
    });
  return [head.join(","), ...rows].join("\n") + "\n";
}
