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
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const online = isWorkerOnline(worker);
  const needLink = students.filter((s) => s.status === "relink" || s.status === "error" || s.status === "sso").length;

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
          ["setup", "الإعداد"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "tasks" && <Tasks items={items} loading={itemsLoading} students={students} />}
      {tab === "students" && <StudentsTab students={students} items={items} worker={worker} online={online} />}
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
function StudentsTab({ students, items, worker, online }) {
  const { toast } = useAdmin();
  const [relink, setRelink] = useState(null);
  const [openId, setOpenId] = useState(null);
  const sorted = [...students].sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
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

  if (openStudent)
    return (
      <StudentDetail
        s={openStudent}
        items={items.filter((it) => it.studentId === openStudent.id)}
        online={online}
        worker={worker}
        toast={toast}
        onBack={() => setOpenId(null)}
        onRelink={() => setRelink(openStudent)}
      />
    );

  return (
    <>
      <AddStudent worker={worker} online={online} />
      {!sorted.length ? (
        <Empty>ما في طلاب لسا</Empty>
      ) : (
        <div className="cards">
          {sorted.map((s) => (
            <StudentCard key={s.id} s={s} upcoming={counts[s.id] || 0} onOpen={() => setOpenId(s.id)} />
          ))}
        </div>
      )}
      {relink && <RelinkModal s={relink} worker={worker} onClose={() => setRelink(null)} />}
    </>
  );
}

// بوكس الطالب — بالضغط عليه بتفتح صفحته
function StudentCard({ s, upcoming, onOpen }) {
  const [label, kind] = STATUS[s.status] || ["—", ""];
  return (
    <button type="button" className="card student-card" onClick={onOpen}>
      <div className="card-head">
        <div>
          <div className="card-title">{s.name}</div>
          <div className="card-meta">
            <Tag kind={kind}>{label}</Tag>
            {s.enabled === false && <Tag>موقوف</Tag>}
            {s.studentNo && <span dir="ltr">{s.studentNo}</span>}
            <span>{s.siteName || hostOf(s.site)}</span>
          </div>
        </div>
        <span className="student-card-arrow" aria-hidden="true">‹</span>
      </div>
      <div className="small-text muted">
        {s.lastSync ? `آخر مزامنة ${fmtAgo(s.lastSync)}` : "لسا ما انمزمن"}
        {` · ${upcoming} مهمة قادمة`}
      </div>
      {s.statusMsg && <div className="small-text err">{s.statusMsg}</div>}
    </button>
  );
}

