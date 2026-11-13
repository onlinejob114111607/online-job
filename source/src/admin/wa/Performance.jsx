// ============================================================
//  أداء المنشورات: رسائل ← ضغطات على الرابط ← تسجيلات
//  + تنظيف المجموعات الميتة (ما بتجيب ولا ضغطة)
// ============================================================
import { useMemo, useState } from "react";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { fmtAgo, toMs } from "../../utils";
import { runCommand, useAdmin, useDocData, useQuery } from "../hooks";
import { Empty, Kpi, Panel, Tag } from "../ui";

const SRC_RE = /^([a-z0-9]{6})-([a-z0-9]{6})$/;
async function fetchIn(col, field, values) {
  const out = [];
  const list = [...new Set(values)].filter(Boolean);
  for (let i = 0; i < list.length; i += 30) {
    const snap = await getDocs(query(collection(db, col), where(field, "in", list.slice(i, i + 30))));
    snap.docs.forEach((d) => out.push({ id: d.id, ...d.data() }));
  }
  return out;
}
const rate = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export default function Performance({ acc, posts, groups }) {
  const { toast, workers } = useAdmin();
  const [data, setData] = useState(null); // { clicks, regs }
  const [busy, setBusy] = useState(false);
  const [minMembers, setMinMembers] = useState(25);
  const [minPosts, setMinPosts] = useState(8);
  const [picked, setPicked] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const tracked = useMemo(() => posts.filter((p) => p.trackKey), [posts]);
  async function load() {
    setBusy(true);
    try {
      const pks = tracked.map((p) => p.trackKey);
      const gks = groups.map((g) => g.k).filter(Boolean);
      const [byPk, byGk] = await Promise.all([fetchIn("track_clicks", "pk", pks), fetchIn("track_clicks", "gk", gks)]);
      const clicks = new Map();
      for (const c of [...byPk, ...byGk]) clicks.set(c.id, c);
      // التسجيلات اللي جاية من منشورات الحساب (آخر 30 يوم)
      const since = new Date(Date.now() - 30 * 86_400_000);
      const rs = await getDocs(query(collection(db, "registrations"), where("createdAt", ">=", since)));
      const regs = rs.docs.map((d) => d.data()).filter((r) => SRC_RE.test(r.utm || ""));
      setData({ clicks: [...clicks.values()], regs });
      setPicked(null);
    } catch (e) {
      toast("فشل التحميل: " + e.message, "bad");
    }
    setBusy(false);
  }

  const perPost = useMemo(() => {
    if (!data) return [];
    const m = new Map();
    for (const p of tracked) {
      const e = m.get(p.trackKey) || { pk: p.trackKey, text: p.text, runs: 0, sent: 0, failed: 0, skipped: 0, last: 0, clicks: 0, regs: 0, joined: 0 };
      e.runs++;
      e.sent += p.sent || 0;
      e.failed += p.failed || 0;
      e.skipped += p.skipped || 0;
      e.last = Math.max(e.last, toMs(p.createdAt));
      e.variants = Math.max(e.variants || 1, 1 + (p.variants?.length || 0));
      m.set(p.trackKey, e);
    }
    for (const c of data.clicks) if (m.has(c.pk)) m.get(c.pk).clicks += c.n || 0;
    for (const r of data.regs) {
      const pk = SRC_RE.exec(r.utm)[1];
      if (m.has(pk)) {
        m.get(pk).regs++;
        if (r.status === "joined") m.get(pk).joined++;
      }
    }
    return [...m.values()].sort((a, b) => b.last - a.last);
  }, [data, tracked]);

  const perGroup = useMemo(() => {
    if (!data) return new Map();
    const m = new Map();
    for (const c of data.clicks) m.set(c.gk, (m.get(c.gk) || 0) + (c.n || 0));
    return m;
  }, [data]);
  const regsByGroup = useMemo(() => {
    const m = new Map();
    for (const r of data?.regs || []) {
      const gk = SRC_RE.exec(r.utm)[2];
      m.set(gk, (m.get(gk) || 0) + 1);
    }
    return m;
  }, [data]);

  // المجموعات الميتة
  const dead = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const g of groups) {
      if (g.status !== "joined" && !g.health) continue;
      const why = [];
      if (g.health === "blocked") why.push("للمشرفين بس / انطردت");
      else if (g.health === "failing") why.push("الإرسال بيفشل");
      if (g.participants > 0 && g.participants < minMembers) why.push(`${g.participants} عضو بس`);
      if ((g.postCount || 0) >= minPosts && !perGroup.get(g.k) && !regsByGroup.get(g.k)) why.push(`${g.postCount} منشور وولا ضغطة`);
      if (why.length) out.push({ g, why });
    }
    return out;
  }, [data, groups, minMembers, minPosts, perGroup, regsByGroup]);
  const sel = picked || new Set(dead.map((x) => x.g.id));

  async function leave() {
    const ids = dead.filter((x) => sel.has(x.g.id)).map((x) => x.g.id);
    if (!ids.length) return;
    if (!confirm(`الرقم رح يطلع من ${ids.length} مجموعة ويحذفها من القائمة (وحدة وحدة بهدوء). متأكد؟`)) return;
    setLeaving(true);
    try {
      const r = await runCommand("wa", "leave_groups", { accountId: acc.id, groupIds: ids }, { timeout: 120_000 });
      toast(`بلّش التنظيف: ${r?.queued || 0} مجموعة — بيكمل لحاله`, "ok", 5000);
      setPicked(new Set());
    } catch (e) {
      toast(e.message, "bad");
    }
    setLeaving(false);
  }

  const tot = perPost.reduce((t, p) => ({ sent: t.sent + p.sent, clicks: t.clicks + p.clicks, regs: t.regs + p.regs }), { sent: 0, clicks: 0, regs: 0 });
  const best = [...perPost].filter((p) => p.sent >= 20).sort((a, b) => rate(b.clicks, b.sent) - rate(a.clicks, a.sent))[0];

  return (
    <div className="page">
      <Panel
        title={`أداء المنشورات — ${acc.name}`}
        actions={
          <button className="btn small primary" onClick={load} disabled={busy}>
            {busy ? "جاري..." : data ? "تحديث" : "اعرض الأداء"}
          </button>
        }
      >
        {!tracked.length ? (
          <Empty>لما تنشر مع «رابط تتبع» مفعّل، هون بتشوف كم رسالة انبعتت، كم واحد ضغط عالرابط، وكم واحد سجّل من كل منشور.</Empty>
        ) : !data ? (
          <p className="small-text muted">اكبس «اعرض الأداء» (بيقرأ الضغطات والتسجيلات مرة وحدة عشان ما يستهلك من حصة Firebase).</p>
        ) : (
          <>
            <div className="kpis">
              <Kpi label="رسائل انبعتت" value={tot.sent} color="#2563eb" />
              <Kpi label="ضغطات عالرابط" value={tot.clicks} sub={`${rate(tot.clicks, tot.sent)} لكل 100 رسالة`} color="#7c3aed" />
              <Kpi label="تسجيلات" value={tot.regs} sub={`${rate(tot.regs, tot.clicks)}٪ من اللي ضغطوا`} color="#059669" />
            </div>
            {best && (
              <div className="alert info">
                🏆 أحسن منشور: {rate(best.clicks, best.sent)} ضغطة لكل 100 رسالة — <span className="post-snippet inline">{best.text.slice(0, 80)}</span>
              </div>
            )}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>المنشور</th>
                    <th>رسائل</th>
                    <th>ضغطات</th>
                    <th>لكل 100</th>
                    <th>تسجيلات</th>
                  </tr>
                </thead>
                <tbody>
                  {perPost.map((p) => (
                    <tr key={p.pk}>
                      <td data-label="المنشور">
                        <div className="post-snippet">{p.text}</div>
                        <div className="small-text muted">
                          {fmtAgo(p.last)}
                          {p.runs > 1 ? ` · انعاد ${p.runs} مرات` : ""}
                          {p.variants > 1 ? ` · ${p.variants} نسخ` : ""}
                          {p.failed ? ` · فشل ${p.failed}` : ""}
                          {p.skipped ? ` · اتخطى ${p.skipped}` : ""}
                        </div>
                      </td>
                      <td data-label="رسائل">{p.sent}</td>
                      <td data-label="ضغطات">
                        <b>{p.clicks}</b>
                      </td>
                      <td data-label="لكل 100">{rate(p.clicks, p.sent)}</td>
                      <td data-label="تسجيلات">
                        {p.regs}
                        {p.joined ? <span className="small-text muted"> ({p.joined} انضم)</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small-text muted">الضغطة بتنحسب مرة وحدة لكل زائر. بتشتغل للمنشورات الجديدة بعد التحديث.</p>
          </>
        )}
      </Panel>

      {data && (
        <Panel
          title={`🧹 المجموعات الميتة (${dead.length})`}
          actions={
            dead.length > 0 && (
              <button className="btn small danger-outline" onClick={leave} disabled={leaving || !sel.size || !workers.waOnline}>
                {leaving ? "جاري..." : `اطلع منها واحذفها (${[...sel].filter((id) => dead.some((x) => x.g.id === id)).length})`}
              </button>
            )
          }
        >
          <div className="form-grid">
            <label className="field">
              <span>أقل عدد أعضاء</span>
              <input type="number" min={0} value={minMembers} onChange={(e) => (setMinMembers(Number(e.target.value) || 0), setPicked(null))} />
            </label>
            <label className="field">
              <span>منشورات بدون ولا ضغطة</span>
              <input type="number" min={1} value={minPosts} onChange={(e) => (setMinPosts(Math.max(1, Number(e.target.value) || 1)), setPicked(null))} />
            </label>
          </div>
          {!dead.length ? (
            <Empty>👌 ما في مجموعات ميتة بهالشروط</Empty>
          ) : (
            <div className="list">
              {dead.map(({ g, why }) => (
                <label key={g.id} className="item check-item">
                  <input
                    type="checkbox"
                    checked={sel.has(g.id)}
                    onChange={(e) => {
                      const n = new Set(sel);
                      e.target.checked ? n.add(g.id) : n.delete(g.id);
                      setPicked(n);
                    }}
                  />
                  <div>
                    <b>{g.name || g.inviteCode || "مجموعة"}</b>
                    <div className="item-meta">
                      {why.map((w) => (
                        <Tag key={w} kind="bad">
                          {w}
                        </Tag>
                      ))}
                      {g.participants ? <span className="muted">{g.participants} عضو</span> : null}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
          <p className="small-text muted">الخروج بيصير وحدة وحدة (كل كم ثانية) عشان ما ينحظر الرقم. «ولا ضغطة» بتنحسب من المنشورات المتتبعة بس.</p>
        </Panel>
      )}
      <ABPanel posts={tracked} />
      <BestHours />
      <Replies acc={acc} />
    </div>
  );
}

// ---------- اختبار النصوص (A/B) ----------
function ABPanel({ posts }) {
  const { toast } = useAdmin();
  const withV = posts.filter((p) => (p.variants || []).some((x) => String(x || "").trim()) && p.sent > 0).slice(0, 8);
  const [calc, setCalc] = useState({});
  const [busy, setBusy] = useState("");
  if (!withV.length) return null;
  async function run(p) {
    setBusy(p.id);
    try {
      const res = await getDocs(query(collection(db, "wa_posts", p.id, "results"), where("status", "==", "sent")));
      const clicks = new Map();
      (await getDocs(query(collection(db, "track_clicks"), where("pk", "==", p.trackKey)))).docs.forEach((d) => clicks.set(d.data().gk, d.data().n || 0));
      const n = 1 + p.variants.length;
      const st = Array.from({ length: n }, () => ({ sent: 0, clicks: 0 }));
      res.docs.forEach((d) => {
        const r = d.data();
        if (r.v != null && st[r.v]) {
          st[r.v].sent++;
          st[r.v].clicks += clicks.get(r.gk) || 0;
        }
      });
      setCalc((c) => ({ ...c, [p.id]: st }));
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy("");
  }
  return (
    <Panel title="🧪 اختبار النصوص (أي نسخة بتجيب ضغطات أكتر)">
      <p className="small-text muted">بالمنشورات اللي إلها نسخ بديلة: كل مجموعة بتاخد نسخة. بالتكرار اليومي، لما نسخة تتفوق بوضوح (30% أكتر وعلى الأقل 15 مجموعة لكل نسخة) بتصير تنبعت لـ 70% من المجموعات لحالها، وبيوصلك تنبيه.</p>
      <div className="list">
        {withV.map((p) => {
          const st = calc[p.id] || p.ab?.stats;
          const win = p.ab?.winner;
          return (
            <div key={p.id} className="item">
              <div className="row-between">
                <div className="post-snippet">{p.text}</div>
                <button className="btn small" disabled={!!busy} onClick={() => run(p)}>
                  {busy === p.id ? "جاري..." : "احسب"}
                </button>
              </div>
              {st && (
                <div className="ab-bars">
                  {st.map((x, i) => {
                    const ctr = x.sent ? (x.clicks / x.sent) * 100 : 0;
                    const max = Math.max(...st.map((y) => (y.sent ? (y.clicks / y.sent) * 100 : 0)), 0.1);
                    return (
                      <div key={i} className={"ab-row" + (win === i ? " win" : "")}>
                        <span>نسخة {i + 1}{win === i ? " 🏆" : ""}</span>
                        <div className="ab-bar">
                          <i style={{ width: `${(ctr / max) * 100}%` }} />
                        </div>
                        <small>
                          {x.clicks} ضغطة / {x.sent} · {ctr.toFixed(1)}%
                        </small>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------- أفضل وقت ----------
const hLabel = (h) => `${h % 12 || 12} ${h < 12 ? "ص" : "م"}`;
function BestHours() {
  const best = useDocData("wa_stats/best_hours");
  if (!best) return (
    <Panel title="⏰ أفضل وقت للنشر">
      <Empty>بينحسب لحاله كل 3 أيام من الضغطات والتسجيلات — بيبين بعد ما يصير في كم منشور متتبَّع.</Empty>
    </Panel>
  );
  const rows = Object.entries(best.byCat || {}).filter(([, v]) => v.samples > 0).sort((a, b) => b[1].samples - a[1].samples);
  return (
    <Panel title="⏰ أفضل وقت للنشر (توقيت مصر)">
      {best.all?.hour != null && <div className="alert info">بشكل عام أحسن وقت: <b>{hLabel(best.all.hour)}</b> — خيار «انشر بأفضل وقت» بالنشر بيقسم المنشور حسب التصنيف وبيبعت كل قسم بوقته.</div>}
      <div className="table-wrap">
        <table className="mini-table">
          <thead>
            <tr>
              <th>التصنيف</th>
              <th>أحسن وقت</th>
              <th>الساعات (ضغطات وتسجيلات)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([c, v]) => {
              const max = Math.max(1, ...Object.values(v.hours || {}));
              return (
                <tr key={c}>
                  <td>{c}</td>
                  <td>
                    <b>{v.hour != null ? hLabel(v.hour) : "بيانات قليلة"}</b>
                  </td>
                  <td>
                    <div className="hour-strip">
                      {Array.from({ length: 24 }, (_, h) => (
                        <i key={h} title={`${hLabel(h)}: ${v.hours?.[h] || 0}`} style={{ opacity: 0.12 + ((v.hours?.[h] || 0) / max) * 0.88 }} className={h === v.hour ? "best" : ""} />
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small-text muted">آخر حساب: {fmtAgo(best.at)}</p>
    </Panel>
  );
}

// ---------- الردود على منشوراتك ----------
function Replies({ acc }) {
  const [rows] = useQuery(() => query(collection(db, "wa_replies"), orderBy("at", "desc"), limit(40)), []);
  const list = rows.filter((r) => !acc || r.accountId === acc.id);
  return (
    <Panel title={`💬 ردود وأسئلة على منشوراتك (${list.length})`}>
      <p className="small-text muted">لما حدا يرد على منشورك بمجموعة، أو يعملك منشن، أو يسأل «كم السعر / كيف بسجل» بعد منشورك، بيوصلك تنبيه عتيليجرام فيه رقمه — احكي معه خاص بسرعة.</p>
      {!list.length ? (
        <Empty>لسا ما في ردود</Empty>
      ) : (
        <div className="list">
          {list.map((r) => (
            <div key={r.id} className="item">
              <div className="row-between">
                <b>
                  {r.name}
                  {r.phone ? <span className="muted" dir="ltr"> +{r.phone}</span> : null}
                </b>
                <span className="small-text muted">{fmtAgo(r.at)}</span>
              </div>
              <div className="small-text muted">
                {r.kind} · {r.group}
              </div>
              <div className="conv-last">{r.text || "[صورة/ملف]"}</div>
              {r.phone && (
                <a className="btn small wa-solid" href={`https://wa.me/${r.phone}`} target="_blank" rel="noreferrer">
                  راسله واتساب
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
