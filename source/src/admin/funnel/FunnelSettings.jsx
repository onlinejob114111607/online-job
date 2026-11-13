import { useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cairoDayKey, copyText } from "../../utils";
import { FUNNEL_DEFAULTS, VOICE_SLOTS, meetingTimeOf, mergeFunnel } from "../../funnelDefaults";
import { useAdmin } from "../hooks";
import { Field, Panel, Toggle } from "../ui";
import { DAYS, WAIT, meetingInstant, timeIn, nextMeeting, VARS } from "./shared";
import { SrcTemplates, VoicesPanel } from "./Voices";

export function FunnelSettings({ cfg }) {
  const { waAccounts, toast } = useAdmin();
  const [s, setS] = useState(() => structuredClone(cfg));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!dirty) setS(structuredClone(cfg));
  }, [cfg, dirty]);
  const set = (k, v) => (setDirty(true), setS((p) => ({ ...p, [k]: v })));
  const setStep = (i, patch) => set("steps", s.steps.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const moveStep = (i, d) => {
    const a = [...s.steps];
    [a[i], a[i + d]] = [a[i + d], a[i]];
    set("steps", a);
  };
  const next = nextMeeting(s);
  const setSch = (d, patch) => {
    const has = s.schedule.find((x) => x.d === d);
    set("schedule", has ? s.schedule.map((x) => (x.d === d ? { ...x, ...patch } : x)) : [...s.schedule, { d, time: s.meetingTime, eve: false, ...patch }].sort((a, b) => a.d - b.d));
  };
  const at = meetingInstant(next?.key || cairoDayKey(), next ? meetingTimeOf(s, next.key) : s.meetingTime);
  const setAA = (i, patch) => set("autoAnswers", s.autoAnswers.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setGoal = (patch) => set("goal", { ...s.goal, ...patch });
  const voiceOpts = [["", "بدون فويس"], ...VOICE_SLOTS];

  async function save() {
    setSaving(true);
    try {
      const clean = mergeFunnel({
        ...s,
        acceptWords: String(s.acceptWords.join ? s.acceptWords.join("\n") : s.acceptWords).split(/[\n،,]+/),
        rejectWords: String(s.rejectWords.join ? s.rejectWords.join("\n") : s.rejectWords).split(/[\n،,]+/),
        problemWords: String(s.problemWords.join ? s.problemWords.join("\n") : s.problemWords).split(/[\n،,]+/),
        autoAnswers: s.autoAnswers.map((a) => ({ ...a, words: String(a.words.join ? a.words.join("\n") : a.words).split(/[\n،,]+/) })),
      });
      if (clean.enabled && clean.discloseOn && !clean.costText.trim()) toast('انتبه: المتابعة ما رح تشتغل قبل ما تكتب "التكلفة الكاملة"', "bad", 6000);
      await setDoc(doc(db, "settings", "funnel"), { ...clean, updatedAt: serverTimestamp() });
      setDirty(false);
      toast("انحفظت ✓ — عامل الواتساب بياخدها فوراً", "ok");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ", "bad");
    }
    setSaving(false);
  }

  const num = (k, props = {}) => ({ type: "number", value: s[k], onChange: (e) => set(k, e.target.value === "" ? "" : Number(e.target.value)), ...props });

  return (
    <div className="settings-page">
      <Panel title="التشغيل">
        <Toggle checked={s.enabled} onChange={(v) => set("enabled", v)} label="تفعيل المتابعة التلقائية يوم اللقاء" hint="لما تكون مطفية ما بينبعت ولا إشي تلقائي." />
        <Toggle checked={s.manualOnly} onChange={(v) => set("manualOnly", v)} label="يدوي بس — الترحيب ما بينبعت إلا لما أضغط الزر" hint={`ما بتبدأ الدفعة لحالها الساعة ${s.startTime}. بتبدأها إنت من زر «ابدأ دفعة اليوم هلأ» بصفحة المتابعة، وبيشتغل بس بأيام اللقاء. باقي السيناريو (الردود والتذكيرات) بيكمّل عادي.`} />
        <Field label="حساب الواتساب اللي بيتابع" hint="نفس الرقم لازم يكون اللي بيرد عليه العملاء.">
          <select value={s.accountId} onChange={(e) => set("accountId", e.target.value)}>
            <option value="">حساب الترحيب الافتراضي (من الإعدادات العامة)</option>
            {waAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.phone ? `(+${a.phone})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="أيام اللقاء ووقت كل يوم (بتوقيت دبي)" hint="ليلة قبل = البوك بيبدأ من الليلة اللي قبل اللقاء (مناسب للقاءات الاثنين والأربعاء).">
          <div className="sched">
            {DAYS.map((d, i) => {
              const x = s.schedule.find((y) => y.d === i);
              const when = x ? meetingInstant("2026-11-02", x.time) : null;
              return (
                <div key={i} className={"sched-row" + (x ? " on" : "")}>
                  <label className="check-line">
                    <input type="checkbox" checked={!!x} onChange={(e) => (e.target.checked ? setSch(i, {}) : set("schedule", s.schedule.filter((y) => y.d !== i)))} /> {d}
                  </label>
                  {x && (
                    <>
                      <input type="time" value={x.time} onChange={(e) => setSch(i, { time: e.target.value })} />
                      <span className="small-text muted">= {timeIn(when, "Africa/Cairo")} مصر · {timeIn(when, "Asia/Gaza")} فلسطين</span>
                      <label className="check-line">
                        <input type="checkbox" checked={!!x.eve} onChange={(e) => setSch(i, { eve: e.target.checked })} /> البوك من الليلة اللي قبل
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Field>
        <div className="form-grid">
          <Field label="مدة اللقاء (دقيقة)">
            <input {...num("duration", { min: 5 })} />
          </Field>
          <Field label="بداية الترحيب (توقيت مصر)">
            <input type="time" value={s.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </Field>
          <Field label="تسكير المتابعة (توقيت مصر)" hint="بعدها ما بينبعت إشي لحد ما خلّص.">
            <input type="time" value={s.closeTime} onChange={(e) => set("closeTime", e.target.value)} />
          </Field>
          <Field label="عدد الأشخاص بكل لقاء" hint="من الأقدم للأحدث، والباقي للقاء الجاي.">
            <input {...num("batchSize", { min: 1 })} />
          </Field>
          <Field label="المسجلين يوم اللقاء بيدخلوا لحد" hint="لو الدفعة فيها مكان، اللي بيسجّل نفس اليوم قبل هالساعة بيوصله ترحيب.">
            <input type="time" value={s.lateUntil} onChange={(e) => set("lateUntil", e.target.value)} />
          </Field>
          <Field label="بوك الليلة اللي قبل: من (توقيت مصر)">
            <input type="time" value={s.eveStart} onChange={(e) => set("eveStart", e.target.value)} />
          </Field>
          <Field label="بوك الليلة اللي قبل: لحد" hint="بعدها البوت بيستنى لبداية المتابعة الصبح.">
            <input type="time" value={s.eveEnd} onChange={(e) => set("eveEnd", e.target.value)} />
          </Field>
          <Field label="البوك البكير لحد (يوم اللقاء، مصر)" hint="البوك قبل هالساعة (أو من الليلة اللي قبل) = بكير: تذكير العصر + تذكير الساعة. بعدها = متأخر: تذكير الساعة بس.">
            <input type="time" value={s.earlyUntil} onChange={(e) => set("earlyUntil", e.target.value)} />
          </Field>
          <Field label="ثواني بين رسالة ورسالة بنفس المحادثة">
            <input {...num("msgGap", { min: 3 })} />
          </Field>
          <Field label="ثواني بين عميل وعميل">
            <input {...num("clientGap", { min: 5 })} />
          </Field>
        </div>
      </Panel>

      <Panel title="بيانات الرسائل">
        <div className="form-grid">
          <Field label="رابط التسجيل {رابط}">
            <input dir="ltr" value={s.regLink} onChange={(e) => set("regLink", e.target.value.trim())} />
          </Field>
          <Field label="الرقم المرجعي {رقم}">
            <input dir="ltr" value={s.refNo} onChange={(e) => set("refNo", e.target.value.trim())} />
          </Field>
          <Field label="اسمك {اسمي}" hint='بمسج التعريف: "معك ..."'>
            <input value={s.senderName} onChange={(e) => set("senderName", e.target.value)} />
          </Field>
          <Field label="اسم التيم ليدر {التيم_ليدر}">
            <input value={s.teamLeader} onChange={(e) => set("teamLeader", e.target.value)} />
          </Field>
          <Field label="رابط إعادة اللقاء {رابط_الإعادة}">
            <input dir="ltr" value={s.replayLink} onChange={(e) => set("replayLink", e.target.value.trim())} placeholder="https://..." />
          </Field>
        </div>
      </Panel>

      <Panel title="رسالة الوضوح وعدم الملاحقة">
        <Toggle checked={s.discloseOn} onChange={(v) => set("discloseOn", v)} label="إرسال رسالة الوضوح قبل رابط التسجيل" hint="مطفية = البوت بيمشي على نص الشركة بدون رسالة الوضوح." />
        <Field label="التكلفة الكاملة {التكلفة} (اختياري)" hint={s.discloseOn ? "لازمة لما تكون رسالة الوضوح مفعّلة." : "فاضية = الأسطر اللي فيها {التكلفة} بالردود بتنشال لحالها."}>
          <textarea rows={2} value={s.costText} onChange={(e) => set("costText", e.target.value)} placeholder="مثال: 150$ رسوم انضمام ودورة + 20$ اشتراك شهري" className={s.discloseOn && !s.costText.trim() ? "input-bad" : ""} />
        </Field>
        {s.discloseOn && (
          <Field label="رسالة الوضوح — بتنبعت قبل رابط التسجيل">
            <textarea rows={7} value={s.disclosure} onChange={(e) => set("disclosure", e.target.value)} />
          </Field>
        )}
        <ul className="small-text muted rules-list">
          <li>أي رفض (مش مهتم، الغي، احذفني...) بأي مرحلة ← بتوقف كل الرسائل والتذكيرات فوراً.</li>
          <li>ما في اتصالات تلقائية. قائمة "ما بعتوا لقطة" بتوصلك إنت وإنت بتقرر تتصل.</li>
          <li>"في حال لم يتم الرد" مرة وحدة بس، ودعوة اللي ما حضر مرة وحدة بس.</li>
          <li>أسئلة الراتب والتكلفة بتنجاوب بشكل صريح (شوف "الردود التلقائية").</li>
        </ul>
        <Toggle checked={!s.manualStops} onChange={(v) => set("manualStops", !v)} label="ردي من الجوال = جواب، والبوت بيكمل" hint="لو طفيتها: أول ما ترد بإيدك على شخص، البوت بيوقف معه وبيتركه إلك." />
      </Panel>

      <Panel
        title="خطوات المحادثة"
        actions={
          <button type="button" className="btn small" onClick={() => confirm("ترجع كل الخطوات والرسائل للنص الأصلي؟") && set("steps", structuredClone(FUNNEL_DEFAULTS.steps))}>
            رجوع للأصل
          </button>
        }
      >
        <p className="small-text muted">
          كل خطوة بتنبعت رسائلها ورا بعض، وبعدها البوت بيستنى رد العميل حسب الشرط. المتغيرات:{" "}
          {VARS.map(([v, l]) => (
            <code key={v} title={l} className="var-chip" onClick={() => copyText(v).then(() => toast(`انسخ ${v}`, "ok", 1200))}>
              {v}
            </code>
          ))}{" "}
          والتنويع {"{أهلاً|مرحبا}"} شغال.
        </p>
        {s.steps.map((st, i) => (
          <div key={i} className="step-card">
            <div className="step-head">
              <span className="step-num">{i + 1}</span>
              <input value={st.label} onChange={(e) => setStep(i, { label: e.target.value })} className="step-label" />
              <div className="row-gap">
                <button type="button" className="icon-btn" disabled={i === 0} onClick={() => moveStep(i, -1)} title="لفوق">
                  ↑
                </button>
                <button type="button" className="icon-btn" disabled={i === s.steps.length - 1} onClick={() => moveStep(i, 1)} title="لتحت">
                  ↓
                </button>
                <button type="button" className="icon-btn" disabled={s.steps.length < 2} onClick={() => confirm("حذف الخطوة؟") && set("steps", s.steps.filter((_, j) => j !== i))}>
                  🗑
                </button>
              </div>
            </div>
            {i === 0 && <div className="small-text muted">هاي رسالة الترحيب اللي بتنبعت تلقائياً الساعة {s.startTime} يوم اللقاء.</div>}
            {st.messages.map((m, k) => (
              <div key={k} className="msg-edit">
                <textarea rows={Math.min(14, Math.max(3, m.split("\n").length + 1))} value={m} onChange={(e) => setStep(i, { messages: st.messages.map((x, j) => (j === k ? e.target.value : x)) })} />
                {st.messages.length > 1 && (
                  <button type="button" className="icon-btn" onClick={() => setStep(i, { messages: st.messages.filter((_, j) => j !== k) })}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {st.disclose && s.discloseOn && <div className="alert info small-text">📢 قبل رسائل هالخطوة بتنبعت "رسالة الوضوح" (الشركة + تسويق شبكي + التكلفة الكاملة).</div>}
            {i < s.steps.length - 1 && st.waitFor !== "none" && (
              <Field label="رسالة الاستكمال (بعد ما تجاوب سؤال أو بعد رد تلقائي)" hint="بتذكّره شو المطلوب بهالخطوة. فاضية = ما بتنبعت.">
                <input value={st.resume} onChange={(e) => setStep(i, { resume: e.target.value })} />
              </Field>
            )}
            <div className="step-foot">
              <button type="button" className="btn small" onClick={() => setStep(i, { messages: [...st.messages, ""] })}>
                + رسالة
              </button>
              <label className="wait-sel">
                🎤 بعدها:
                <select value={st.voice} onChange={(e) => setStep(i, { voice: e.target.value })}>
                  {voiceOpts.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {s.discloseOn && (
              <label className="check-line">
                <input type="checkbox" checked={!!st.disclose} onChange={(e) => set("steps", s.steps.map((x, j) => ({ ...x, disclose: j === i ? e.target.checked : e.target.checked ? false : x.disclose })))} /> رسالة الوضوح قبلها
              </label>
              )}
              {i < s.steps.length - 1 && (
                <label className="check-line">
                  <input type="checkbox" checked={st.rejectStops !== false} onChange={(e) => setStep(i, { rejectStops: e.target.checked })} /> كلمة "لا" بتوقف المتابعة
                </label>
              )}
              {i < s.steps.length - 1 ? (
                <label className="wait-sel">
                  بعدها استنى:
                  <select value={st.waitFor} onChange={(e) => setStep(i, { waitFor: e.target.value })}>
                    {Object.entries(WAIT).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="small-text muted">آخر خطوة — بعدها العميل بينضاف لقائمة "خلّصوا التسجيل"</span>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn small"
          onClick={() => set("steps", [...s.steps.slice(0, -1), { key: `s${Date.now()}`, label: "خطوة جديدة", waitFor: "any", messages: [""] }, s.steps.at(-1)])}
        >
          + خطوة (قبل الأخيرة)
        </button>
      </Panel>

      <SrcTemplates value={s.srcTemplates || {}} first={s.steps[0]?.messages?.[0] || ""} onChange={(v) => set("srcTemplates", v)} />

      <Panel title="رسائل قبل اللقاء (للي خلّصوا التسجيل)">
        <p className="small-text muted">
          بتنبعت تلقائياً يوم اللقاء للي حجزوا (البوك)، كل وحدة بوقتها قبل اللقاء. لو حدا حجز متأخر بيوصله بس أقرب تذكير. "للي ما تفاعل" = ما رد ولا شاف (الصحين الزرق) من آخر تذكير. أي صورة من وقت "ادخل اللقاء" = حضور مبدئي.
        </p>
        {s.reminders.map((r, i) => {
          const setR = (patch) => set("reminders", s.reminders.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          const when = new Date(at.getTime() - (Number(r.before) || 0) * 60_000);
          return (
            <div key={r.key} className="step-card">
              <div className="step-head">
                <Toggle checked={r.enabled} onChange={(v) => setR({ enabled: v })} label="" />
                <input value={r.label} onChange={(e) => setR({ label: e.target.value })} className="step-label" />
                <label className="wait-sel">
                  قبل
                  <input type="number" min={0} className="mini-num" value={r.before} onChange={(e) => setR({ before: e.target.value === "" ? "" : Number(e.target.value) })} />
                  دقيقة
                </label>
              </div>
              {r.kind === "msg" && (
                <div className="step-foot">
                  <label className="wait-sel">
                    لمين:
                    <select value={r.who} onChange={(e) => setR({ who: e.target.value })}>
                      <option value="all">الكل</option>
                      <option value="early">البوك البكير بس</option>
                      <option value="silent">اللي ما تفاعل (ما رد ولا شاف)</option>
                    </select>
                  </label>
                  <label className="wait-sel">
                    🎤
                    <select value={r.voice} onChange={(e) => setR({ voice: e.target.value })}>
                      {voiceOpts.map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {r.kind === "list" && <div className="small-text muted">بتوصلك على تيليجرام: اللي ما بعتوا لقطة دخول، المتفاعلين أولاً، مع روابط واتساب للاتصال اليدوي. (بتطلع كمان بتبويب "البوك والحضور")</div>}
              <div className="small-text muted">
                = {timeIn(when, "Asia/Dubai")} دبي · {timeIn(when, "Africa/Cairo")} مصر
              </div>
              {r.messages.map((m, k) => (
                <div key={k} className="msg-edit">
                  <textarea rows={Math.min(12, Math.max(3, m.split("\n").length + 1))} value={m} onChange={(e) => setR({ messages: r.messages.map((x, j) => (j === k ? e.target.value : x)) })} />
                </div>
              ))}
            </div>
          );
        })}
        <Field label="الرد على لقطة الدخول (مرة وحدة)">
          <textarea rows={2} value={s.joinAck} onChange={(e) => set("joinAck", e.target.value)} />
        </Field>
        <Field label="كلمات المشكلة بالردود بعد البوك (وحدة بكل سطر)">
          <textarea rows={4} value={Array.isArray(s.problemWords) ? s.problemWords.join("\n") : s.problemWords} onChange={(e) => set("problemWords", e.target.value)} />
        </Field>
      </Panel>

      <Panel title="في حال لم يتم الرد">
        <Field label="بعد كم دقيقة بدون رد؟ (0 = مطفية)" hint="بتنبعت مرة وحدة بس لكل شخص، وقبل موعد اللقاء.">
          <input {...num("nudgeAfter", { min: 0 })} />
        </Field>
        <div className="msg-edit">
          <textarea rows={4} value={s.nudgeText} onChange={(e) => set("nudgeText", e.target.value)} />
        </div>
      </Panel>

      <Panel title="اللي ما حضر">
        <Toggle checked={s.noShowOn} onChange={(v) => set("noShowOn", v)} label="دعوة وحدة بس للقاء الجاي" hint="اللي حجز وما حضر (لا لقطة ولا علّمته حضر) بتوصله دعوة وحدة يوم اللقاء الجاي. إذا وافق بيصير بوك، وبعدها البوت ما بيرجع يدعيه." />
        <div className="msg-edit">
          <textarea rows={5} value={s.noShowText} onChange={(e) => set("noShowText", e.target.value)} />
        </div>
      </Panel>

      <Panel
        title="الردود التلقائية على الأسئلة"
        actions={
          <button type="button" className="btn small" onClick={() => confirm("ترجع الردود التلقائية للأصل؟") && set("autoAnswers", structuredClone(FUNNEL_DEFAULTS.autoAnswers))}>
            رجوع للأصل
          </button>
        }
      >
        <p className="small-text muted">
          لما الشخص يسأل سؤال فيه وحدة من الكلمات، البوت بيرد لحاله وبيكمل من مكانه. سؤال "موعد اللقاء" بيرد بساعة اللقاء بتوقيت دولة الشخص {"{ساعة_محلي}"} وبيسأله "بتكون جاهز؟". أي سؤال تاني ← بيوصلك تنبيه، بتجاوبه وبيكمل.
        </p>
        {s.autoAnswers.map((a, i) => (
          <div key={a.key} className="step-card">
            <div className="step-head">
              <Toggle checked={a.enabled} onChange={(v) => setAA(i, { enabled: v })} label="" />
              <input value={a.label} onChange={(e) => setAA(i, { label: e.target.value })} className="step-label" />
              {a.key !== "time" && (
                <button type="button" className="icon-btn" onClick={() => set("autoAnswers", s.autoAnswers.filter((_, j) => j !== i))}>
                  🗑
                </button>
              )}
            </div>
            <Field label="الكلمات (وحدة بكل سطر)">
              <textarea rows={3} value={Array.isArray(a.words) ? a.words.join("\n") : a.words} onChange={(e) => setAA(i, { words: e.target.value })} />
            </Field>
            <div className="msg-edit">
              <textarea rows={Math.min(8, Math.max(3, a.text.split("\n").length + 1))} value={a.text} onChange={(e) => setAA(i, { text: e.target.value })} />
            </div>
            <label className="check-line">
              <input type="checkbox" checked={a.resume} onChange={(e) => setAA(i, { resume: e.target.checked })} /> بعد الرد ابعت "رسالة الاستكمال" تبع الخطوة
            </label>
          </div>
        ))}
        <button type="button" className="btn small" onClick={() => set("autoAnswers", [...s.autoAnswers, { key: `u${Date.now()}`, label: "سؤال جديد", enabled: true, resume: true, words: [], text: "" }])}>
          + رد تلقائي
        </button>
      </Panel>

      <VoicesPanel on={s.voiceOn} setOn={(v) => set("voiceOn", v)} />

      <Panel title="الهدف اليومي والدرجة">
        <div className="form-grid">
          <Field label="هدف البوك بكل يوم لقاء">
            <input type="number" min={0} value={s.goal.daily} onChange={(e) => setGoal({ daily: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="اسم الدرجة الجاية (اختياري)">
            <input value={s.goal.rankName} onChange={(e) => setGoal({ rankName: e.target.value })} />
          </Field>
          <Field label="BV المطلوب يمين">
            <input type="number" min={0} value={s.goal.rankRight} onChange={(e) => setGoal({ rankRight: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="BV المطلوب يسار">
            <input type="number" min={0} value={s.goal.rankLeft} onChange={(e) => setGoal({ rankLeft: Number(e.target.value) || 0 })} />
          </Field>
        </div>
        <Field label="تنبيه تيليجرام لو متأخر" hint="بالساعة هاي (مصر)، لو البوك أقل من النسبة من الهدف بيوصلك تنبيه.">
          <div className="list">
            {s.goal.checks.map((c, i) => (
              <div key={i} className="row-gap">
                الساعة <input type="time" value={c.at} onChange={(e) => setGoal({ checks: s.goal.checks.map((x, j) => (j === i ? { ...x, at: e.target.value } : x)) })} />
                لازم <input type="number" className="mini-num" min={1} max={100} value={c.pct} onChange={(e) => setGoal({ checks: s.goal.checks.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)) })} />٪ من الهدف
                <button type="button" className="icon-btn" onClick={() => setGoal({ checks: s.goal.checks.filter((_, j) => j !== i) })}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="btn small" onClick={() => setGoal({ checks: [...s.goal.checks, { at: "16:00", pct: 60 }] })}>
              + وقت فحص
            </button>
          </div>
        </Field>
      </Panel>

      <Panel
        title="رسائل جاهزة (بعد اللقاء والأسئلة)"
        actions={
          <button type="button" className="btn small" onClick={() => confirm("ترجع الرسائل الجاهزة للأصل؟") && set("quickReplies", structuredClone(FUNNEL_DEFAULTS.quickReplies))}>
            رجوع للأصل
          </button>
        }
      >
        <p className="small-text muted">ما بتنبعت تلقائياً — بتطلعلك أزرار بنافذة المحادثة، بتكبس وحدة وبتعدلها لو بدك وبتبعتها.</p>
        {s.quickReplies.map((q, i) => {
          const setQ = (patch) => set("quickReplies", s.quickReplies.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={i} className="step-card">
              <div className="step-head">
                <input value={q.label} onChange={(e) => setQ({ label: e.target.value })} className="step-label" />
                <button type="button" className="icon-btn" onClick={() => set("quickReplies", s.quickReplies.filter((_, j) => j !== i))}>
                  🗑
                </button>
              </div>
              <div className="msg-edit">
                <textarea rows={Math.min(8, Math.max(2, q.text.split("\n").length + 1))} value={q.text} onChange={(e) => setQ({ text: e.target.value })} />
              </div>
            </div>
          );
        })}
        <button type="button" className="btn small" onClick={() => set("quickReplies", [...s.quickReplies, { label: "رسالة جديدة", text: "" }])}>
          + رسالة جاهزة
        </button>
      </Panel>

      <Panel title="فهم الردود">
        <div className="form-grid">
          <Field label="كلمات القبول" hint="وحدة بكل سطر. البحث بيتجاهل الهمزات والتشكيل والحروف المكررة (تماااام = تمام).">
            <textarea rows={8} value={Array.isArray(s.acceptWords) ? s.acceptWords.join("\n") : s.acceptWords} onChange={(e) => set("acceptWords", e.target.value)} />
          </Field>
          <Field label="كلمات الرفض (بتوقف المتابعة)" hint='العبارات اللي فيها مسافة بكلمات القبول (زي "لا مانع") بتنفحص قبل الرفض.'>
            <textarea rows={8} value={Array.isArray(s.rejectWords) ? s.rejectWords.join("\n") : s.rejectWords} onChange={(e) => set("rejectWords", e.target.value)} />
          </Field>
        </div>
        <p className="small-text muted">
          أي رد مش مفهوم بخطوة "رد بقبول" أو "صورة" ← بيطلع عندك بـ "محتاج ردك" وبيوصلك تنبيه تيليجرام. بتجاوب (Reply بتيليجرام، أو من اللوحة، أو من جوالك) والبوت بيكمل من نفس الخطوة. كلمة "لا" لحالها بخطوة سؤال المدرب أو بعد البوك ما بتعتبر رفض، بتطلعلك.
        </p>
      </Panel>

      <div className="save-bar">
        <div className="save-status">{dirty ? <span className="muted">في تعديلات ما انحفظت</span> : <span className="ok">كل شي محفوظ</span>}</div>
        <button className="btn primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}
