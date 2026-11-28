// ============================================================
//  متابعة الطلاب على المودل: المهام القادمة + إدارة الطلاب + الإعداد
//  البيانات بتيجي من عامل المودل (moodle-worker/) اللي شغال على الجوال
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { fmtAgo, toMs } from "../../utils";
import { runCommand, store, useAdmin, useDocData, useQuery } from "../hooks";
import { Empty, Field, Kpi, Modal, Panel, SubTabs, Tag } from "../ui";
import { encryptForWorker } from "./crypto";
import { useVault, seal, unseal } from "./vault";
import {
  CLIENT_STATUS, CUR, ClientFields, ClientsSummary, EMPTY_CLIENT, EditClient, Finance, PortalButtons, Universities, VaultBar,
  clientFields, exportClients, money, remainingOf, sortByName, uniName, vaultPatch, CopyAllButton, CopyStudentButton,
} from "./clients";

const KIND = {
  assign: ["واجب", "📝"],
  quiz: ["اختبار", "🧪"],
  workshop: ["مشروع", "🛠"],
  lesson: ["درس", "📖"],
  forum: ["نقاش", "💬"],
  h5pactivity: ["نشاط", "🎯"],
  choice: ["تصويت", "🗳"],
  feedback: ["استبيان", "📋"],
  questionnaire: ["استبيان", "📋"],
  survey: ["استبيان", "📋"],
  bigbluebuttonbn: ["محاضرة أونلاين", "🎥"],
  zoom: ["محاضرة أونلاين", "🎥"],
  attendance: ["حضور", "🙋"],
  resource: ["ملف", "📄"],
  folder: ["مجلد", "📁"],
  url: ["رابط", "🔗"],
  page: ["صفحة", "📃"],
  book: ["كتاب", "📚"],
  event: ["موعد", "📌"],
};
const kindOf = (k) => KIND[k] || ["نشاط", "📌"];

const STATUS = {
  pending: ["جاري الربط...", "wait"],
  ok: ["مربوط", "ok"],
  relink: ["بدها إعادة ربط", "bad"],
  error: ["في مشكلة", "bad"],
  sso: ["بدها رابط التقويم", "wait"],
};

// حالة المودل (الطالب اللي انضاف بدون متابعة مودل ما إله ربط)
const statusOf = (s) => (s.mode === "none" ? ["بدون متابعة مودل", ""] : STATUS[s.status] || ["—", ""]);

