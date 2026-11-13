// ============================================================
//  صحة النظام: العمّال، الحسابات، الحصة، الطوابير، التحديث
// ============================================================
import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { fmtAgo, toMs } from "../utils";
import { runCommand, useAdmin, useDocData } from "./hooks";
import { Empty, Kpi, Panel } from "./ui";

// إصدار العمّال اللي بتجي معه هاي اللوحة (لو العامل أقدم ← في تحديث)
export const EXPECTED_VERSION = "2026.11.13";
const cairoMidnightMs = () => {
  const d = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  const off = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000;
  return Date.UTC(+p.year, +p.month - 1, +p.day) - off;
};

function Row({ ok, warn, title, children }) {
  return (
    <div className={"health-row " + (ok ? "ok" : warn ? "warn" : "bad")}>
      <span className="health-dot">{ok ? "✓" : warn ? "!" : "✕"}</span>
      <div>
        <b>{title}</b>
        <div className="small-text muted">{children}</div>
      </div>
    </div>
  );
}

export default function Health() {
  const { workers, waAccounts, tgAccounts, app, toast } = useAdmin();
  const [q, setQ] = useState(null);
  const [busy, setBusy] = useState("");
  const report = useDocData("system/daily_report");
  const midnight = cairoMidnightMs();

  useEffect(() => {
    let alive = true;
    const c = (qq) => getCountFromServer(qq).then((s) => s.data().count).catch(() => null);
    Promise.all([
      c(query(collection(db, "wa_posts"), where("status", "in", ["queued", "sending"]))),
      c(query(collection(db, "wa_groups"), where("status", "==", "pending"))),
      c(query(collection(db, "tg_sources"), where("status", "in", ["pending", "working", "scanning"]))),
      c(query(collection(db, "registrations"), where("status", "==", "new"))),
      c(query(collection(db, "orders"), where("status", "in", ["new", "confirm_queued", "awaiting"]))),
    ]).then(([posts, groups, sources, regs, orders]) => alive && setQ({ posts, groups, sources, regs, orders }));
    return () => {
      alive = false;
    };
  }, []);

  const w = { wa: workers.wa || {}, tg: workers.tg || {} };
  const quotaToday = ["wa", "tg"].some((k) => toMs(w[k].quotaAt) > midnight);
  const waOpen = waAccounts.filter((a) => a.state === "open").length;
  const waOff = waAccounts.filter((a) => a.enabled !== false && a.state !== "open");
  const paused = waAccounts.filter((a) => toMs(a.postPausedUntil) > Date.now());
  const tgBad = tgAccounts.filter((a) => ["banned", "unauthorized", "full", "error"].includes(a.status));
  const tgFlood = tgAccounts.filter((a) => (Number(a.floodUntil) || 0) > Date.now());
  const n = app.notify || {};
  const ver = (k) => w[k].version || "قديم";
  const outdated = ["wa", "tg"].filter((k) => (workers[`${k}Online`] && (w[k].version || "0") < EXPECTED_VERSION));

  async function cmd(type, label) {
    setBusy(type);
    try {
      const r = await runCommand("wa", type, {}, { timeout: 60_000 });
      toast(type === "self_update" ? "بلّش التحديث — العمّال رح يوقفوا دقيقة ويرجعوا" : label, "ok", 6000);
      return r;
    } catch (e) {
      toast(e.message, "bad", 7000);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page">
      <Panel title="🩺 صحة النظام">
        <div className="health-list">
          {["wa", "tg"].map((k) => (
            <Row key={k} ok={workers[`${k}Online`]} title={`عامل ${k === "wa" ? "الواتساب" : "تيليجرام"}`}>
              {workers[`${k}Online`] ? `شغال من ${fmtAgo(w[k].startedAt)}` : `واقف — آخر نبض ${w[k].lastSeen ? fmtAgo(w[k].lastSeen) : "—"}`}
              {` · إصدار ${ver(k)}`}
              {w[k].rssMb ? ` · ذاكرة ${w[k].rssMb}MB` : ""}
              {w[k].errors ? ` · ${w[k].errors} خطأ اتصال من التشغيل` : ""}
            </Row>
          ))}
          <Row ok={!quotaToday} title="حصة Firebase اليومية">
            {quotaToday ? "خلصت اليوم مرة على الأقل — بترجع الساعة 10 الصبح (مصر). الحل الدائم: خطة Blaze (بتدفع بس لو تجاوزت المجاني)." : "تمام — ما خلصت اليوم"}
          </Row>
          <Row ok={waAccounts.length > 0 && !waOff.length} warn={waOpen > 0 && waOff.length > 0} title={`أرقام الواتساب (${waOpen}/${waAccounts.length} متصل)`}>
            {waOff.length ? `مش متصل: ${waOff.map((a) => a.name).join("، ")}` : waAccounts.length ? "كلهم متصلين" : "ما في أرقام"}
            {paused.length ? ` · ⏸ واقف نشر لحمايته: ${paused.map((a) => a.name).join("، ")}` : ""}
            {waAccounts.some((a) => (a.risk?.score || 0) >= 30) ? ` · خطر الحظر: ${waAccounts.filter((a) => (a.risk?.score || 0) >= 30).map((a) => `${a.name} ${a.risk.score}/100`).join("، ")}` : ""}
          </Row>
          <Row ok={!tgBad.length && tgAccounts.length > 0} warn={tgFlood.length > 0 && !tgBad.length} title={`حسابات تيليجرام (${tgAccounts.length})`}>
            {tgBad.length ? `في مشكلة: ${tgBad.map((a) => `${a.name || a.phone} (${a.status})`).join("، ")}` : tgFlood.length ? `FloodWait مؤقت: ${tgFlood.map((a) => a.name || a.phone).join("، ")}` : tgAccounts.length ? "كلهم تمام" : "ما في حسابات"}
          </Row>
          <Row ok={n.enabled && n.botToken && n.chatId} title="تنبيهات تيليجرام">
            {n.enabled && n.botToken && n.chatId ? `شغالة · التقرير اليومي ${n.daily === false ? "مطفي" : `الساعة ${n.dailyAt || "23:00"}`}${report?.day ? ` (آخر واحد ${report.day})` : ""}` : "مطفية أو ناقصها توكن/Chat ID — الإعدادات ← التنبيهات"}
          </Row>
          <Row ok={!outdated.length} warn title="التحديثات">
            {outdated.length ? `في إصدار أحدث للعمّال (${EXPECTED_VERSION}) — حدّثهم من تحت` : "العمّال على آخر إصدار"}
          </Row>
        </div>
        {w.wa.lastError && <p className="small-text muted">آخر خطأ اتصال (واتساب): {w.wa.lastError}</p>}
      </Panel>

      <Panel title="الطوابير هلأ">
        {!q ? (
          <Empty>جاري العد...</Empty>
        ) : (
          <div className="kpis">
            {[
              ["منشورات بالطابور", q.posts],
              ["مجموعات بانتظار الانضمام", q.groups],
              ["مصادر بالسحب", q.sources],
              ["مسجلين ما وصلهم ترحيب", q.regs],
              ["طلبات بانتظار التأكيد", q.orders],
            ].map(([l, v]) => (
              <Kpi key={l} label={l} value={v ?? "—"} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="أدوات">
        <div className="btn-row">
          <button className="btn small" disabled={!!busy || !workers.waOnline} onClick={() => cmd("daily_report_now", "انبعت التقرير على تيليجرام ✓")}>
            {busy === "daily_report_now" ? "جاري..." : "📊 ابعت تقرير اليوم هلأ"}
          </button>
          <button
            className="btn small primary"
            disabled={!!busy || !workers.waOnline || !app.system?.repo}
            onClick={() => confirm("تحديث العمّال من GitHub؟ رح يوقفوا حوالي دقيقة ويرجعوا لحالهم.") && cmd("self_update")}
            title={app.system?.repo ? "" : "حط ريبو التحديث بالإعدادات ← عام"}
          >
            {busy === "self_update" ? "جاري..." : "⬇️ حدّث العمّال من GitHub"}
          </button>
        </div>
        {!app.system?.repo && <p className="small-text muted">التحديث التلقائي بيحتاج ريبو GitHub فيه ملفات النظام — الإعدادات ← عام ← «تحديث العمّال».</p>}
        <p className="small-text muted">سجل التحديث على الجوال: <code dir="ltr">cat ~/system/update.log</code> · للرجوع للنسخة اللي قبل: <code dir="ltr">~/system/update.sh rollback</code></p>
      </Panel>
    </div>
  );
}
