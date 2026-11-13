import { useEffect, useRef, useState } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { money, normOptions } from "../../store/shared";
import { runCommand, useAdmin } from "../hooks";
import { Empty, Field, Modal, Panel, Tag, Toggle } from "../ui";
import { prodCol, publishCatalog, uploaderOf, splitVals, OPT_PRESETS, EMPTY_PRODUCT } from "./shared";

export function Products({ products, pub, priv }) {
  const { toast } = useAdmin();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = products.filter((p) => (!cat || p.category === cat) && (!q || String(p.name).includes(q)));

  async function publish(list = products) {
    setBusy(true);
    try {
      const n = await publishCatalog(list, pub);
      toast(`انتشر المتجر (${n} منتج) ✓`, "ok");
    } catch (e) {
      console.error(e);
      toast("فشل النشر: " + e.message, "bad");
    }
    setBusy(false);
  }

  async function quick(p, patch) {
    try {
      await updateDoc(doc(db, "store_products", p.id), patch);
      await publishCatalog(products.map((x) => (x.id === p.id ? { ...x, ...patch } : x)), pub);
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
  }

  return (
    <>
      <Panel
        title={`المنتجات (${products.length})`}
        actions={
          <>
            <button className="btn small" disabled={busy} onClick={() => publish()} title="إعادة نشر الكتالوج للمتجر">
              {busy ? "جاري..." : "إعادة نشر"}
            </button>
            <button className="btn small primary" onClick={() => setEdit({})}>
              + منتج جديد
            </button>
          </>
        }
      >
        {!uploaderOf(priv) && <div className="alert warn">جهّز رفع الصور من "إعدادات المتجر" ← رفع الصور، عشان ترفع صور المنتجات من هون مباشرة.</div>}
        <div className="filters">
          <input type="search" placeholder="بحث باسم المنتج..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">كل الأقسام</option>
            {pub.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {!shown.length ? (
          <Empty>{products.length ? "ما في نتائج" : "ضيف أول منتج"}</Empty>
        ) : (
          <div className="prod-grid">
            {shown.map((p) => (
              <div key={p.id} className={"prod-card" + (p.visible === false ? " hidden-prod" : "")}>
                <div className="prod-img" onClick={() => setEdit(p)}>
                  {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <div className="prod-ph">لا صورة</div>}
                </div>
                <div className="prod-body">
                  <b onClick={() => setEdit(p)}>{p.name}</b>
                  <div className="small-text">
                    <b>{money(p.price)} ₪</b> <span className="muted">= {money(p.cost)} + ربحك {money(p.profit)}</span>
                  </div>
                  <div className="item-meta">
                    {p.category && <Tag kind="info">{p.category}</Tag>}
                    {p.visible === false && <Tag>مخفي</Tag>}
                    {p.available === false && <Tag kind="bad">نفد</Tag>}
                  </div>
                  <div className="btn-row">
                    <button className="btn small" onClick={() => setEdit(p)}>
                      تعديل
                    </button>
                    <button className="btn small" onClick={() => quick(p, { available: p.available === false })}>
                      {p.available === false ? "متوفر" : "نفد"}
                    </button>
                    <button className="btn small" onClick={() => quick(p, { visible: p.visible === false })}>
                      {p.visible === false ? "إظهار" : "إخفاء"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {edit && <ProductModal p={edit} products={products} pub={pub} priv={priv} onClose={() => setEdit(null)} />}
    </>
  );
}

// صورة لسا بتنتشر على GitHub Pages (أول دقيقة) ← بنعيد المحاولة
export function Thumb({ src }) {
  const [n, setN] = useState(0);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    setN(0);
    setBad(false);
  }, [src]);
  const url = n ? `${src}${src.includes("?") ? "&" : "?"}r=${n}` : src;
  return (
    <>
      <img
        src={url}
        alt=""
        onLoad={() => setBad(false)}
        onError={() => {
          setBad(true);
          if (n < 12) setTimeout(() => setN((x) => x + 1), 10_000);
        }}
      />
      {bad && <span className="img-wait">{n < 12 ? "⏳ بتجهز..." : "⚠️ مش ظاهرة"}</span>}
    </>
  );
}

export function ImagesField({ label, value, onChange, priv, hint }) {
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(0);
  const [url, setUrl] = useState("");
  const input = useRef(null);
  async function onFiles(files) {
    const upload = uploaderOf(priv);
    if (!upload) return toast("جهّز رفع الصور من إعدادات المتجر أول (GitHub)", "bad", 4500);
    const list = [...files];
    setBusy(list.length);
    const added = [];
    for (const f of list) {
      try {
        added.push(await upload(f));
      } catch (e) {
        toast(`فشل رفع ${f.name}: ${e.message}`, "bad", 8000);
      }
      setBusy((b) => b - 1);
    }
    if (added.length) onChange([...value, ...added]);
  }
  const move = (i, d) => {
    const a = [...value];
    [a[i], a[i + d]] = [a[i + d], a[i]];
    onChange(a);
  };
  return (
    <Field label={label} hint={hint}>
      <div className="img-list">
        {value.map((src, i) => (
          <div key={src + i} className="img-item">
            <Thumb src={src} />
            {i === 0 && <span className="img-main">الرئيسية</span>}
            <div className="img-tools">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)}>
                →
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                ✕
              </button>
              <button type="button" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                ←
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="img-add" onClick={() => input.current?.click()} disabled={busy > 0}>
          {busy > 0 ? `جاري الرفع (${busy})...` : "+ رفع صور"}
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ""))} />
      </div>
      <div className="row-form">
        <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="أو الصق رابط صورة https://..." />
        <button
          type="button"
          className="btn small"
          onClick={() => {
            const links = url.split(/\s+/).filter((u) => /^https?:\/\//.test(u));
            if (links.length) onChange([...value, ...links]);
            setUrl("");
          }}
        >
          إضافة
        </button>
      </div>
    </Field>
  );
}

export function OptionsEditor({ groups, onChange }) {
  const setG = (i, patch) => onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  return (
    <Field label="الخيارات (مقاس، لون...)" hint="الزبون لازم يختار قبل ما يضيف للسلة. اكبس على أي قيمة لتعلّمها «مش متوفر».">
      {groups.map((g, i) => {
        const vals = splitVals(g.text);
        return (
          <div key={i} className="opt-group">
            <div className="row-form">
              <input value={g.label} onChange={(e) => setG(i, { label: e.target.value })} placeholder="اسم الخيار (المقاس)" style={{ maxWidth: 160 }} />
              <input value={g.text} onChange={(e) => setG(i, { text: e.target.value })} placeholder="القيم مفصولة بفاصلة: S، M، L" />
              <button type="button" className="icon-btn" onClick={() => onChange(groups.filter((_, j) => j !== i))}>
                🗑
              </button>
            </div>
            {vals.length > 0 && (
              <div className="chips">
                {vals.map((v) => {
                  const off = (g.off || []).includes(v);
                  return (
                    <button
                      type="button"
                      key={v}
                      className={"chip" + (off ? " chip-off" : " active")}
                      title={off ? "مش متوفر — اكبس لترجّعه" : "متوفر — اكبس لتعلّمه مش متوفر"}
                      onClick={() => setG(i, { off: off ? g.off.filter((x) => x !== v) : [...(g.off || []), v] })}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {groups.length < 3 && (
        <div className="chips">
          {OPT_PRESETS.map(([l, t]) => (
            <button type="button" key={t} className="chip" onClick={() => onChange([...groups, { label: l, text: t, off: [] }])}>
              + {l}: {t}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => onChange([...groups, { label: "", text: "", off: [] }])}>
            + خيار فاضي
          </button>
        </div>
      )}
    </Field>
  );
}

export function ProductModal({ p, products, pub, priv, onClose }) {
  const { toast } = useAdmin();
  const [s, setS] = useState(() => ({
    ...EMPTY_PRODUCT,
    ...p,
    features: (p.features || []).join("\n"),
    featuresHe: (p.featuresHe || []).join("\n"),
    featuresEn: (p.featuresEn || []).join("\n"),
    optGroups: normOptions(p.options).map((g) => ({ label: g.label, text: g.values.join("، "), off: g.off })),
  }));
  const [saving, setSaving] = useState(false);
  const [trBusy, setTrBusy] = useState(false);
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const price = (Number(s.cost) || 0) + (Number(s.profit) || 0);
  const lines = (v) =>
    String(v || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);

  // ترجمة تلقائية للإنجليزي (عن طريق عامل الواتساب على الجوال)
  async function translateEn(cur = s, quiet = false) {
    const feats = lines(cur.features);
    const texts = [cur.name, cur.desc || "", ...feats];
    if (!String(cur.name || "").trim()) return null;
    setTrBusy(true);
    try {
      const r = await runCommand("wa", "store_translate", { texts, to: "en" }, { timeout: 45_000 });
      const out = r?.texts || [];
      const en = { nameEn: out[0] || "", descEn: out[1] || "", featuresEn: out.slice(2).join("\n") };
      setS((x) => ({ ...x, ...en }));
      if (!quiet) toast("تُرجم ✓ — راجعه وعدّل لو بدك", "ok");
      return en;
    } catch (e) {
      if (!quiet) toast("ما زبطت الترجمة: " + e.message, "bad");
      return null;
    } finally {
      setTrBusy(false);
    }
  }
  const others = products.filter((x) => x.id !== p.id);

  async function save() {
    if (!s.name.trim()) return toast("اكتب اسم المنتج", "bad");
    if (!(Number(s.cost) > 0)) return toast("اكتب سعر المنتج", "bad");
    setSaving(true);
    try {
      let cur = s;
      // ما في اسم إنجليزي ← نحاول نترجم لحالنا قبل الحفظ (الإنجليزي هو لغة المتجر الأساسية)
      if (!String(s.nameEn || "").trim()) {
        const en = await translateEn(s, true);
        if (en) cur = { ...s, ...en };
      }
      const ref = p.id ? doc(db, "store_products", p.id) : doc(prodCol);
      const options = normOptions(
        s.optGroups.map((g) => {
          const values = splitVals(g.text);
          return { label: g.label, values, off: (g.off || []).filter((v) => values.includes(v)) };
        })
      );
      const data = {
        name: s.name.trim(),
        category: s.category,
        cost: Number(s.cost) || 0,
        profit: Number(s.profit) || 0,
        price,
        oldPrice: Number(s.oldPrice) || 0,
        images: s.images,
        feedback: s.feedback,
        features: String(s.features)
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        desc: s.desc.trim(),
        options,
        nameHe: String(s.nameHe || "").trim(),
        featuresHe: String(s.featuresHe || "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        descHe: String(s.descHe || "").trim(),
        nameEn: String(cur.nameEn || "").trim(),
        featuresEn: lines(cur.featuresEn),
        descEn: String(cur.descEn || "").trim(),
        featured: !!s.featured,
        flashPrice: Number(s.flashUntil) > Date.now() ? Number(s.flashPrice) || 0 : 0,
        flashUntil: Number(s.flashUntil) > Date.now() && Number(s.flashPrice) > 0 ? Number(s.flashUntil) : 0,
        ...(p.status === "draft" ? { status: "live" } : {}),
        sizeGuide: String(s.sizeGuide || "").trim(),
        delivery: s.delivery,
        deliveryPrice: Number(s.deliveryPrice) || 0,
        related: s.related.filter((r) => others.some((o) => o.id === r)),
        available: s.available !== false,
        visible: p.status === "draft" ? true : s.visible !== false,
        badge: s.badge.trim(),
        order: Number(s.order) || 0,
        tgLink: s.tgLink.trim(),
        privateNote: s.privateNote.trim(),
        updatedAt: serverTimestamp(),
        ...(p.id ? {} : { createdAt: serverTimestamp() }),
      };
      await setDoc(ref, data, { merge: true });
      const next = p.id ? products.map((x) => (x.id === p.id ? { ...x, ...data, id: p.id } : x)) : [{ ...data, id: ref.id }, ...products];
      await publishCatalog(next, pub);
      toast("انحفظ وانتشر بالمتجر ✓", "ok");
      onClose();
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ: " + e.message, "bad");
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`حذف "${p.name}" نهائياً؟`)) return;
    try {
      await deleteDoc(doc(db, "store_products", p.id));
      await publishCatalog(
        products.filter((x) => x.id !== p.id),
        pub
      );
      onClose();
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
  }

  return (
    <Modal
      wide
      title={p.id ? "تعديل منتج" : "منتج جديد"}
      onClose={onClose}
      actions={
        <>
          {p.id && (
            <button className="btn danger-outline" onClick={remove}>
              حذف
            </button>
          )}
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? "جاري..." : "حفظ ونشر"}
          </button>
        </>
      }
    >
      <Field label="اسم المنتج">
        <input value={s.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="القسم">
          <select value={s.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">—</option>
            {pub.categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="سعر المنتج (حسب التليجرام)">
          <input type="number" min={0} value={s.cost} onChange={(e) => set("cost", e.target.value)} />
        </Field>
        <Field label="ربحي">
          <input type="number" min={0} value={s.profit} onChange={(e) => set("profit", e.target.value)} />
        </Field>
        <Field label="السعر النهائي (بيبين بالمتجر)">
          <input value={`${money(price)} ₪`} readOnly className="readonly-strong" />
        </Field>
        <Field label="السعر قبل الخصم (اختياري)" hint="بيبين مشطوب جنب السعر">
          <input type="number" min={0} value={s.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} />
        </Field>
        <Field label="شارة (اختياري)" hint="مثال: عرض ليومين، الأكثر طلباً">
          <input value={s.badge} onChange={(e) => set("badge", e.target.value)} />
        </Field>
      </div>

      <ImagesField label="صور المنتج" value={s.images} onChange={(v) => set("images", v)} priv={priv} hint="أول صورة هي الرئيسية. الصور الجديدة بتاخد دقيقة تقريباً لتبين." />
      <ImagesField label="صور الفيدباك (آراء الزبائن)" value={s.feedback} onChange={(v) => set("feedback", v)} priv={priv} hint="لقطات حقيقية من قناة الفيدباك." />

      <Field label="أهم المميزات (وحدة بكل سطر)" hint="الدليل بينصح بأهم المميزات بس، مش الوصف كامل.">
        <textarea rows={5} value={s.features} onChange={(e) => set("features", e.target.value)} />
      </Field>
      <Field label="وصف قصير (اختياري)">
        <textarea rows={3} value={s.desc} onChange={(e) => set("desc", e.target.value)} />
      </Field>
      <details className="he-box" open={!s.nameEn}>
        <summary>🇬🇧 English — لغة المتجر الأساسية{s.nameEn ? " ✓" : " (فاضي)"}</summary>
        <p className="small-text muted">الزبون بيشوف الإنجليزي أول. اكبس "ترجم تلقائي" وراجع الترجمة. لو تركته فاضي، بالحفظ بيترجم لحاله (لو عامل الواتساب شغال)، وإلا بيبين بالعربي.</p>
        <button type="button" className="btn small" disabled={trBusy || !s.name.trim()} onClick={() => translateEn()}>
          {trBusy ? "جاري الترجمة..." : "🌐 ترجم تلقائي من العربي"}
        </button>
        <Field label="Product name">
          <input dir="ltr" value={s.nameEn || ""} onChange={(e) => set("nameEn", e.target.value)} />
        </Field>
        <Field label="Features (one per line)">
          <textarea dir="ltr" rows={4} value={s.featuresEn || ""} onChange={(e) => set("featuresEn", e.target.value)} />
        </Field>
        <Field label="Description">
          <textarea dir="ltr" rows={2} value={s.descEn || ""} onChange={(e) => set("descEn", e.target.value)} />
        </Field>
      </details>
      <details className="he-box">
        <summary>🇮🇱 النسخة العبرية (اختياري){s.nameHe ? " ✓" : ""}</summary>
        <p className="small-text muted">لزبائن الداخل. إذا تركتها فاضية، المنتج بيبين بالعربي بالنسخة العبرية. المقاسات والألوان والأقسام الشائعة بتترجم لحالها.</p>
        <Field label="اسم المنتج بالعبري">
          <input dir="rtl" value={s.nameHe || ""} onChange={(e) => set("nameHe", e.target.value)} />
        </Field>
        <Field label="المميزات بالعبري (وحدة بكل سطر)">
          <textarea rows={4} value={s.featuresHe || ""} onChange={(e) => set("featuresHe", e.target.value)} />
        </Field>
        <Field label="الوصف بالعبري">
          <textarea rows={2} value={s.descHe || ""} onChange={(e) => set("descHe", e.target.value)} />
        </Field>
      </details>
      <OptionsEditor groups={s.optGroups} onChange={(v) => set("optGroups", v)} />
      <Field label="دليل المقاسات (اختياري)" hint="مثال: S = 36-38 · M = 40-42 — بيبين للزبون تحت المقاسات">
        <textarea rows={2} value={s.sizeGuide || ""} onChange={(e) => set("sizeGuide", e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="التوصيل">
          <select value={s.delivery} onChange={(e) => set("delivery", e.target.value)}>
            <option value="normal">عادي (توصيل واحد للطلب)</option>
            <option value="perPiece">لكل قطعة (أثاث)</option>
            <option value="custom">سعر توصيل خاص</option>
          </select>
        </Field>
        {s.delivery === "custom" && (
          <Field label="سعر التوصيل الخاص للقطعة">
            <input type="number" min={0} value={s.deliveryPrice} onChange={(e) => set("deliveryPrice", e.target.value)} />
          </Field>
        )}
        <Field label="ترتيب (رقم أكبر = أول)">
          <input type="number" value={s.order} onChange={(e) => set("order", e.target.value)} />
        </Field>
      </div>
      <div className="row-gap">
        <Toggle checked={s.available !== false} onChange={(v) => set("available", v)} label="متوفر" />
        <Toggle checked={s.visible !== false} onChange={(v) => set("visible", v)} label="ظاهر بالمتجر" />
        <Toggle checked={!!s.featured} onChange={(v) => set("featured", v)} label="مميّز (أول الأكثر مبيعاً + بالمساحة الإعلانية)" />
      </div>

      <div className="he-box flash-box">
        <b>⏱️ عرض بوقت محدد</b>
        <p className="small-text muted">سعر مخفّض لمدة معيّنة، مع عدّاد تنازلي بالمتجر. لما يخلص الوقت، السعر بيرجع لحاله.</p>
        <div className="form-grid">
          <Field label={`سعر العرض (السعر الحالي ${money(price)} ₪)`}>
            <input type="number" min={0} value={s.flashPrice} onChange={(e) => set("flashPrice", e.target.value)} placeholder="مثلاً 99" />
          </Field>
          <Field label="المدة">
            <select
              value=""
              onChange={(e) => e.target.value && set("flashUntil", Date.now() + Number(e.target.value) * 3600_000)}
            >
              <option value="">{Number(s.flashUntil) > Date.now() ? `شغّال لحد ${new Date(Number(s.flashUntil)).toLocaleString("ar-EG", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "اختار المدة"}</option>
              <option value="6">6 ساعات</option>
              <option value="12">12 ساعة</option>
              <option value="24">24 ساعة</option>
              <option value="48">48 ساعة</option>
              <option value="72">3 أيام</option>
            </select>
          </Field>
        </div>
        {Number(s.flashUntil) > Date.now() && (
          <button type="button" className="btn small danger-outline" onClick={() => setS((x) => ({ ...x, flashUntil: 0, flashPrice: "" }))}>
            إلغاء العرض
          </button>
        )}
        {Number(s.flashPrice) > 0 && Number(s.flashPrice) >= price && <div className="err-text">سعر العرض لازم يكون أقل من السعر الحالي</div>}
      </div>

      {others.length > 0 && (
        <Field label="منتجات بتلبق معه (بتبين تحته)">
          <div className="chips">
            {others.slice(0, 80).map((o) => (
              <button
                type="button"
                key={o.id}
                className={"chip" + (s.related.includes(o.id) ? " active" : "")}
                onClick={() => set("related", s.related.includes(o.id) ? s.related.filter((x) => x !== o.id) : [...s.related, o.id])}
              >
                {o.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="form-grid">
        <Field label="رابط المنتج بالتليجرام (إلك بس)">
          <input dir="ltr" value={s.tgLink} onChange={(e) => set("tgLink", e.target.value)} placeholder="https://t.me/..." />
        </Field>
        <Field label="ملاحظة خاصة (اسم المشرف، المخزن...)">
          <input value={s.privateNote} onChange={(e) => set("privateNote", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
