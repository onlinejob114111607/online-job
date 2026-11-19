import { useEffect, useState } from "react";
import { collection, doc, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAdmin, useDocData, useQuery } from "../hooks";
import { Empty, Field, Panel, Progress, Tag, Toggle } from "../ui";

// النشر الآلي على مجموعات الواتساب: كل حساب بيمرق على كل مجموعاته مرة باليوم بين البداية والنهاية،
// والعامل بيقسم الوقت على عدد المجموعات، والقوالب بتتبدل وحدة ورا التانية
const DEF = { enabled: false, accounts: [], templateIds: [], mentionAll: false, start: "08:00", end: "20:00" };
const mins = (hm) => {
  const [h, m] = String(hm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtGap = (m) => (m >= 60 ? `${Math.floor(m / 60)} س ${m % 60 ? `${m % 60} د` : ""}` : `${Math.max(1, m)} د`);
const clock = (t) => (t ? new Date(t).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" }) : "—");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

export default function AutoPost() {
  const { waAccounts, toast } = useAdmin();
  const saved = useDocData("settings/waAuto");
  const [tpls] = useQuery(() => query(collection(db, "templates"), orderBy("createdAt", "desc")), []);
  const [states] = useQuery(() => collection(db, "wa_auto"), []);
  const [groups] = useQuery(() => collection(db, "wa_groups"), []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (saved !== undefined && !f) setF({ ...DEF, ...(saved || {}) });
  }, [saved, f]);
  if (!f) return <div className="page muted">جاري التحميل…</div>;

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const toggleIn = (key, id) => set({ [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] });
  const win = mins(f.end) - mins(f.start);
  const groupsOf = (id) => groups.filter((g) => g.accountId === id && g.status === "joined" && g.enabled !== false && g.jid).length;
  const dirty = JSON.stringify({ ...DEF, ...(saved || {}), updatedAt: null }) !== JSON.stringify({ ...f, updatedAt: null });

  async function save(patch = {}) {
    const next = { ...f, ...patch };
    if (next.enabled) {
      if (!next.accounts.length) return toast("اختار حساب واحد على الأقل", "bad");
      if (!next.templateIds.length) return toast("اختار قالب واحد على الأقل", "bad");
      if (mins(next.end) <= mins(next.start)) return toast("ساعة النهاية لازم تكون بعد ساعة البداية", "bad");
    }
    setBusy(true);
    try {
      const { updatedAt, ...clean } = next;
      await setDoc(doc(db, "settings", "waAuto"), { ...clean, updatedAt: serverTimestamp() });
      setF(next);
      toast(next.enabled ? "النشر الآلي شغّال ✓" : "انحفظ ✓", "ok");
    } catch (e) {
      console.error(e);
      toast("صار خطأ بالحفظ", "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Panel
        title="النشر الآلي على المجموعات"
        actions={
          <Tag kind={saved?.enabled ? "ok" : ""}>{saved?.enabled ? "🟢 شغّال" : "⚪ واقف"}</Tag>
        }
      >
        <p className="small-text muted">
          كل حساب بتختاره بينشر على <b>كل مجموعاته</b>، مجموعة وحدة كل فترة، من ساعة البداية لساعة النهاية. الفترة بتنحسب لحالها: الوقت ÷ عدد المجموعات
          (مثلاً 12 ساعة و72 مجموعة = مجموعة كل 10 دقايق). القوالب بتتبدل وحدة ورا التانية. وكل حماية الرقم (الحد اليومي وحد الساعة والإيقاف المؤقت) بتضل شغالة.
        </p>

        <Toggle checked={f.enabled} onChange={(v) => set({ enabled: v })} label="تشغيل النشر الآلي" />

        <div className="grid-2col">
          <Field label="يبلّش الساعة">
            <input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} />
          </Field>
          <Field label="يوقف الساعة">
            <input type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} />
          </Field>
        </div>

        <Field label="الحسابات" hint="كل حساب بينشر على مجموعاته هو، والفترة بتنحسب لكل حساب لحاله.">
          {!waAccounts.length ? (
            <Empty>ما في حسابات واتساب</Empty>
          ) : (
            <div className="auto-checks">
              {waAccounts.map((a) => {
                const n = groupsOf(a.id);
                return (
                  <label key={a.id} className="check-line">
                    <input type="checkbox" checked={f.accounts.includes(a.id)} onChange={() => toggleIn("accounts", a.id)} />
                    <span>
                      {a.name} {a.phone ? `(+${a.phone})` : ""} · <span className="muted">{n} مجموعة</span>
                      {n > 0 && win > 0 && <span className="muted"> · وحدة كل ~{fmtGap(Math.round(win / n))}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Field>

        <Field label="القوالب" hint="بيستعملها بالدور: المجموعة الأولى القالب الأول، التانية التاني، وهيك. ضيف أو عدّل القوالب من تبويب القوالب.">
          {!tpls.length ? (
            <Empty>ما في قوالب لسا، اعمل قوالب من تبويب «القوالب»</Empty>
          ) : (
            <div className="auto-checks">
              {tpls.map((t) => (
                <label key={t.id} className="check-line">
                  <input type="checkbox" checked={f.templateIds.includes(t.id)} onChange={() => toggleIn("templateIds", t.id)} />
                  <span>
                    <b>{t.title}</b> <span className="muted small-text">— {String(t.text || "").slice(0, 70)}…</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>

        <Toggle checked={f.mentionAll} onChange={(v) => set({ mentionAll: v })} label="منشن للكل" hint="بيعمل منشن لكل أعضاء المجموعة مع كل منشور (ما عدا أرقامك)." />

        <div className="btn-row">
          <button className="btn primary" disabled={busy || !dirty} onClick={() => save()}>
            {busy ? "جاري..." : "حفظ"}
          </button>
          {saved?.enabled && (
            <button className="btn" disabled={busy} onClick={() => confirm("توقف النشر الآلي على كل الحسابات؟") && save({ enabled: false })}>
              ⏹ إيقاف
            </button>
          )}
        </div>
      </Panel>

      {(saved?.accounts || []).length > 0 && (
        <Panel title="حالة اليوم">
          <div className="auto-list">
            {saved.accounts.map((id) => {
              const a = waAccounts.find((x) => x.id === id);
              const s = states.find((x) => x.id === id);
              const live = s && s.day === today();
              const total = live ? s.total || 0 : groupsOf(id);
              const done = live ? (s.done || []).length : 0;
              return (
                <div key={id} className="auto-item">
                  <div className="row-gap" style={{ justifyContent: "space-between" }}>
                    <b>{a?.name || id}</b>
                    <span className="muted small-text">
                      {done}/{total} مجموعة
                    </span>
                  </div>
                  <Progress
                    parts={[
                      [((live ? s.sent || 0 : 0) / Math.max(1, total)) * 100, "s"],
                      [((live ? (s.failed || 0) + (s.skipped || 0) : 0) / Math.max(1, total)) * 100, "f"],
                    ]}
                  />
                  {live && (
                    <p className="small-text">
                      ✅ {s.sent || 0} انبعت · ❌ {s.failed || 0} فشل{s.skipped ? ` · ⏭ ${s.skipped} تخطّى` : ""} · ⏳ {Math.max(0, total - done)} باقي
                    </p>
                  )}
                  <p className="small-text muted">
                    {live ? (
                      <>
                        آخر نشر: {clock(s.lastAt)} {s.lastGroup ? `← ${s.lastGroup}` : ""} {s.lastTpl ? `(${s.lastTpl})` : ""}
                        {s.next && s.next > Date.now() && done < total ? ` · الجاي تقريباً ${clock(s.next)}` : ""}
                        {s.gapMin ? ` · الفاصل ~${fmtGap(s.gapMin)}` : ""}
                      </>
                    ) : (
                      "ما بلّش اليوم لسا"
                    )}
                  </p>
                  {live && s.note && <p className="small-text">ℹ️ {s.note}</p>}
                  {live && s.error && <p className="small-text" style={{ color: "var(--bad)" }}>❌ {s.error}</p>}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
