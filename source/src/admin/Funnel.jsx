import { useEffect, useMemo, useState } from "react";
import { collection, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { cairoDayKey } from "../utils";
import { mergeFunnel, scheduleOf } from "../funnelDefaults";
import { store, useDocData, useQuery } from "./hooks";
import { Empty, SubTabs } from "./ui";
import { statusOf, addDayKey, dayLabel } from "./funnel/shared";
import { StatusPanel } from "./funnel/StatusPanel";
import { NowPage } from "./funnel/NowPage";
import { Conversations } from "./funnel/Conversations";
import { Completed } from "./funnel/Completed";
import { Stats } from "./funnel/Stats";
import { Goal } from "./funnel/Goal";
import { CopyMessages } from "./funnel/CopyMessages";
import { FunnelSettings } from "./funnel/FunnelSettings";

export default function Funnel() {
  const raw = useDocData("settings/funnel");
  const cfg = useMemo(() => mergeFunnel(raw), [raw]);
  const [tab, setTab] = useState(() => store.get("funnel.tab", "now"));
  useEffect(() => store.set("funnel.tab", tab), [tab]);
  const today = cairoDayKey();
  const [day, setDay] = useState(today);
  const [runs] = useQuery(() => query(collection(db, "funnel_runs"), orderBy("day", "desc"), limit(30)), []);
  const [rows, loading] = useQuery(() => query(collection(db, "funnel"), where("day", "==", day)), [day]);

  const counts = useMemo(() => {
    const c = {};
    rows.forEach((r) => (c[statusOf(r)] = (c[statusOf(r)] || 0) + 1));
    return c;
  }, [rows]);
  const tomorrow = addDayKey(today, 1);
  const days = useMemo(
    () => [...new Set([today, ...(scheduleOf(cfg, tomorrow)?.eve ? [tomorrow] : []), ...runs.map((r) => r.day)])].sort().reverse(),
    [runs, today, tomorrow, cfg]
  );

  if (raw === undefined) return <Empty>جاري التحميل...</Empty>;

  return (
    <div className="page">
      <StatusPanel cfg={cfg} rawExists={raw !== null} />
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["now", "الآن 📱", counts.attention || ""],
          ["today", "المحادثات", counts.attention ? `${counts.attention} محتاج ردك` : ""],
          ["done", "البوك والحضور", counts.completed || ""],
          ["stats", "النسب"],
          ["goal", "الهدف اليومي"],
          ["copy", "نسخ الرسائل"],
          ["settings", "الإعدادات والرسائل"],
        ]}
      />
      {!["settings", "copy", "stats", "goal", "now"].includes(tab) && (
        <div className="chips">
          {days.map((d) => (
            <button key={d} className={"chip" + (day === d ? " active" : "")} onClick={() => setDay(d)}>
              {d === today ? "اليوم" : d === tomorrow ? `بكرة (${dayLabel(d)})` : dayLabel(d)}
              {runs.find((r) => r.day === d)?.count ? ` (${runs.find((r) => r.day === d).count})` : ""}
            </button>
          ))}
        </div>
      )}
      {tab === "now" && <NowPage rows={day === today ? rows : []} loading={loading} cfg={cfg} run={runs.find((r) => r.day === today)} setTab={setTab} setDay={setDay} today={today} />}
      {tab === "today" && <Conversations rows={rows} loading={loading} counts={counts} cfg={cfg} day={day} />}
      {tab === "done" && <Completed rows={rows.filter((r) => r.status === "completed")} all={rows} cfg={cfg} day={day} run={runs.find((r) => r.day === day)} />}
      {tab === "stats" && <Stats runs={runs} cfg={cfg} />}
      {tab === "goal" && <Goal runs={runs} cfg={cfg} />}
      {tab === "copy" && <CopyMessages cfg={cfg} />}
      {tab === "settings" && <FunnelSettings cfg={cfg} />}
    </div>
  );
}
