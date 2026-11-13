import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../firebase";
import { SITE, STATUSES, WEEK_START } from "../config";
import { loadSiteContent } from "../siteContent";
import { addDays, copyText, endOfDay, fmtDateTime, fmtDay, fromInputDate, startOfDay, startOfWeek, toInputDate, waLink } from "../utils";
import { WaIcon } from "../components/Icons";
import { useAdmin } from "./hooks";
import { Empty, HBars, Kpi, Modal, Panel, SubTabs, Tag, WorkerOff } from "./ui";
import Tracking from "./Tracking";

const statusMap = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

function getPreset(key) {
  const now = new Date();
  switch (key) {
    case "today":
      return [startOfDay(now), endOfDay(now)];
    case "yesterday":
      return [startOfDay(addDays(now, -1)), endOfDay(addDays(now, -1))];
    case "week": {
      const s = startOfWeek(now, WEEK_START);
      return [s, endOfDay(addDays(s, 6))];
    }
    case "lastweek": {
      const s = addDays(startOfWeek(now, WEEK_START), -7);
      return [s, endOfDay(addDays(s, 6))];
    }
    case "month":
      return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)];
    case "30":
      return [startOfDay(addDays(now, -29)), endOfDay(now)];
    default:
      return null;
  }
}

const PRESETS = [
  { key: "today", label: "اليوم" },
  { key: "yesterday", label: "أمس" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "lastweek", label: "الأسبوع الماضي" },
  { key: "month", label: "هذا الشهر" },
  { key: "30", label: "آخر 30 يوم" },
];

const WELCOME = {
  queued: ["ترحيب بالطابور", "wait"],
  sent: ["تم الترحيب", "ok"],
  failed: ["فشل الترحيب", "bad"],
};

