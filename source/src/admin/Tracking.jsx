import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAdmin } from "./hooks";
import { Empty, HBars, Panel } from "./ui";

const SRC_RE = /^([a-z0-9]{6})-([a-z0-9]{6})$/;

async function fetchIn(col, field, values) {
  const out = [];
  const list = [...values];
  for (let i = 0; i < list.length; i += 30) {
    const snap = await getDocs(query(collection(db, col), where(field, "in", list.slice(i, i + 30))));
    snap.docs.forEach((d) => out.push({ id: d.id, ...d.data() }));
  }
  return out;
}

export default function Tracking({ rows }) {
  const { app, waAccounts } = useAdmin();
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  const tracked = useMemo(
    () =>
      rows
        .map((r) => {
          const m = SRC_RE.exec(r.utm || "");
          return m ? { ...r, pk: m[1], gk: m[2] } : null;
        })
        .filter(Boolean),
    [rows]
  );
  const pks = useMemo(() => [...new Set(tracked.map((r) => r.pk))], [tracked]);
  const gks = useMemo(() => [...new Set(tracked.map((r) => r.gk))], [tracked]);

  useEffect(() => {
    let alive = true;
    if (!pks.length) {
      setPosts([]);
      setGroups([]);
      return undefined;
    }
    setLoading(true);
    Promise.all([fetchIn("wa_posts", "trackKey", pks), fetchIn("wa_groups", "k", gks)])
      .then(([p, g]) => {
        if (!alive) return;
        setPosts(p);
        setGroups(g);
      })
      .catch((e) => console.error(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pks.join(","), gks.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const accName = (id) => waAccounts.find((a) => a.id === id)?.name || "—";

  const byPost = useMemo(() => {
    const m = new Map();
    for (const r of tracked) {
      const e = m.get(r.pk) || { pk: r.pk, regs: 0, joined: 0 };
      e.regs++;
      if (r.status === "joined") e.joined++;
      m.set(r.pk, e);
    }
    for (const e of m.values()) {
      const ps = posts.filter((p) => p.trackKey === e.pk);
      const latest = ps.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0];
      e.text = latest?.text || "(منشور محذوف)";
      e.account = latest ? accName(latest.accountId) : "—";
      e.runs = ps.length;
      e.sent = ps.reduce((s, p) => s + (p.sent || 0), 0);
      e.target = latest?.target === "category" ? `تصنيف: ${latest.category}` : latest?.target === "selected" ? "اختيار يدوي" : latest ? "كل المجموعات" : "";
    }
    return [...m.values()].sort((a, b) => b.regs - a.regs);
  }, [tracked, posts]); // eslint-disable-line react-hooks/exhaustive-deps

  const byGroup = useMemo(() => {
    const m = new Map();
    for (const r of tracked) {
      const e = m.get(r.gk) || { gk: r.gk, regs: 0, joined: 0 };
      e.regs++;
      if (r.status === "joined") e.joined++;
      m.set(r.gk, e);
    }
    for (const e of m.values()) {
      const g = groups.find((x) => x.k === e.gk);
      e.name = g?.name || "(مجموعة محذوفة)";
      e.category = g?.category || "عام";
      e.account = g ? accName(g.accountId) : "—";
    }
    return [...m.values()].sort((a, b) => b.regs - a.regs);
  }, [tracked, groups]); // eslint-disable-line react-hooks/exhaustive-deps

  const byCat = useMemo(() => {
    const m = {};
    for (const g of byGroup) m[g.category] = (m[g.category] || 0) + g.regs;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [byGroup]);

  if (!app.siteUrl)
    return (
      <div className="alert warn">
        حط رابط موقع التسجيل من الإعدادات ← عام، وفعّل "رابط تتبع" لما تنشر. بعدها كل تسجيل بيجي من منشور بيبين هون مع المنشور والمجموعة اللي جابته.
      </div>
    );

  if (!tracked.length)
    return (
      <Empty>
        ما في تسجيلات جاية من منشورات متتبعة بهالفترة.
        <br />
        لما تنشر، خلّي خيار "أضف رابط تسجيل متتبع" مفعّل.
      </Empty>
    );

  return (
    <div className="page">
      <div className="alert info">
        {tracked.length} من {rows.length} تسجيل بهالفترة جاي من منشورات واتساب ({Math.round((tracked.length / Math.max(1, rows.length)) * 100)}%)
        {loading && " · جاري التحميل..."}
      </div>

      <Panel title="حسب المنشور">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>المنشور</th>
                <th>الحساب</th>
                <th>رسائل انبعتت</th>
                <th>تسجيلات</th>
                <th>انضم</th>
                <th>لكل 100 رسالة</th>
              </tr>
            </thead>
            <tbody>
              {byPost.map((p) => (
                <tr key={p.pk}>
                  <td data-label="المنشور">
                    <div className="post-snippet">{p.text}</div>
                    <div className="small-text muted">
                      {p.target}
                      {p.runs > 1 ? ` · انعاد ${p.runs} مرات` : ""}
                    </div>
                  </td>
                  <td data-label="الحساب">{p.account}</td>
                  <td data-label="رسائل انبعتت">{p.sent || "—"}</td>
                  <td data-label="تسجيلات">
                    <b>{p.regs}</b>
                  </td>
                  <td data-label="انضم">{p.joined}</td>
                  <td data-label="لكل 100 رسالة">{p.sent ? ((p.regs / p.sent) * 100).toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid-2col">
        <Panel title="أكتر المجموعات اللي بتجيب تسجيلات">
          <table className="mini-table">
            <thead>
              <tr>
                <th>المجموعة</th>
                <th>التصنيف</th>
                <th>تسجيلات</th>
                <th>انضم</th>
              </tr>
            </thead>
            <tbody>
              {byGroup.slice(0, 50).map((g) => (
                <tr key={g.gk}>
                  <td>
                    {g.name}
                    <div className="small-text muted">{g.account}</div>
                  </td>
                  <td>{g.category}</td>
                  <td>
                    <b>{g.regs}</b>
                  </td>
                  <td>{g.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="حسب تصنيف المجموعات">
          <HBars items={byCat} total={tracked.length} />
        </Panel>
      </div>
    </div>
  );
}
