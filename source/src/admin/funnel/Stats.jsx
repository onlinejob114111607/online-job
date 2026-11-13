import { useMemo, useState } from "react";
import { cairoDayKey } from "../../utils";
import { pct } from "../../funnelDefaults";
import { Empty, Kpi, Panel } from "../ui";
import { DAYS, addDayKey, dayLabel, weekKey, sumStats, bookRate, RateHead } from "./shared";

export function RateRow({ label, s, sub }) {
  return (
    <tr>
      <td data-label="">
        <b>{label}</b>
        {sub && <div className="small-text muted">{sub}</div>}
      </td>
      <td data-label="رسائل">{s.welcomed || 0}</td>
      <td data-label="بوك">{s.booked || 0}</td>
      <td data-label="نسبة البوك">
        <b>{bookRate(s)}٪</b>
      </td>
      <td data-label="حضور">{s.attended || 0}</td>
      <td data-label="نسبة الحضور">
        <b>{pct(s.attended || 0, s.booked || 0)}٪</b>
      </td>
    </tr>
  );
}

export function Stats({ runs }) {
  const withStats = runs.filter((r) => r.stats);
  const weeks = useMemo(() => {
    const m = new Map();
    for (const r of withStats) {
      const k = weekKey(r.day);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r.stats);
    }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, l]) => ({ k, s: sumStats(l), n: l.length }));
  }, [withStats]);
  const [range, setRange] = useState(28);
  const since = addDayKey(cairoDayKey(), -range);
  const inRange = withStats.filter((r) => r.day >= since);
  const src = sumStats(inRange.map((r) => r.stats));
  const srcRows = Object.entries(src.bySource).sort((a, b) => b[1].welcomed - a[1].welcomed);
  // جودة المصدر = كم واحد حضر من كل 100 رسالة
  const quality = (v) => pct(v.attended || 0, v.welcomed || 0);
  const ranked = srcRows.filter(([, v]) => v.welcomed >= 5).sort((a, b) => quality(b[1]) - quality(a[1]));
  const bestQ = ranked[0]?.[1] ? quality(ranked[0][1]) : 0;
  // أفضل ساعة للإرسال
  const hours = {};
  for (const r of inRange) for (const [h, x] of Object.entries(r.stats.byHour || {})) {
    const e = (hours[h] ||= { w: 0, r: 0, b: 0 });
    e.w += x.w || 0;
    e.r += x.r || 0;
    e.b += x.b || 0;
  }
  const hourRows = Object.entries(hours).sort((a, b) => Number(a[0]) - Number(b[0]));
  const bestHour = hourRows.filter(([, x]) => x.w >= 5).sort((a, b) => pct(b[1].b, b[1].w) - pct(a[1].b, a[1].w) || pct(b[1].r, b[1].w) - pct(a[1].r, a[1].w))[0];
  // أفضل يوم لقاء
  const wdays = {};
  for (const r of inRange) {
    const [y, m, d] = r.day.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const e = (wdays[wd] ||= { welcomed: 0, booked: 0, attended: 0, invBooked: 0, n: 0 });
    for (const k of ["welcomed", "booked", "attended", "invBooked"]) e[k] += r.stats[k] || 0;
    e.n++;
  }
  const thisW = weeks[0]?.s;
  const lastW = weeks[1]?.s;
  const diff = (a, b) => {
    const d = Math.round((a - b) * 10) / 10;
    return d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : "=";
  };

  if (!withStats.length) return <Empty>النسب بتطلع هون أول ما تشتغل المتابعة (بتنحسب لحالها كل يوم لقاء).</Empty>;
  return (
    <>
      <Panel title="نسب الأسبوع">
        <div className="kpis">
          <Kpi label="نسبة البوك" value={`${bookRate(thisW)}٪`} sub={lastW ? `${diff(bookRate(thisW), bookRate(lastW))} عن الأسبوع الماضي` : "البوك ÷ الرسائل"} color="#2563eb" />
          <Kpi label="نسبة الحضور" value={`${pct(thisW.attended, thisW.booked)}٪`} sub={lastW ? `${diff(pct(thisW.attended, thisW.booked), pct(lastW.attended, lastW.booked))} عن الأسبوع الماضي` : "الحضور ÷ البوك"} color="#059669" />
          <Kpi label="بوك هالأسبوع" value={thisW.booked} sub={`من ${thisW.welcomed} رسالة`} color="#7c3aed" />
          <Kpi label="حضروا" value={thisW.attended} color="#d97706" />
        </div>
        <p className="small-text muted">نسبة البوك = البوك ÷ الرسائل (اللي وصلهم مسج تعريفي) × 100 · نسبة الحضور = الحضور ÷ البوك × 100. الحضور = لقطة شاشة وقت اللقاء أو تعليمك بإيدك.</p>
      </Panel>
      <Panel title="مقارنة أسبوعية">
        <div className="table-wrap">
          <table className="table">
            <RateHead first="الأسبوع (من السبت)" />
            <tbody>
              {weeks.map((w) => (
                <RateRow key={w.k} label={dayLabel(w.k)} sub={`${w.n} لقاءات`} s={w.s} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="حسب مصدر التسجيل"
        actions={
          <select value={range} onChange={(e) => setRange(Number(e.target.value))}>
            <option value={7}>آخر أسبوع</option>
            <option value={28}>آخر 4 أسابيع</option>
            <option value={90}>آخر 3 شهور</option>
          </select>
        }
      >
        <div className="table-wrap">
          <table className="table">
            <RateHead first="المصدر" />
            <tbody>
              {srcRows.map(([k, v]) => (
                <RateRow key={k} label={k} s={v} sub={v.welcomed >= 5 ? `جودة: ${quality(v)} حضور لكل 100 رسالة${quality(v) === bestQ && bestQ > 0 ? " 🏆" : quality(v) < bestQ / 3 ? " ⚠️ ضعيف" : ""}` : "عينة صغيرة"} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="small-text muted">المصدر = src برابط التسجيل (لو موجود) أو "مصدر المعرفة" اللي اختاره الشخص. «الجودة» = كم واحد حضر اللقاء من كل 100 وصلتهم رسالة — هي اللي بتقول وين تصرف على الإعلانات.</p>
      </Panel>
      <Panel title="أفضل وقت لإرسال المسج التعريفي">
        {!hourRows.length ? (
          <Empty>بتبين بعد كم لقاء (بتنحسب من ساعة المسج التعريفي — توقيت مصر)</Empty>
        ) : (
          <>
            {bestHour && (
              <div className="alert info">
                🕐 أحسن ساعة: <b>{bestHour[0]}:00</b> — {pct(bestHour[1].r, bestHour[1].w)}٪ ردّوا و{pct(bestHour[1].b, bestHour[1].w)}٪ عملوا بوك. لو بدك غيّر «بيبدأ الترحيب» بالإعدادات لقريب من هالساعة.
              </div>
            )}
            <div className="table-wrap">
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>الساعة</th>
                    <th>رسائل</th>
                    <th>ردّوا</th>
                    <th>بوك</th>
                  </tr>
                </thead>
                <tbody>
                  {hourRows.map(([h, x]) => (
                    <tr key={h} className={bestHour?.[0] === h ? "row-best" : ""}>
                      <td>{h}:00</td>
                      <td>{x.w}</td>
                      <td>{pct(x.r, x.w)}٪</td>
                      <td>{pct(x.b, x.w)}٪</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {Object.keys(wdays).length > 1 && (
          <>
            <h4 className="sub-title">حسب يوم اللقاء</h4>
            <div className="table-wrap">
              <table className="table">
                <RateHead first="اليوم" />
                <tbody>
                  {Object.entries(wdays).map(([wd, v]) => (
                    <RateRow key={wd} label={DAYS[wd]} sub={`${v.n} لقاءات`} s={v} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
      <Panel title="كل لقاء">
        <div className="table-wrap">
          <table className="table">
            <RateHead first="اللقاء" />
            <tbody>
              {withStats.map((r) => (
                <RateRow key={r.day} label={dayLabel(r.day)} sub={`بكير ${r.stats.early || 0} · متأخر ${r.stats.late || 0}${r.stats.invited ? ` · دعوات ${r.stats.invited}` : ""}`} s={r.stats} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
