import { collection, doc, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cairoDayKey } from "../../utils";
import { pct } from "../../funnelDefaults";
import { useAdmin, useQuery } from "../hooks";
import { Kpi, Panel, Tag } from "../ui";
import { dayLabel } from "./shared";

export function Goal({ runs, cfg }) {
  const { toast } = useAdmin();
  const [logs] = useQuery(() => query(collection(db, "funnel_goals"), orderBy("day", "desc"), limit(40)), []);
  const g = cfg.goal;
  const today = cairoDayKey();
  const byDay = Object.fromEntries(logs.map((l) => [l.day, l]));
  const days = [...new Set([today, ...runs.map((r) => r.day), ...logs.map((l) => l.day)])].sort().reverse().slice(0, 30);
  const latest = logs.find((l) => l.bvLeft != null || l.bvRight != null) || {};
  const remL = Math.max(0, g.rankLeft - (Number(latest.bvLeft) || 0));
  const remR = Math.max(0, g.rankRight - (Number(latest.bvRight) || 0));
  const todayRun = runs.find((r) => r.day === today);
  const bookedToday = todayRun?.stats?.booked || 0;

  async function save(day, patch) {
    try {
      await setDoc(doc(db, "funnel_goals", day), { day, ...patch, updatedAt: serverTimestamp() }, { merge: true });
    } catch {
      toast("فشل الحفظ", "bad");
    }
  }
  const num = (v) => (v === "" ? null : Number(v));

  return (
    <>
      <Panel title="هدف اليوم">
        <div className="kpis">
          <Kpi label="بوك اليوم" value={`${bookedToday} / ${g.daily || "—"}`} sub={g.daily ? `${pct(bookedToday, g.daily)}٪ من الهدف` : "حدد الهدف بالإعدادات"} color={g.daily && bookedToday >= g.daily ? "#059669" : "#2563eb"} />
          <Kpi label={`الباقي يمين${g.rankName ? ` لـ ${g.rankName}` : ""}`} value={g.rankRight ? remR : "—"} sub={`BV يمين: ${latest.bvRight ?? "—"}`} color="#7c3aed" />
          <Kpi label={`الباقي يسار${g.rankName ? ` لـ ${g.rankName}` : ""}`} value={g.rankLeft ? remL : "—"} sub={`BV يسار: ${latest.bvLeft ?? "—"}`} color="#d97706" />
        </div>
        <p className="small-text muted">
          تنبيه تيليجرام لو البوك متأخر: {g.checks.length ? g.checks.map((c) => `الساعة ${c.at} لازم ${Math.ceil((g.daily * c.pct) / 100)}`).join(" · ") : "مطفي"}. الهدف والدرجة بتتعدل من "الإعدادات والرسائل".
        </p>
      </Panel>
      <Panel title="سجل الإنجاز اليومي">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>اليوم</th>
                <th>رسائل</th>
                <th>بوك / الهدف</th>
                <th>حضور</th>
                <th>BV يمين</th>
                <th>BV يسار</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const s = runs.find((r) => r.day === d)?.stats || {};
                const l = byDay[d] || {};
                const hit = g.daily && (s.booked || 0) >= g.daily;
                return (
                  <tr key={d}>
                    <td data-label="اليوم">
                      <b>{d === today ? "اليوم" : dayLabel(d)}</b>
                    </td>
                    <td data-label="رسائل">{s.welcomed ?? "—"}</td>
                    <td data-label="بوك">
                      <Tag kind={hit ? "ok" : s.booked ? "wait" : ""}>
                        {s.booked ?? 0} / {g.daily || "—"}
                      </Tag>
                    </td>
                    <td data-label="حضور">{s.attended ?? "—"}</td>
                    <td data-label="BV يمين">
                      <input className="mini-num" type="number" defaultValue={l.bvRight ?? ""} onBlur={(e) => num(e.target.value) !== (l.bvRight ?? null) && save(d, { bvRight: num(e.target.value) })} />
                    </td>
                    <td data-label="BV يسار">
                      <input className="mini-num" type="number" defaultValue={l.bvLeft ?? ""} onBlur={(e) => num(e.target.value) !== (l.bvLeft ?? null) && save(d, { bvLeft: num(e.target.value) })} />
                    </td>
                    <td data-label="ملاحظة">
                      <input className="note-input" defaultValue={l.note || ""} placeholder="—" onBlur={(e) => e.target.value !== (l.note || "") && save(d, { note: e.target.value.slice(0, 300) })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small-text muted">BV: اكتب المجموع الحالي ليمين ويسار، والباقي للدرجة بينحسب من آخر قيمة كتبتها.</p>
      </Panel>
    </>
  );
}
