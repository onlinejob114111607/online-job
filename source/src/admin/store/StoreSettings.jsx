import { useState } from "react";
import { doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { copyText } from "../../utils";
import { DEFAULT_REGIONS, STORE_PRIVATE_DEFAULTS, STORE_PUBLIC_DEFAULTS } from "../../store/shared";
import { runCommand, useAdmin } from "../hooks";
import { Field, Modal, Panel, Toggle } from "../ui";
import { prodCol, publishCatalog, cleanUrl, fbFeedUrl, storeUrlOf, ghRepoOf, pagesUrl } from "./shared";
import { ImagesField } from "./Products";

export function StoreSettings({ pub, priv, products }) {
  const { toast, waAccounts } = useAdmin();
  const [a, setA] = useState(() => ({ ...pub, notesText: pub.notes.join("\n"), notesHeText: (pub.notesHe || []).join("\n"), notesEnText: (pub.notesEn || []).join("\n"), catsText: pub.categories.join("\n") }));
  const [b, setB] = useState(() => ({ ...priv }));
  const [saving, setSaving] = useState(false);
  const [openRegion, setOpenRegion] = useState(null);
  const setPub = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const setPriv = (k, v) => setB((x) => ({ ...x, [k]: v }));
  const setRegion = (i, patch) => setPub("regions", a.regions.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    setSaving(true);
    try {
      const pubData = {
        name: a.name.trim() || STORE_PUBLIC_DEFAULTS.name,
        tagline: a.tagline.trim(),
        whatsapp: String(a.whatsapp || "").replace(/\D/g, ""),
        waFloat: a.waFloat !== false,
        showHe: !!a.showHe,
        nameEn: String(a.nameEn || "").trim(),
        taglineEn: String(a.taglineEn || "").trim(),
        notesEn: String(a.notesEnText || "").split("\n").map((x) => x.trim()).filter(Boolean),
        nameHe: String(a.nameHe || "").trim(),
        taglineHe: String(a.taglineHe || "").trim(),
        notesHe: String(a.notesHeText || "").split("\n").map((x) => x.trim()).filter(Boolean),
        pixelId: String(a.pixelId || "").replace(/\D/g, ""),
        social: {
          facebook: cleanUrl(a.social?.facebook),
          instagram: cleanUrl(a.social?.instagram),
          tiktok: cleanUrl(a.social?.tiktok),
        },
        banners: (a.banners || []).filter((x) => x.img),
        catImages: Object.fromEntries(Object.entries(a.catImages || {}).filter(([, v]) => v)),
        currency: a.currency || "₪",
        notes: a.notesText.split("\n").map((x) => x.trim()).filter(Boolean),
        noDeliveryDays: a.noDeliveryDays.trim(),
        categories: a.catsText.split("\n").map((x) => x.trim()).filter(Boolean),
        regions: a.regions.map((r) => ({
          ...r,
          price: Number(r.price) || 0,
          cities: (Array.isArray(r.cities) ? r.cities : String(r.cities).split(/[،,\n]+/)).map((x) => String(x).trim()).filter(Boolean),
        })),
      };
      await setDoc(doc(db, "store", "public"), { ...pubData, updatedAt: serverTimestamp() });
      await setDoc(doc(db, "store", "settings"), {
        ...b,
        imgbbKey: String(b.imgbbKey || "").trim(),
        ghToken: String(b.ghToken || "").trim(),
        ghRepo: String(b.ghRepo || "").trim(),
        updatedAt: serverTimestamp(),
      });
      await publishCatalog(products, pubData);
      toast("انحفظت الإعدادات وانتشرت بالمتجر ✓", "ok");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ: " + e.message, "bad");
    }
    setSaving(false);
  }

  return (
    <div className="settings-page">
      <Panel title="واجهة المتجر">
        <Toggle checked={a.waFloat !== false} onChange={(v) => setPub("waFloat", v)} label="زر واتساب عائم للاستفسار" hint="بيفتح محادثة مع رقم استقبال الطلبات." />
        <Field label="بانرات الصفحة الرئيسية (عروض)" hint="صورة عريضة (مثلاً 1200×500). الرابط: اختار قسم أو منتج يفتح لما الزبون يكبس.">
          {(a.banners || []).map((bn, i) => {
            const setB = (patch) => setPub("banners", a.banners.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="banner-row">
                <img src={bn.img} alt="" />
                <div className="banner-fields">
                  <input value={bn.title || ""} onChange={(e) => setB({ title: e.target.value })} placeholder="عنوان على البانر (اختياري)" />
                  <select value={bn.link || ""} onChange={(e) => setB({ link: e.target.value })}>
                    <option value="">بدون رابط</option>
                    {(a.catsText || "").split("\n").map((c) => c.trim()).filter(Boolean).map((c) => (
                      <option key={c} value={`c:${c}`}>
                        قسم: {c}
                      </option>
                    ))}
                    {products.map((p) => (
                      <option key={p.id} value={`p:${p.id}`}>
                        منتج: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="icon-btn" onClick={() => setPub("banners", a.banners.filter((_, j) => j !== i))}>
                  🗑
                </button>
              </div>
            );
          })}
          <ImagesField label="" value={[]} onChange={(imgs) => setPub("banners", [...(a.banners || []), ...imgs.map((img) => ({ img, title: "", link: "" }))])} priv={b} />
        </Field>
        <Field label="صور الأقسام" hint="اختياري — إذا ما حطيت صورة، بيستعمل صورة أول منتج بالقسم.">
          <div className="cat-imgs">
            {(a.catsText || "").split("\n").map((c) => c.trim()).filter(Boolean).map((c) => (
              <div key={c} className="cat-img">
                <div className="cat-img-box">{a.catImages?.[c] ? <img src={a.catImages[c]} alt="" /> : <span>—</span>}</div>
                <b>{c}</b>
                <ImagesField label="" value={[]} onChange={(imgs) => imgs[0] && setPub("catImages", { ...(a.catImages || {}), [c]: imgs[0] })} priv={b} />
                {a.catImages?.[c] && (
                  <button type="button" className="link-like" onClick={() => setPub("catImages", { ...a.catImages, [c]: "" })}>
                    شيل الصورة
                  </button>
                )}
              </div>
            ))}
          </div>
        </Field>
      </Panel>

      <Panel title="🇬🇧 الإنجليزي (لغة المتجر الأساسية)">
        <p className="small-text muted">المتجر بيفتح بالإنجليزي، وفي زر EN / عربي فوق. رابط العربي مباشرة: بآخر رابط المتجر حط ?lang=ar</p>
        {storeUrlOf(b) && (
          <p className="small-text" dir="ltr">
            {storeUrlOf(b)}?lang=en · {storeUrlOf(b)}?lang=ar
          </p>
        )}
        <div className="form-grid">
          <Field label="Store name">
            <input dir="ltr" value={a.nameEn || ""} onChange={(e) => setPub("nameEn", e.target.value)} placeholder="Joudi Store" />
          </Field>
          <Field label="Tagline">
            <input dir="ltr" value={a.taglineEn || ""} onChange={(e) => setPub("taglineEn", e.target.value)} placeholder="Delivery to all areas" />
          </Field>
        </div>
        <Field label="Top bar notes (one per line)" hint="فاضي = ملاحظات جاهزة بالإنجليزي">
          <textarea dir="ltr" rows={3} value={a.notesEnText || ""} onChange={(e) => setPub("notesEnText", e.target.value)} />
        </Field>
        <Field label="رسالة تأكيد الطلب للطلبات من النسخة الإنجليزية (اختياري)" hint="فاضي = بتنبعت الرسالة العربية">
          <textarea rows={4} value={b.confirmTplEn || ""} onChange={(e) => setPriv("confirmTplEn", e.target.value)} />
        </Field>
        <TranslateAll products={products} pub={pub} />
      </Panel>

      <Panel title="🇮🇱 النسخة العبرية (اختياري)">
        <Toggle checked={!!a.showHe} onChange={(v) => setPub("showHe", v)} label="إظهار زر עברית كمان" hint="مطفي = المتجر إنجليزي وعربي بس. رابط العبري بيضل شغال: بآخر الرابط ?lang=he" />
        {storeUrlOf(b) && (
          <p className="small-text" dir="ltr">
            {storeUrlOf(b)}?lang=he
          </p>
        )}
        <div className="form-grid">
          <Field label="اسم المتجر بالعبري (اختياري)">
            <input value={a.nameHe || ""} onChange={(e) => setPub("nameHe", e.target.value)} />
          </Field>
          <Field label="جملة تحت الاسم بالعبري">
            <input value={a.taglineHe || ""} onChange={(e) => setPub("taglineHe", e.target.value)} placeholder="משלוח לכל האזורים" />
          </Field>
        </div>
        <Field label="ملاحظات الشريط العلوي بالعبري (وحدة بكل سطر)" hint="فاضي = ملاحظات جاهزة بالعبري (אחריות، משלוח، בדיקה בקבלה)">
          <textarea rows={3} value={a.notesHeText || ""} onChange={(e) => setPub("notesHeText", e.target.value)} />
        </Field>
        <Field label="رسالة تأكيد الطلب بالعبري (للطلبات من النسخة العبرية)">
          <textarea rows={6} value={b.confirmTplHe ?? STORE_PRIVATE_DEFAULTS.confirmTplHe} onChange={(e) => setPriv("confirmTplHe", e.target.value)} />
        </Field>
      </Panel>

      <Panel title="📊 Facebook Pixel">
        <ol className="steps-mini">
          <li>
            افتح <b dir="ltr">business.facebook.com/events_manager</b> ← Connect data sources ← Web ← اختار Meta Pixel وسمّيه.
          </li>
          <li>انسخ رقم الـ Pixel ID (أرقام بس، حوالي 15 رقم) والصقه هون.</li>
          <li>
            بعد الحفظ، الموقع بيبعت لفيسبوك: زيارة الصفحات، مشاهدة منتج، إضافة للسلة، بدء الطلب، والطلب نفسه (<b dir="ltr">Purchase</b>) مع قيمته — فبتقدر تعمل إعلانات هدفها «طلبات» وتشوف كم طلب جابلك كل إعلان.
          </li>
        </ol>
        <Field label="Pixel ID">
          <input dir="ltr" value={a.pixelId || ""} onChange={(e) => setPub("pixelId", e.target.value)} placeholder="123456789012345" />
        </Field>
      </Panel>

      <Panel title="روابط التواصل (بالفوتر)">
        <p className="small-text muted">الأزرار بتظهر بأسفل المتجر، وأي زر رابطه فاضي ما بيظهر. زر الواتساب بيطلع لحاله من رقم المتجر.</p>
        <div className="form-grid">
          <Field label="فيسبوك">
            <input dir="ltr" value={a.social?.facebook || ""} onChange={(e) => setPub("social", { ...a.social, facebook: e.target.value })} placeholder="https://facebook.com/..." />
          </Field>
          <Field label="إنستغرام">
            <input dir="ltr" value={a.social?.instagram || ""} onChange={(e) => setPub("social", { ...a.social, instagram: e.target.value })} placeholder="https://instagram.com/..." />
          </Field>
          <Field label="تيك توك (اختياري)">
            <input dir="ltr" value={a.social?.tiktok || ""} onChange={(e) => setPub("social", { ...a.social, tiktok: e.target.value })} placeholder="https://tiktok.com/@..." />
          </Field>
        </div>
      </Panel>

      <Panel title="🛍️ كتالوج فيسبوك وإنستغرام">
        {fbFeedUrl(b) ? (
          <>
            <p className="small-text muted">ملف فيه كل منتجاتك (الاسم، السعر، الصور، الرابط، متوفر/نفد) بيتحدّث لحاله مع كل «إعادة نشر». فيسبوك بيسحبه كل يوم، فالمنتجات بتظهر بمتجر صفحتك وبإنستغرام (تاغ المنتجات) وبإعلانات الكتالوج.</p>
            <div className="copy-row">
              <input dir="ltr" readOnly value={fbFeedUrl(b)} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn small" onClick={() => copyText(fbFeedUrl(b)).then(() => toast("انتسخ ✓", "ok"))}>
                نسخ
              </button>
            </div>
            <ol className="steps-mini">
              <li>
                افتح <b dir="ltr">business.facebook.com/commerce</b> ← Add catalog ← E-commerce ← Upload product info.
              </li>
              <li>
                اختار <b dir="ltr">Data feed</b> ← <b dir="ltr">Use a URL</b> والصق الرابط اللي فوق.
              </li>
              <li>
                اختار التحديث <b dir="ltr">Daily</b> والعملة <b dir="ltr">ILS</b>، وبعدين اربط الكتالوج بصفحة الفيسبوك وحساب الإنستغرام (Commerce Manager ← Sales channels).
              </li>
              <li>الملف بينعمل أول مرة بعد ما تكبس «إعادة نشر» بتبويب المنتجات.</li>
            </ol>
          </>
        ) : (
          <div className="alert warn">جهّز رفع الصور لـ GitHub (تحت) عشان ينعمل رابط الكتالوج.</div>
        )}
      </Panel>

      <Panel title="المتجر">
        <div className="form-grid">
          <Field label="اسم المتجر">
            <input value={a.name} onChange={(e) => setPub("name", e.target.value)} />
          </Field>
          <Field label="جملة تحت الاسم">
            <input value={a.tagline} onChange={(e) => setPub("tagline", e.target.value)} />
          </Field>
          <Field label="رقم واتساب استقبال الطلبات" hint="بصيغة دولية بدون + (مثال: 970599123456). الأفضل نفس رقم حساب المتابعة.">
            <input dir="ltr" value={a.whatsapp} onChange={(e) => setPub("whatsapp", e.target.value)} />
          </Field>
          <Field label="العملة">
            <input value={a.currency} onChange={(e) => setPub("currency", e.target.value)} />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="ملاحظات أسفل المتجر (وحدة بكل سطر)">
            <textarea rows={4} value={a.notesText} onChange={(e) => setPub("notesText", e.target.value)} />
          </Field>
          <Field label="الأقسام (وحدة بكل سطر)">
            <textarea rows={4} value={a.catsText} onChange={(e) => setPub("catsText", e.target.value)} />
          </Field>
        </div>
        <Field label="ملاحظة أيام التوصيل">
          <input value={a.noDeliveryDays} onChange={(e) => setPub("noDeliveryDays", e.target.value)} />
        </Field>
      </Panel>

      <Panel title="رفع الصور">
        <Field label="وين تنحفظ الصور">
          <select value={b.imgProvider || "github"} onChange={(e) => setPriv("imgProvider", e.target.value)}>
            <option value="github">GitHub — بريبو المتجر نفسه (مجاني وبيشتغل بمصر)</option>
            <option value="imgbb">ImgBB</option>
          </select>
        </Field>
        {(b.imgProvider || "github") === "github" ? (
          <>
            <ol className="steps-mini">
              <li>لازم يكون ريبو المتجر معمول ومفعّل عليه GitHub Pages.</li>
              <li>
                افتح{" "}
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" dir="ltr">
                  github.com/settings/personal-access-tokens/new
                </a>
              </li>
              <li>
                الاسم: <b dir="ltr">store-images</b> · المدة: أطول مدة متاحة
              </li>
              <li>
                Repository access ← <b>Only select repositories</b> ← اختار ريبو المتجر
              </li>
              <li>
                Permissions ← Repository permissions ← <b>Contents</b> ← <b>Read and write</b>
              </li>
              <li>
                <b>Generate token</b> وانسخ التوكن (بيبدأ بـ <span dir="ltr">github_pat_</span>) والصقه هون.
              </li>
            </ol>
            <div className="form-grid">
              <Field label="ريبو المتجر" hint="حسابك/اسم الريبو — مثال: onlinejob114111607/shop">
                <input dir="ltr" value={b.ghRepo} onChange={(e) => setPriv("ghRepo", e.target.value)} placeholder="username/shop" />
              </Field>
              <Field label="التوكن" hint="بيتخزن بحسابك بس، وما حدا بيشوفه غيرك.">
                <input dir="ltr" type="password" value={b.ghToken} onChange={(e) => setPriv("ghToken", e.target.value)} placeholder="github_pat_..." />
              </Field>
            </div>
            {ghRepoOf(b) && (
              <p className="small-text muted" dir="ltr">
                {pagesUrl(ghRepoOf(b).owner, ghRepoOf(b).name, "img/...")}
              </p>
            )}
            <p className="small-text muted">الصور بتنحفظ بمجلد img بالريبو. لما ترفع تحديث للمتجر بعدين، لا تحذف مجلد img.</p>
          </>
        ) : (
          <Field label="مفتاح ImgBB API">
            <input dir="ltr" value={b.imgbbKey} onChange={(e) => setPriv("imgbbKey", e.target.value)} placeholder="xxxxxxxxxxxxxxxx" />
          </Field>
        )}
      </Panel>

      <Panel title="الطلبات والتأكيد">
        <div className="form-grid">
          <Field label="اسم المندوبة (بنموذج المشرف)">
            <input value={b.repName} onChange={(e) => setPriv("repName", e.target.value)} />
          </Field>
          <Field label="حساب واتساب رسالة التأكيد">
            <select value={b.confirmAccountId} onChange={(e) => setPriv("confirmAccountId", e.target.value)}>
              <option value="">حساب الترحيب الافتراضي</option>
              {waAccounts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} {x.phone ? `(+${x.phone})` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="small-text muted">
          المتغيرات: {"{الاسم} {العنوان} {الجوال} {جوال1} {جوال2} {الطلب} {المنتج} {السعر} {الربح} {سعر_الجملة} {المندوبة} {ملاحظة} {رقم_الطلب}"}
        </p>
        {[
          ["confirmTpl", "رسالة التأكيد للزبون (قسم المتابعة)"],
          ["supervisorTpl", "نموذج إرسال الطلب لمشرف المنتج"],
          ["ledgerTpl", "نموذج تسجيل الطلب على الدفتر"],
          ["reviewTpl", "رسالة طلب التقييم (بعد الاستلام) — {رابط_التقييم} {الاسم_الأول}"],
        ].map(([k, l]) => (
          <Field
            key={k}
            label={
              <>
                {l}{" "}
                <button type="button" className="link-like" onClick={() => setPriv(k, STORE_PRIVATE_DEFAULTS[k])}>
                  رجوع للأصل
                </button>
              </>
            }
          >
            <textarea rows={8} value={b[k]} onChange={(e) => setPriv(k, e.target.value)} />
          </Field>
        ))}
      </Panel>

      <Panel
        title="مناطق التوصيل وأسعارها"
        actions={
          <button type="button" className="btn small" onClick={() => confirm("ترجع المناطق والأسعار للجدول الأصلي من الدليل؟") && setPub("regions", structuredClone(DEFAULT_REGIONS))}>
            رجوع للأصل
          </button>
        }
      >
        <div className="table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>المنطقة</th>
              <th>التوصيل ₪</th>
              <th>المدة</th>
              <th>البلدات</th>
            </tr>
          </thead>
          <tbody>
            {a.regions.map((r, i) => (
              <tr key={r.id}>
                <td>
                  <input className="note-input" value={r.name} onChange={(e) => setRegion(i, { name: e.target.value })} />
                </td>
                <td>
                  <input className="mini-num" type="number" min={0} value={r.price} onChange={(e) => setRegion(i, { price: e.target.value })} />
                </td>
                <td>
                  <input className="note-input" value={r.duration} onChange={(e) => setRegion(i, { duration: e.target.value })} />
                </td>
                <td>
                  <button type="button" className="btn small" onClick={() => setOpenRegion(i)}>
                    {(Array.isArray(r.cities) ? r.cities.length : String(r.cities).split(/[،,\n]+/).filter(Boolean).length)} بلدة
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {openRegion !== null && (
          <Modal title={`بلدات: ${a.regions[openRegion].name}`} onClose={() => setOpenRegion(null)} actions={<button className="btn primary" onClick={() => setOpenRegion(null)}>تم</button>}>
            <textarea
              rows={14}
              style={{ width: "100%" }}
              value={Array.isArray(a.regions[openRegion].cities) ? a.regions[openRegion].cities.join("، ") : a.regions[openRegion].cities}
              onChange={(e) => setRegion(openRegion, { cities: e.target.value })}
            />
            <div className="hint">مفصولة بفاصلة.</div>
          </Modal>
        )}
      </Panel>

      <div className="save-bar">
        <div className="save-status">
          <span className="muted">التغييرات بتنتشر بالمتجر لما تحفظ</span>
        </div>
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? "جاري الحفظ..." : "حفظ ونشر"}
        </button>
      </div>
    </div>
  );
}

// ترجمة كل المنتجات اللي ما إلها إنجليزي (دفعة وحدة)
export function TranslateAll({ products, pub }) {
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  const missing = products.filter((p) => !p.nameEn && p.status !== "draft");
  async function run() {
    setBusy(true);
    try {
      const r = await runCommand("wa", "store_translate_all", {}, { timeout: 600_000 });
      toast(`تُرجم ${r?.done || 0} منتج — رح ينتشر هلأ`, "ok", 5000);
      const snap = await getDocs(prodCol);
      await publishCatalog(snap.docs.map((d) => ({ id: d.id, ...d.data() })), pub);
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
    setBusy(false);
  }
  return (
    <div className="btn-row">
      <button type="button" className="btn small" disabled={busy || !missing.length} onClick={run}>
        {busy ? "جاري الترجمة..." : `🌐 ترجم كل المنتجات الناقصة للإنجليزي (${missing.length})`}
      </button>
    </div>
  );
}
