import { useMemo, useState } from "react";
import { collection, doc, orderBy, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { fmtAgo, toMs, waLink } from "../utils";
import { WaIcon } from "../components/Icons";
import { useAdmin, useQuery } from "./hooks";
import { Empty, Kpi, Panel, Tag, WorkerOff } from "./ui";

// طابور الترحيب اليدوي (wa_dms): متابعة كل رقم انبعتله ترحيب من صفحة التسجيلات،
// مع إيقاف/تشغيل لكل حساب، إلغاء رقم قبل ما ينبعتله، وإعادة المحاولة للي فشلوا.
const ST = {
  queued: ["⏳ بالطابور", "wait"],
  sending: ["📤 عم ينبعت هلأ", "wait"],
  sent: ["✅ انبعت", "ok"],
  failed: ["❌ فشل", "bad"],
  cancelled: ["🚫 ملغي", ""],
};
const RANGES = [
  [1, "اليوم"],
  [7, "آخر 7 أيام"],
  [30, "آخر 30 يوم"],
];
const LIVE = ["queued", "sending"];
const fmtSec = (n) => (n >= 60 ? `${Math.round((n / 60) * 10) / 10} دقيقة` : `${n} ثانية`);
const clock = (ms) => (ms ? new Date(ms).toLocaleString("ar-EG", { hour: "numeric", minute: "2-digit", day: "numeric", month: "numeric" }) : "");

export default function WelcomeQueue() {
  const { app, waAccounts, workers, toast } = useAdmin();
  // الفاصل بين ترحيب والتاني (بالثواني) — من الإعدادات
  const gapMin = Number(app.wa.dmGapMin) || 20;
  const gapMax = Math.max(gapMin, Number(app.wa.dmGapMax) || 45);
  const AVG_GAP = (gapMin + gapMax) / 2;
  const [gap, setGap] = useState(null); // {min, max} وإنت بتعدّل
  const [days, setDays] = useState(1);
  const [accF, setAccF] = useState("");
  const [stF, setStF] = useState("");
  const [busy, setBusy] = useState(false);

  // 00:00 بتوقيت الجهاز ناقص (الأيام - 1)
  const since = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1));
    return Timestamp.fromDate(d);
  }, [days]);
  const [recent, loading] = useQuery(() => query(collection(db, "wa_dms"), where("createdAt", ">=", since), orderBy("createdAt", "desc")), [since.toMillis()]);
  // اللي لسا بالطابور بيطلعوا دايماً حتى لو أقدم من الفترة
  const [live] = useQuery(() => query(collection(db, "wa_dms"), where("status", "in", LIVE)), []);

  const rows = useMemo(() => {
    const m = new Map();
    for (const r of [...live, ...recent]) m.set(r.id, r);
    return [...m.values()].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  }, [live, recent]);

  const accName = (id) => waAccounts.find((a) => a.id === id)?.name || "حساب محذوف";
  const shown = rows.filter((r) => (!accF || r.accountId === accF) && (!stF || r.status === stF));
  const count = (st) => rows.filter((r) => (!accF || r.accountId === accF) && r.status === st).length;

  // ترتيب كل رقم بطابور حسابه ← وقت تقريبي للإرسال
  const eta = useMemo(() => {
    const m = new Map();
    const byAcc = new Map();
    for (const r of rows.filter((x) => x.status === "queued").sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt))) {
      const n = (byAcc.get(r.accountId) || 0) + 1;
      byAcc.set(r.accountId, n);
      m.set(r.id, n);
    }
    return m;
  }, [rows]);

  const accsInQueue = [...new Set(rows.filter((r) => LIVE.includes(r.status)).map((r) => r.accountId))];
  const pausedAny = waAccounts.some((a) => a.dmPaused);

  async function setPaused(ids, paused) {
    setBusy(true);
    try {
      const b = writeBatch(db);
      ids.forEach((id) => b.update(doc(db, "wa_accounts", id), { dmPaused: paused }));
      await b.commit();
      toast(paused ? "⏸ الطابور وقف — اللي عم ينبعت هلأ بيكمّل، والباقي بيستنى" : "▶ الطابور رجع يشتغل", "ok");
    } catch (e) {
      console.error(e);
      toast("صار خطأ", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(list) {
    if (!list.length || !confirm(`تلغي ${list.length} ترحيب من الطابور؟`)) return;
    await bulk(list, (b, r) => {
      b.update(doc(db, "wa_dms", r.id), { status: "cancelled", cancelledAt: serverTimestamp() });
      if (r.regId) b.update(doc(db, "registrations", r.regId), { welcome: { status: "cancelled", at: serverTimestamp() } });
    }, "انلغى ✓");
  }

  async function retry(list) {
    if (!list.length) return;
    await bulk(list, (b, r) => {
      b.update(doc(db, "wa_dms", r.id), { status: "queued", error: null, retriedAt: serverTimestamp() });
      if (r.regId) b.update(doc(db, "registrations", r.regId), { welcome: { status: "queued", at: serverTimestamp(), by: accName(r.accountId) } });
    }, `رجع ${list.length} للطابور 🔁`);
  }

  async function bulk(list, fn, msg) {
    setBusy(true);
    try {
      for (let i = 0; i < list.length; i += 200) {
        const b = writeBatch(db);
        list.slice(i, i + 200).forEach((r) => fn(b, r));
        await b.commit();
      }
      toast(msg, "ok");
    } catch (e) {
      console.error(e);
      toast("صار خطأ — يمكن التسجيل انحذف", "bad");
    } finally {
      setBusy(false);
    }
  }

  async function saveGap(v = gap) {
    const a = Math.round(Number(v.min));
    const b = Math.round(Number(v.max));
    if (!(a >= 5) || !(b >= a) || b > 3600) return toast("الأقل لازم يكون 5 ثواني أو أكتر، والأكتر أكبر منه (لحد ساعة)", "bad");
    setBusy(true);
    try {
      await updateDoc(doc(db, "settings", "app"), { "wa.dmGapMin": a, "wa.dmGapMax": b });
      setGap(null);
      toast("انحفظ ✓ — بيمشي من الترحيب الجاي", "ok");
    } catch (e) {
      console.error(e);
      toast("صار خطأ بالحفظ", "bad");
    } finally {
      setBusy(false);
    }
  }

  const queuedShown = shown.filter((r) => r.status === "queued");
  const failedShown = shown.filter((r) => r.status === "failed");

  return (
    <div className="page">
      {!workers.waOnline && <WorkerOff name="عامل الواتساب" />}

      <div className="kpis">
        <Kpi label="بالطابور" value={count("queued") + count("sending")} color="var(--wait, #f5b301)" sub={count("queued") ? `بيخلصوا بحوالي ${Math.ceil((count("queued") * AVG_GAP) / 60)} دقيقة` : ""} />
        <Kpi label="انبعت" value={count("sent")} color="var(--ok, #22c55e)" />
        <Kpi label="فشل" value={count("failed")} color="var(--bad, #ef4444)" />
        <Kpi label="ملغي" value={count("cancelled")} />
      </div>

      <Panel
        title="التحكم بالطابور"
        actions={
          pausedAny ? (
            <button className="btn primary small" disabled={busy} onClick={() => setPaused(waAccounts.filter((a) => a.dmPaused).map((a) => a.id), false)}>
              ▶ شغّل الكل
            </button>
          ) : (
            <button className="btn small" disabled={busy || !waAccounts.length} onClick={() => setPaused(waAccounts.map((a) => a.id), true)}>
              ⏸ وقّف الكل
            </button>
          )
        }
      >
        {!waAccounts.length ? (
          <Empty>ما في حسابات واتساب</Empty>
        ) : (
          <div className="wq-accs">
            {waAccounts
              .filter((a) => a.dmPaused || accsInQueue.includes(a.id) || a.id === accF)
              .map((a) => {
                const q = rows.filter((r) => r.accountId === a.id && LIVE.includes(r.status)).length;
                return (
                  <div key={a.id} className="wq-acc">
                    <div>
                      <b>{a.name}</b> <span className="muted small-text">{q ? `· ${q} بالطابور` : "· الطابور فاضي"}</span>
                      {a.state !== "open" && <Tag kind="bad">مش متصل</Tag>}
                      {a.dmPaused && <Tag kind="wait">⏸ واقف</Tag>}
                    </div>
                    <button className={"btn small" + (a.dmPaused ? " primary" : "")} disabled={busy} onClick={() => setPaused([a.id], !a.dmPaused)}>
                      {a.dmPaused ? "▶ شغّل" : "⏸ وقّف"}
                    </button>
                  </div>
                );
              })}
            {!accsInQueue.length && !pausedAny && <p className="small-text muted">الطابور فاضي هلأ. الترحيبات بتدخله من صفحة التسجيلات ← حدّد الأرقام ← إرسال ترحيب.</p>}
          </div>
        )}
      </Panel>

      <Panel title="⏱ الفاصل بين ترحيب والتاني">
        <p className="small-text muted">
          حالياً: بين <b>{fmtSec(gapMin)}</b> و <b>{fmtSec(gapMax)}</b> (عشوائي بينهم عشان يبيّن طبيعي). كل ما كبّرت الفاصل، قلّ خطر الحظر، بس الطابور بيطوّل.
        </p>
        {gap ? (
          <div className="wq-gap">
            <label>
              أقل إشي (ثواني)
              <input type="number" min={5} max={3600} value={gap.min} onChange={(e) => setGap({ ...gap, min: e.target.value })} />
            </label>
            <label>
              أكتر إشي (ثواني)
              <input type="number" min={5} max={3600} value={gap.max} onChange={(e) => setGap({ ...gap, max: e.target.value })} />
            </label>
            <button className="btn primary small" disabled={busy} onClick={saveGap}>
              حفظ
            </button>
            <button className="btn small" onClick={() => setGap(null)}>
              إلغاء
            </button>
          </div>
        ) : (
          <div className="btn-row">
            <button className="btn small" onClick={() => setGap({ min: gapMin, max: gapMax })}>
              ✏️ غيّر الفاصل
            </button>
            {[
              [20, 45, "عادي"],
              [60, 120, "هادي (دقيقة–دقيقتين)"],
              [180, 300, "آمن جداً (3–5 د)"],
            ].map(([a, b, l]) => (
              <button key={l} className={"btn small" + (gapMin === a && gapMax === b ? " primary" : "")} disabled={busy} onClick={() => saveGap({ min: a, max: b })}>
                {l}
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="الأرقام">
        <div className="toolbar">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select value={accF} onChange={(e) => setAccF(e.target.value)}>
            <option value="">كل الحسابات</option>
            {waAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select value={stF} onChange={(e) => setStF(e.target.value)}>
            <option value="">كل الحالات</option>
            {Object.entries(ST).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <div className="toolbar-actions">
            {failedShown.length > 0 && (
              <button className="btn small" disabled={busy} onClick={() => retry(failedShown)}>
                🔁 أعد محاولة الفاشلين ({failedShown.length})
              </button>
            )}
            {queuedShown.length > 0 && (
              <button className="btn small" disabled={busy} onClick={() => cancel(queuedShown)}>
                🚫 ألغِ اللي بالطابور ({queuedShown.length})
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="muted">جاري التحميل…</p>
        ) : !shown.length ? (
          <Empty>ما في ترحيبات بهالفترة</Empty>
        ) : (
          <div className="wq-list">
            {shown.map((r) => {
              const [label, kind] = ST[r.status] || [r.status, ""];
              const pos = eta.get(r.id);
              const acc = waAccounts.find((a) => a.id === r.accountId);
              return (
                <div key={r.id} className={"wq-row st-" + r.status}>
                  <div className="wq-main">
                    <div>
                      <b>{r.name || "بدون اسم"}</b>{" "}
                      <a className="wa-btn small" href={waLink(r.phone)} target="_blank" rel="noreferrer">
                        <WaIcon size={14} /> <span dir="ltr">+{r.phone}</span>
                      </a>
                    </div>
                    <div className="small-text muted">
                      من {accName(r.accountId)} · دخل الطابور {fmtAgo(toMs(r.createdAt))}
                      {r.status === "sent" && r.sentAt ? ` · انبعت ${clock(toMs(r.sentAt))}` : ""}
                      {r.status === "queued" && pos ? (acc?.dmPaused ? " · الطابور واقف" : ` · دوره ${pos} — تقريباً بعد ${Math.max(1, Math.round((pos * AVG_GAP) / 60))} د`) : ""}
                    </div>
                    {r.error && <div className="small-text" style={{ color: "var(--bad)" }}>السبب: {r.error}</div>}
                  </div>
                  <div className="wq-side">
                    <Tag kind={kind}>{label}</Tag>
                    {r.status === "queued" && (
                      <button className="btn small" disabled={busy} onClick={() => cancel([r])} title="إلغاء قبل ما ينبعت">
                        🚫
                      </button>
                    )}
                    {(r.status === "failed" || r.status === "cancelled") && (
                      <button className="btn small" disabled={busy} onClick={() => retry([r])} title="رجّعه للطابور">
                        🔁
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
