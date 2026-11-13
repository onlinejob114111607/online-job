import { useState } from "react";
import { deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { fmtAgo } from "../../utils";
import { displayPhone, normPhone } from "../../store/shared";
import { useAdmin, useQuery } from "../hooks";
import { Empty, Field, Panel } from "../ui";
import { blCol, blacklistAdd } from "./shared";

export function Blacklist() {
  const { toast } = useAdmin();
  const [rows, loading] = useQuery(() => query(blCol, orderBy("createdAt", "desc")), []);
  const [ph, setPh] = useState("");
  const [why, setWhy] = useState("");
  async function add() {
    const p = normPhone(ph);
    if (!p) return toast("رقم غير صحيح (مثال: 0591234567)", "bad");
    await blacklistAdd([p], null, why.trim() || "حظر يدوي").then(() => (setPh(""), setWhy(""), toast("انحظر ✓", "ok"))).catch((e) => toast("فشل: " + e.message, "bad"));
  }
  return (
    <Panel title={`القائمة السوداء (${rows.length})`}>
      <p className="small-text muted">الأرقام هون ما بتقدر تبعت طلب من المتجر (الطلب بيترفض لحاله). لما تعلّم طلب «راجع» بيسألك إذا بدك تحظر الرقم.</p>
      <div className="form-grid">
        <Field label="رقم جوال">
          <input dir="ltr" value={ph} onChange={(e) => setPh(e.target.value)} placeholder="0591234567" />
        </Field>
        <Field label="السبب (اختياري)">
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="رفض الاستلام مرتين" />
        </Field>
      </div>
      <button className="btn small primary" onClick={add} disabled={!ph.trim()}>
        حظر
      </button>
      {loading && !rows.length ? (
        <Empty>جاري التحميل...</Empty>
      ) : !rows.length ? (
        <Empty>ما في أرقام محظورة</Empty>
      ) : (
        <div className="list" style={{ marginTop: 12 }}>
          {rows.map((r) => (
            <div key={r.id} className="item">
              <div className="item-head">
                <div className="item-title">
                  <b dir="ltr">{displayPhone(r.phone || r.id)}</b> {r.name && <span className="muted">— {r.name}</span>}
                </div>
                <button className="btn small" onClick={() => confirm("تشيل الحظر عن الرقم؟") && deleteDoc(doc(blCol, r.id)).catch((e) => toast(e.message, "bad"))}>
                  شيل الحظر
                </button>
              </div>
              <div className="item-meta">
                <span>{r.reason}</span>
                {r.code && <span className="m-code">#{r.code}</span>}
                <span className="muted">{fmtAgo(r.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
