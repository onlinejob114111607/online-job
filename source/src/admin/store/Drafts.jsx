import { useState } from "react";
import { deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { money, normOptions } from "../../store/shared";
import { useAdmin } from "../hooks";
import { Empty, Panel, Tag } from "../ui";
import { publishCatalog } from "./shared";
import { ProductModal } from "./Products";

export function Drafts({ drafts, products, pub, priv }) {
  const { toast } = useAdmin();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState("");

  async function publishOne(p) {
    setBusy(p.id);
    try {
      const patch = { status: "live", visible: true, updatedAt: serverTimestamp() };
      await updateDoc(doc(db, "store_products", p.id), patch);
      await publishCatalog([{ ...p, ...patch }, ...products], pub);
      toast("انتشر بالمتجر ✓", "ok");
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
    setBusy("");
  }
  async function remove(p) {
    if (!confirm(`حذف "${p.name}"؟`)) return;
    await deleteDoc(doc(db, "store_products", p.id)).catch((e) => toast("فشل: " + e.message, "bad"));
  }
  const ready = drafts.filter((p) => p.images?.length && p.price > 0);
  async function publishAll() {
    if (!confirm(`نشر ${ready.length} منتج (اللي فيهم صور) مرة وحدة؟ الأفضل تراجعهم قبل.`)) return;
    setBusy("all");
    try {
      const patch = { status: "live", visible: true };
      for (const p of ready) await updateDoc(doc(db, "store_products", p.id), patch);
      await publishCatalog([...ready.map((p) => ({ ...p, ...patch })), ...products], pub);
      toast(`انتشر ${ready.length} منتج ✓`, "ok");
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
    setBusy("");
  }

  return (
    <Panel
      title={`بانتظار المراجعة (${drafts.length})`}
      actions={
        ready.length > 1 && (
          <button className="btn small" disabled={busy === "all"} onClick={publishAll}>
            {busy === "all" ? "جاري..." : `نشر الكل (${ready.length})`}
          </button>
        )
      }
    >
      <p className="small-text muted">
        المنتجات اللي انسحبت من قنوات تيليجرام. راجع الاسم والسعر والصور، وعدّل لو بدك، وبعدين اكبس <b>نشر</b>. السعر = سعر القناة + الربح (+ ربحك الإضافي للقناة).
      </p>
      {!drafts.length ? (
        <Empty>ما في منتجات جديدة — فعّل الاستيراد من تبويب "قنوات تيليجرام"</Empty>
      ) : (
        <div className="list">
          {drafts.map((p) => (
            <div key={p.id} className="item draft-item">
              <div className="draft-imgs">
                {(p.images || []).slice(0, 5).map((u) => (
                  <img key={u} src={u} alt="" loading="lazy" />
                ))}
                {!p.images?.length && <div className="prod-ph">لا صور</div>}
              </div>
              <div className="item-head">
                <div className="item-title">
                  <b>{p.name}</b>
                  {p.nameEn && <div className="small-text muted" dir="ltr">{p.nameEn}</div>}
                </div>
                <b>{money(p.price)} ₪</b>
              </div>
              <div className="item-meta">
                <span className="muted">= {money(p.cost)} سعر القناة + {money(p.profit)} ربح</span>
                <select className="quick-cat" value={p.category || ""} onChange={(e) => updateDoc(doc(db, "store_products", p.id), { category: e.target.value }).catch((er) => toast("فشل: " + er.message, "bad"))} title="غيّر القسم">
                  <option value="">— بدون قسم —</option>
                  {[...new Set([...pub.categories, p.category].filter(Boolean))].map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
                {p.source?.title && <Tag>{p.source.title}</Tag>}
                {normOptions(p.options).map((g) => (
                  <Tag key={g.label}>
                    {g.label}: {g.values.join("، ")}
                  </Tag>
                ))}
                {p.tgLink && (
                  <a href={p.tgLink} target="_blank" rel="noreferrer" className="small-text">
                    المنشور الأصلي ↗
                  </a>
                )}
              </div>
              {p.features?.length > 0 && <div className="small-text">{p.features.slice(0, 5).join(" · ")}</div>}
              <div className="btn-row">
                <button className="btn small primary" disabled={busy === p.id || !p.images?.length} onClick={() => publishOne(p)}>
                  {busy === p.id ? "جاري..." : "نشر"}
                </button>
                <button className="btn small" onClick={() => setEdit(p)}>
                  تعديل ثم نشر
                </button>
                <button className="btn small danger-outline" onClick={() => remove(p)}>
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <ProductModal p={edit} products={[...products, edit]} pub={pub} priv={priv} onClose={() => setEdit(null)} />}
    </Panel>
  );
}
