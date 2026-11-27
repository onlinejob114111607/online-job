// ============================================================
//  ملف الطالب كعميل: بيانات الدراسة + الحساب والدفعات + البوابات + الجامعات
//  كله محفوظ على نفس سجل الطالب بـ moodle_students (عامل المودل بيتجاهل الحقول الجديدة)
// ============================================================
import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../firebase";
import { copyText, toMs, waLink } from "../../utils";
import { useAdmin, useDocData } from "../hooks";
import { Empty, Field, Kpi, Modal, Panel, Tag } from "../ui";
import { lockVault, seal, setupVault, unlockVault, unseal, useVault } from "./vault";

export const CUR = "₪";
export const money = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
export const paidOf = (s) => (s.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
export const remainingOf = (s) => (Number(s.total) || 0) - paidOf(s);
export const CLIENT_STATUS = {
  active: ["نشط", "ok"],
  paused: ["موقوف مؤقتاً", "wait"],
  done: ["خلص", ""],
};
const METHODS = ["نقدي", "تحويل بنكي", "جوال باي", "محفظة", "أخرى"];
export const uniOf = (s, unis) => unis.find((u) => u.id === s.universityId) || null;
export const uniName = (s, unis) => uniOf(s, unis)?.name || s.university || "";
export const portalOf = (s, unis) => s.portalUrl || uniOf(s, unis)?.portalUrl || "";
export const moodleOf = (s, unis) => s.site || uniOf(s, unis)?.moodleUrl || "";
const fixUrl = (u) => (!u ? "" : /^https?:\/\//i.test(u) ? u : `https://${u}`);
const today = () => new Date().toISOString().slice(0, 10);
const phoneDigits = (p) => String(p || "").replace(/\D/g, "").replace(/^00/, "");

// ---------------- الخزنة (الرمز السري) ----------------
export function VaultBar() {
  const { toast } = useAdmin();
  const cfg = useDocData("settings/studentVault");
  const open = useVault();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  if (cfg === undefined) return null;

  async function go(e) {
    e.preventDefault();
    if (!cfg) {
      if (!/^\d{4,12}$/.test(pin)) return toast("الرمز لازم يكون أرقام من 4 لـ 12 خانة", "bad");
      if (pin !== pin2) return toast("الرمزين مش متطابقين", "bad");
      if (!confirm("احفظ الرمز عندك منيح! إذا نسيته ما في طريقة ترجّع كلمات السر المحفوظة فيه.")) return;
    }
    setBusy(true);
    try {
      if (!cfg) await setupVault(pin);
      else await unlockVault(pin, cfg);
      setPin("");
      setPin2("");
      toast("🔓 الخزنة مفتوحة — بتتسكّر لحالها بعد 30 دقيقة", "ok");
    } catch (err) {
      toast(err.message, "bad");
    }
    setBusy(false);
  }

  if (open)
    return (
      <div className="vault-bar open">
        <span>🔓 خزنة كلمات السر مفتوحة</span>
        <button className="btn small" onClick={lockVault}>
          🔒 قفل
        </button>
      </div>
    );
  return (
    <form className="vault-bar" onSubmit={go}>
      <span>{cfg ? "🔒 كلمات السر مقفولة — حط الرمز السري:" : "🔐 اختار رمز سري (PIN) لحماية كلمات سر الطلاب:"}</span>
      <input type="password" inputMode="numeric" dir="ltr" placeholder="الرمز" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="off" />
      {!cfg && <input type="password" inputMode="numeric" dir="ltr" placeholder="أعد الرمز" value={pin2} onChange={(e) => setPin2(e.target.value)} autoComplete="off" />}
      <button className="btn primary small" disabled={busy || !pin}>
        {busy ? "..." : cfg ? "افتح" : "احفظ الرمز"}
      </button>
    </form>
  );
}

// كلمة سر محفوظة: اعرض / انسخ (لازم الخزنة مفتوحة)
function SecretRow({ s, field, label }) {
  const { toast } = useAdmin();
  const open = useVault();
  const [shown, setShown] = useState(null);
  useEffect(() => setShown(null), [open, s.vault?.c]);
  if (!s.vault) return null;
  async function get() {
    try {
      const v = (await unseal(s.vault))?.[field];
      if (!v) toast("ما في كلمة سر محفوظة هون", "bad");
      return v || null;
    } catch (e) {
      toast(e.message, "bad");
      return null;
    }
  }
  return (
    <div className="secret-row">
      <span className="muted">{label}:</span>
      <code dir="ltr">{shown ?? "••••••••"}</code>
      {open ? (
        <>
          <button className="btn small" onClick={async () => setShown(shown ? null : await get())}>
            {shown ? "🙈" : "👁"}
          </button>
          <button
            className="btn small"
            onClick={async () => {
              const v = await get();
              if (v && (await copyText(v))) toast("انسخت كلمة السر ✓", "ok");
            }}
          >
            📋
          </button>
        </>
      ) : (
        <span className="small-text muted">افتح الخزنة فوق</span>
      )}
    </div>
  );
}

// أزرار البوابات: بتفتح الموقع وبتنسخ الرقم الجامعي (وبعدها انسخ كلمة السر والصقها)
export function PortalButtons({ s, unis }) {
  const { toast } = useAdmin();
  const portal = fixUrl(portalOf(s, unis));
  const moodle = fixUrl(moodleOf(s, unis));
  const go = (url) => {
    window.open(url, "_blank", "noopener"); // أول إشي (عشان ما ينحظر النافذة)
    if (s.studentNo) copyText(s.studentNo).then((ok) => ok && toast(`انسخ الرقم الجامعي ${s.studentNo} — الصقه، وبعدين انسخ كلمة السر من هون`, "ok", 5000));
  };
  const differentPortalPass = !!s.vaultHasPortal;
  return (
    <div className="portal-box">
      <div className="btn-row">
        <button className="btn primary small" disabled={!portal} onClick={() => go(portal)} title={portal || "حط رابط البوابة بالجامعة أو بملف الطالب"}>
          🎓 بوابة الطلبة
        </button>
        <button className="btn small" disabled={!moodle} onClick={() => go(moodle)} title={moodle || "حط رابط المودل"}>
          💻 التعليم الإلكتروني
        </button>
        {s.studentNo && (
          <button className="btn small" onClick={async () => (await copyText(s.studentNo)) && toast("انسخ ✓", "ok")}>
            📋 الرقم الجامعي <span dir="ltr">{s.studentNo}</span>
          </button>
        )}
      </div>
      <SecretRow s={s} field="password" label={differentPortalPass ? "كلمة سر المودل" : "كلمة السر"} />
      {differentPortalPass && <SecretRow s={s} field="portalPassword" label="كلمة سر البوابة" />}
      {!s.vault && <p className="small-text muted">ما في كلمة سر محفوظة لهالطالب — أضفها من «✏️ تعديل البيانات».</p>}
    </div>
  );
}

// ---------------- فورم بيانات الطالب ----------------
export const EMPTY_CLIENT = { name: "", phone: "", universityId: "", university: "", college: "", major: "", semester: "", studentNo: "", clientStatus: "active", total: "", portalUrl: "", notes: "", password: "", portalPassword: "" };

export function clientFields(f) {
  return {
    name: f.name.trim(),
    phone: phoneDigits(f.phone),
    universityId: f.universityId || null,
    university: f.universityId ? "" : f.university.trim(),
    college: f.college.trim(),
    major: f.major.trim(),
    semester: f.semester.trim(),
    studentNo: f.studentNo.trim(),
    clientStatus: f.clientStatus || "active",
    total: Number(f.total) || 0,
    portalUrl: f.portalUrl.trim(),
    notes: f.notes.trim(),
  };
}

// كلمات السر الجديدة ← خزنة (بتدمج مع المحفوظ إذا في)
export async function vaultPatch(f, existing) {
  if (!f.password && !f.portalPassword) return {};
  const old = existing ? (await unseal(existing).catch(() => null)) || {} : {};
  const next = { ...old, ...(f.password ? { password: f.password } : {}), ...(f.portalPassword ? { portalPassword: f.portalPassword } : {}) };
  return { vault: await seal(next), vaultHasPortal: !!next.portalPassword && next.portalPassword !== next.password };
}

export function ClientFields({ f, set, unis, editing }) {
  const open = useVault();
  return (
    <>
      <div className="grid-2">
        <Field label="اسم الطالب">
          <input value={f.name} onChange={set("name")} required />
        </Field>
        <Field label="رقم واتساب الطالب" hint="مع المقدمة، مثلاً 970599123456">
          <input dir="ltr" value={f.phone} onChange={set("phone")} inputMode="tel" />
        </Field>
        <Field label="الجامعة">
          <select value={f.universityId} onChange={set("universityId")}>
            <option value="">— اختار (أو اكتب تحت) —</option>
            {unis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {!f.universityId && <input placeholder="أو اكتب اسم الجامعة" value={f.university} onChange={set("university")} style={{ marginTop: 6 }} />}
        </Field>
        <Field label="الكلية">
          <input value={f.college} onChange={set("college")} />
        </Field>
        <Field label="التخصص">
          <input value={f.major} onChange={set("major")} />
        </Field>
        <Field label="الفصل الدراسي" hint="مثلاً: الأول 2026/2027">
          <input value={f.semester} onChange={set("semester")} />
        </Field>
        <Field label="الرقم الجامعي">
          <input dir="ltr" value={f.studentNo} onChange={set("studentNo")} autoComplete="off" />
        </Field>
        <Field label="حالة العميل">
          <select value={f.clientStatus} onChange={set("clientStatus")}>
            {Object.entries(CLIENT_STATUS).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`الحساب الإجمالي (${CUR})`}>
          <input type="number" min="0" step="any" dir="ltr" value={f.total} onChange={set("total")} />
        </Field>
        <Field label="رابط بوابة الطلبة (اختياري)" hint="إذا فاضي بياخد رابط الجامعة">
          <input dir="ltr" value={f.portalUrl} onChange={set("portalUrl")} placeholder="https://..." />
        </Field>
      </div>
      {open ? (
        <div className="grid-2">
          <Field label="كلمة السر" hint={editing ? "اتركها فاضية إذا ما بدك تغيّرها" : "بتتشفّر بالرمز السري"}>
            <input type="password" dir="ltr" value={f.password} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Field label="كلمة سر البوابة (إذا مختلفة)" hint="فاضي = نفس كلمة السر">
            <input type="password" dir="ltr" value={f.portalPassword} onChange={set("portalPassword")} autoComplete="new-password" />
          </Field>
        </div>
      ) : (
        <div className="alert info">🔒 عشان تحفظ كلمة السر، افتح الخزنة بالرمز السري (الشريط فوق).</div>
      )}
      <Field label="ملاحظات">
        <textarea rows={2} value={f.notes} onChange={set("notes")} />
      </Field>
    </>
  );
}

export function EditClient({ s, unis, onClose }) {
  const { toast } = useAdmin();
  const [f, setF] = useState({
    ...EMPTY_CLIENT,
    ...Object.fromEntries(Object.keys(EMPTY_CLIENT).map((k) => [k, s[k] == null ? EMPTY_CLIENT[k] : String(s[k])])),
    password: "",
    portalPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateDoc(doc(db, "moodle_students", s.id), { ...clientFields(f), ...(await vaultPatch(f, s.vault)), updatedAt: serverTimestamp() });
      toast("انحفظ ✓", "ok");
      onClose();
    } catch (err) {
      toast(err.message, "bad");
    }
    setBusy(false);
  }
  return (
    <Modal
      wide
      title={`تعديل بيانات ${s.name}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn primary" form="edit-client" disabled={busy}>
            {busy ? "جاري..." : "حفظ"}
          </button>
        </>
      }
    >
      <form id="edit-client" onSubmit={save}>
        <ClientFields f={f} set={set} unis={unis} editing />
      </form>
    </Modal>
  );
}

// ---------------- الحساب والدفعات ----------------
export function Finance({ s }) {
  const { toast } = useAdmin();
  const [f, setF] = useState({ amount: "", at: today(), method: METHODS[0], note: "" });
  const [busy, setBusy] = useState(false);
  const total = Number(s.total) || 0;
  const paid = paidOf(s);
  const rem = total - paid;
  const pays = [...(s.payments || [])].sort((a, b) => (b.at || 0) - (a.at || 0));

  async function add(e) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!(amount > 0)) return toast("حط المبلغ", "bad");
    setBusy(true);
    try {
      const p = { id: Math.random().toString(36).slice(2, 10), amount, at: new Date(f.at || today()).getTime(), method: f.method, note: f.note.trim() };
      await updateDoc(doc(db, "moodle_students", s.id), { payments: [...(s.payments || []), p] });
      setF({ amount: "", at: today(), method: f.method, note: "" });
      toast(`انضافت دفعة ${money(amount)} ${CUR} ✓`, "ok");
    } catch (err) {
      toast(err.message, "bad");
    }
    setBusy(false);
  }
  async function remove(p) {
    if (!confirm(`تحذف دفعة ${money(p.amount)} ${CUR}؟`)) return;
    await updateDoc(doc(db, "moodle_students", s.id), { payments: (s.payments || []).filter((x) => x.id !== p.id) }).catch((e) => toast(e.message, "bad"));
  }
  const reminder = `مرحبا ${String(s.name || "").split(/\s+/)[0]} 🌷\nتذكير لطيف: المتبقي من حسابك ${money(rem)} ${CUR} (الإجمالي ${money(total)} ${CUR}، المدفوع ${money(paid)} ${CUR}).\nشكراً إلك 🙏`;

  return (
    <Panel
      title="💰 الحساب"
      actions={
        s.phone && rem > 0 ? (
          <a className="btn small wa-solid" href={waLink(s.phone, reminder)} target="_blank" rel="noreferrer">
            تذكير بالدفع على واتساب
          </a>
        ) : null
      }
    >
      <div className="kpis">
        <Kpi label="الإجمالي" value={`${money(total)} ${CUR}`} />
        <Kpi label="المدفوع" value={`${money(paid)} ${CUR}`} color="var(--ok, #22c55e)" />
        <Kpi label={rem < 0 ? "رصيد زيادة" : "المتبقي"} value={`${money(Math.abs(rem))} ${CUR}`} color={rem > 0 ? "var(--bad, #ef4444)" : "var(--ok, #22c55e)"} />
      </div>
      <form className="pay-form" onSubmit={add}>
        <input type="number" min="0" step="any" dir="ltr" placeholder={`المبلغ ${CUR}`} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <input type="date" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} />
        <select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
          {METHODS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <input placeholder="ملاحظة (اختياري)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button className="btn primary small" disabled={busy}>
          + دفعة
        </button>
      </form>
      {!pays.length ? (
        <Empty>ما في دفعات لسا</Empty>
      ) : (
        <div className="pay-list">
          {pays.map((p) => (
            <div key={p.id} className="pay-row">
              <b>
                {money(p.amount)} {CUR}
              </b>
              <span className="muted small-text">
                {new Date(p.at).toLocaleDateString("ar-EG")} · {p.method}
                {p.note ? ` · ${p.note}` : ""}
              </span>
              <button className="btn small" onClick={() => remove(p)} title="حذف الدفعة">
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------------- الملخص + الفلاتر + التصدير ----------------
export function ClientsSummary({ students }) {
  const total = students.reduce((a, s) => a + (Number(s.total) || 0), 0);
  const paid = students.reduce((a, s) => a + paidOf(s), 0);
  const owing = students.filter((s) => remainingOf(s) > 0);
  return (
    <div className="kpis">
      <Kpi label="الطلاب" value={students.length} sub={`${students.filter((s) => (s.clientStatus || "active") === "active").length} نشط`} />
      <Kpi label="الإجمالي" value={`${money(total)} ${CUR}`} />
      <Kpi label="المدفوع" value={`${money(paid)} ${CUR}`} color="var(--ok, #22c55e)" />
      <Kpi label="المتبقي" value={`${money(Math.max(0, total - paid))} ${CUR}`} color="var(--bad, #ef4444)" sub={`${owing.length} طالب عليهم مبلغ`} />
    </div>
  );
}

export function exportClients(students, unis) {
  const rows = students.map((s) => ({
    الاسم: s.name || "",
    واتساب: s.phone || "",
    الجامعة: uniName(s, unis),
    الكلية: s.college || "",
    التخصص: s.major || "",
    الفصل: s.semester || "",
    "الرقم الجامعي": s.studentNo || "",
    الحالة: CLIENT_STATUS[s.clientStatus || "active"]?.[0] || "",
    الإجمالي: Number(s.total) || 0,
    المدفوع: paidOf(s),
    المتبقي: remainingOf(s),
    المواد: s.coursesMode === "selected" ? "مواد محددة" : "كل المواد",
    ملاحظات: s.notes || "",
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "الطلاب");
  XLSX.writeFile(wb, `students-${today()}.xlsx`);
}

// ---------------- الجامعات ----------------
export function Universities({ unis, students }) {
  const { toast } = useAdmin();
  const empty = { name: "", portalUrl: "", moodleUrl: "" };
  const [edit, setEdit] = useState(null);
  async function save(e) {
    e.preventDefault();
    const data = { name: edit.name.trim(), portalUrl: edit.portalUrl.trim(), moodleUrl: edit.moodleUrl.trim() };
    if (!data.name) return toast("اسم الجامعة مطلوب", "bad");
    try {
      if (edit.id) await updateDoc(doc(db, "universities", edit.id), data);
      else await addDoc(collection(db, "universities"), { ...data, createdAt: serverTimestamp() });
      setEdit(null);
      toast("انحفظ ✓", "ok");
    } catch (err) {
      toast(err.message, "bad");
    }
  }
  async function remove(u) {
    const n = students.filter((s) => s.universityId === u.id).length;
    if (!confirm(n ? `في ${n} طالب مربوطين بـ ${u.name}. تحذفها؟ (الطلاب ما بينحذفوا)` : `تحذف ${u.name}؟`)) return;
    await deleteDoc(doc(db, "universities", u.id)).catch((e) => toast(e.message, "bad"));
  }
  return (
    <Panel
      title="🏛 الجامعات"
      actions={
        !edit && (
          <button className="btn primary small" onClick={() => setEdit(empty)}>
            + جامعة
          </button>
        )
      }
    >
      <p className="small-text muted">حط روابط بوابة الطلبة والمودل لكل جامعة مرة وحدة، وكل طالب منها بياخدها لحاله.</p>
      {edit && (
        <form className="settings-box" onSubmit={save}>
          <Field label="اسم الجامعة">
            <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required autoFocus />
          </Field>
          <Field label="رابط بوابة الطلبة">
            <input dir="ltr" value={edit.portalUrl} onChange={(e) => setEdit({ ...edit, portalUrl: e.target.value })} placeholder="https://..." />
          </Field>
          <Field label="رابط التعليم الإلكتروني (المودل)">
            <input dir="ltr" value={edit.moodleUrl} onChange={(e) => setEdit({ ...edit, moodleUrl: e.target.value })} placeholder="https://moodle..." />
          </Field>
          <div className="btn-row">
            <button className="btn primary small">حفظ</button>
            <button type="button" className="btn small" onClick={() => setEdit(null)}>
              إلغاء
            </button>
          </div>
        </form>
      )}
      {!unis.length ? (
        <Empty>ما في جامعات لسا</Empty>
      ) : (
        <div className="pay-list">
          {unis.map((u) => (
            <div key={u.id} className="pay-row">
              <b>{u.name}</b>
              <span className="muted small-text" dir="ltr">
                {[u.portalUrl, u.moodleUrl].filter(Boolean).join("  ·  ") || "بدون روابط"}
              </span>
              <span className="small-text muted">{students.filter((s) => s.universityId === u.id).length} طالب</span>
              <button className="btn small" onClick={() => setEdit({ ...empty, ...u })}>
                ✏️
              </button>
              <button className="btn small" onClick={() => remove(u)}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export const sortByName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar");
export const lastPayMs = (s) => Math.max(0, ...(s.payments || []).map((p) => toMs(p.at)));
