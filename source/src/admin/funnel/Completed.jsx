import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { cairoDayKey, copyText, fmtAgo, toMs, waLink } from "../../utils";
import { daySummary, pct } from "../../funnelDefaults";
import { useAdmin } from "../hooks";
import { Empty, Panel, Tag } from "../ui";
import { remSent, timeIn, meetingOf, dayLabel } from "./shared";

export function Completed({ rows, all, cfg, day, run }) {
  const { toast } = useAdmin();
  const at = meetingOf(cfg, day);
  const sorted = [...rows].sort((a, b) => !!a.attended - !!b.attended || toMs(a.completedAt) - toMs(b.completedAt));
  const isToday = day === cairoDayKey();
  // تعديل الحضور ← بنحدّث النسب لهاليوم كمان
  const set = async (c, patch) => {
    try {
      await updateDoc(doc(db, "funnel", c.id), patch);
      if ("attended" in patch) {
        const s = daySummary(all.map((r) => (r.id === c.id ? { ...r, ...patch } : r)));
        await setDoc(doc(db, "funnel_runs", day), { day, stats: s }, { merge: true });
      }
    } catch {
      toast("فشل الحفظ", "bad");
    }
  };
  const att = rows.filter((r) => r.attended).length;
  const calls = run?.calls || [];

  return (
    <Panel
      title={`البوك (${rows.length}) · حضروا ${att}`}
      actions={
        <button className="btn small" disabled={!rows.length} onClick={() => copyText(sorted.map((r) => `${r.name} +${r.phone}`).join("\n")).then(() => toast("انسخت القائمة", "ok"))}>
          نسخ القائمة
        </button>
      }
    >
      <p className="small-text muted">
        اللقاء {dayLabel(day)} الساعة {timeIn(at, "Asia/Dubai")} دبي · {timeIn(at, "Africa/Cairo")} مصر. أي لقطة شاشة بتوصل وقت "ادخل اللقاء" بتنحسب حضور مبدئي (🟡)، وبتقدر تعلّم الحضور بإيدك. اللي ما حضر بتوصله دعوة وحدة للقاء الجاي.
        {rows.length > 0 && ` (حضور ${pct(att, rows.length)}٪)`}
      </p>
      {isToday && calls.length > 0 && (
        <div className="alert warn">
          <b>📞 للاتصال اليدوي — ما بعتوا لقطة دخول ({calls.filter((x) => !rows.find((r) => r.id === x.phone)?.attended).length}):</b>
          <div className="call-list">
            {calls
              .filter((x) => !rows.find((r) => r.id === x.phone)?.attended)
              .map((x) => (
                <div key={x.phone} className="call-row">
                  <span>{x.hot ? "🟢" : "⚪"} {x.name}</span>
                  <a className="btn small" href={`tel:+${x.phone}`}>اتصال</a>
                  <a className="btn small wa-solid" href={waLink(x.phone)} target="_blank" rel="noreferrer">
                    واتساب
                  </a>
                </div>
              ))}
          </div>
        </div>
      )}
      {!sorted.length ? (
        <Empty>لسا ما حدا خلّص بهاليوم</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الواتساب</th>
                <th>البوك</th>
                <th>حضر</th>
                <th>بعد اللقاء</th>
                <th>ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id}>
                  <td data-label="الاسم">
                    <b>{c.name}</b>
                    <div className="small-text muted">
                      {c.country || ""} {c.src ? `· ${c.src}` : ""} {c.reinvite ? "· دعوة ثانية" : ""}
                    </div>
                  </td>
                  <td data-label="الواتساب">
                    <a className="wa-btn" href={waLink(c.phone)} target="_blank" rel="noreferrer">
                      <span dir="ltr">+{c.phone}</span>
                    </a>
                  </td>
                  <td data-label="البوك" className="small-text book-cell">
                    <Tag kind={c.bookType === "early" ? "ok" : "wait"}>{c.bookType === "early" ? "بكير" : "متأخر"}</Tag> {fmtAgo(c.completedAt)}
                    <div className="rem-tags">
                      {cfg.reminders
                        .filter((r) => r.enabled && r.kind === "msg")
                        .map((r) => (
                          <Tag key={r.key} kind={remSent(c.rems?.[r.key]) ? "ok" : ""} title={c.rems?.[r.key] === "skip" ? "اتخطى" : c.rems?.[r.key] ? "انبعت" : "لسا"}>
                            {remSent(c.rems?.[r.key]) ? "✓ " : c.rems?.[r.key] === "skip" ? "– " : ""}
                            {r.label}
                          </Tag>
                        ))}
                    </div>
                    {c.readAt && <div className="small-text muted">شاف آخر رسالة {fmtAgo(c.readAt)}</div>}
                    {c.attention && <div className="err-text">{c.lastIn}</div>}
                  </td>
                  <td data-label="حضر">
                    <label className="check-line">
                      <input type="checkbox" checked={!!c.attended} onChange={(e) => set(c, { attended: e.target.checked ? true : false })} />
                      {c.attended === "prelim" ? "🟡 مبدئي (لقطة)" : c.attended ? "✓" : ""}
                    </label>
                  </td>
                  <td data-label="بعد اللقاء">
                    <input type="checkbox" checked={!!c.followEnd} onChange={(e) => set(c, { followEnd: e.target.checked })} />
                  </td>
                  <td data-label="ملاحظة">
                    <input
                      className="note-input"
                      defaultValue={c.note || ""}
                      placeholder="—"
                      onBlur={(e) => e.target.value !== (c.note || "") && set(c, { note: e.target.value.slice(0, 300) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
