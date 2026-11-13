import { useEffect, useState } from "react";
import { cairoDayKey, copyText } from "../../utils";
import { meetingTimeOf } from "../../funnelDefaults";
import { useAdmin } from "../hooks";
import { Field, Panel } from "../ui";
import { meetingInstant, timeIn, fillText } from "./shared";

export function CopyMessages({ cfg }) {
  const { toast } = useAdmin();
  const [day, setDay] = useState(cairoDayKey());
  const [time, setTime] = useState(() => meetingTimeOf(cfg, cairoDayKey()));
  const [name, setName] = useState("");
  const [copied, setCopied] = useState("");
  const dayTime = meetingTimeOf(cfg, day || cairoDayKey());
  useEffect(() => setTime(dayTime), [dayTime]);

  const groups = [];
  let n = 0;
  const add = (title, items) => groups.push({ title, items: items.map((x) => ({ ...x, code: `M${++n}` })) });
  add(
    "خطوات المحادثة",
    cfg.steps.flatMap((st) => [
      ...(st.disclose && cfg.discloseOn ? [{ label: "رسالة الوضوح (قبل رابط التسجيل)", text: cfg.disclosure }] : []),
      ...st.messages.map((m, k) => ({ label: st.messages.length > 1 ? `${st.label} (${k + 1})` : st.label, text: m })),
    ])
  );
  add(
    "قبل اللقاء",
    cfg.reminders.flatMap((r) => r.messages.map((m) => ({ label: `${r.label} — قبل ${r.before} د`, text: m })))
  );
  if (cfg.nudgeText.trim()) add("في حال لم يتم الرد", [{ label: "في حال لم يتم الرد", text: cfg.nudgeText }]);
  add("ردود تلقائية على الأسئلة", cfg.autoAnswers.map((a) => ({ label: a.label, text: a.text })));
  add("الحضور واللي ما حضر", [
    ...(cfg.joinAck.trim() ? [{ label: "تأكيد الحضور (بعد اللقطة)", text: cfg.joinAck }] : []),
    ...(cfg.noShowText.trim() ? [{ label: "دعوة اللي ما حضر للقاء الجاي", text: cfg.noShowText }] : []),
  ]);
  add("رسائل جاهزة", cfg.quickReplies.map((q) => ({ label: q.label, text: q.text })));

  const at = meetingInstant(day || cairoDayKey(), time || dayTime);
  async function copy(code, text) {
    await copyText(fillText(text, cfg, day || cairoDayKey(), time || dayTime, name.trim()));
    setCopied(code);
    toast(`انسخت ${code}`, "ok", 1200);
    setTimeout(() => setCopied((c) => (c === code ? "" : c)), 1800);
  }

  return (
    <>
      <Panel title="تاريخ ووقت اللقاء للرسائل">
        <div className="form-grid">
          <Field label="تاريخ اللقاء">
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="الساعة (بتوقيت دبي)" hint={`= ${timeIn(at, "Africa/Cairo")} مصر · ${timeIn(at, "Asia/Gaza")} فلسطين`}>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="اسم العميل (اختياري)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="بيتحط مكان {name}" />
          </Field>
        </div>
        <div className="btn-row">
          <button className="btn small" onClick={() => setDay(cairoDayKey())}>
            اليوم
          </button>
          <button className="btn small" onClick={() => setTime(dayTime)}>
            وقت هاليوم ({dayTime})
          </button>
        </div>
        <p className="small-text muted">الرسائل بتنسخ والتاريخ واليوم والساعات معبّيين حسب اللي فوق. التعديل هون للنسخ بس، وما بيغيّر إعدادات المتابعة.</p>
      </Panel>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <Panel key={g.title} title={g.title}>
            <div className="list">
              {g.items.map((it) => {
                const filled = fillText(it.text, cfg, day || cairoDayKey(), time || dayTime, name.trim());
                return (
                  <div key={it.code} className="item copy-item">
                    <div className="item-head">
                      <div className="item-title">
                        <span className="m-code">{it.code}</span> {it.label}
                      </div>
                      <button className={"btn small" + (copied === it.code ? " primary" : "")} onClick={() => copy(it.code, it.text)}>
                        {copied === it.code ? "✓ انسخت" : "نسخ"}
                      </button>
                    </div>
                    <div className="copy-text">{filled}</div>
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}
    </>
  );
}
