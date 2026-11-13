import { useState } from "react";
import { collection, deleteDoc, doc, limit, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { fmtAgo } from "../../utils";
import { useAdmin, useQuery } from "../hooks";
import { Empty, Panel } from "../ui";
import { publishCatalog } from "./shared";

export function Reviews({ products, pub }) {
  const { toast } = useAdmin();
  const [rows, loading] = useQuery(() => query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(200)), []);
  const [f, setF] = useState("pending");
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const shown = rows.filter((r) => (f === "pending" ? !r.approved : r.approved));
  async function act(r, patch) {
    try {
      if (patch === "delete") await deleteDoc(doc(db, "reviews", r.id));
      else await updateDoc(doc(db, "reviews", r.id), patch);
      await publishCatalog(products, pub);
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
  }
  return (
    <Panel title="تقييمات الزبائن">
      <p className="small-text muted">
        الزبون بيقيّم بس من رابط بيوصله بعد ما يستلم الطلب (زر «اطلب تقييم» جوا الطلب). التقييم ما بيبين بالمتجر إلا لما توافق عليه. التقييمات الحقيقية بتبني ثقة، فوافق على كل تقييم صادق حتى لو مش 5 نجوم.
      </p>
      <div className="chips">
        <button className={"chip" + (f === "pending" ? " active" : "")} onClick={() => setF("pending")}>
          بانتظار موافقتك {rows.filter((r) => !r.approved).length}
        </button>
        <button className={"chip" + (f === "approved" ? " active" : "")} onClick={() => setF("approved")}>
          منشورة {rows.filter((r) => r.approved).length}
        </button>
      </div>
      {loading && !rows.length ? (
        <Empty>جاري التحميل...</Empty>
      ) : !shown.length ? (
        <Empty>ما في تقييمات هون</Empty>
      ) : (
        <div className="list">
          {shown.map((r) => (
            <div key={r.id} className="item">
              <div className="item-head">
                <div className="item-title">
                  <span className="stars-txt">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span> <b>{r.name}</b>
                </div>
                <span className="muted small-text">{fmtAgo(r.createdAt)}</span>
              </div>
              <div className="small-text muted">{byId[r.productId]?.name || "منتج محذوف"}</div>
              {r.text && <div className="conv-last">{r.text}</div>}
              <div className="btn-row">
                {!r.approved ? (
                  <button className="btn small primary" onClick={() => act(r, { approved: true })}>
                    موافقة ونشر
                  </button>
                ) : (
                  <button className="btn small" onClick={() => act(r, { approved: false })}>
                    إخفاء
                  </button>
                )}
                <button className="btn small danger-outline" onClick={() => confirm("حذف التقييم؟") && act(r, "delete")}>
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
