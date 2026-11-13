import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getCountFromServer, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "../firebase";
import { WEEK_START } from "../config";
import { waSettingsOf } from "../appSettings";
import { cairoDayKey, fmtAgo, startOfDay, startOfWeek } from "../utils";
import { useAdmin, useDocData, useQuery } from "./hooks";
import { mergeFunnel } from "../funnelDefaults";
import { DAYS, nextMeeting } from "./funnel/shared";
import { Empty, Kpi, Panel, Tag } from "./ui";
import { waStateOf } from "./wa/waShared";
import { tgStateOf } from "./tg/tgShared";

async function count(q) {
  try {
    return (await getCountFromServer(q)).data().count;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export default function Overview() {
  const { app, workers, waAccounts, tgAccounts } = useAdmin();
  const [c, setC] = useState({});

  useEffect(() => {
    let alive = true;
    async function load() {
      const today = Timestamp.fromDate(startOfDay(new Date()));
      const week = Timestamp.fromDate(startOfWeek(new Date(), WEEK_START));
      const regs = collection(db, "registrations");
      const links = collection(db, "tg_links");
      const groups = collection(db, "wa_groups");
      const [regToday, regWeek, linksToday, linksActive, linksTotal, groupsJoined, groupsPending, regNew] = await Promise.all([
        count(query(regs, where("createdAt", ">=", today))),
        count(query(regs, where("createdAt", ">=", week))),
        count(query(links, where("firstSeen", ">=", today))),
        count(query(links, where("status", "==", "active"))),
        count(links),
        count(query(groups, where("status", "==", "joined"))),
        count(query(groups, where("status", "==", "pending"))),
        count(query(regs, where("status", "==", "new"))),
      ]);
      if (alive) setC({ regToday, regWeek, linksToday, linksActive, linksTotal, groupsJoined, groupsPending, regNew });
    }
    load();
    // كل 5 دقائق وبس لما الصفحة ظاهرة (عشان ما نصرف قراءات Firestore على الفاضي)
    const t = setInterval(() => document.visibilityState === "visible" && load(), 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const funnelRaw = useDocData("settings/funnel");
  const funnel = mergeFunnel(funnelRaw);
  const next = nextMeeting(funnel);
  const mode = !funnel.enabled ? ["مطفي", "bad"] : funnel.manualOnly ? ["يدوي بالزر", "wait"] : [`تلقائي ${funnel.startTime}`, "ok"];

  const [logs] = useQuery(() => query(collection(db, "logs"), orderBy("ts", "desc"), limit(12)), []);

  const today = cairoDayKey();
  const sentToday = waAccounts.reduce((s, a) => s + (a.dayKey === today ? a.sentToday || 0 : 0), 0);
  const n = (v) => (v === undefined ? "…" : v === null ? "—" : v);

  const todo = [];
  if (!app.siteUrl) todo.push(["حط رابط موقع التسجيل عشان روابط التتبع تشتغل", "/admin/settings"]);
  if (!app.tg.apiId || !app.tg.apiHash) todo.push(["أدخل api_id و api_hash لتيليجرام", "/admin/settings"]);
  if (!waAccounts.length) todo.push(["أضف أول حساب واتساب", "/admin/wa"]);
  if (!tgAccounts.length) todo.push(["أضف أول حساب تيليجرام للصياد", "/admin/tg"]);
  if (!app.notify.enabled) todo.push(["فعّل تنبيهات تيليجرام (تسجيل جديد، عامل وقف)", "/admin/settings"]);

  return (
    <div className="page">
      <div className="kpis kpis-6">
        <Kpi label="تسجيلات اليوم" value={n(c.regToday)} color="#2563eb" />
        <Kpi label="تسجيلات الأسبوع" value={n(c.regWeek)} color="#7c3aed" />
        <Kpi label="روابط جديدة اليوم" value={n(c.linksToday)} color="#0f766e" />
        <Kpi label="روابط شغالة" value={n(c.linksActive)} sub={c.linksTotal ? `من ${c.linksTotal}` : ""} color="#059669" />
        <Kpi label="مجموعات منضم إلها" value={n(c.groupsJoined)} sub={c.groupsPending ? `+${c.groupsPending} بالانتظار` : ""} color="#d97706" />
        <Kpi label="رسائل انبعتت اليوم" value={sentToday} color="#db2777" />
      </div>

      <Panel title="دفعة الترحيب" className="welcome-summary" actions={<Link to="/admin/funnel" className="btn small primary">افتح المتابعة</Link>}>
        <div className="ws-grid">
          <div>
            <span>بانتظار الترحيب</span>
            <b>{n(c.regNew)}</b>
          </div>
          <div>
            <span>اللقاء الجاي</span>
            <b>{next ? (next.today ? "اليوم" : DAYS[next.wd]) : "—"}</b>
          </div>
          <div>
            <span>بكل دفعة</span>
            <b>{funnel.batchSize}</b>
          </div>
          <div>
            <span>طريقة الإرسال</span>
            <b><Tag kind={mode[1]}>{mode[0]}</Tag></b>
          </div>
        </div>
      </Panel>

      {Object.values(c).some((v) => v === null) && (
        <div className="alert warn">
          تعذّر تحميل بعض الأرقام. غالباً حصة القراءة اليومية المجانية بـ Firebase خلصت، وبترجع تتجدد الساعة 10 الصبح بتوقيت مصر. شوف الاستهلاك من Firebase Console ← Firestore ← Usage.
        </div>
      )}

      {todo.length > 0 && (
        <Panel title="خطوات باقية للتجهيز">
          <ul className="todo">
            {todo.map(([t, to]) => (
              <li key={t}>
                <Link to={to}>{t}</Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid-2col">
        <Panel title="العمّال على الجوال">
          <WorkerCard
            name="عامل الواتساب"
            w={workers.wa}
            on={workers.waOnline}
            lines={workers.wa ? [`${workers.wa.connected ?? 0} من ${workers.wa.accounts ?? 0} حساب متصل`] : []}
          />
          <WorkerCard
            name="عامل تيليجرام"
            w={workers.tg}
            on={workers.tgOnline}
            lines={
              workers.tg
                ? [
                    `${workers.tg.connected ?? 0} حساب متصل`,
                    `${workers.tg.monitored ?? 0} مصدر تحت المراقبة الحية`,
                    workers.tg.pending ? `${workers.tg.pending} مصدر بالطابور` : null,
                    workers.tg.check?.running ? `فحص الروابط: ${workers.tg.check.done}/${workers.tg.check.total}` : null,
                  ].filter(Boolean)
                : []
            }
          />
        </Panel>

        <Panel title="آخر الأحداث" actions={<Link to="/admin/logs" className="btn small">الكل</Link>}>
          {!logs.length ? (
            <Empty>ما في أحداث لسا</Empty>
          ) : (
            <ul className="log-list compact">
              {logs.map((l) => (
                <li key={l.id} className={`lv-${l.level}`}>
                  <span className="log-time">{fmtAgo(l.ts)}</span>
                  <Tag kind={l.worker === "wa" ? "ok" : "info"}>{l.worker === "wa" ? "واتساب" : "تيليجرام"}</Tag>
                  <span className="log-msg">{l.msg}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid-2col">
        <Panel title={`حسابات واتساب (${waAccounts.length})`} actions={<Link to="/admin/wa" className="btn small">إدارة</Link>}>
          {!waAccounts.length ? (
            <Empty>ما في حسابات</Empty>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>الحساب</th>
                  <th>الحالة</th>
                  <th>رسائل اليوم</th>
                  <th>انضمامات اليوم</th>
                </tr>
              </thead>
              <tbody>
                {waAccounts.map((a) => {
                  const [label, kind] = waStateOf(a, workers.waOnline);
                  const s = waSettingsOf(a);
                  return (
                    <tr key={a.id}>
                      <td>
                        <b>{a.name}</b>
                        {a.phone && <div className="small-text muted" dir="ltr">+{a.phone}</div>}
                      </td>
                      <td>
                        <Tag kind={kind}>{label}</Tag>
                      </td>
                      <td>
                        {a.dayKey === today ? a.sentToday || 0 : 0}
                        {!app.wa.postUnlimited && s.dailyLimit > 0 ? ` / ${s.dailyLimit}` : ""}
                      </td>
                      <td>{a.joinDayKey === today ? a.joinedToday || 0 : 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title={`حسابات تيليجرام (${tgAccounts.length})`} actions={<Link to="/admin/tg" className="btn small">إدارة</Link>}>
          {!tgAccounts.length ? (
            <Empty>ما في حسابات</Empty>
          ) : (
            <table className="mini-table">
              <thead>
                <tr>
                  <th>الحساب</th>
                  <th>الحالة</th>
                  <th>انضمامات اليوم</th>
                </tr>
              </thead>
              <tbody>
                {tgAccounts.map((a) => {
                  const [label, kind] = tgStateOf(a, workers.tgOnline, app);
                  return (
                    <tr key={a.id}>
                      <td>
                        <b>{a.name || a.phone}</b>
                        {a.username && <div className="small-text muted" dir="ltr">@{a.username}</div>}
                      </td>
                      <td>
                        <Tag kind={kind}>{label}</Tag>
                      </td>
                      <td>
                        {a.joinsDate === today ? a.joinsToday || 0 : 0} / {a.dailyLimit || app.tg.dailyLimit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function WorkerCard({ name, w, on, lines }) {
  return (
    <div className={"worker-card " + (on ? "on" : "off")}>
      <div className="worker-head">
        <span className="worker-dot" />
        <b>{name}</b>
        <Tag kind={on ? "ok" : "bad"}>{on ? "شغال" : w?.state === "stopped" ? "موقوف" : "مطفي"}</Tag>
      </div>
      <div className="small-text muted">
        {w ? `آخر نبض: ${fmtAgo(w.lastSeen)}` : "ما اشتغل ولا مرة"}
        {w?.startedAt && on ? ` · شغال من ${fmtAgo(w.startedAt).replace("قبل ", "")}` : ""}
      </div>
      {on && lines.length > 0 && (
        <ul className="worker-lines">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
