import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAdmin, useQuery } from "../hooks";
import { Empty, Panel } from "../ui";

export default function Templates({ onUse }) {
  const { toast } = useAdmin();
  const [rows, loading] = useQuery(() => query(collection(db, "templates"), orderBy("createdAt", "desc")), []);
  const [edit, setEdit] = useState(null); // {id?, title, text}

  async function save(e) {
    e.preventDefault();
    const title = edit.title.trim();
    const text = edit.text.trim();
    if (!title || !text) return toast("الاسم والنص مطلوبين", "bad");
    if (edit.id) await updateDoc(doc(db, "templates", edit.id), { title, text });
    else await addDoc(collection(db, "templates"), { title, text, createdAt: serverTimestamp() });
    setEdit(null);
    toast("انحفظ ✓", "ok");
  }

  return (
    <div className="page">
      <Panel
        title="قوالب المنشورات"
        actions={
          !edit && (
            <button className="btn primary small" onClick={() => setEdit({ title: "", text: "" })}>
              + قالب جديد
            </button>
          )
        }
      >
        <p className="small-text muted">احفظ صيغ المنشورات اللي بتستعملها كتير، واستعملها بضغطة من صفحة النشر.</p>
        {edit && (
          <form className="settings-box" onSubmit={save}>
            <div className="field">
              <label>اسم القالب</label>
              <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={60} autoFocus />
            </div>
            <div className="field">
              <label>النص</label>
              <textarea rows={7} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
            </div>
            <div className="btn-row">
              <button className="btn primary small">حفظ</button>
              <button type="button" className="btn small" onClick={() => setEdit(null)}>
                إلغاء
              </button>
            </div>
          </form>
        )}
      </Panel>

      {loading ? null : !rows.length ? (
        <Empty>ما في قوالب لسا</Empty>
      ) : (
        <div className="list">
          {rows.map((t) => (
            <div className="item" key={t.id}>
              <div className="item-head">
                <div className="item-title">{t.title}</div>
                <div className="item-actions">
                  <button className="icon-btn txt" onClick={() => onUse(t.text)}>
                    استعمل
                  </button>
                  <button className="icon-btn txt" onClick={() => setEdit({ id: t.id, title: t.title, text: t.text })}>
                    تعديل
                  </button>
                  <button className="icon-btn txt" onClick={() => confirm(`حذف قالب "${t.title}"؟`) && deleteDoc(doc(db, "templates", t.id))}>
                    حذف
                  </button>
                </div>
              </div>
              <div className="post-text">{t.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
