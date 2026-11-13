import { useEffect, useState } from "react";
import { SITE } from "../config";
import { saveSiteContent } from "../siteContent";
import Icon, { ICON_OPTIONS, iconKey } from "./Icons";

// محرر نصوص صفحة الهبوط من لوحة التحكم
export default function SiteEditor({ initial, onSaved }) {
  const [s, setS] = useState(initial);
  const [state, setState] = useState("idle"); // idle | saving | saved | error
  const [dirty, setDirty] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!dirty) setS(initial);
  }, [initial, dirty]);

  const upd = (patch) => {
    setS((p) => ({ ...p, ...patch }));
    setDirty(true);
    setState("idle");
  };
  const text = (k) => ({ value: s[k] ?? "", onChange: (e) => upd({ [k]: e.target.value }) });

  async function save() {
    setState("saving");
    try {
      await saveSiteContent(s);
      onSaved?.(s);
      setDirty(false);
      setState("saved");
    } catch (e) {
      console.error(e);
      setState("error");
    }
  }

  function resetDefaults() {
    setS({ ...SITE });
    setDirty(true);
    setConfirmReset(false);
    setState("idle");
  }

  return (
    <div className="editor">
      <Group title="عام">
        <Input id="se-name" label="اسم الموقع (يظهر بالأعلى وبعنوان الصفحة)" {...text("name")} />
        <Input id="se-cta" label="نص زر التسجيل" {...text("ctaText")} />
        <Input id="se-footer" label="نص أسفل الصفحة" {...text("footer")} />
      </Group>

      <Group title="الواجهة الرئيسية">
        <Input id="se-badge" label="الشارة الصغيرة (اتركها فاضية لإخفائها)" {...text("badge")} />
        <Area id="se-headline" label="العنوان الرئيسي" rows={2} {...text("headline")} />
        <Area id="se-sub" label="الوصف تحت العنوان" rows={3} {...text("subheadline")} />
      </Group>

      <Group title="فقرة التعريف">
        <Input id="se-intro-t" label="عنوان الفقرة" {...text("introTitle")} />
        <Area
          id="se-intro"
          label="النص (اترك سطر فاضي بين كل فقرة والثانية، واتركه فاضي لإخفاء القسم)"
          rows={8}
          {...text("intro")}
        />
      </Group>

      <Group title="المميزات">
        <Input id="se-ben-t" label="عنوان القسم" {...text("benefitsTitle")} />
        <ListEditor
          items={s.benefits}
          onChange={(benefits) => upd({ benefits })}
          blank={{ icon: "star", title: "", text: "" }}
          addLabel="إضافة ميزة"
          render={(item, set, i) => (
            <>
              <div className="row-2">
                <div className="field field-small">
                  <label htmlFor={`se-b-i-${i}`}>أيقونة</label>
                  <div className="icon-pick">
                    <span className="icon-prev"><Icon name={iconKey(item.icon)} size={20} /></span>
                    <select id={`se-b-i-${i}`} value={iconKey(item.icon)} onChange={(e) => set({ icon: e.target.value })}>
                      {ICON_OPTIONS.map(([k, l]) => (
                        <option key={k} value={k}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input id={`se-b-t-${i}`} label="العنوان" value={item.title} onChange={(e) => set({ title: e.target.value })} />
              </div>
              <Input id={`se-b-x-${i}`} label="الوصف" value={item.text} onChange={(e) => set({ text: e.target.value })} />
            </>
          )}
        />
      </Group>

      <Group title="خطوات البدء">
        <Input id="se-st-t" label="عنوان القسم" {...text("stepsTitle")} />
        <ListEditor
          items={s.steps}
          onChange={(steps) => upd({ steps })}
          blank={{ title: "", text: "" }}
          addLabel="إضافة خطوة"
          numbered
          render={(item, set, i) => (
            <>
              <Input id={`se-s-t-${i}`} label="العنوان" value={item.title} onChange={(e) => set({ title: e.target.value })} />
              <Input id={`se-s-x-${i}`} label="الوصف" value={item.text} onChange={(e) => set({ text: e.target.value })} />
            </>
          )}
        />
      </Group>

      <Group title="المطلوب من المتقدم">
        <Input id="se-req-t" label="عنوان القسم" {...text("requirementsTitle")} />
        <ListEditor
          items={s.requirements}
          onChange={(requirements) => upd({ requirements })}
          blank=""
          addLabel="إضافة شرط"
          render={(item, set, i) => (
            <Input id={`se-r-${i}`} label={`الشرط ${i + 1}`} value={item} onChange={(e) => set(e.target.value)} />
          )}
        />
      </Group>

      <Group title="أرقام تحت الواجهة">
        <p className="small-text muted">اختياري — بتظهر كمربعات تحت العنوان الرئيسي. حط أرقام حقيقية بس (مثلاً عدد المسجلين أو الدول).</p>
        <ListEditor
          items={s.stats || []}
          onChange={(stats) => upd({ stats })}
          blank={{ value: "", label: "" }}
          addLabel="إضافة رقم"
          render={(item, set, i) => (
            <div className="row-2">
              <Input id={`se-n-v-${i}`} label="الرقم" value={item.value} onChange={(e) => set({ value: e.target.value })} small />
              <Input id={`se-n-l-${i}`} label="الوصف" value={item.label} onChange={(e) => set({ label: e.target.value })} />
            </div>
          )}
        />
      </Group>

      <Group title="أسئلة شائعة">
        <Input id="se-faq-t" label="عنوان القسم" {...text("faqTitle")} />
        <ListEditor
          items={s.faq || []}
          onChange={(faq) => upd({ faq })}
          blank={{ q: "", a: "" }}
          addLabel="إضافة سؤال"
          render={(item, set, i) => (
            <>
              <Input id={`se-q-${i}`} label="السؤال" value={item.q} onChange={(e) => set({ q: e.target.value })} />
              <Area id={`se-a-${i}`} label="الجواب" rows={2} value={item.a} onChange={(e) => set({ a: e.target.value })} />
            </>
          )}
        />
      </Group>

      <Group title="استمارة التسجيل">
        <Input id="se-f-t" label="عنوان الاستمارة" {...text("formTitle")} />
        <Input id="se-f-s" label="النص تحت العنوان" {...text("formSubtitle")} />
        <Input id="se-ok-t" label="عنوان رسالة النجاح" {...text("successTitle")} />
        <Area id="se-ok-x" label="نص رسالة النجاح" rows={2} {...text("successText")} />
      </Group>

      <Group title="الواتساب">
        <Input
          id="se-wa"
          label="رقم واتساب يظهر كزر عائم بالصفحة (اختياري، بصيغة دولية بدون + مثل 201012345678)"
          dir="ltr"
          {...text("contactWhatsapp")}
        />
        <Area
          id="se-wa-msg"
          label="الرسالة الجاهزة لما تتواصل مع مسجّل ({name} = اسمه الأول)"
          rows={3}
          {...text("waGreeting")}
        />
      </Group>

      <div className="save-bar">
        <div className="save-status">
          {state === "saving" && <span className="muted">جاري الحفظ...</span>}
          {state === "saved" && <span className="ok">✓ تم الحفظ، التعديلات ظاهرة على الموقع</span>}
          {state === "error" && <span className="err">فشل الحفظ. تأكد إنك ناشر قواعد Firestore الجديدة.</span>}
          {state === "idle" && dirty && <span className="muted">في تعديلات ما انحفظت</span>}
        </div>
        <div className="save-actions">
          {confirmReset ? (
            <>
              <span className="small-text">ترجيع النصوص الأصلية؟</span>
              <button className="btn small" onClick={() => setConfirmReset(false)}>
                لا
              </button>
              <button className="btn small danger" onClick={resetDefaults}>
                نعم
              </button>
            </>
          ) : (
            <button className="btn small" onClick={() => setConfirmReset(true)}>
              النصوص الأصلية
            </button>
          )}
          <button className="btn primary" onClick={save} disabled={state === "saving" || !dirty}>
            حفظ التعديلات
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="panel editor-group">
      <h3 className="panel-title">{title}</h3>
      <div className="editor-fields">{children}</div>
    </section>
  );
}

function Input({ id, label, small, ...props }) {
  return (
    <div className={"field" + (small ? " field-small" : "")}>
      <label htmlFor={id}>{label}</label>
      <input id={id} {...props} />
    </div>
  );
}

function Area({ id, label, ...props }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} {...props} />
    </div>
  );
}

function ListEditor({ items, onChange, blank, render, addLabel, numbered }) {
  const setAt = (i) => (patch) =>
    onChange(items.map((it, j) => (j === i ? (typeof it === "string" ? patch : { ...it, ...patch }) : it)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="list-editor">
      {items.map((item, i) => (
        <div className="list-item" key={i}>
          <div className="list-item-head">
            <span className="muted small-text">{numbered ? `الخطوة ${i + 1}` : `#${i + 1}`}</span>
            <div className="list-item-actions">
              <button type="button" className="icon-btn" title="لفوق" onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                title="لتحت"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
              >
                ↓
              </button>
              <button type="button" className="icon-btn" title="حذف" onClick={() => remove(i)}>
                ✕
              </button>
            </div>
          </div>
          {render(item, setAt(i), i)}
        </div>
      ))}
      <button
        type="button"
        className="btn small dashed"
        onClick={() => onChange([...items, typeof blank === "string" ? blank : { ...blank }])}
      >
        + {addLabel}
      </button>
    </div>
  );
}
