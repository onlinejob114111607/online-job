import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { fmtTs } from "../../utils";
import { useAdmin } from "../hooks";
import { Empty, Progress, Tag } from "../ui";
import { P_STATUS } from "./waShared";

function targetLabel(p) {
  if (p.target === "category") return `تصنيف: ${p.category}`;
  if (p.target === "selected") return `${(p.groupIds || []).length} مجموعة مختارة`;
  return "كل المجموعات";
}

export default function Posts({ posts, onCopy }) {
  if (!posts.length) return <Empty>ما في منشورات لهالحساب لسا</Empty>;
  return (
    <div className="list">
      {posts.map((p) => (
        <PostItem key={p.id} p={p} onCopy={onCopy} />
      ))}
    </div>
  );
}

function PostItem({ p, onCopy }) {
  const { toast } = useAdmin();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [results, setResults] = useState([]);
  const [label, cls] = P_STATUS[p.status] || [p.status, ""];
  const total = p.total || 0;
  const sent = p.sent || 0;
  const failed = p.failed || 0;
  const pct = (x) => (total ? (x / total) * 100 : 0);
  const active = ["scheduled", "queued", "sending"].includes(p.status);
  const ref = doc(db, "wa_posts", p.id);

  useEffect(() => {
    if (!open) return undefined;
    return onSnapshot(query(collection(db, "wa_posts", p.id, "results"), orderBy("at", "desc")), (s) => setResults(s.docs.map((d) => d.data())));
  }, [open, p.id]);

  async function remove() {
    if (!confirm("حذف المنشور وسجله؟")) return;
    const docs = (await getDocs(collection(db, "wa_posts", p.id, "results"))).docs;
    for (let i = 0; i < docs.length; i += 400) {
      const b = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
    await deleteDoc(ref);
  }

  return (
    <div className="item">
      <div className="item-head">
        <div className="item-meta">
          <Tag kind={cls}>{label}</Tag>
          {p.repeat === "daily" && <Tag kind="info">يومي</Tag>}
          {p.track && <Tag kind="ok">متتبع</Tag>}
          <span>{targetLabel(p)}</span>
        </div>
        <div className="item-actions">
          <button className="icon-btn txt" onClick={() => setOpen((v) => !v)}>
            {open ? "إخفاء" : "التفاصيل"}
          </button>
          <button
            className="icon-btn txt"
            onClick={() => {
              onCopy(p.text);
              toast("تم نسخ النص لمنشور جديد");
            }}
          >
            نسخ
          </button>
          {active ? (
            <button
              className="icon-btn txt"
              onClick={() => confirm(p.repeat === "daily" ? "إلغاء المنشور وإيقاف التكرار اليومي؟" : "إلغاء المنشور؟") && updateDoc(ref, { status: "cancelled", note: null })}
            >
              إلغاء
            </button>
          ) : (
            <button className="icon-btn txt" onClick={remove}>
              حذف
            </button>
          )}
        </div>
      </div>
      <div className={"post-text" + (expanded ? " open" : "")} onClick={() => setExpanded((v) => !v)}>
        {p.text}
      </div>
      {total > 0 && (
        <Progress
          parts={[
            [pct(sent), "s"],
            [pct(failed), "f"],
          ]}
        />
      )}
      <div className="item-meta">
        {total > 0 && (
          <span>
            انبعت {sent} من {total}
          </span>
        )}
        {failed > 0 && <span className="err-text">فشل {failed}</span>}
        {p.status === "scheduled" && <span>موعده: {fmtTs(p.scheduledAt)}</span>}
        {p.finishedAt ? <span>خلص: {fmtTs(p.finishedAt)}</span> : <span>{fmtTs(p.createdAt)}</span>}
        {p.note && <span className="warn-text">{p.note}</span>}
      </div>
      {open && (
        <div className="results">
          {results.length ? (
            results.map((r, i) => (
              <div key={i}>
                <span>{r.groupName}</span>
                <span className={r.status === "sent" ? "ok-text" : "err-text"}>{r.status === "sent" ? "انبعت" : r.error || "فشل"}</span>
              </div>
            ))
          ) : (
            <span className="muted">ما في نتائج لسا</span>
          )}
        </div>
      )}
    </div>
  );
}
