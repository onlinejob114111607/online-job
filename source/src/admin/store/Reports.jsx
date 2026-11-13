import { useMemo, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { fmtDateTime, toDate } from "../../utils";
import { ORDER_STATUS, money } from "../../store/shared";
import { useQuery } from "../hooks";
import { Empty, Kpi, Panel } from "../ui";
import { monthKey, monthRange, monthName, monthStats, orderProfit } from "./shared";

export function Reports({ products }) {
  const [mk, setMk] = useState(() => monthKey(new Date()));
  const prevKey = useMemo(() => {
    const [a] = monthRange(mk);
    return monthKey(new Date(a.getFullYear(), a.getMonth() - 1, 1));
  }, [mk]);
  const [rows, loading] = useQuery(() => {
    const [a, b] = monthRange(mk);
    return query(collection(db, "orders"), where("createdAt", ">=", a), where("createdAt", "<", b));
  }, [mk]);
  const [prevRows] = useQuery(() => {
    const [a, b] = monthRange(prevKey);
    return query(collection(db, "orders"), where("createdAt", ">=", a), where("createdAt", "<", b));
  }, [prevKey]);
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const { st, days, prods, regions } = useMemo(() => monthStats(rows, byId), [rows, byId]);
  const prev = useMemo(() => monthStats(prevRows, byId).st, [prevRows, byId]);
  const months = useMemo(() => {
    const out = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
    return out;
  }, []);
  const [a, b] = monthRange(mk);
  const nDays = Math.round((b - a) / 86_400_000);
  const maxDay = Math.max(1, ...Object.values(days));
  const delta = prev.profit ? Math.round(((st.profit - prev.profit) / prev.profit) * 100) : null;

  function exportCsv() {
    const lines = [["رقم الطلب", "التاريخ", "الاسم", "المنطقة", "الحالة", "المجموع", "الربح"].join(",")];
    for (const o of rows) lines.push([o.code, fmtDateTime(toDate(o.createdAt)), `"${String(o.name || "").replace(/"/g, "'")}"`, o.regionName || "", ORDER_STATUS[o.status]?.[0] || o.status, o.total, orderProfit(o, byId)].join(","));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const u = URL.createObjectURL(blob);
    const el = Object.assign(document.createElement("a"), { href: u, download: `orders-${mk}.csv` });
    el.click();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  }

  return (
    <>
      <Panel
        title={`تقرير ${monthName(mk)}`}
        actions={
          <div className="btn-row">
            <select value={mk} onChange={(e) => setMk(e.target.value)}>
              {months.map((k) => (
                <option key={k} value={k}>
                  {monthName(k)}
                </option>
              ))}
            </select>
            {rows.length > 0 && (
              <button className="btn small" onClick={exportCsv}>
                تنزيل Excel
              </button>
            )}
          </div>
        }
      >
        {loading && !rows.length ? (
          <Empty>جاري التحميل...</Empty>
        ) : (
          <>
            <div className="kpis">
              <Kpi label="الربح الصافي (المستلمة)" value={`${money(st.profit)} ₪`} sub={delta === null ? "" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% عن ${monthName(prevKey)}`} color="#059669" />
              <Kpi label="ربح متوقع (بالطريق)" value={`${money(st.expected)} ₪`} sub={`${st.pending} طلب مؤكد لسا ما استلم`} color="#0891b2" />
              <Kpi label="حافز الاستلام" value={`${st.bonus} ₪`} sub={`${st.delivered} طلب مستلم`} hint="كل 5 طلبيات مستلمة = 10 شيكل" color="#1d4ed8" />
              <Kpi label="نسبة الرجوع" value={`${st.returnRate}%`} sub={`${st.returned} راجع · ${st.cancelled} ملغي`} color={st.returnRate > 20 ? "#dc2626" : "#d97706"} />
            </div>
            <div className="kpis">
              <Kpi label="كل الطلبات" value={st.all} sub={prev.all ? `الشهر اللي قبل: ${prev.all}` : ""} />
              <Kpi label="مبيعات (المستلمة)" value={`${money(st.revenue)} ₪`} sub={`${st.items} قطعة`} />
              <Kpi label="الربح الكلي المتوقع" value={`${money(st.profit + st.expected)} ₪`} hint="المستلم + المؤكد اللي بالطريق" />
              <Kpi label="ربح الطلب الواحد" value={`${money(st.delivered ? Math.round(st.profit / st.delivered) : 0)} ₪`} hint="متوسط الربح لكل طلب مستلم" />
            </div>
            {st.delivered > 0 && (
              <>
                <h4 className="sub-title">الربح حسب اليوم (حسب يوم الاستلام)</h4>
                <div className="day-bars">
                  {Array.from({ length: nDays }, (_, i) => i + 1).map((d) => (
                    <div key={d} className="day-bar" title={`${d}: ${money(days[d] || 0)} ₪`}>
                      <span style={{ height: `${((days[d] || 0) / maxDay) * 100}%` }} />
                      <small>{d % 5 === 1 || nDays < 12 ? d : ""}</small>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Panel>
      {prods.length > 0 && (
        <Panel title="المنتجات الأكثر ربحاً">
          <div className="table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>قطع</th>
                  <th>الربح</th>
                </tr>
              </thead>
              <tbody>
                {prods.slice(0, 15).map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{money(p.profit)} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {regions.length > 0 && (
        <Panel title="حسب المنطقة">
          <div className="table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>المنطقة</th>
                  <th>طلبات مستلمة</th>
                  <th>الربح</th>
                </tr>
              </thead>
              <tbody>
                {regions.map(([r, x]) => (
                  <tr key={r}>
                    <td>{r}</td>
                    <td>{x.n}</td>
                    <td>{money(x.profit)} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