// صفحة الطالب: بياناته + تحديد المساقات + مهامه
function StudentDetail({ s, items, online, worker, toast, onBack, onRelink }) {
  const [label, kind] = STATUS[s.status] || ["—", ""];
  const [busy, setBusy] = useState(false);
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

      <Panel title={s.name}>
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

      <Panel title="المساقات اللي بتتابعها" actions={<span className="small-text muted">شيل الصح عن المادة اللي ما بدك تتابعها</span>}>
        {!courses.length ? (
          <Empty>لسا ما ظهرت مواد — اعمل مزامنة</Empty>
        ) : (
          <div className="course-list">
            {courses.map((c) => (
              <label key={c.name} className={"course-row" + (muted.has(c.name) ? " off" : "")}>
                <input type="checkbox" checked={!muted.has(c.name)} onChange={() => toggleCourse(c.name)} />
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
    </div>
  );
}

// الربط: بنشفّر السر بالمتصفح وبنبعته للعامل كأمر، والعامل بيمسحه من الأمر أول ما يستلمه
async function linkStudent(studentId, secret, worker) {
  const box = await encryptForWorker(secret, worker?.publicKey);
  return runCommand("moodle", "moodle_link", { studentId, box }, { timeout: 150_000 });
}

function AddStudent({ worker, online }) {
  const { toast } = useAdmin();
  const empty = { name: "", studentNo: "", password: "", site: "", ical: "" };
  const [f, setF] = useState(empty);
  const [mode, setMode] = useState("password"); // password | ical
  const [site, setSite] = useState(null); // نتيجة فحص الموقع
  const [busy, setBusy] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function check() {
    if (!f.site.trim()) return toast("حط رابط المودل أول", "bad");
    if (!online) return toast("عامل المودل مطفي — شغّله على الجوال أول", "bad");
    setBusy("check");
    try {
      const r = await runCommand("moodle", "moodle_check_site", { url: f.site.trim() }, { timeout: 60_000 });
      setSite(r);
      if (r.loginType !== "app") setMode("ical");
    } catch (e) {
      setSite({ error: e.message });
    }
    setBusy("");
  }

  async function submit(e) {
    e.preventDefault();
    if (!online) return toast("عامل المودل مطفي — شغّله على الجوال أول", "bad");
    const secret = mode === "ical" ? { ical: f.ical.trim() } : { password: f.password };
    if (mode === "ical" ? !secret.ical : !secret.password) return toast(mode === "ical" ? "حط رابط التقويم" : "حط كلمة السر", "bad");
    setBusy("add");
    let ref;
    try {
      ref = await addDoc(collection(db, "moodle_students"), {
        name: f.name.trim(),
        studentNo: f.studentNo.trim(),
        site: f.site.trim(),
        mode,
        status: "pending",
        enabled: true,
        createdAt: serverTimestamp(),
      });
      const r = await linkStudent(ref.id, secret, worker);
      toast(`تم ربط ${f.name.trim()} ✓${r?.siteName ? ` — ${r.siteName}` : ""}`, "ok", 5000);
      setF(empty);
      setSite(null);
    } catch (err) {
      toast(err.message, "bad", 7000);
      setF((x) => ({ ...x, password: "" }));
      // الربط فشل ← بنشيل الطالب عشان ما يتكرر لما تحاول مرة ثانية (البيانات بتضل بالفورم)
      if (ref) await deleteDoc(ref).catch(() => {});
    }
    setBusy("");
  }

  return (
    <Panel title="إضافة طالب">
      <form onSubmit={submit}>
        <div className="grid-2">
          <Field label="اسم الطالب">
            <input value={f.name} onChange={set("name")} required />
          </Field>
          <Field label="الرقم الجامعي (اسم المستخدم بالمودل)">
            <input dir="ltr" value={f.studentNo} onChange={set("studentNo")} required={mode === "password"} autoComplete="off" />
          </Field>
        </div>
        <Field label="رابط المودل" hint="أي رابط من موقع مودل الجامعة، مثلاً صفحة الدخول">
          <div className="row-form">
            <input dir="ltr" placeholder="https://moodle.university.edu/login/index.php" value={f.site} onChange={(e) => (set("site")(e), setSite(null))} required />
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
            كلمة السر
          </button>
          <button type="button" className={"tab" + (mode === "ical" ? " active" : "")} onClick={() => setMode("ical")}>
            رابط التقويم
          </button>
        </div>
        {mode === "password" ? (
          <Field label="كلمة سر المودل" hint="بتعطيك حالة التسليم والعلامات والملفات الجديدة كمان. بتتشفّر بالمتصفح. الجامعات اللي مسكّرة خدمة الموبايل (مثل الأقصى) بيدخلها العامل بالمتصفح، وبتنحفظ كلمة السر مشفّرة على الجوال بس عشان يعيد الدخول.">
            <input type="password" dir="ltr" value={f.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
        ) : (
          <Field label="رابط تقويم المودل" hint="الطالب بيجيبه من: التقويم ← استيراد أو تصدير التقويمات ← تصدير التقويم ← (كل الأحداث، الأيام الأخيرة والقادمة) ← الحصول على رابط التقويم. بيعطي المواعيد بس.">
            <input dir="ltr" placeholder="https://.../calendar/export_execute.php?userid=...&authtoken=..." value={f.ical} onChange={set("ical")} autoComplete="off" />
          </Field>
        )}
        <button className="btn primary" disabled={!!busy || !online}>
          {busy === "add" ? "جاري الربط..." : "إضافة وربط"}
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
  const [mode, setMode] = useState(s.mode === "ical" || s.status === "sso" ? "ical" : "password");
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!val.trim()) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, "moodle_students", s.id), { status: "pending", statusMsg: null, mode });
      await linkStudent(s.id, mode === "ical" ? { ical: val.trim() } : { password: val }, worker);
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
      title={`إعادة ربط ${s.name}`}
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
