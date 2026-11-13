import { useState } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { fmtTs } from "../utils";
import { useQuery } from "./hooks";
import { Empty, Panel, Tag } from "./ui";

const LEVELS = { ok: ["نجاح", "ok"], info: ["معلومة", "info"], warn: ["تنبيه", "wait"], error: ["خطأ", "bad"] };

export default function Logs() {
  const [worker, setWorker] = useState("");
  const [level, setLevel] = useState("");
  const [rows, loading] = useQuery(
    () => query(collection(db, "logs"), ...(worker ? [where("worker", "==", worker)] : []), orderBy("ts", "desc"), limit(300)),
    [worker]
  );
  const shown = rows.filter((r) => !level || r.level === level);

  return (
    <div className="page">
      <Panel title="سجل الأحداث">
        <p className="small-text muted">الأحداث المهمة من العاملين (آخر 3 أيام). التفاصيل الكاملة بتظهر على شاشة Termux.</p>
        <div className="filters">
          <select value={worker} onChange={(e) => setWorker(e.target.value)}>
            <option value="">كل العمّال</option>
            <option value="wa">واتساب</option>
            <option value="tg">تيليجرام</option>
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">كل الأنواع</option>
            {Object.entries(LEVELS).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {loading && !rows.length ? (
          <Empty>جاري التحميل...</Empty>
        ) : !shown.length ? (
          <Empty>ما في أحداث</Empty>
        ) : (
          <ul className="log-list">
            {shown.map((l) => (
              <li key={l.id} className={`lv-${l.level}`}>
                <span className="log-time">{fmtTs(l.ts)}</span>
                <Tag kind={l.worker === "wa" ? "ok" : "info"}>{l.worker === "wa" ? "واتساب" : "تيليجرام"}</Tag>
                <Tag kind={LEVELS[l.level]?.[1]}>{LEVELS[l.level]?.[0] || l.level}</Tag>
                <span className="log-msg">{l.msg}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