const DAY = 86400_000;
const dateFmt = new Intl.DateTimeFormat("ar", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fmtDue = (ms) => (ms ? dateFmt.format(new Date(ms)) : "بدون موعد");
function leftText(ms) {
  if (!ms) return "";
  const h = (ms - Date.now()) / 3600_000;
  if (h < 0) return h > -24 ? `فات من ${Math.round(-h)} س` : `فات من ${Math.round(-h / 24)} يوم`;
  if (h < 1) return `باقي ${Math.max(1, Math.round(h * 60))} د`;
  if (h < 48) return `باقي ${Math.round(h)} س`;
  return `باقي ${Math.round(h / 24)} يوم`;
}
const urgency = (ms) => {
  const h = (ms - Date.now()) / 3600_000;
  return h < 0 ? "bad" : h < 24 ? "bad" : h < 72 ? "wait" : "info";
};

const isWorkerOnline = (w) => !!w && w.state === "running" && Date.now() - toMs(w.lastSeen) < 150_000;

export default function Students() {
  const [tab, setTab] = useState(() => store.get("students.tab", "tasks"));
  useEffect(() => store.set("students.tab", tab), [tab]);
  const worker = useDocData("workers/moodle");
  const [students] = useQuery(() => collection(db, "moodle_students"), []);
  const [items, itemsLoading] = useQuery(() => collection(db, "moodle_items"), []);
  const [unis] = useQuery(() => collection(db, "universities"), []);
  const sortedUnis = [...unis].sort(sortByName);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const online = isWorkerOnline(worker);
  const needLink = students.filter((s) => s.mode !== "none" && (s.status === "relink" || s.status === "error" || s.status === "sso")).length;

  return (
    <div className="page">
      {worker !== undefined && !online && (
        <div className="alert warn">
          {worker ? "عامل المودل مطفي على الجوال — المزامنة والتنبيهات واقفة لحد ما يرجع." : "عامل المودل لسا ما اشتغل ولا مرة. شوف تبويب «الإعداد»."}
        </div>
      )}
      <SubTabs
        tabs={[
          ["tasks", "المهام"],
          ["students", "الطلاب", needLink || null],
          ["universities", "الجامعات"],
          ["setup", "الإعداد"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "tasks" && <Tasks items={items} loading={itemsLoading} students={students} />}
      {tab === "students" && <StudentsTab students={students} items={items} worker={worker} online={online} unis={sortedUnis} />}
      {tab === "universities" && <Universities unis={sortedUnis} students={students} />}
      {tab === "setup" && <Setup worker={worker} online={online} />}
    </div>
  );
}

// ============================================================
//  المهام
// ============================================================
// مجموعة المواد المكتومة لكل طالب (studentId → Set أسماء مواد)
function useMutedMap(students) {
  return useMemo(() => {
    const m = {};
    for (const s of students) m[s.id] = new Set(s.mutedCourses || []);
    return m;
  }, [students]);
}
const isMuted = (muted, it) => muted[it.studentId]?.has(it.course || "");

async function toggleItemDone(it, toast) {
  try {
    await updateDoc(doc(db, "moodle_items", it.id), { done: !it.done, doneAt: it.done ? null : serverTimestamp() });
  } catch (e) {
    toast(e.message, "bad");
  }
}

// جدول المهام — مشترك بين تبويب المهام وصفحة الطالب
function TaskTable({ rows, onToggle, showStudent = true }) {
  const t = Date.now();
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>الموعد</th>
            {showStudent && <th>الطالب</th>}
            <th>المهمة</th>
            <th>الحالة</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((it) => {
            const [label, icon] = kindOf(it.kind);
            return (
              <tr key={it.id} style={it.gone ? { opacity: 0.55 } : undefined}>
                <td data-label="الموعد">
                  <b>{fmtDue(it.dueMs)}</b>
                  {it.dueMs ? (
                    <div>
                      <Tag kind={it.done || it.submitted ? "ok" : urgency(it.dueMs)}>{leftText(it.dueMs)}</Tag>
                    </div>
                  ) : null}
                </td>
                {showStudent && <td data-label="الطالب">{it.student}</td>}
                <td data-label="المهمة">
                  <div>
                    {icon} <span className="muted small-text">{label}</span>{" "}
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer">
                        <b>{it.title}</b>
                      </a>
                    ) : (
                      <b>{it.title}</b>
                    )}
                  </div>
                  <div className="small-text muted">
                    {it.course}
                    {it.timeLimitMin ? ` · مدة ${it.timeLimitMin} دقيقة` : ""}
                    {it.opens && toMs(it.opens) > t ? ` · بيفتح ${fmtDue(toMs(it.opens))}` : ""}
                    {it.gone ? " · انشال من المودل" : ""}
                  </div>
                </td>
                <td data-label="الحالة">
                  {it.submitted ? <Tag kind="ok">مسلّم</Tag> : it.done ? <Tag kind="ok">خلصت</Tag> : it.task ? <Tag>لسا</Tag> : <Tag kind="info">محتوى</Tag>}
                  {it.grade ? <div className="small-text">العلامة: {it.grade}</div> : null}
                </td>
                <td>
                  {it.task && !it.submitted && (
                    <button className="btn small" onClick={() => onToggle(it)}>
                      {it.done ? "رجّعها" : "✓ خلصت"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Tasks({ items, loading, students }) {
  const { toast } = useAdmin();
  const [view, setView] = useState("upcoming");
  const [who, setWho] = useState("");
  const [q, setQ] = useState("");
  const t = Date.now();
  const muted = useMutedMap(students);

  const visible = useMemo(() => items.filter((it) => !isMuted(muted, it)), [items, muted]);

  const rows = useMemo(() => {
    const list = visible.map((it) => ({ ...it, dueMs: toMs(it.due), seenMs: toMs(it.firstSeen) }));
    const open = (it) => it.task && !it.done && !it.submitted && !it.gone;
    const pick = {
      upcoming: (it) => open(it) && it.dueMs > t,
      late: (it) => open(it) && it.dueMs && it.dueMs <= t && it.dueMs > t - 14 * DAY,
      nodue: (it) => open(it) && !it.dueMs,
      new: (it) => t - it.seenMs < 3 * DAY,
      done: (it) => it.task && (it.done || it.submitted),
      all: () => true,
    }[view];
    const s = q.trim().toLowerCase();
    return list
      .filter(pick)
      .filter((it) => !who || it.studentId === who)
      .filter((it) => !s || `${it.title} ${it.course} ${it.student}`.toLowerCase().includes(s))
      .sort((a, b) =>
        view === "new" ? b.seenMs - a.seenMs : view === "done" || view === "late" ? (b.dueMs || 0) - (a.dueMs || 0) : (a.dueMs || Infinity) - (b.dueMs || Infinity)
      )
      .slice(0, 300);
  }, [visible, view, who, q, t]);

  const open = visible.filter((it) => it.task && !it.done && !it.submitted && !it.gone);
  const due = (it) => toMs(it.due);
  const k24 = open.filter((it) => due(it) > t && due(it) < t + DAY).length;
  const k7 = open.filter((it) => due(it) > t && due(it) < t + 7 * DAY).length;
  const late = open.filter((it) => due(it) && due(it) <= t && due(it) > t - 14 * DAY).length;
  const fresh = visible.filter((it) => t - toMs(it.firstSeen) < DAY).length;

  const toggleDone = (it) => toggleItemDone(it, toast);

  return (
    <>
      <div className="kpis">
        <Kpi label="خلال 24 ساعة" value={k24} color="#ef4444" />
        <Kpi label="هالأسبوع" value={k7} color="#f59e0b" />
        <Kpi label="فات موعدها" value={late} color="#dc2626" hint="مش مسلّمة ومش معلّمة خلصت — آخر أسبوعين" />
        <Kpi label="جديد اليوم" value={fresh} color="#7c3aed" />
      </div>

      <SubTabs
        tabs={[
          ["upcoming", "القادمة"],
          ["late", "فات موعدها", late || null],
          ["nodue", "بدون موعد"],
          ["new", "الجديد"],
          ["done", "المخلّصة"],
          ["all", "الكل"],
        ]}
        value={view}
        onChange={setView}
      />
      <div className="filters">
        <input placeholder="بحث بالعنوان أو المادة أو الطالب..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">كل الطلاب</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loader" />
      ) : !rows.length ? (
        <Empty>{items.length ? "ما في إشي هون" : "لسا ما في مهام — ضيف طالب من تبويب «الطلاب»"}</Empty>
      ) : (
        <TaskTable rows={rows} onToggle={toggleDone} />
      )}
    </>
  );
}

// ============================================================
//  الطلاب
// ============================================================
function StudentsTab({ students, items, worker, online, unis }) {
  const { toast } = useAdmin();
  const [relink, setRelink] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [uniF, setUniF] = useState("");
  const [stF, setStF] = useState("");
  const [owes, setOwes] = useState(false);
  const openStudent = students.find((s) => s.id === openId);

  // عدّ المهام القادمة لكل طالب (بدون المواد المكتومة) — من المهام الفعلية
  const counts = useMemo(() => {
    const t = Date.now();
    const m = {};
    for (const it of items) {
      if (!it.task || it.done || it.submitted || it.gone) continue;
      const muted = (students.find((s) => s.id === it.studentId)?.mutedCourses || []).includes(it.course || "");
      if (muted) continue;
      const due = toMs(it.due);
      if (due && due < t) continue;
      m[it.studentId] = (m[it.studentId] || 0) + 1;
    }
    return m;
  }, [items, students]);

  const uniList = [...new Set(students.map((s) => uniName(s, unis)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  const shown = [...students]
    .filter((s) => {
      if (uniF && uniName(s, unis) !== uniF) return false;
      if (stF && (s.clientStatus || "active") !== stF) return false;
      if (owes && !(remainingOf(s) > 0)) return false;
      const t = q.trim().toLowerCase();
      return !t || [s.name, s.studentNo, s.phone, uniName(s, unis), s.college, s.major].some((v) => String(v || "").toLowerCase().includes(t));
    })
    .sort(sortByName);

  if (openStudent)
    return (
      <StudentDetail
        s={openStudent}
        items={items.filter((it) => it.studentId === openStudent.id)}
        online={online}
        worker={worker}
        unis={unis}
        toast={toast}
        onBack={() => setOpenId(null)}
        onRelink={() => setRelink(openStudent)}
      />
    );

  return (
    <>
      <VaultBar />
      <ClientsSummary students={students} />
      <div className="toolbar">
        <input className="search" placeholder="بحث بالاسم أو الرقم الجامعي أو التخصص..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={uniF} onChange={(e) => setUniF(e.target.value)}>
          <option value="">كل الجامعات</option>
          {uniList.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <select value={stF} onChange={(e) => setStF(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(CLIENT_STATUS).map(([k, [l]]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <label className="check-line">
          <input type="checkbox" checked={owes} onChange={(e) => setOwes(e.target.checked)} /> عليه مبلغ
        </label>
        <div className="toolbar-actions">
          <button className="btn small" onClick={() => exportClients(shown, unis)} disabled={!shown.length}>
            ⬇ Excel
          </button>
          <CopyAllButton students={shown} unis={unis} />
          <button className="btn primary small" onClick={() => setAdding((v) => !v)}>
            {adding ? "✕ سكّر" : "+ إضافة طالب / عميل"}
          </button>
        </div>
      </div>
      {adding && <AddStudent worker={worker} online={online} unis={unis} onDone={() => setAdding(false)} />}
      {!shown.length ? (
        <Empty>{students.length ? "ما في طلاب بهالفلتر" : "ما في طلاب لسا — اضغط «+ إضافة طالب / عميل»"}</Empty>
      ) : (
        <div className="cards">
          {shown.map((s) => (
            <StudentCard key={s.id} s={s} unis={unis} upcoming={counts[s.id] || 0} onOpen={() => setOpenId(s.id)} />
          ))}
        </div>
      )}
      {relink && <RelinkModal s={relink} worker={worker} onClose={() => setRelink(null)} />}
    </>
  );
}

// بوكس الطالب — بالضغط عليه بتفتح صفحته
function StudentCard({ s, unis, upcoming, onOpen }) {
  const [label, kind] = statusOf(s);
  const rem = remainingOf(s);
  const [cl, ck] = CLIENT_STATUS[s.clientStatus || "active"] || CLIENT_STATUS.active;
  return (
    <button type="button" className="card student-card" onClick={onOpen}>
      <div className="card-head">
        <div>
          <div className="card-title">{s.name}</div>
          <div className="card-meta">
            <Tag kind={ck}>{cl}</Tag>
            {Number(s.total) > 0 && <Tag kind={rem > 0 ? "bad" : "ok"}>{rem > 0 ? `باقي ${money(rem)} ${CUR}` : "خالص ✓"}</Tag>}
            <Tag kind={kind}>{label}</Tag>
            {s.enabled === false && <Tag>المتابعة موقوفة</Tag>}
          </div>
        </div>
        <span className="student-card-arrow" aria-hidden="true">‹</span>
      </div>
      <div className="small-text muted">{[uniName(s, unis), s.college, s.major].filter(Boolean).join(" · ") || s.siteName || hostOf(s.site)}</div>
      <div className="small-text muted">
        {s.studentNo && <span dir="ltr">{s.studentNo} · </span>}
        {s.mode === "none" ? "بدون متابعة مودل" : `${s.lastSync ? `آخر مزامنة ${fmtAgo(s.lastSync)}` : "لسا ما انمزمن"} · ${upcoming} مهمة قادمة`}
      </div>
      {s.statusMsg && s.mode !== "none" && <div className="small-text err">{s.statusMsg}</div>}
    </button>
  );
}

// صفحة الطالب: بياناته + تحديد المساقات + مهامه
function StudentDetail({ s, items, online, worker, unis, toast, onBack, onRelink }) {
  const [label, kind] = statusOf(s);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const selectedMode = s.coursesMode === "selected";
  const [showMuted, setShowMuted] = useState(false);
  const muted = new Set(s.mutedCourses || []);

  // المواد المكتشفة من المهام (الاسم + عدد المهام)
  const courses = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const name = it.course || "بدون مادة";
      const c = m.get(name) || { name, total: 0, open: 0 };
      c.total++;
      if (it.task && !it.done && !it.submitted && !it.gone) c.open++;
      m.set(name, c);
    }
    return [...m.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, "ar"));
  }, [items]);

  const rows = useMemo(() => {
    const t = Date.now();
    return items
      .filter((it) => !muted.has(it.course || ""))
      .map((it) => ({ ...it, dueMs: toMs(it.due) }))
      .filter((it) => it.task && (showMuted || (!it.done && !it.submitted)) ) // المهام (مع خيار عرض المخلّص)
      .filter((it) => !it.gone)
      .sort((a, b) => {
        const oa = a.done || a.submitted ? 1 : 0;
        const ob = b.done || b.submitted ? 1 : 0;
        return oa - ob || (a.dueMs || Infinity) - (b.dueMs || Infinity);
      })
      .slice(0, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, s.mutedCourses, showMuted]);

  async function toggleCourse(name) {
    const next = muted.has(name) ? (s.mutedCourses || []).filter((c) => c !== name) : [...(s.mutedCourses || []), name];
    try {
      await updateDoc(doc(db, "moodle_students", s.id), { mutedCourses: next });
    } catch (e) {
      toast(e.message, "bad");
    }
  }
  // كل المواد ← ما في ولا مادة مكتومة · مواد محددة ← بنحفظ اللي اخترتهم، وأي مادة جديدة بتطلع بتنكتم لحالها
  async function setCoursesMode(mode) {
    const patch = mode === "all" ? { coursesMode: "all", mutedCourses: [], followedCourses: [] } : { coursesMode: "selected", followedCourses: courses.map((c) => c.name).filter((n) => !muted.has(n)) };
    await updateDoc(doc(db, "moodle_students", s.id), patch).catch((e) => toast(e.message, "bad"));
  }
  useEffect(() => {
    if (!selectedMode) return;
    const followed = new Set(s.followedCourses || []);
    const fresh = courses.map((c) => c.name).filter((n) => !followed.has(n) && !muted.has(n));
    if (fresh.length) updateDoc(doc(db, "moodle_students", s.id), { mutedCourses: [...(s.mutedCourses || []), ...fresh] }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMode, courses.length]);
  async function toggleFollow(name) {
    const followed = new Set(s.followedCourses || courses.map((c) => c.name).filter((n) => !muted.has(n)));
    followed.has(name) ? followed.delete(name) : followed.add(name);
    const mutedNext = courses.map((c) => c.name).filter((n) => !followed.has(n));
    await updateDoc(doc(db, "moodle_students", s.id), { followedCourses: [...followed], mutedCourses: mutedNext }).catch((e) => toast(e.message, "bad"));
  }
  async function sync() {
    setBusy(true);
    try {
      await runCommand("moodle", "moodle_sync", { studentId: s.id }, { timeout: 180_000 });
      toast(`تمت مزامنة ${s.name} ✓`, "ok");
    } catch (e) {
      toast(e.message, "bad", 6000);
    }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`حذف ${s.name} وكل مهامه؟ الربط رح ينمسح من الجوال كمان.`)) return;
    try {
      if (online) await runCommand("moodle", "moodle_delete", { studentId: s.id }, { timeout: 60_000 });
      else await deleteDoc(doc(db, "moodle_students", s.id));
      toast("انحذف", "ok");
      onBack();
    } catch (e) {
      toast(e.message, "bad");
    }
  }

  return (
    <div>
      <button className="btn small" onClick={onBack} style={{ marginBottom: 10 }}>
        › رجوع لكل الطلاب
      </button>

      <Panel
        title={s.name}
        actions={
          <div className="row-gap">
            <CopyStudentButton s={s} unis={unis} />
            <button className="btn small" onClick={() => setEditing(true)}>
              ✏️ تعديل البيانات
            </button>
          </div>
        }
      >
        <div className="card-meta">
          <Tag kind={(CLIENT_STATUS[s.clientStatus || "active"] || CLIENT_STATUS.active)[1]}>{(CLIENT_STATUS[s.clientStatus || "active"] || CLIENT_STATUS.active)[0]}</Tag>
          {s.semester && <span>{s.semester}</span>}
          {s.phone && (
            <a href={`https://wa.me/${s.phone}`} target="_blank" rel="noreferrer" dir="ltr">
              +{s.phone}
            </a>
          )}
        </div>
        <div className="client-info">
          <div>
            <span className="muted">الجامعة</span>
            <b>{uniName(s, unis) || "—"}</b>
          </div>
          <div>
            <span className="muted">الكلية</span>
            <b>{s.college || "—"}</b>
          </div>
          <div>
            <span className="muted">التخصص</span>
            <b>{s.major || "—"}</b>
          </div>
          <div>
            <span className="muted">الرقم الجامعي</span>
            <b dir="ltr">{s.studentNo || "—"}</b>
          </div>
        </div>
        <VaultBar />
        <PortalButtons s={s} unis={unis} />
        {s.notes && <div className="client-note">📝 {s.notes}</div>}
      </Panel>

      <Finance s={s} />

      <Panel title="💻 متابعة المودل">
        <div className="card-meta">
          <Tag kind={kind}>{label}</Tag>
          {s.enabled === false && <Tag>موقوف</Tag>}
          {s.studentNo && <span dir="ltr">{s.studentNo}</span>}
          <span>{s.siteName || hostOf(s.site)}</span>
          <span>{s.mode === "ical" ? "تقويم" : s.mode === "web" ? "دخول مباشر" : "حساب"}</span>
        </div>
        <div className="small-text muted" style={{ marginTop: 6 }}>
          {s.lastSync ? `آخر مزامنة ${fmtAgo(s.lastSync)}` : "لسا ما انمزمن"}
          {` · ${courses.length} مادة`}
        </div>
        {s.statusMsg && <div className="small-text err">{s.statusMsg}</div>}
        <div className="btn-row">
          <button className="btn small" onClick={sync} disabled={busy || !online || s.status === "pending"}>
            {busy ? "جاري..." : "مزامنة الآن"}
          </button>
          <button className="btn small" onClick={onRelink}>
            إعادة ربط
          </button>
          <button className="btn small" onClick={() => updateDoc(doc(db, "moodle_students", s.id), { enabled: s.enabled === false })}>
            {s.enabled === false ? "تشغيل" : "إيقاف"}
          </button>
          <button className="btn small danger-outline" onClick={remove}>
            حذف
          </button>
        </div>
      </Panel>

      <Panel title="المواد اللي بتتابعها">
        <div className="tabs" style={{ marginBottom: 10 }}>
          <button className={"tab" + (!selectedMode ? " active" : "")} onClick={() => selectedMode && setCoursesMode("all")}>
            كل المواد
          </button>
          <button className={"tab" + (selectedMode ? " active" : "")} onClick={() => !selectedMode && setCoursesMode("selected")}>
            مواد محددة
          </button>
        </div>
        <p className="small-text muted">
          {selectedMode ? "علّم المواد اللي بدك تتابعها بس. أي مادة جديدة بتطلع ما بتتابعها إلا إذا علّمتها." : "بنتابع كل مواده، وأي مادة جديدة بتنضاف لحالها."}
        </p>
        {!selectedMode ? (
          courses.length ? (
            <div className="small-text">{courses.map((c) => c.name).join(" · ")}</div>
          ) : (
            <Empty>{s.mode === "none" ? "هالطالب بدون متابعة مودل" : "لسا ما ظهرت مواد — اعمل مزامنة"}</Empty>
          )
        ) : !courses.length ? (
          <Empty>لسا ما ظهرت مواد — اعمل مزامنة</Empty>
        ) : (
          <div className="course-list">
            {courses.map((c) => (
              <label key={c.name} className={"course-row" + (muted.has(c.name) ? " off" : "")}>
                <input type="checkbox" checked={!muted.has(c.name)} onChange={() => toggleFollow(c.name)} />
                <span className="course-name">{c.name}</span>
                <span className="small-text muted">{c.open} قادمة · {c.total} كل</span>
              </label>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="مهام الطالب"
        actions={
          <button className="btn small" onClick={() => setShowMuted((v) => !v)}>
            {showMuted ? "أخفِ المخلّص" : "اعرض المخلّص"}
          </button>
        }
      >
        {!rows.length ? <Empty>ما في مهام هون</Empty> : <TaskTable rows={rows} onToggle={(it) => toggleItemDone(it, toast)} showStudent={false} />}
      </Panel>
      {editing && <EditClient s={s} unis={unis} onClose={() => setEditing(false)} />}
    </div>
  );
}

// الربط: بنشفّر السر بالمتصفح وبنبعته للعامل كأمر، والعامل بيمسحه من الأمر أول ما يستلمه
async function linkStudent(studentId, secret, worker) {
  const box = await encryptForWorker(secret, worker?.publicKey);
  return runCommand("moodle", "moodle_link", { studentId, box }, { timeout: 150_000 });
}

function AddStudent({ worker, online, unis, onDone }) {
  const { toast } = useAdmin();
  const vaultOpen = useVault();
  const [f, setF] = useState({ ...EMPTY_CLIENT, site: "", ical: "" });
  const [follow, setFollow] = useState(true); // متابعة المودل (ربط مع العامل)
  const [mode, setMode] = useState("password"); // password | ical
  const [site, setSite] = useState(null); // نتيجة فحص الموقع
  const [busy, setBusy] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const uni = unis.find((u) => u.id === f.universityId);
  const moodleUrl = f.site.trim() || uni?.moodleUrl || "";

  async function check() {
    if (!moodleUrl) return toast("حط رابط المودل أول", "bad");
    if (!online) return toast("عامل المودل مطفي — شغّله على الجوال أول", "bad");
    setBusy("check");
    try {
      const r = await runCommand("moodle", "moodle_check_site", { url: moodleUrl }, { timeout: 60_000 });
      setSite(r);
      if (r.loginType !== "app") setMode("ical");
    } catch (e) {
      setSite({ error: e.message });
    }
    setBusy("");
  }

  async function submit(e) {
    e.preventDefault();
    if (f.password && !vaultOpen) return toast("افتح الخزنة بالرمز السري (فوق) عشان تنحفظ كلمة السر", "bad");
    const link = follow && moodleUrl && (mode === "ical" ? f.ical.trim() : f.password);
    if (follow && moodleUrl && !link) return toast(mode === "ical" ? "حط رابط التقويم، أو شيل صح «تابع مهامه على المودل»" : "حط كلمة السر، أو شيل صح «تابع مهامه على المودل»", "bad");
    if (link && !online) return toast("عامل المودل مطفي — شغّله على الجوال، أو شيل صح «تابع مهامه على المودل» وضيفه بدون متابعة", "bad");
    setBusy("add");
    let ref;
    try {
      ref = await addDoc(collection(db, "moodle_students"), {
        ...clientFields(f),
        ...(await vaultPatch(f, null)),
        site: moodleUrl,
        mode: link ? mode : "none",
        coursesMode: "all",
        payments: [],
        status: "pending",
        enabled: true,
        createdAt: serverTimestamp(),
      });
      if (link) {
        try {
          const r = await linkStudent(ref.id, mode === "ical" ? { ical: f.ical.trim() } : { password: f.password }, worker);
          toast(`تمت إضافة ${f.name.trim()} وربطه ✓${r?.siteName ? ` — ${r.siteName}` : ""}`, "ok", 5000);
        } catch (err) {
          // الطالب بيضل محفوظ، بس الربط بدو إعادة
          await updateDoc(ref, { status: "relink", statusMsg: err.message }).catch(() => {});
          toast(`انضاف ${f.name.trim()}، بس ربط المودل ما زبط: ${err.message} — جرّب «إعادة ربط» من صفحته`, "bad", 8000);
        }
      } else toast(`تمت إضافة ${f.name.trim()} ✓`, "ok");
      setF({ ...EMPTY_CLIENT, site: "", ical: "" });
      setSite(null);
      onDone?.();
    } catch (err) {
      toast(err.message, "bad", 7000);
    }
    setBusy("");
  }

  return (
    <Panel title="➕ إضافة طالب / عميل">
      <form onSubmit={submit}>
        <ClientFields f={f} set={set} unis={unis} />

        <label className="check-line" style={{ margin: "8px 0" }}>
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> تابع مهامه على المودل (تنبيهات الواجبات والاختبارات)
        </label>
        {follow && (
          <>
            <Field label="رابط المودل" hint={uni?.moodleUrl ? `فاضي = رابط ${uni.name}` : "أي رابط من موقع مودل الجامعة، مثلاً صفحة الدخول"}>
              <div className="row-form">
                <input dir="ltr" placeholder={uni?.moodleUrl || "https://moodle.university.edu/login/index.php"} value={f.site} onChange={(e) => (set("site")(e), setSite(null))} />
                <button type="button" className="btn" onClick={check} disabled={!!busy}>
                  {busy === "check" ? "جاري الفحص..." : "افحص الموقع"}
                </button>
              </div>
            </Field>
            {site &&
              (site.error ? (
                <div className="alert danger">{site.error}</div>
              ) : site.loginType === "app" ? (
                <div className="alert info">✅ {site.siteName || "الموقع"} — بيزبط بالرقم الجامعي وكلمة السر.</div>
              ) : (
                <div className="alert warn">
                  ⚠️ {site.siteName || "الموقع"} — {site.loginType === "disabled" ? "الجامعة مسكّرة خدمة تطبيق الموبايل" : `الدخول عن طريق ${site.providers?.join(" / ") || "المتصفح (Microsoft/Google)"}`}، فكلمة السر ما بتزبط. استعمل رابط التقويم.
                </div>
              ))}
            <div className="tabs" style={{ marginTop: 8 }}>
              <button type="button" className={"tab" + (mode === "password" ? " active" : "")} onClick={() => setMode("password")}>
                بكلمة السر (فوق)
              </button>
              <button type="button" className={"tab" + (mode === "ical" ? " active" : "")} onClick={() => setMode("ical")}>
                رابط التقويم
              </button>
            </div>
            {mode === "ical" && (
              <Field label="رابط تقويم المودل" hint="الطالب بيجيبه من: التقويم ← استيراد أو تصدير التقويمات ← تصدير التقويم ← (كل الأحداث، الأيام الأخيرة والقادمة) ← الحصول على رابط التقويم.">
                <input dir="ltr" placeholder="https://.../calendar/export_execute.php?userid=...&authtoken=..." value={f.ical} onChange={set("ical")} autoComplete="off" />
              </Field>
            )}
            {mode === "password" && <p className="small-text muted">كلمة السر اللي فوق بتنبعت مشفّرة لعامل المودل على الجوال عشان يتابع مهامه.</p>}
          </>
        )}
        <button className="btn primary" disabled={!!busy}>
          {busy === "add" ? "جاري..." : follow && moodleUrl ? "إضافة وربط" : "إضافة"}
        </button>
      </form>
    </Panel>
  );
}

const hostOf = (u) => {
  try {
    return new URL(/^https?:/.test(u) ? u : `https://${u}`).host;
  } catch {
    return u || "";
  }
};

function RelinkModal({ s, worker, onClose }) {
  const { toast } = useAdmin();
  const vaultOpen = useVault();
  const [mode, setMode] = useState(s.mode === "ical" || s.status === "sso" ? "ical" : "password");
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!val.trim()) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "moodle_students", s.id), { status: "pending", statusMsg: null, mode });
      await linkStudent(s.id, mode === "ical" ? { ical: val.trim() } : { password: val }, worker);
      // الخزنة مفتوحة ← كلمة السر الجديدة بتنحفظ كمان بملف الطالب
      if (mode === "password" && vaultOpen) await updateDoc(doc(db, "moodle_students", s.id), await vaultPatch({ password: val, portalPassword: "" }, s.vault)).catch(() => {});
      toast(`تم ربط ${s.name} ✓`, "ok");
      onClose();
    } catch (e) {
      toast(e.message, "bad", 7000);
      setVal("");
    }
    setBusy(false);
  }

  return (
    <Modal
      title={`${s.mode === "none" ? "ربط المودل لـ" : "إعادة ربط"} ${s.name}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" onClick={go} disabled={busy || !val.trim()}>
            {busy ? "جاري الربط..." : "ربط"}
          </button>
        </>
      }
    >
      <div className="tabs">
        <button className={"tab" + (mode === "password" ? " active" : "")} onClick={() => (setMode("password"), setVal(""))}>
          كلمة السر
        </button>
        <button className={"tab" + (mode === "ical" ? " active" : "")} onClick={() => (setMode("ical"), setVal(""))}>
          رابط التقويم
        </button>
      </div>
      <Field label={mode === "ical" ? "رابط التقويم الجديد" : `كلمة السر للحساب ${s.studentNo || ""}`}>
        <input type={mode === "ical" ? "text" : "password"} dir="ltr" value={val} onChange={(e) => setVal(e.target.value)} autoComplete="off" autoFocus />
      </Field>
    </Modal>
  );
}

// ============================================================
//  الإعداد
// ============================================================
function Setup({ worker, online }) {
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);

  async function testTg() {
    setBusy(true);
    try {
      await runCommand("moodle", "moodle_test_tg", {}, { timeout: 30_000 });
      toast("انبعتت رسالة تجربة على تيليجرام ✓", "ok");
    } catch (e) {
      toast(e.message, "bad", 6000);
    }
    setBusy(false);
  }
  async function syncAll() {
    try {
      await runCommand("moodle", "moodle_sync", {}, { wait: false });
      toast("بلّشت مزامنة كل الطلاب", "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
  }

  return (
    <>
      <Panel title="حالة العامل">
        <div className="card-meta">
          <Tag kind={online ? "ok" : "bad"}>{online ? "شغال" : "مطفي"}</Tag>
          {worker?.version && <span>الإصدار {worker.version}</span>}
          {worker?.lastSeen && <span>آخر ظهور {fmtAgo(worker.lastSeen)}</span>}
          {worker && <Tag kind={worker.telegram ? "ok" : "wait"}>{worker.telegram ? "تيليجرام معبّى" : "تيليجرام مش معبّى"}</Tag>}
          {worker?.syncMinutes && <span>المزامنة كل {worker.syncMinutes} دقيقة</span>}
          {worker?.lastCycle && <span>آخر دورة {fmtAgo(worker.lastCycle)}</span>}
        </div>
        <div className="btn-row">
          <button className="btn small" onClick={testTg} disabled={!online || busy}>
            رسالة تجربة على تيليجرام
          </button>
          <button className="btn small" onClick={syncAll} disabled={!online}>
            مزامنة كل الطلاب الآن
          </button>
        </div>
      </Panel>
      <Panel title="تشغيل العامل على الجوال (Termux)">
        <ol className="small-text" style={{ lineHeight: 1.9, overflowWrap: "anywhere" }}>
          <li>
            <code dir="ltr">pkg install nodejs git</code> ثم <code dir="ltr">git clone https://github.com/onlinejob114111607/online-job</code>
          </li>
          <li>
            <code dir="ltr">cd online-job/moodle-worker && npm install && cp .env.example .env</code>
          </li>
          <li>عبّي ملف ‎.env: مفتاح Supabase، وتوكن بوت تيليجرام (من ‎@BotFather) ورقم المحادثة.</li>
          <li>
            <code dir="ltr">npm start</code> — وخليه شغال (بتقدر تستعمل <code dir="ltr">termux-wake-lock</code> عشان ما يطفي).
          </li>
        </ol>
        <p className="small-text muted">التفاصيل الكاملة بملف moodle-worker/README.md.</p>
      </Panel>
      <Panel title="الأمان">
        <ul className="small-text muted" style={{ lineHeight: 1.9 }}>
          <li>كلمة السر بتتشفّر بالمتصفح بمفتاح العامل، والعامل بس بيقدر يفكها على الجوال — قاعدة البيانات ما بتشوفها أبداً.</li>
          <li>الجامعات اللي خدمة الموبايل شغالة عندها: بتنستعمل كلمة السر مرة وحدة لأخذ مفتاح دخول، وما بتنحفظ.</li>
          <li>الجامعات اللي مسكّرة الخدمة (مثل الأقصى): بتنحفظ كلمة السر <b>مشفّرة على جوال العامل بس</b> (data/secrets.json) عشان يعيد الدخول — مش بقاعدة البيانات.</li>
          <li>مفاتيح الدخول وروابط التقويم كمان محفوظة على جوال العامل بس، مش بقاعدة البيانات.</li>
          <li>إذا الطالب غيّر كلمة السر أو انتهى الربط، بيظهر عنده «بدها إعادة ربط» وبيوصلك تنبيه.</li>
        </ul>
      </Panel>
    </>
  );
}
