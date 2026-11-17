// ⚙️ إعدادات المتجر — عدّلي هون بس
export const STORE_URL = "https://onlinejob114111607.github.io/shop/?lang=ar";

// رقم واتساب بصيغة دولية بدون + أو أصفار (مثال: 970599123456).
// إذا تركتِه فاضي، أزرار واتساب بتودّي على المتجر بدل واتساب.
export const WHATSAPP_NUMBER = "972597850956";
export const WHATSAPP_MESSAGE = "مرحبا جودي ستور 🌸 حابة أطلب / أستفسر";

export const SOCIAL = {
  facebook: "https://www.facebook.com/share/1E82d714BE/",
  instagram: "https://www.instagram.com/joudi.store.ps",
};

export const waLink = (msg = WHATSAPP_MESSAGE) =>
  WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}` : STORE_URL;

// روابط أقسام المتجر (عدّليها إذا عندك روابط مباشرة لكل قسم)
export const CATEGORY_LINKS = {
  fashion: STORE_URL,
  accessories: STORE_URL,
  beauty: STORE_URL,
  home: STORE_URL,
};

// 💬 آراء العميلات: حطّي هون آراء حقيقية فقط (نص الرأي + الاسم + المدينة).
// طول ما الحقل فاضي، البطاقة بتظهر كمكان محجوز مكتوب عليه [رأي عميلة حقيقي].
export const TESTIMONIALS = [
  { text: "", name: "", city: "" },
  { text: "", name: "", city: "" },
  { text: "", name: "", city: "" },
  { text: "", name: "", city: "" },
  { text: "", name: "", city: "" },
  { text: "", name: "", city: "" },
];
