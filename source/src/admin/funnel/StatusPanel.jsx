import { useEffect, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { runCommand, useAdmin } from "../hooks";
import { Kpi, Panel, WorkerOff } from "../ui";
import { DAYS, timeIn, cairoWeekday, nextMeeting, meetingOf } from "./shared";

export function StatusPanel({ cfg, rawExists }) {
  const { workers, waAccounts, app, toast } = useAdmin();
  const [waiting, setWaiting] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getCountFromServer(query(collection(db, "registrations"), where("status", "==", "new")))
      .then((s) => setWaiting(s.data().count))
      .catch(() => setWaiting(null));
  }, []);
  const next = nextMeeting(cfg);
  const accId = cfg.accountId || app.welcomeAccountId;
  const acc = waAccounts.find((a) => a.id === accId);
  const at = next ? meetingOf(cfg, next.key) : null;

  async function runNow() {
    if (cfg.manualOnly && !cfg.days.includes(cairoWeekday())) {
      toast(`اليوم مش يوم لقاء — الدفعة بتنبعت بس ${cfg.days.map((d) => DAYS[d]).join(" و")}`, "bad", 6000);
      return;
    }
    const msg = cfg.manualOnly
      ? `تبدأ دفعة الترحيب هلأ؟ رح ينبعت ترحيب لحد ${cfg.batchSize} شخص (من الأقدم).`
      : `تبدأ دفعة اليوم هلأ؟ رح ينبعت ترحيب لحد ${cfg.batchSize} شخص (من الأقدم)، حتى لو اليوم مش يوم لقاء.`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      const r = await runCommand("wa", "funnel_run_now", { manual: !!cfg.manualOnly }, { timeout: 60_000 });
      toast(r?.added ? `دخل ${r.added} شخص دفعة اليوم` : r?.note || "ما في حدا جديد", "ok", 4000);
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy(false);
  }

  return (
    <Panel
      title="متابعة يوم اللقاء"
      actions={
        <button className="btn small" disabled={busy || !cfg.enabled} onClick={runNow} title="لتجربة أو لو بدك تبدأ قبل الموعد">
          {busy ? "جاري..." : "ابدأ دفعة اليوم هلأ"}
        </button>
      }
    >
      {!workers.waOnline && <WorkerOff name="عامل الواتساب" />}
      {!rawExists || !cfg.enabled ? (
        <div className="alert warn">المتابعة التلقائية مطفية — فعّلها من تبويب "الإعدادات والرسائل".</div>
      ) : !acc ? (
        <div className="alert warn">اختار حساب الواتساب اللي بيبعت المتابعة من الإعدادات.</div>
      ) : acc.state !== "open" ? (
        <div className="alert warn">حساب المتابعة "{acc.name}" مش متصل هلأ.</div>
      ) : null}
      {cfg.enabled && cfg.discloseOn && !cfg.costText.trim() && (
        <div className="alert bad">⛔ المتابعة واقفة: لازم تكتب "التكلفة الكاملة" بالإعدادات — بتنحط برسالة الوضوح قبل رابط التسجيل (إلزامي).</div>
      )}
      <div className="kpis">
        <Kpi label="بانتظار دورهم" value={waiting === undefined ? "…" : waiting === null ? "—" : waiting} hint="مسجلين جداد ما انبعتلهم ترحيب" color="#2563eb" />
        <Kpi
          label="اللقاء الجاي"
          value={next ? (next.today ? "اليوم" : DAYS[next.wd]) : "—"}
          sub={at ? `${timeIn(at, "Asia/Dubai")} دبي · ${timeIn(at, "Africa/Cairo")} مصر` : ""}
          color="#7c3aed"
        />
        <Kpi label="بيبدأ الترحيب" value={cfg.manualOnly ? "يدوي" : cfg.startTime} sub={cfg.manualOnly ? "بالزر بس" : "توقيت مصر"} color="#059669" />
        <Kpi label="بكل لقاء" value={cfg.batchSize} sub="شخص" color="#d97706" />
      </div>
      {waiting > cfg.batchSize && next && (
        <p className="small-text muted">
          في {waiting} بالانتظار — بكل لقاء بينبعت لـ {cfg.batchSize} من الأقدم، فبيخلصوا تقريباً خلال {Math.ceil(waiting / cfg.batchSize)} لقاءات.
        </p>
      )}
    </Panel>
  );
}
