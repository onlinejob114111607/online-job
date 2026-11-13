import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { COUNTRIES, EXPERIENCE_OPTIONS, HOURS_OPTIONS, SOURCE_OPTIONS } from "../config";
import { buildIntlPhone, normalizeDigits, getRef, getUtmSource } from "../utils";

const empty = {
  name: "",
  countryIdx: 0,
  phone: "",
  city: "",
  age: "",
  experience: "",
  hours: "",
  source: "",
  consent: false,
  website: "", // حقل مخفي ضد البوتات
};

export default function RegisterForm({ site }) {
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | done | duplicate | error
  const [step, setStep] = useState(1); // الاستمارة على خطوتين

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setF((p) => ({ ...p, [k]: v }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  function validateStep1() {
    const e = {};
    const name = f.name.trim();
    if (name.length < 3 || name.split(/\s+/).length < 2) e.name = "اكتب اسمك الثنائي على الأقل";
    const digits = normalizeDigits(f.phone);
    if (digits.length < 7 || digits.length > 15) e.phone = "رقم الواتساب غير صحيح";
    return e;
  }

  function next(ev) {
    ev.preventDefault();
    const e = validateStep1();
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  }

  function validate() {
    const e = validateStep1();
    if (Object.keys(e).length) {
      setErrors(e);
      setStep(1);
      return false;
    }
    if (!f.city.trim()) e.city = "اكتب مدينتك";
    const age = Number(normalizeDigits(f.age));
    if (!age || age < 18 || age > 70) e.age = "العمر لازم يكون 18 سنة أو أكثر";
    if (!f.experience) e.experience = "اختر مستوى خبرتك";
    if (!f.hours) e.hours = "اختر عدد الساعات";
    if (!f.source) e.source = "اختر من وين سمعت عنا";
    if (!f.consent) e.consent = "لازم توافق على التواصل معك";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev) {
    ev.preventDefault();
    if (f.website) return; // بوت
    if (!validate()) return;
    setState("sending");

    const country = COUNTRIES[f.countryIdx];
    const phone = buildIntlPhone(country.code, f.phone);

    try {
      await setDoc(doc(db, "registrations", phone), {
        name: f.name.trim().slice(0, 80),
        phone,
        country: country.name,
        city: f.city.trim().slice(0, 60),
        age: Number(normalizeDigits(f.age)),
        experience: f.experience,
        hours: f.hours,
        source: f.source,
        ref: getRef(),
        utm: getUtmSource(),
        status: "new",
        notes: "",
        consent: true,
        createdAt: serverTimestamp(),
      });
      setState("done");
      setF(empty);
      setStep(1);
    } catch (err) {
      // القواعد بترفض الإنشاء لو الرقم مسجل من قبل
      if (err?.code === "permission-denied") setState("duplicate");
      else setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="form-card success">
        <div className="success-icon">✓</div>
        <h3>{site.successTitle}</h3>
        <p>{site.successText}</p>
        <p className="muted">خلي الواتساب مفتوح وتأكد إنو الرقم صحيح.</p>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={step === 1 ? next : submit} noValidate>
      {site.formTitle && <h3>{site.formTitle}</h3>}
      {site.formSubtitle && <p className="muted">{site.formSubtitle}</p>}

      <div className="form-steps" aria-label={`الخطوة ${step} من 2`}>
        <span className={step >= 1 ? "on" : ""}>1 · بياناتك</span>
        <i className={step === 2 ? "on" : ""} />
        <span className={step === 2 ? "on" : ""}>2 · تفاصيل بسيطة</span>
      </div>

      {step === 1 && (
        <>
          <Field label="الاسم الكامل" error={errors.name}>
            <input value={f.name} onChange={set("name")} autoComplete="name" placeholder="مثال: أحمد محمد" />
          </Field>

          <Field label="رقم الواتساب" error={errors.phone}>
            <div className="phone-row">
              <select value={f.countryIdx} onChange={set("countryIdx")} aria-label="الدولة">
                {COUNTRIES.map((c, i) => (
                  <option key={c.code} value={i}>
                    {c.name} (+{c.code})
                  </option>
                ))}
              </select>
              <input value={f.phone} onChange={set("phone")} inputMode="tel" dir="ltr" autoComplete="tel-national" placeholder="1012345678" />
            </div>
          </Field>

          <button className="btn primary block">التالي ←</button>
          <p className="form-hint">ما بنشارك رقمك مع حدا، وبنتواصل معك على الواتساب بس.</p>
        </>
      )}

      {step === 2 && (
        <>
          <div className="grid-2">
            <Field label="المدينة" error={errors.city}>
              <input value={f.city} onChange={set("city")} />
            </Field>
            <Field label="العمر" error={errors.age}>
              <input value={f.age} onChange={set("age")} inputMode="numeric" />
            </Field>
          </div>

          <Field label="خبرتك" error={errors.experience}>
            <Chips options={EXPERIENCE_OPTIONS} value={f.experience} onChange={(v) => setF((p) => ({ ...p, experience: v }))} />
          </Field>

          <Field label="كم ساعة بتقدر تشتغل يومياً؟" error={errors.hours}>
            <Chips options={HOURS_OPTIONS} value={f.hours} onChange={(v) => setF((p) => ({ ...p, hours: v }))} />
          </Field>

          <Field label="من وين سمعت عنا؟" error={errors.source}>
            <select value={f.source} onChange={set("source")}>
              <option value="">اختر...</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>

          <input className="hp" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} />

          <label className={"consent" + (errors.consent ? " has-error" : "")}>
            <input type="checkbox" checked={f.consent} onChange={set("consent")} />
            <span>أوافق على التواصل معي عبر الواتساب بخصوص فرصة العمل.</span>
          </label>
          {errors.consent && <div className="err">{errors.consent}</div>}

          {state === "duplicate" && <div className="alert warn">هذا الرقم مسجّل عندنا من قبل، رح نتواصل معك قريباً 👍</div>}
          {state === "error" && <div className="alert danger">صار خطأ في الإرسال، تأكد من الإنترنت وجرب مرة ثانية.</div>}

          <div className="form-actions">
            <button type="button" className="btn" onClick={() => setStep(1)}>
              → رجوع
            </button>
            <button className="btn primary" disabled={state === "sending"}>
              {state === "sending" ? "جاري الإرسال..." : "إرسال التسجيل"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <div className={"field" + (error ? " has-error" : "")}>
      <label>{label}</label>
      {children}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button type="button" key={o} className={"chip" + (value === o ? " active" : "")} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}
