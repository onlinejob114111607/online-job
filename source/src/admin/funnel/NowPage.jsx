import { useMemo, useState } from "react";
import { fmtAgo, toMs, waLink } from "../../utils";
import { daySummary, pct } from "../../funnelDefaults";
import { Empty, Panel } from "../ui";
import { DAYS, statusOf, timeIn, nextMeeting, meetingOf, useTick, untilText } from "./shared";
import { ConvModal } from "./Conversations";

export function NowPage({ rows, loading, cfg, run, setTab, setDay, today }) {
  useTick();
  const [open, setOpen] = useState(null);
  const next = nextMeeting(cfg);
  const at = next ? meetingOf(cfg, next.key) : null;
  const s = useMemo(() => daySummary(rows), [rows]);
  const need = rows.filter((r) => statusOf(r) === "attention").sort((a, b) => toMs(b.lastInAt) - toMs(a.lastInAt));
  const booked = rows.filter((r) => r.status === "completed");
  const notIn = booked.filter((r) => !r.attended);
  const live = rows.filter((r) => r.status === "active").length;
  const goal = cfg.goal?.daily || 0;
  const meetLeft = at ? at.getTime() - Date.now() : null;
  const inHour = meetLeft != null && meetLeft < 70 * 60_000 && meetLeft > -90 * 60_000 && next?.today;
  const calls = (run?.calls || []).filter((x) => !rows.find((r) => r.id === x.phone)?.attended);
  const cur = open && rows.find((r) => r.id === open);
  return (
    <div className="now-page">
      <div className={"now-hero" + (inHour ? " hot" : "")}>
        <div>
          <small>اللقاء الجاي</small>
          <b>{next ? (next.today ? "اليوم" : DAYS[next.wd]) : "—"}</b>
          {at && (
            <span>
              {timeIn(at, "Africa/Cairo")} مصر · {timeIn(at, "Asia/Dubai")} دبي
            </span>
          )}
        </div>
        {at && next?.today && <div className="now-count">{meetLeft > -90 * 60_000 ? untilText(meetLeft) : "خلص"}</div>}
      </div>
      <div className="now-grid">
        <button type="button" className="now-tile" onClick={() => setTab("today")}>
          <b>{s.welcomed}</b>
          <span>رسائل اليوم</span>
          <small>{live} بالمحادثة</small>
        </button>
        <button type="button" className="now-tile" onClick={() => setTab("today")}>
          <b>{s.replied}</b>
          <span>ردّوا</span>
          <small>{pct(s.replied, s.welcomed)}٪</small>
        </button>
        <button type="button" className={"now-tile" + (goal && s.booked >= goal ? " ok" : "")} onClick={() => setTab("done")}>
          <b>
            {s.booked}
            {goal ? <em>/{goal}</em> : null}
          </b>
          <span>بوك</span>
          <small>{pct(s.booked - s.invBooked, s.welcomed)}٪ من الرسائل</small>
        </button>
        <button type="button" className="now-tile" onClick={() => setTab("done")}>
          <b>{s.attended}</b>
          <span>حضروا</span>
          <small>{booked.length ? `${pct(s.attended, booked.length)}٪ من البوك` : "—"}</small>
        </button>
      </div>
      {goal > 0 && (
        <div className="now-bar" title="هدف البوك اليومي">
          <span style={{ width: `${Math.min(100, (s.booked / goal) * 100)}%` }} />
        </div>
      )}

      <Panel title={`محتاج ردك (${need.length})`}>
        {loading && !rows.length ? (
          <Empty>جاري التحميل...</Empty>
        ) : !need.length ? (
          <Empty>👌 ما في حدا مستنيك</Empty>
        ) : (
          <div className="list">
            {need.map((c) => (
              <div key={c.id} className="item conv-item conv-alert" onClick={() => setOpen(c.id)}>
                <div className="item-head">
                  <b>{c.name || "—"}</b>
                  <span className="muted small-text">{fmtAgo(c.lastInAt)}</span>
                </div>
                {c.attentionWhy && <div className="err-text small-text">{c.attentionWhy}</div>}
                {c.lastIn && <div className="conv-last">{c.lastIn}</div>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {inHour && calls.length > 0 && (
        <Panel title={`📞 اتصل فيهم (${calls.length})`}>
          <div className="call-list">
            {calls.map((x) => (
              <div key={x.phone} className="call-row">
                <span>
                  {x.hot ? "🟢" : "⚪"} {x.name}
                </span>
                <a className="btn small" href={`tel:+${x.phone}`}>
                  اتصال
                </a>
                <a className="btn small wa-solid" href={waLink(x.phone)} target="_blank" rel="noreferrer">
                  واتساب
                </a>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {booked.length > 0 && (
        <Panel title={`البوك اليوم (${booked.length}) · لسا ما دخلوا ${notIn.length}`}>
          <div className="now-people">
            {booked.map((c) => (
              <a key={c.id} className={"now-person" + (c.attended ? " in" : "")} href={waLink(c.phone)} target="_blank" rel="noreferrer">
                <span>{c.attended === "prelim" ? "🟡" : c.attended ? "✅" : c.lastInAt > (c.lastOutAt || 0) || c.readAt ? "👀" : "⏳"}</span>
                {c.name || c.phone}
              </a>
            ))}
          </div>
          <p className="small-text muted">✅ حضر · 🟡 بعت لقطة · 👀 تفاعل/قرأ · ⏳ لسا ما تفاعل</p>
        </Panel>
      )}
      <div className="btn-row">
        <button className="btn small" onClick={() => (setDay(today), setTab("today"))}>
          كل المحادثات
        </button>
        <button className="btn small" onClick={() => setTab("stats")}>
          النسب
        </button>
      </div>
      {cur && <ConvModal c={cur} cfg={cfg} day={today} onClose={() => setOpen(null)} />}
    </div>
  );
}
