import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { addDoc, collection, deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { WA_DEFAULTS, waSettingsOf } from "../../appSettings";
import { cairoDayKey } from "../../utils";
import { runCommand, useAdmin } from "../hooks";
import { Empty, Panel, Tag, Toggle } from "../ui";
import { waStateOf } from "./waShared";

export default function Accounts({ selectedId, onSelect }) {
  const { waAccounts, workers, toast } = useAdmin();
  const [name, setName] = useState("");

  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    await addDoc(collection(db, "wa_accounts"), {
      name: n.slice(0, 40),
      enabled: true,
      state: "new",
      settings: { ...WA_DEFAULTS },
      sentToday: 0,
      dayKey: null,
      createdAt: serverTimestamp(),
    });
    setName("");
    toast(workers.waOnline ? "انضاف الحساب — استنى الـ QR يظهر" : "انضاف الحساب — شغّل عامل الواتساب ليظهر الـ QR", "ok");
  }

  return (
    <div className="page">
      <Panel title="إضافة حساب واتساب">
        <form className="row-form" onSubmit={add}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الحساب (مثلاً: نشر 1، ترحيب)" maxLength={40} required />
          <button className="btn primary">أضف</button>
        </form>
        <p className="small-text muted">بعد الإضافة رح يظهر الحساب تحت، واربطه بـ QR أو بكود ربط.</p>
      </Panel>

      {!waAccounts.length ? (
        <Empty>ما في حسابات — أضف أول حساب فوق</Empty>
      ) : (
        <div className="cards">
          {waAccounts.map((a) => (
            <AccountCard key={a.id} a={a} selected={a.id === selectedId} onSelect={() => onSelect(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AccountCard({ a, selected, onSelect }) {
  const { workers, toast, app } = useAdmin();
  const [label, kind] = waStateOf(a, workers.waOnline);
  const s = waSettingsOf(a);
  const [showSettings, setShowSettings] = useState(false);
  const [pairPhone, setPairPhone] = useState("");
  const canvas = useRef(null);
  const live = workers.waOnline && a.enabled !== false;
  const showQr = live && a.state === "qr" && a.qr;
  const showPair = live && a.state === "pairing" && a.pairingCode;
  const ref = doc(db, "wa_accounts", a.id);
  const today = cairoDayKey();

  useEffect(() => {
    if (showQr && canvas.current) QRCode.toCanvas(canvas.current, a.qr, { width: 240, margin: 1 }).catch(() => {});
  }, [showQr, a.qr]);

  const cmd = async (type, extra = {}, okMsg) => {
    try {
      await runCommand("wa", type, { accountId: a.id, ...extra }, { wait: false });
      if (okMsg) toast(okMsg, "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
  };

  async function pair(e) {
    e.preventDefault();
    const phone = pairPhone.replace(/\D/g, "");
    if (phone.length < 8) return toast("اكتب الرقم كامل بالصيغة الدولية", "bad");
    await cmd("pairing", { phone }, "تم الطلب — الكود رح يظهر خلال ثواني");
  }

  const pc = a.pairingCode || "";
  const sentToday = a.dayKey === today ? a.sentToday || 0 : 0;
  const joinedToday = a.joinDayKey === today ? a.joinedToday || 0 : 0;
  const postLim = s.warmup ? "تسخين" : app.wa.postUnlimited || s.dailyLimit <= 0 ? "∞" : s.dailyLimit;

  return (
    <div className={"card acc-card" + (selected ? " selected" : "")}>
      <div className="card-head">
        <div>
          <div className="card-title">{a.name || a.id}</div>
          <div className="card-meta">
            <Tag kind={kind}>{label}</Tag>
            {a.phone && <span dir="ltr">+{a.phone}</span>}
            <span>
              رسائل اليوم {sentToday} / {postLim}
            </span>
            <span>انضمام {joinedToday}</span>
            {s.warmup && <Tag kind="info">وضع التسخين</Tag>}
            {app.welcomeAccountId === a.id && <Tag kind="ok">حساب الترحيب</Tag>}
          </div>
        </div>
        <div className="card-actions">
          <button className="btn small" onClick={onSelect}>
            اختيار
          </button>
          <button
            className="btn small"
            onClick={async () => {
              const n = prompt("اسم الحساب:", a.name || "");
              if (n && n.trim()) await updateDoc(ref, { name: n.trim().slice(0, 40) });
            }}
          >
            تسمية
          </button>
        </div>
      </div>

      {showQr && (
        <div className="qr-wrap">
          <canvas ref={canvas} />
          <p className="small-text muted">واتساب ← الأجهزة المرتبطة ← ربط جهاز، وامسح الكود</p>
        </div>
      )}
      {showPair && (
        <div className="pair">
          <p className="small-text muted">واتساب ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف</p>
          <div className="pair-code" dir="ltr">
            {pc.length === 8 ? `${pc.slice(0, 4)}-${pc.slice(4)}` : pc}
          </div>
        </div>
      )}
      {live && a.state !== "open" && (
        <form className="row-form" onSubmit={pair}>
          <input dir="ltr" inputMode="numeric" placeholder="201xxxxxxxxx" value={pairPhone} onChange={(e) => setPairPhone(e.target.value)} />
          <button className="btn small">اطلب كود ربط بالرقم</button>
        </form>
      )}
      {a.error && <div className="small-text err">{a.error}</div>}

      <div className="btn-row">
        <button className="btn small" onClick={() => cmd("restart", {}, "تم إرسال أمر إعادة الاتصال")} disabled={!workers.waOnline}>
          إعادة الاتصال
        </button>
        <button className="btn small" onClick={() => updateDoc(ref, { enabled: a.enabled === false })}>
          {a.enabled === false ? "تشغيل" : "إيقاف مؤقت"}
        </button>
        <button className="btn small" onClick={() => setShowSettings((v) => !v)}>
          الإعدادات
        </button>
        <button
          className="btn small danger-outline"
          onClick={() => confirm(`فصل رقم "${a.name}"؟ رح تحتاج تربطه من جديد.`) && cmd("logout", {}, "تم إرسال أمر الفصل")}
        >
          فصل الرقم
        </button>
        <button
          className="btn small danger-outline"
          onClick={() => {
            if (!confirm(`حذف حساب "${a.name}" نهائياً مع كل مجموعاته ومنشوراته من اللوحة؟\n(ما رح يطلع من المجموعات بواتساب)`)) return;
            if (!workers.waOnline) return toast("شغّل العامل أول عشان يفصل الرقم ويحذف الجلسة", "bad");
            cmd("delete_account", {}, "جاري الحذف...");
          }}
        >
          حذف
        </button>
      </div>

      {showSettings && <AccountSettings a={a} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function AccountSettings({ a, onClose }) {
  const { toast, app } = useAdmin();
  const [s, setS] = useState(() => waSettingsOf(a));
  const num = (k) => ({
    type: "number",
    value: s[k],
    onChange: (e) => setS((p) => ({ ...p, [k]: e.target.value })),
  });

  async function save(e) {
    e.preventDefault();
    const data = { ...s };
    for (const k of Object.keys(WA_DEFAULTS)) if (k !== "warmup") data[k] = Math.max(0, parseInt(data[k], 10) || 0);
    if (data.minDelay < 10) return toast("أقل فاصل بين الرسائل 10 ثواني", "bad");
    if (data.maxDelay < data.minDelay) return toast("أكبر فاصل لازم يكون أكبر من أو يساوي الأقل", "bad");
    if (data.joinMinDelay < 30) return toast("أقل فاصل بين الانضمامات 30 ثانية", "bad");
    if (data.joinMaxDelay < data.joinMinDelay) return toast("فواصل الانضمام غلط", "bad");
    if (data.quietStart > 23 || data.quietEnd > 23) return toast("ساعات الهدوء من 0 لـ 23", "bad");
    const patch = { settings: data };
    if (data.warmup && !a.settings?.warmup) patch.warmupStartedAt = serverTimestamp();
    if (!data.warmup && a.warmupStartedAt) patch.warmupStartedAt = deleteField();
    await updateDoc(doc(db, "wa_accounts", a.id), patch);
    toast("تم الحفظ ✓", "ok");
    onClose();
  }

  return (
    <form className="settings-box" onSubmit={save}>
      <p className="small-text muted">كل ما زادت الفواصل وقلّ الحد اليومي، كل ما قلّ خطر الحظر.</p>
      <div className="form-grid">
        <label>
          أقل فاصل بين الرسائل (ث)
          <input min={10} {...num("minDelay")} />
        </label>
        <label>
          أكبر فاصل بين الرسائل (ث)
          <input min={10} {...num("maxDelay")} />
        </label>
        <label>
          الحد اليومي للرسائل {app.wa.postUnlimited && <small className="muted">(متجاهَل: النشر بدون حد مفعّل)</small>}
          <input min={0} {...num("dailyLimit")} />
        </label>
        <label>
          حد الانضمام اليومي <small className="muted">(0 = العام: {app.wa.dailyJoinLimit})</small>
          <input min={0} {...num("joinDailyLimit")} />
        </label>
        <label>
          أقل فاصل بين الانضمامات (ث)
          <input min={30} {...num("joinMinDelay")} />
        </label>
        <label>
          أكبر فاصل بين الانضمامات (ث)
          <input min={30} {...num("joinMaxDelay")} />
        </label>
        <label>
          ساعات الهدوء: من الساعة
          <input min={0} max={23} {...num("quietStart")} />
        </label>
        <label>
          لحد الساعة <small className="muted">(نفس الرقمين = بدون هدوء)</small>
          <input min={0} max={23} {...num("quietEnd")} />
        </label>
      </div>
      <Toggle
        checked={s.warmup}
        onChange={(v) => setS((p) => ({ ...p, warmup: v }))}
        label="وضع التسخين للرقم الجديد"
        hint={`الحدود بتبدأ من 20% وبتزيد تدريجياً لحد 100% خلال ${app.wa.warmupDays} يوم (حتى لو النشر بدون حد مفعّل)`}
      />
      <div className="btn-row">
        <button className="btn primary small">حفظ الإعدادات</button>
        <button type="button" className="btn small" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </form>
  );
}
