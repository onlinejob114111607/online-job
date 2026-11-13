import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cairoDayKey } from "../../utils";
import { runCommand, useAdmin } from "../hooks";
import { Empty, Panel, Tag } from "../ui";
import { tgStateOf } from "./tgShared";

export default function TgAccounts() {
  const { tgAccounts, workers, app, toast } = useAdmin();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [step, setStep] = useState("phone"); // phone | code | password
  const [busy, setBusy] = useState(false);
  const [sentPhone, setSentPhone] = useState("");

  async function sendCode(e) {
    e?.preventDefault();
    if (!workers.tgOnline) return toast("عامل تيليجرام مطفي — شغّله على الجوال أول", "bad");
    setBusy(true);
    try {
      const r = await runCommand("tg", "tg_send_code", { phone });
      setSentPhone(r?.phone || phone);
      setStep("code");
      toast(r?.viaApp ? "الكود وصل على تطبيق تيليجرام (رسالة من Telegram)" : "الكود انبعت برسالة SMS", "ok", 5000);
    } catch (err) {
      toast(err.message, "bad", 5000);
    }
    setBusy(false);
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await runCommand("tg", "tg_verify", { phone: sentPhone, code, password: pw || null });
      if (r?.needPassword) {
        setStep("password");
        toast("الحساب عليه تحقق بخطوتين — اكتب كلمة السر", "info", 4000);
      } else {
        toast(`تمت إضافة ${r?.name || "الحساب"} ✓`, "ok");
        setPhone("");
        setCode("");
        setPw("");
        setStep("phone");
      }
    } catch (err) {
      toast(err.message, "bad", 5000);
    }
    setBusy(false);
  }

  return (
    <div className="page">
      <Panel title="إضافة حساب تيليجرام">
        {step === "phone" ? (
          <form className="row-form" onSubmit={sendCode}>
            <input dir="ltr" inputMode="tel" placeholder="+20 1xx xxx xxxx" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <button className="btn primary" disabled={busy}>
              {busy ? "جاري..." : "اطلب الكود"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p className="small-text muted" dir="auto">
              الرقم: <b dir="ltr">{sentPhone}</b>
            </p>
            <div className="row-form">
              <input dir="ltr" inputMode="numeric" placeholder="الكود" value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
              {step === "password" && (
                <input type="password" dir="ltr" placeholder="كلمة سر التحقق بخطوتين" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus />
              )}
              <button className="btn primary" disabled={busy}>
                {busy ? "جاري..." : "تأكيد"}
              </button>
              <button type="button" className="btn" onClick={() => (setStep("phone"), setCode(""), setPw(""))}>
                رجوع
              </button>
            </div>
          </form>
        )}
        <p className="small-text muted">
          استعمل أرقام ثانوية مش رقمك الأساسي. الكود وكلمة السر بينمسحوا من قاعدة البيانات أول ما العامل يستعملهم، والجلسة بتنحفظ على الجوال بس.
        </p>
      </Panel>

      {!tgAccounts.length ? (
        <Empty>ما في حسابات تيليجرام</Empty>
      ) : (
        <div className="cards">
          {tgAccounts.map((a) => (
            <TgCard key={a.id} a={a} app={app} online={workers.tgOnline} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function TgCard({ a, app, online, toast }) {
  const [label, kind] = tgStateOf(a, online, app);
  const today = cairoDayKey();
  const joins = a.joinsDate === today ? a.joinsToday || 0 : 0;
  const ref = doc(db, "tg_accounts", a.id);

  async function cmd(type, okMsg) {
    try {
      await runCommand("tg", type, { accountId: a.id }, { wait: false });
      toast(okMsg, "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{a.name || a.phone}</div>
          <div className="card-meta">
            <Tag kind={kind}>{label}</Tag>
            <span dir="ltr">{a.phone}</span>
            {a.username && <span dir="ltr">@{a.username}</span>}
            <span>
              انضمامات اليوم {joins} / {a.dailyLimit || app.tg.dailyLimit}
            </span>
          </div>
        </div>
      </div>
      {a.error && <div className="small-text err">{a.error}</div>}
      <div className="btn-row">
        <button className="btn small" onClick={() => updateDoc(ref, a.enabled === false ? { enabled: true, status: "ok", error: null } : { enabled: false })}>
          {a.enabled === false ? "تشغيل" : "إيقاف"}
        </button>
        <button className="btn small" onClick={() => cmd("tg_reconnect", "تم إرسال أمر إعادة الاتصال")} disabled={!online}>
          إعادة الاتصال
        </button>
        <button
          className="btn small"
          onClick={async () => {
            const v = prompt(`الحد اليومي للانضمام لهاد الحساب (فاضي = العام: ${app.tg.dailyLimit})`, a.dailyLimit || "");
            if (v === null) return;
            const n = parseInt(v, 10);
            if (v.trim() && (!n || n < 1 || n > 200)) return toast("الحد لازم يكون بين 1 و 200", "bad");
            await updateDoc(ref, { dailyLimit: v.trim() ? n : null });
          }}
        >
          الحد اليومي
        </button>
        <button
          className="btn small danger-outline"
          onClick={() => confirm(`حذف حساب ${a.name || a.phone}؟ الجلسة رح تنمسح من الجوال.`) && cmd("tg_delete", "جاري الحذف...")}
        >
          حذف
        </button>
      </div>
    </div>
  );
}
