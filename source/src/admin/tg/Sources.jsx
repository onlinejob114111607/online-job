import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, getCountFromServer, getDoc, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { fmtAgo } from "../../utils";
import { runCommand, useAdmin, useQuery } from "../hooks";
import { Empty, Panel, Tag, Toggle } from "../ui";
import { SRC_STATUS, parseSource } from "./tgShared";

export default function Sources() {
  const { tgAccounts, toast } = useAdmin();
  const [text, setText] = useState("");
  const [pref, setPref] = useState("");
  const [monitor, setMonitor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [rows, loading] = useQuery(() => query(collection(db, "tg_sources"), orderBy("created", "desc"), limit(1000)), []);

  const counts = useMemo(() => {
    const c = {};
    rows.forEach((r) => (c[r.status] = (c[r.status] || 0) + 1));
    return c;
  }, [rows]);
  const list = rows.filter((r) => !filter || r.status === filter);
  const accName = (id) => tgAccounts.find((a) => a.id === id)?.name || id;

  async function add(e) {
    e.preventDefault();
    await addList(text.split(/[\s,،]+/).filter(Boolean));
    setText("");
  }
  async function addList(parts) {
    let added = 0;
    let dup = 0;
    let bad = 0;
    setBusy(true);
    const seen = new Set();
    for (const p of parts) {
      const s = parseSource(p);
      if (!s) {
        bad++;
        continue;
      }
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const ref = doc(db, "tg_sources", s.id);
      try {
        const ex = await getDoc(ref);
        if (ex.exists()) {
          dup++;
          continue;
        }
        await setDoc(ref, {
          input: p.trim(),
          key: `${s.kind}:${s.val}`,
          title: null,
          chatId: null,
          status: "pending",
          accountId: null,
          accountPref: pref || null,
          monitor,
          scanned: 0,
          linksFound: 0,
          attempts: 0,
          error: null,
          created: serverTimestamp(),
          updated: serverTimestamp(),
        });
        added++;
      } catch (err) {
        console.error(err);
        bad++;
      }
    }
    setBusy(false);
    toast(`انضاف ${added}${dup ? ` · مكرر ${dup}` : ""}${bad ? ` · غير صالح ${bad}` : ""}`, added ? "ok" : "info", 4000);
  }

  async function retryFailed() {
    const failed = rows.filter((r) => r.status === "failed");
    if (!failed.length) return;
    const b = writeBatch(db);
    failed.forEach((r) => b.update(doc(db, "tg_sources", r.id), { status: "pending", attempts: 0, error: null, accountId: null }));
    await b.commit();
    toast(`رجع ${failed.length} مصدر للطابور`, "ok");
  }

  return (
    <div className="page">
      <Panel title="إضافة جروبات وقنوات تيليجرام">
        <form onSubmit={add}>
          <div className="field">
            <label>الروابط (سطر لكل رابط)</label>
            <textarea rows={5} dir="ltr" value={text} onChange={(e) => setText(e.target.value)} required placeholder={"https://t.me/groupname\n@channelname\nhttps://t.me/+AbCdEf123"} />
          </div>
          <div className="row-form">
            <select value={pref} onChange={(e) => setPref(e.target.value)}>
              <option value="">توزيع تلقائي على الحسابات</option>
              {tgAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.phone}
                </option>
              ))}
            </select>
            <label className="check-line">
              <input type="checkbox" checked={monitor} onChange={(e) => setMonitor(e.target.checked)} /> مراقبة حية بعد السحب
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? "جاري..." : "إضافة"}
            </button>
          </div>
        </form>
      </Panel>
      <Discover addList={addList} existing={rows} />
      <WaSources />

      <Panel
        title={`المصادر (${rows.length})`}
        actions={
          counts.failed ? (
            <button className="btn small" onClick={retryFailed}>
              إعادة الفاشل ({counts.failed})
            </button>
          ) : null
        }
      >
        <div className="chips">
          <button className={"chip" + (!filter ? " active" : "")} onClick={() => setFilter("")}>
            الكل {rows.length}
          </button>
          {Object.entries(SRC_STATUS).map(([k, [l]]) =>
            counts[k] ? (
              <button key={k} className={"chip" + (filter === k ? " active" : "")} onClick={() => setFilter(k)}>
                {l} {counts[k]}
              </button>
            ) : null
          )}
        </div>

        {loading ? null : !list.length ? (
          <Empty>ما في مصادر</Empty>
        ) : (
          <div className="list">
            {list.map((s) => {
              const [label, kind] = SRC_STATUS[s.status] || [s.status, ""];
              const ref = doc(db, "tg_sources", s.id);
              return (
                <div className="item" key={s.id}>
                  <div className="item-head">
                    <div className="item-title">
                      {s.title || <span dir="ltr">{s.input}</span>}
                    </div>
                    <div className="item-actions">
                      {["failed", "done", "duplicate"].includes(s.status) && (
                        <button
                          className="icon-btn txt"
                          title="إعادة السحب"
                          onClick={() => updateDoc(ref, { status: "pending", attempts: 0, error: null, accountId: null })}
                        >
                          {s.status === "done" ? "سحب من جديد" : "إعادة"}
                        </button>
                      )}
                      <button className="icon-btn txt" onClick={() => updateDoc(ref, { monitor: s.monitor === false })}>
                        {s.monitor === false ? "تشغيل المراقبة" : "إيقاف المراقبة"}
                      </button>
                      <button className="icon-btn txt" onClick={() => confirm("حذف المصدر؟ (الروابط اللي انسحبت منه بتضل)") && deleteDoc(ref)}>
                        حذف
                      </button>
                    </div>
                  </div>
                  <div className="item-meta">
                    <Tag kind={kind}>{label}</Tag>
                    {s.status === "done" && s.monitor !== false && <Tag kind="ok">🔴 مراقبة حية</Tag>}
                    {s.title && <span dir="ltr">{s.input}</span>}
                    {s.scanned ? <span>{s.scanned} رسالة</span> : null}
                    <span>{s.linksFound || 0} رابط</span>
                    {s.score && <ScoreTag sc={s.score} />}
                    {s.accountId && <span>الحساب: {accName(s.accountId)}</span>}
                    <select
                      className="mini-select"
                      value={s.accountPref || ""}
                      onChange={(e) => updateDoc(ref, { accountPref: e.target.value || null })}
                      title="حساب محدد لهاد المصدر"
                    >
                      <option value="">تلقائي</option>
                      {tgAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name || a.phone}
                        </option>
                      ))}
                    </select>
                    <span className="muted">{fmtAgo(s.updated || s.created)}</span>
                    {s.error && <span className="err-text">{s.error}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      <SourceScore rows={rows} />
    </div>
  );
}

// ---------- تقييم المصادر: كم رابط شغال، وكم واحد انضمينا إله ----------
const gradeOf = (sc) => (sc.total < 10 ? ["عينة صغيرة", ""] : sc.score >= 45 ? ["ممتاز 🟢", "ok"] : sc.score >= 20 ? ["متوسط 🟡", "wait"] : ["ضعيف 🔴", "bad"]);
function ScoreTag({ sc }) {
  const [l, k] = gradeOf(sc);
  return (
    <Tag kind={k} title={`${sc.active}/${sc.total} شغال · ${sc.joined} انضمام`}>
      {l} {sc.total >= 10 ? sc.score : ""}
    </Tag>
  );
}
function SourceScore({ rows }) {
  const { toast } = useAdmin();
  const [busy, setBusy] = useState("");
  const done = rows.filter((r) => r.status === "done");
  const scored = done.filter((r) => r.score).sort((a, b) => b.score.score - a.score.score);
  const weak = scored.filter((r) => r.score.total >= 10 && r.score.score < 20 && r.monitor !== false);

  async function run() {
    setBusy("run");
    let n = 0;
    try {
      for (const r of done) {
        const base = query(collection(db, "tg_links"), where("sourceId", "==", r.id));
        const [t, a, j] = await Promise.all([
          getCountFromServer(base),
          getCountFromServer(query(collection(db, "tg_links"), where("sourceId", "==", r.id), where("status", "==", "active"))),
          getCountFromServer(query(collection(db, "tg_links"), where("sourceId", "==", r.id), where("waStatus", "==", "joined"))),
        ]);
        const total = t.data().count;
        const active = a.data().count;
        const joined = j.data().count;
        // التقييم من 100: نص على نسبة الروابط الشغالة ونص على نسبة اللي انضمينا إلها
        const score = total ? Math.round((active / total) * 50 + Math.min(1, joined / total) * 50) : 0;
        await updateDoc(doc(db, "tg_sources", r.id), { score: { total, active, joined, score, at: Date.now() } });
        n++;
      }
      toast(`انحسب تقييم ${n} مصدر ✓`, "ok");
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
    setBusy("");
  }
  async function stopWeak() {
    if (!weak.length || !confirm(`إيقاف المراقبة الحية لـ ${weak.length} مصدر ضعيف؟ (الروابط اللي انسحبت بتضل)`)) return;
    setBusy("weak");
    const b = writeBatch(db);
    weak.forEach((r) => b.update(doc(db, "tg_sources", r.id), { monitor: false }));
    await b.commit().then(() => toast("تم ✓", "ok")).catch((e) => toast(e.message, "bad"));
    setBusy("");
  }
  if (!done.length) return null;
  return (
    <Panel
      title="⭐ تقييم المصادر"
      actions={
        <>
          {weak.length > 0 && (
            <button className="btn small danger-outline" disabled={!!busy} onClick={stopWeak}>
              وقف مراقبة الضعيفة ({weak.length})
            </button>
          )}
          <button className="btn small primary" disabled={!!busy} onClick={run}>
            {busy === "run" ? "جاري الحساب..." : scored.length ? "إعادة الحساب" : "احسب التقييم"}
          </button>
        </>
      }
    >
      <p className="small-text muted">التقييم من 100 = نص على نسبة الروابط الشغالة (بعد الفحص) ونص على نسبة الروابط اللي انضم إلها الواتساب فعلاً. المصدر الضعيف بيجيب روابط منتهية أو مجموعات سبام — وقف مراقبته ووفّر الانضمامات.</p>
      {!scored.length ? (
        <Empty>اكبس «احسب التقييم» (بيعدّ الروابط من غير ما يقرأها كلها)</Empty>
      ) : (
        <div className="table-wrap">
          <table className="mini-table">
            <thead>
              <tr>
                <th>المصدر</th>
                <th>روابط</th>
                <th>شغال</th>
                <th>انضمينا</th>
                <th>التقييم</th>
              </tr>
            </thead>
            <tbody>
              {scored.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.title || r.input}
                    {r.monitor === false && <span className="muted small-text"> · بدون مراقبة</span>}
                  </td>
                  <td>{r.score.total}</td>
                  <td>{r.score.total ? Math.round((r.score.active / r.score.total) * 100) : 0}٪</td>
                  <td>{r.score.joined}</td>
                  <td>
                    <ScoreTag sc={r.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------- اكتشاف مصادر جديدة: مقترحة من القنوات + بحث بكلمة ----------
function Discover({ addList, existing }) {
  const { toast, workers } = useAdmin();
  const [sugg] = useQuery(() => query(collection(db, "tg_suggest"), orderBy("mentions", "desc"), limit(60)), []);
  const have = useMemo(() => new Set(existing.map((r) => r.id)), [existing]);
  const list = sugg.filter((x) => x.status !== "ignored" && !have.has(x.id));
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  async function search(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await runCommand("tg", "tg_search", { q }, { timeout: 60_000 });
      setRes(r?.results || []);
    } catch (er) {
      toast(er.message, "bad");
    }
    setBusy(false);
  }
  async function addOne(ref, id) {
    await addList([ref]);
    if (id) await updateDoc(doc(db, "tg_suggest", id), { status: "added" }).catch(() => {});
  }
  return (
    <Panel title="🔭 اكتشاف مصادر جديدة">
      <form className="copy-row" onSubmit={search}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بتيليجرام: وظائف فلسطين، شغل اونلاين، بيع وشراء الخليل..." />
        <button className="btn small primary" disabled={busy || q.trim().length < 3 || !workers.tgOnline}>
          {busy ? "جاري..." : "بحث"}
        </button>
      </form>
      {res && (
        <div className="list" style={{ marginBottom: 14 }}>
          {!res.length ? (
            <Empty>ما لقينا إشي بهالكلمة</Empty>
          ) : (
            res.map((r) => (
              <div key={r.id} className="item row-between">
                <div>
                  <b>{r.title}</b>
                  <div className="small-text muted" dir="ltr">
                    @{r.username} · {r.kind === "channel" ? "قناة" : "جروب"}
                    {r.members ? ` · ${r.members.toLocaleString("en")} عضو` : ""}
                  </div>
                </div>
                {r.added || have.has(r.id) ? (
                  <Tag kind="ok">مضاف</Tag>
                ) : (
                  <button className="btn small" onClick={() => addOne(`https://t.me/${r.username}`).then(() => setRes((x) => x.map((y) => (y.id === r.id ? { ...y, added: true } : y))))}>
                    ➕ أضف
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
      <h4 className="sub-title">مقترحة من مصادرك ({list.length})</h4>
      <p className="small-text muted">قنوات وجروبات تيليجرام انذكرت روابطها بالمصادر اللي بتسحب منها — كل ما انذكرت أكتر، غالباً بتكون مفيدة أكتر.</p>
      {!list.length ? (
        <Empty>بتطلع هون لحالها لما الصياد يلاقي روابط قنوات بالمصادر</Empty>
      ) : (
        <div className="list">
          {list.slice(0, 30).map((x) => (
            <div key={x.id} className="item row-between">
              <div>
                <b dir="ltr">{x.ref.replace("https://", "")}</b>
                <div className="small-text muted">
                  انذكر {x.mentions} مرة · من {x.sources?.length || 1} مصدر · {fmtAgo(x.lastSeen)}
                </div>
              </div>
              <div className="btn-row">
                <button className="btn small" onClick={() => addOne(x.ref, x.id)}>
                  ➕ أضف
                </button>
                <button className="btn small" onClick={() => updateDoc(doc(db, "tg_suggest", x.id), { status: "ignored" })}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------- 🎣 صياد من مجموعات الواتساب ----------
function WaSources() {
  const { app, toast } = useAdmin();
  const [rows] = useQuery(() => query(collection(db, "wa_sources"), orderBy("links", "desc"), limit(200)), []);
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const on = app?.wa?.harvestLinks !== false;
  const total = rows.reduce((n, r) => n + (r.links || 0), 0);
  const shown = all ? rows : rows.slice(0, 15);
  const weak = rows.filter((r) => r.score?.total >= 10 && r.score.score < 20 && !r.blocked);

  async function toggle(v) {
    await setDoc(doc(db, "settings", "app"), { wa: { harvestLinks: v } }, { merge: true })
      .then(() => toast(v ? "اشتغل ✓" : "توقف", "ok"))
      .catch((e) => toast(e.message, "bad"));
  }
  async function score() {
    setBusy(true);
    let n = 0;
    try {
      for (const r of rows.filter((x) => (x.links || 0) >= 3)) {
        const c = (...w) => getCountFromServer(query(collection(db, "tg_links"), where("sourceId", "==", r.id), ...w)).then((x) => x.data().count);
        const [t, a, j] = await Promise.all([c(), c(where("status", "==", "active")), c(where("waStatus", "==", "joined"))]);
        const sc = t ? Math.round((a / t) * 50 + Math.min(1, j / t) * 50) : 0;
        await updateDoc(doc(db, "wa_sources", r.id), { score: { total: t, active: a, joined: j, score: sc, at: Date.now() } });
        n++;
      }
      toast(`انحسب تقييم ${n} مجموعة ✓`, "ok");
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
    setBusy(false);
  }
  async function stopWeak() {
    if (!weak.length || !confirm(`إيقاف اللقط من ${weak.length} مجموعة ضعيفة؟`)) return;
    const b = writeBatch(db);
    weak.forEach((r) => b.update(doc(db, "wa_sources", r.id), { blocked: true }));
    await b.commit().then(() => toast("تم ✓", "ok")).catch((e) => toast(e.message, "bad"));
  }

  return (
    <Panel
      title="🎣 روابط من مجموعات الواتساب"
      actions={
        <>
          {weak.length > 0 && (
            <button className="btn small danger-outline" onClick={stopWeak}>
              وقف الضعيفة ({weak.length})
            </button>
          )}
          {rows.length > 0 && (
            <button className="btn small primary" disabled={busy} onClick={score}>
              {busy ? "جاري الحساب..." : "احسب التقييم"}
            </button>
          )}
        </>
      }
    >
      <Toggle
        checked={on}
        onChange={toggle}
        label={on ? "اللقط شغّال" : "اللقط موقوف"}
        hint="أي رابط مجموعة بينبعت بمجموعات الواتساب اللي أرقامك فيها بينلقط لحاله وبيدخل نفس طابور الصياد: فحص ← أولوية ← انضمام بالتدريج (بنفس الحد اليومي)."
      />
      {!rows.length ? (
        <Empty>{on ? "لسا ما انلقط ولا رابط — بتبلش تبين خلال ساعات حسب نشاط المجموعات" : "شغّله عشان يبدأ يلقط"}</Empty>
      ) : (
        <>
          <p className="small-text muted">
            انلقط <b>{total}</b> رابط من <b>{rows.length}</b> مجموعة. التقييم من 100 = نص على نسبة الروابط الشغالة ونص على نسبة اللي انضمينا إلها — روابط المجموعة القوية بتنضم أول.
          </p>
          <div className="table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>المجموعة</th>
                  <th>روابط</th>
                  <th>التقييم</th>
                  <th>آخر رابط</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} style={r.blocked ? { opacity: 0.5 } : undefined}>
                    <td>{r.title || r.jid || r.id}</td>
                    <td>{r.links || 0}</td>
                    <td>{r.score ? <ScoreTag sc={r.score} /> : "—"}</td>
                    <td className="small-text">{fmtAgo(r.lastSeen)}</td>
                    <td>
                      <button className="icon-btn txt" onClick={() => updateDoc(doc(db, "wa_sources", r.id), { blocked: !r.blocked })}>
                        {r.blocked ? "تشغيل" : "إيقاف"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 15 && (
            <button className="btn small" onClick={() => setAll(!all)}>
              {all ? "أقل" : `عرض الكل (${rows.length})`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
