import { useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cairoDayKey, fmtAgo, toMs, waLink } from "../../utils";
import { runCommand, useAdmin } from "../hooks";
import { Empty, Modal, Panel, Tag } from "../ui";
import { WAIT, STATUS, ORDER, statusOf } from "./shared";

export function Conversations({ rows, loading, counts, cfg, day }) {
  const [f, setF] = useState("");
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const shown = rows
    .filter((r) => !f || statusOf(r) === f)
    .filter((r) => !q || [r.name, r.phone, r.lastIn].some((v) => String(v || "").toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ORDER.indexOf(statusOf(a)) - ORDER.indexOf(statusOf(b)) || toMs(b.lastInAt || b.updatedAt) - toMs(a.lastInAt || a.updatedAt));
  const cur = open && rows.find((r) => r.id === open);

  return (
    <Panel title={`المحادثات (${rows.length})`}>
      <div className="chips">
        <button className={"chip" + (!f ? " active" : "")} onClick={() => setF("")}>
          الكل {rows.length}
        </button>
        {ORDER.filter((k) => counts[k]).map((k) => (
          <button key={k} className={"chip" + (f === k ? " active" : "") + (k === "attention" ? " chip-alert" : "")} onClick={() => setF(k)}>
            {STATUS[k][0]} {counts[k]}
          </button>
        ))}
      </div>
      <div className="filters">
        <input type="search" placeholder="بحث بالاسم أو الرقم أو آخر رد..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading && !rows.length ? (
        <Empty>جاري التحميل...</Empty>
      ) : !shown.length ? (
        <Empty>{rows.length ? "ما في نتائج" : "ما في محادثات بهاليوم"}</Empty>
      ) : (
        <div className="list">
          {shown.map((c) => {
            const [l, k] = STATUS[statusOf(c)] || [c.status, ""];
            const step = cfg.steps[c.step];
            return (
              <div key={c.id} className={"item conv-item" + (statusOf(c) === "attention" ? " conv-alert" : "")} onClick={() => setOpen(c.id)}>
                <div className="item-head">
                  <div className="item-title">
                    <b>{c.name || "—"}</b> <span className="muted small-text" dir="ltr">+{c.phone}</span>
                  </div>
                  <Tag kind={k}>{l}</Tag>
                </div>
                <div className="item-meta">
                  {step && c.status !== "queued" && (
                    <span>
                      خطوة {c.step + 1}/{cfg.steps.length}: {step.label}
                    </span>
                  )}
                  {c.due != null && <Tag kind="wait">بينبعتله هلأ</Tag>}
                  {c.attentionWhy && <span className="err-text">{c.attentionWhy}</span>}
                  {c.error && <span className="err-text">{c.error}</span>}
                </div>
                {c.lastIn && (
                  <div className="conv-last">
                    <span className="muted">آخر رد ({fmtAgo(c.lastInAt)}):</span> {c.lastIn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {cur && <ConvModal c={cur} cfg={cfg} day={day} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

export function ConvModal({ c, cfg, day, onClose }) {
  const { toast, workers } = useAdmin();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [resume, setResume] = useState(true);
  const [save, setSave] = useState(false);
  const ref = doc(db, "funnel", c.id);
  const lastQ = [...(c.history || [])].reverse().find((h) => h.d === "in")?.t || "";
  const isToday = day === cairoDayKey();
  const next = cfg.steps[(c.step ?? -1) + 1];
  const live = ["active", "queued"].includes(c.status);

  async function act(patch, msg) {
    try {
      await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
      if (msg) toast(msg, "ok");
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
  }
  async function sendReply() {
    if (!text.trim()) return;
    if (!workers.waOnline) return toast("عامل الواتساب مطفي", "bad");
    setBusy(true);
    try {
      const r = await runCommand("wa", "funnel_answer", { phone: c.phone, text: text.trim(), resume, save, question: save ? lastQ : "" }, { timeout: 90_000 });
      setText("");
      setSave(false);
      toast(r?.resumed ? "انبعتت ✓ — والبوت كمّل من مكانه" : "انبعتت ✓", "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy(false);
  }
  async function markDone() {
    const early = Date.now() < new Date(`${c.day}T${cfg.earlyUntil}:00+02:00`).getTime();
    await act({ status: "completed", due: null, attention: false, completedAt: Date.now(), bookType: early ? "early" : "late" }, "انضاف لقائمة البوك");
    updateDoc(doc(db, "registrations", c.regId || c.phone), { status: "interested", funnel: { status: "completed", day: c.day } }).catch(() => {});
  }

  return (
    <Modal
      wide
      title={`${c.name || ""} · +${c.phone}`}
      onClose={onClose}
      actions={
        <button className="btn" onClick={onClose}>
          إغلاق
        </button>
      }
    >
      <div className="item-meta">
        <Tag kind={STATUS[statusOf(c)]?.[1]}>{STATUS[statusOf(c)]?.[0] || c.status}</Tag>
        {cfg.steps[c.step] && (
          <span>
            خطوة {c.step + 1}: {cfg.steps[c.step].label} — مستني: {WAIT[cfg.steps[c.step].waitFor]}
          </span>
        )}
        <a className="btn small wa-solid" href={waLink(c.phone)} target="_blank" rel="noreferrer">
          فتح بواتسابي
        </a>
      </div>

      <div className="chat">
        {!(c.history || []).length ? (
          <Empty>ما في رسائل لسا</Empty>
        ) : (
          c.history.map((h, i) => (
            <div key={i} className={"bubble " + (h.d === "in" ? "in" : h.d === "me" ? "me" : h.d === "note" ? "note" : "out")}>
              <div className="bubble-text">{h.t}</div>
              <div className="bubble-time">
                {h.d === "me" ? "إنت من الجوال · " : h.by === "panel" ? "إنت من اللوحة · " : ""}
                {new Date(h.at).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" })}
              </div>
            </div>
          ))
        )}
      </div>

      {["active", "completed", "invite"].includes(c.status) && (
        <div className="field">
          <label>{c.attention ? "جاوبه — وبعدها البوت بيكمل من مكانه" : "رد من اللوحة (البوت بيضل شغال ومستني نفس الشرط)"}</label>
          {c.attention && lastQ && (
            <div className="conv-last">
              <span className="muted">سأل:</span> {lastQ}
            </div>
          )}
          {cfg.quickReplies.length > 0 && (
            <div className="chips quick-replies">
              {cfg.quickReplies.map((q) => (
                <button key={q.label} type="button" className="chip" title={q.text} onClick={() => setText(q.text)}>
                  {q.label}
                </button>
              ))}
            </div>
          )}
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب ردك أو اختار رسالة جاهزة..." />
          <div className="hint">المتغيرات زي {"{name}"} و{"{التيم_ليدر}"} و{"{التكلفة}"} بتتعبى لحالها وقت الإرسال. بتقدر كمان تجاوب من تيليجرام: Reply على تنبيه "محتاج جوابك".</div>
          {c.status === "active" && cfg.steps[c.step]?.resume && (
            <label className="check-line">
              <input type="checkbox" checked={resume} onChange={(e) => setResume(e.target.checked)} /> بعد جوابي كمّل المحادثة: "{cfg.steps[c.step].resume.slice(0, 60)}"
            </label>
          )}
          {lastQ && (
            <label className="check-line">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> احفظه كرد تلقائي لنفس السؤال ("{lastQ.slice(0, 40)}")
            </label>
          )}
          <button className="btn small primary" disabled={busy || !text.trim()} onClick={sendReply}>
            {busy ? "جاري..." : "إرسال"}
          </button>
        </div>
      )}

      <div className="btn-row">
        {c.status === "active" && next && c.due == null && (
          <button className="btn small primary" onClick={() => act({ due: c.step + 1, attention: false, attentionWhy: null }, "رح تنبعت الخطوة الجاية")}>
            كمّل للخطوة الجاية: {next.label}
          </button>
        )}
        {c.attention && (
          <button className="btn small" onClick={() => act({ attention: false, attentionWhy: null })}>
            شيل "محتاج ردك"
          </button>
        )}
        {live && (
          <button className="btn small" onClick={() => act({ status: "manual", due: null, attention: false }, "البوت وقف مع هالشخص")}>
            خليه عندي (وقّف البوت)
          </button>
        )}
        {isToday && ["manual", "expired", "closed", "rejected"].includes(c.status) && c.step >= 0 && (
          <button className="btn small" onClick={() => act({ status: "active", attention: false, due: null }, "رجع للبوت")}>
            رجّعه للبوت
          </button>
        )}
        {c.status !== "completed" && (
          <button className="btn small" onClick={markDone}>
            علّمه خلّص التسجيل
          </button>
        )}
        {live && (
          <button className="btn small danger-outline" onClick={() => confirm("تسكير المتابعة مع هالشخص؟") && act({ status: "closed", due: null, attention: false })}>
            تسكير
          </button>
        )}
      </div>
    </Modal>
  );
}