export default function Registrations() {
  const { toast } = useAdmin();
  const [preset, setPreset] = useState("week");
  const [from, setFrom] = useState(() => toInputDate(getPreset("week")[0]));
  const [to, setTo] = useState(() => toInputDate(getPreset("week")[1]));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("");
  const [refF, setRefF] = useState("");
  const [tab, setTab] = useState("list");
  const [noteRow, setNoteRow] = useState(null);
  const [site, setSite] = useState(SITE);
  const [selected, setSelected] = useState(new Set());
  const [welcomeFor, setWelcomeFor] = useState(null); // مصفوفة صفوف

  useEffect(() => {
    loadSiteContent().then(setSite).catch(() => {});
  }, []);

  function applyPreset(key) {
    setPreset(key);
    const [s, e] = getPreset(key);
    setFrom(toInputDate(s));
    setTo(toInputDate(e));
  }

  // مباشر: التسجيلات الجديدة وحالة الترحيب بتتحدث لحالها
  useEffect(() => {
    if (!from || !to || from > to) return undefined;
    setLoading(true);
    setLoadErr("");
    const s = startOfDay(fromInputDate(from));
    const e = endOfDay(fromInputDate(to));
    const q = query(
      collection(db, "registrations"),
      where("createdAt", ">=", Timestamp.fromDate(s)),
      where("createdAt", "<=", Timestamp.fromDate(e)),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const x = d.data();
            return { id: d.id, ...x, createdAt: x.createdAt?.toDate?.() || null };
          })
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoadErr("تعذّر تحميل البيانات. تأكد من قواعد Firestore ومن الإنترنت.");
        setLoading(false);
      }
    );
  }, [from, to]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusF === "_nowelcome") {
        if (r.welcome?.status === "sent") return false;
      } else if (statusF && r.status !== statusF) return false;
      if (refF && (r.ref || "direct") !== refF) return false;
      if (!s) return true;
      return [r.name, r.phone, r.city, r.country, r.ref, r.utm].some((v) => String(v || "").toLowerCase().includes(s));
    });
  }, [rows, search, statusF, refF]);

  const stats = useMemo(() => buildStats(rows, from, to), [rows, from, to]);
  const refs = useMemo(() => [...new Set(rows.map((r) => r.ref || "direct"))].sort(), [rows]);

  async function changeStatus(row, status) {
    try {
      await updateDoc(doc(db, "registrations", row.id), { status });
    } catch {
      toast("فشل تحديث الحالة", "bad");
    }
  }

  async function saveNote(row, notes) {
    setNoteRow(null);
    try {
      await updateDoc(doc(db, "registrations", row.id), { notes });
    } catch {
      toast("فشل حفظ الملاحظة", "bad");
    }
  }

  async function remove(row) {
    if (!confirm(`حذف تسجيل "${row.name}" نهائياً؟`)) return;
    try {
      await deleteDoc(doc(db, "registrations", row.id));
    } catch {
      toast("فشل الحذف", "bad");
    }
  }

  const toggleSel = (id) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSel = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSel ? new Set() : new Set(filtered.map((r) => r.id)));
  const selRows = rows.filter((r) => selected.has(r.id));

  function exportExcel() {
    const data = filtered.map((r, i) => ({
      "#": i + 1,
      "الاسم": r.name,
      "رقم الواتساب": "+" + r.phone,
      "الدولة": r.country,
      "المدينة": r.city,
      "العمر": r.age,
      "الخبرة": r.experience,
      "ساعات العمل": r.hours,
      "مصدر المعرفة": r.source,
      "المسوّق (ref)": r.ref || "direct",
      "المصدر (src)": r.utm || "",
      "الحالة": statusMap[r.status]?.label || r.status,
      "الترحيب": WELCOME[r.welcome?.status]?.[0] || "",
      "ملاحظات": r.notes || "",
      "تاريخ التسجيل": fmtDateTime(r.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [5, 22, 18, 12, 14, 7, 24, 14, 14, 16, 16, 12, 14, 30, 20].map((w) => ({ wch: w }));
    const byRef = stats.byRef.map(([ref, v]) => ({
      "المسوّق": ref,
      "عدد التسجيلات": v.total,
      "انضم": v.joined,
      "نسبة الانضمام %": v.total ? Math.round((v.joined / v.total) * 100) : 0,
    }));
    const ws2 = XLSX.utils.json_to_sheet(byRef);
    ws2["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.utils.book_append_sheet(wb, ws, "التسجيلات");
    XLSX.utils.book_append_sheet(wb, ws2, "أداء الفريق");
    XLSX.writeFile(wb, `registrations_${from}_to_${to}.xlsx`);
  }

  function exportCSV() {
    const header = ["الاسم", "رقم الواتساب", "الدولة", "المدينة", "العمر", "المسوّق", "المصدر", "الحالة", "تاريخ التسجيل"];
    const lines = filtered.map((r) =>
      [r.name, "+" + r.phone, r.country, r.city, r.age, r.ref || "direct", r.utm || "", statusMap[r.status]?.label || r.status, fmtDateTime(r.createdAt)]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `registrations_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const notWelcomed = rows.filter((r) => r.welcome?.status !== "sent").length;

  return (
    <div className="page">
      <div className="panel">
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.key} className={"chip" + (preset === p.key ? " active" : "")} onClick={() => applyPreset(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="range">
          <label>
            من
            <input type="date" value={from} max={to} onChange={(e) => (setPreset("custom"), setFrom(e.target.value))} />
          </label>
          <label>
            إلى
            <input type="date" value={to} min={from} onChange={(e) => (setPreset("custom"), setTo(e.target.value))} />
          </label>
        </div>
      </div>

      {loadErr && <div className="alert danger">{loadErr}</div>}

      <div className="kpis">
        <Kpi label="إجمالي التسجيلات" value={rows.length} />
        <Kpi label="جديد" value={stats.byStatus.new || 0} color={statusMap.new.color} />
        <Kpi label="ما وصلهم ترحيب" value={notWelcomed} color={statusMap.contacted.color} />
        <Kpi
          label="انضم"
          value={stats.byStatus.joined || 0}
          sub={rows.length ? Math.round(((stats.byStatus.joined || 0) / rows.length) * 100) + "%" : "0%"}
          color={statusMap.joined.color}
        />
      </div>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["list", "المسجلين"],
          ["stats", "الإحصائيات"],
          ["tracking", "تتبع المنشورات"],
          ["links", "روابط الفريق"],
        ]}
      />

      {tab === "list" && (
        <div className="panel">
          <div className="toolbar">
            <input className="search" placeholder="بحث بالاسم أو الرقم أو المدينة..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="_nowelcome">ما وصلهم ترحيب</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select value={refF} onChange={(e) => setRefF(e.target.value)}>
              <option value="">كل المسوّقين</option>
              {refs.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <div className="toolbar-actions">
              <button className="btn primary small" onClick={exportExcel} disabled={!filtered.length}>
                ⬇ Excel
              </button>
              <button className="btn small" onClick={exportCSV} disabled={!filtered.length}>
                ⬇ CSV
              </button>
            </div>
          </div>

          <div className="sel-bar">
            <span className="muted count-line">
              عرض {filtered.length} من {rows.length}
              {selected.size > 0 && ` · محدد ${selected.size}`}
            </span>
            <div className="row-gap">
              <button
                className="btn small"
                onClick={() => setSelected(new Set(filtered.filter((r) => r.welcome?.status !== "sent").map((r) => r.id)))}
                disabled={!filtered.length}
              >
                حدد اللي ما وصلهم ترحيب
              </button>
              <button className="btn small wa-solid" disabled={!selected.size} onClick={() => setWelcomeFor(selRows)}>
                <WaIcon size={15} /> إرسال ترحيب ({selected.size})
              </button>
            </div>
          </div>

          {loading ? (
            <Empty>جاري التحميل...</Empty>
          ) : !filtered.length ? (
            <Empty>لا يوجد تسجيلات في هذه الفترة</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="check-col">
                      <input type="checkbox" checked={allSel} onChange={toggleAll} aria-label="تحديد الكل" />
                    </th>
                    <th>الاسم</th>
                    <th>الواتساب</th>
                    <th>المكان</th>
                    <th>العمر</th>
                    <th>الخبرة / الساعات</th>
                    <th>المسوّق</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className={selected.has(r.id) ? "row-sel" : ""}>
                      <td className="check-col" data-label="تحديد">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} />
                      </td>
                      <td data-label="الاسم">
                        <b>{r.name}</b>
                        {r.welcome?.status && (
                          <div>
                            <Tag kind={WELCOME[r.welcome.status]?.[1]} title={r.welcome.error || r.welcome.by || ""}>
                              {WELCOME[r.welcome.status]?.[0]}
                            </Tag>
                          </div>
                        )}
                        {r.funnel?.status && (
                          <div>
                            <Tag kind={{ completed: "ok", active: "info", queued: "wait", rejected: "bad", failed: "bad" }[r.funnel.status] || ""}>
                              متابعة: {{ queued: "بالطابور", active: "بالمحادثة", completed: "خلّص التسجيل", rejected: "رفض", expired: "انتهى يومه", failed: "مش على واتساب" }[r.funnel.status] || r.funnel.status}
                            </Tag>
                          </div>
                        )}
                        {r.notes && <div className="note-preview">📝 {r.notes}</div>}
                      </td>
                      <td data-label="الواتساب">
                        <a
                          className="wa-btn"
                          href={waLink(r.phone, (site.waGreeting || "").replace("{name}", r.name.split(" ")[0]))}
                          target="_blank"
                          rel="noreferrer"
                          title="فتح محادثة من واتسابك"
                          onClick={() => r.status === "new" && changeStatus(r, "contacted")}
                        >
                          <WaIcon size={16} />
                          <span dir="ltr">+{r.phone}</span>
                        </a>
                      </td>
                      <td data-label="المكان">
                        {r.city}، {r.country}
                      </td>
                      <td data-label="العمر">{r.age}</td>
                      <td data-label="الخبرة">
                        <div className="small-text">{r.experience}</div>
                        <div className="small-text muted">{r.hours}</div>
                      </td>
                      <td data-label="المسوّق">
                        <span className="ref-tag">{r.ref || "direct"}</span>
                        <div className="small-text muted">
                          {r.source}
                          {r.utm ? ` · ${r.utm}` : ""}
                        </div>
                      </td>
                      <td data-label="الحالة">
                        <select
                          className="status-select"
                          style={{ "--c": statusMap[r.status]?.color || "#64748b" }}
                          value={r.status}
                          onChange={(e) => changeStatus(r, e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td data-label="التاريخ" className="small-text nowrap">
                        {fmtDateTime(r.createdAt)}
                      </td>
                      <td className="row-actions">
                        <button className="icon-btn" title="إرسال ترحيب من حساب النظام" onClick={() => setWelcomeFor([r])}>
                          👋
                        </button>
                        <button className="icon-btn" title="ملاحظة" onClick={() => setNoteRow(r)}>
                          📝
                        </button>
                        <button className="icon-btn" title="حذف" onClick={() => remove(r)}>
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "stats" && <StatsView stats={stats} total={rows.length} />}
      {tab === "tracking" && <Tracking rows={rows} />}
      {tab === "links" && <LinksView />}

      {noteRow && <NoteModal row={noteRow} onClose={() => setNoteRow(null)} onSave={saveNote} />}
      {welcomeFor && (
        <WelcomeModal
          rows={welcomeFor}
          site={site}
          onClose={() => setWelcomeFor(null)}
          onDone={() => {
            setWelcomeFor(null);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}

/* ======================= رسالة الترحيب (يدوية) ======================= */
function WelcomeModal({ rows, site, onClose, onDone }) {
  const { app, waAccounts, workers, toast } = useAdmin();
  const usable = waAccounts.filter((a) => a.enabled !== false);
  const def = usable.find((a) => a.id === app.welcomeAccountId) || usable.find((a) => a.state === "open") || usable[0];
  const [accId, setAccId] = useState(def?.id || "");
  const [text, setText] = useState(site.waGreeting || SITE.waGreeting);
  const [skipSent, setSkipSent] = useState(true);
  const [busy, setBusy] = useState(false);

  const targets = rows.filter((r) => !(skipSent && r.welcome?.status === "sent") && r.welcome?.status !== "queued");
  const acc = waAccounts.find((a) => a.id === accId);

  async function send() {
    if (!accId) return toast("اختار حساب واتساب", "bad");
    if (!targets.length) return toast("ما في حدا يتبعتله", "bad");
    setBusy(true);
    try {
      for (let i = 0; i < targets.length; i += 200) {
        const b = writeBatch(db);
        targets.slice(i, i + 200).forEach((r) => {
          b.set(doc(collection(db, "wa_dms")), {
            accountId: accId,
            phone: r.phone,
            name: r.name,
            regId: r.id,
            text,
            status: "queued",
            createdAt: serverTimestamp(),
          });
          b.update(doc(db, "registrations", r.id), { welcome: { status: "queued", at: serverTimestamp(), by: acc?.name || "" } });
        });
        await b.commit();
      }
      toast(`دخل ${targets.length} ترحيب الطابور — بينبعتوا وحدة وحدة بفاصل نص دقيقة تقريباً`, "ok", 4500);
      onDone();
    } catch (e) {
      console.error(e);
      toast("صار خطأ بالحفظ", "bad");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`إرسال ترحيب (${targets.length})`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" onClick={send} disabled={busy || !targets.length || !accId}>
            {busy ? "جاري..." : "إرسال"}
          </button>
        </>
      }
    >
      {!workers.waOnline && <WorkerOff name="عامل الواتساب" />}
      {!usable.length ? (
        <div className="alert warn">ما في حسابات واتساب — أضف حساب من قسم واتساب.</div>
      ) : (
        <div className="field">
          <label>من أي حساب؟</label>
          <select value={accId} onChange={(e) => setAccId(e.target.value)}>
            {usable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.phone ? `(+${a.phone})` : ""} {a.state === "open" ? "" : "— مش متصل"}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>نص الرسالة ({"{name}"} = الاسم الأول، والتنويع {"{أهلاً|مرحبا}"} شغال)</label>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {rows.some((r) => r.welcome?.status === "sent") && (
        <label className="check-line">
          <input type="checkbox" checked={skipSent} onChange={(e) => setSkipSent(e.target.checked)} /> تخطّى اللي وصلهم ترحيب قبل
        </label>
      )}
      <p className="small-text muted">
        الرسائل ما بتنبعت إلا لما تضغط إرسال. بتنبعت وحدة وحدة بفاصل 20–45 ثانية، والحالة بتتحول لـ "تم التواصل" تلقائياً.
      </p>
    </Modal>
  );
}

/* ======================= الإحصائيات ======================= */
function buildStats(rows, from, to) {
  const byStatus = {};
  const byRefMap = {};
  const bySource = {};
  const byCountry = {};
  const dayMap = {};

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    const ref = r.ref || "direct";
    byRefMap[ref] = byRefMap[ref] || { total: 0, joined: 0 };
    byRefMap[ref].total++;
    if (r.status === "joined") byRefMap[ref].joined++;
    bySource[r.source || "—"] = (bySource[r.source || "—"] || 0) + 1;
    byCountry[r.country || "—"] = (byCountry[r.country || "—"] || 0) + 1;
    if (r.createdAt) {
      const k = toInputDate(r.createdAt);
      dayMap[k] = (dayMap[k] || 0) + 1;
    }
  }

  const days = [];
  if (from && to) {
    let d = fromInputDate(from);
    const end = fromInputDate(to);
    let guard = 0;
    while (d <= end && guard < 366) {
      const k = toInputDate(d);
      days.push({ date: new Date(d), count: dayMap[k] || 0 });
      d = addDays(d, 1);
      guard++;
    }
  }

  const sortDesc = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  return {
    byStatus,
    byRef: Object.entries(byRefMap).sort((a, b) => b[1].total - a[1].total),
    bySource: sortDesc(bySource),
    byCountry: sortDesc(byCountry),
    days,
  };
}

function StatsView({ stats, total }) {
  const maxDay = Math.max(1, ...stats.days.map((d) => d.count));
  return (
    <div className="stats-grid">
      <div className="panel span-2">
        <h3 className="panel-title">التسجيلات اليومية</h3>
        {stats.days.length > 62 ? (
          <div className="muted">اختر فترة أقصر من شهرين لعرض الرسم اليومي.</div>
        ) : (
          <div className="bars">
            {stats.days.map((d) => (
              <div className="bar-col" key={d.date.toISOString()} title={`${fmtDay(d.date)}: ${d.count}`}>
                <span className="bar-val">{d.count || ""}</span>
                <div className="bar" style={{ height: `${(d.count / maxDay) * 100}%` }} />
                <span className="bar-label">{fmtDay(d.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h3 className="panel-title">أداء أعضاء الفريق</h3>
        {!stats.byRef.length ? (
          <div className="muted">لا يوجد بيانات</div>
        ) : (
          <table className="mini-table">
            <thead>
              <tr>
                <th>المسوّق</th>
                <th>تسجيلات</th>
                <th>انضم</th>
              </tr>
            </thead>
            <tbody>
              {stats.byRef.map(([ref, v], i) => (
                <tr key={ref}>
                  <td>
                    {i === 0 && "🥇 "}
                    {i === 1 && "🥈 "}
                    {i === 2 && "🥉 "}
                    {ref}
                  </td>
                  <td>{v.total}</td>
                  <td>{v.joined}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3 className="panel-title">حسب الحالة</h3>
        <HBars items={STATUSES.map((s) => [s.label, stats.byStatus[s.value] || 0, s.color])} total={total} />
      </div>

      <div className="panel">
        <h3 className="panel-title">من وين سمعوا عنا</h3>
        <HBars items={stats.bySource} total={total} />
      </div>

      <div className="panel">
        <h3 className="panel-title">حسب الدولة</h3>
        <HBars items={stats.byCountry} total={total} />
      </div>
    </div>
  );
}

/* ======================= روابط الفريق ======================= */
function LinksView() {
  const { app } = useAdmin();
  const [name, setName] = useState("");
  const [src, setSrc] = useState("");
  const [copied, setCopied] = useState("");

  const clean = name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-؀-ۿ]/g, "");
  const base = app.siteUrl || window.location.origin + window.location.pathname;
  let link = "";
  if (clean) {
    try {
      const u = new URL(base);
      u.searchParams.set("ref", clean);
      if (src) u.searchParams.set("src", src);
      link = u.toString();
    } catch {
      link = `${base}?ref=${encodeURIComponent(clean)}${src ? `&src=${encodeURIComponent(src)}` : ""}`;
    }
  }

  async function copy(text) {
    await copyText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 1800);
  }

  return (
    <Panel title="إنشاء رابط خاص لعضو بالفريق" className="narrow-panel">
      <p className="muted">
        كل عضو بينشر رابطه الخاص، وكل شخص بيسجّل من خلاله بينحسب إله. ما في داعي تعمل رابط جديد كل أسبوع، الفلترة بالتاريخ بتعطيك نتائج كل أسبوع لحاله.
      </p>
      <div className="field">
        <label>اسم العضو (بالإنجليزي أفضل)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: ahmed" dir="ltr" />
      </div>
      <div className="field">
        <label>المنصة (اختياري)</label>
        <div className="chips">
          {["", "facebook", "tiktok", "instagram", "whatsapp", "telegram"].map((s) => (
            <button key={s || "none"} type="button" className={"chip" + (src === s ? " active" : "")} onClick={() => setSrc(s)}>
              {s || "بدون"}
            </button>
          ))}
        </div>
      </div>
      {link && (
        <div className="link-box">
          <code dir="ltr">{link}</code>
          <button className="btn primary small" onClick={() => copy(link)}>
            {copied === link ? "✓ تم النسخ" : "نسخ"}
          </button>
        </div>
      )}
    </Panel>
  );
}

/* ======================= نافذة الملاحظات ======================= */
function NoteModal({ row, onClose, onSave }) {
  const [v, setV] = useState(row.notes || "");
  return (
    <Modal
      title={`ملاحظة: ${row.name}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" onClick={() => onSave(row, v.trim().slice(0, 1000))}>
            حفظ
          </button>
        </>
      }
    >
      <textarea rows={5} value={v} onChange={(e) => setV(e.target.value)} placeholder="اكتب ملاحظتك..." autoFocus />
    </Modal>
  );
}
