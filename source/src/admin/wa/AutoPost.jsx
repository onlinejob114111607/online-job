import { useEffect, useState } from "react";
import { collection, doc, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAdmin, useDocData, useQuery } from "../hooks";
import { Empty, Field, Panel, Progress, Tag, Toggle } from "../ui";

// النشر الآلي على مجموعات الواتساب — كل حساب إله إعداداته لحاله:
// تشغيل/إيقاف، القوالب اللي بيبدّل بينها، المنشن، وساعة البداية والنهاية.
// الحساب بيمرق على كل مجموعاته مرة باليوم، والفاصل = الوقت ÷ عدد المجموعات.
const ACC = { enabled: false, templateIds: [], mentionAll: false, start: "08:00", end: "20:00" };
const mins = (hm) => {
  const [h, m] = String(hm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtGap = (m) => (m >= 60 ? `${Math.floor(m / 60)} س${m % 60 ? ` ${m % 60} د` : ""}` : `${Math.max(1, m)} د`);
const clock = (t) => (t ? new Date(t).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" }) : "—");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());

// الإعدادات المحفوظة لكل حساب (وبتحوّل الشكل القديم: إعداد واحد لكل الحسابات)
function perFrom(saved, ids) {
  const per = { ...(saved?.per || {}) };
  if (!saved?.per && saved?.accounts?.length) {
    for (const id of ids) {
      per[id] = {
        ...ACC,
        enabled: !!saved.enabled && saved.accounts.includes(id),
        templateIds: saved.accounts.includes(id) ? saved.templateIds || [] : [],
        mentionAll: !!saved.mentionAll,
        start: saved.start || ACC.start,
        end: saved.end || ACC.end,
      };
    }
  }
  return per;
}

function AccountCard({ acc, cfg, state, groupsCount, tpls, onSave }) {
  const [f, setF] = useState(cfg);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(cfg), [JSON.stringify(cfg)]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const toggleTpl = (id) => set({ templateIds: f.templateIds.includes(id) ? f.templateIds.filter((x) => x !== id) : [...f.templateIds, id] });
  const win = mins(f.end) - mins(f.start);
  const dirty = JSON.stringify(f) !== JSON.stringify(cfg);
  const live = state && state.day === today();
  const total = live ? state.total || groupsCount : groupsCount;
  const done = live ? (state.done || []).length : 0;
  const usedTpls = tpls.filter((t) => cfg.templateIds.includes(t.id));

  async function save(patch = {}) {
    const next = { ...f, ...patch };
    if (next.enabled && !next.templateIds.length) {
      setOpen(true);
      return alert("اختار قالب واحد على الأقل لهالحساب");
    }
    if (mins(next.end) <= mins(next.start)) return alert("ساعة النهاية لازم تكون بعد ساعة البداية");
    setBusy(true);
    const ok = await onSave(acc.id, next);
    setBusy(false);
    if (ok) setF(next);
  }

  return (
    <div className="auto-item">
      <div className="auto-head">
        <div>
          <b>{acc.name}</b> {acc.phone && <span className="muted small-text">(+{acc.phone})</span>}
          <div className="muted small-text">
            {groupsCount} مجموعة{groupsCount > 0 && win > 0 ? ` · وحدة كل ~${fmtGap(Math.round(win / groupsCount))}` : ""} · {cfg.start}–{cfg.end}
          </div>
        </div>
        <Toggle checked={cfg.enabled} onChange={(v) => save({ enabled: v })} label={cfg.enabled ? "شغّال" : "واقف"} />
      </div>

      <div className="small-text">
        {usedTpls.length ? (
          <>
            📝 القوالب: {usedTpls.map((t) => t.title).join(" ← ")}
            {cfg.mentionAll && " · 📣 منشن للكل"}
          </>
        ) : (
          <span className="muted">ما في قوالب مختارة لهالحساب</span>
        )}
      </div>

      {cfg.enabled && (
        <>
          <Progress
            parts={[
              [((live ? state.sent || 0 : 0) / Math.max(1, total)) * 100, "s"],
              [((live ? (state.failed || 0) + (state.skipped || 0) : 0) / Math.max(1, total)) * 100, "f"],
            ]}
          />
          <p className="small-text muted">
            {live ? (
              <>
                ✅ {state.sent || 0} · ❌ {state.failed || 0}
                {state.skipped ? ` · ⏭ ${state.skipped}` : ""} · ⏳ {Math.max(0, total - done)} باقي من {total}
                {state.lastAt ? ` · آخر نشر ${clock(state.lastAt)}${state.lastGroup ? ` ← ${state.lastGroup}` : ""}` : ""}
                {state.next && state.next > Date.now() && done < total ? ` · الجاي ~${clock(state.next)}` : ""}
              </>
            ) : (
              `ما بلّش اليوم لسا (بيبلّش الساعة ${cfg.start})`
            )}
          </p>
          {live && state.note && <p className="small-text">ℹ️ {state.note}</p>}
          {live && state.error && <p className="small-text" style={{ color: "var(--bad)" }}>❌ {state.error}</p>}
        </>
      )}

      <button className="btn small" onClick={() => setOpen((x) => !x)}>
        {open ? "▲ سكّر الإعدادات" : "⚙️ إعدادات هالحساب"}
      </button>

      {open && (
        <div className="auto-edit">
          <div className="grid-2col">
            <Field label="يبلّش الساعة">
              <input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} />
            </Field>
            <Field label="يوقف الساعة">
              <input type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </div>
          <Field label="القوالب" hint="بيستعملها بالدور حسب الرقم جنب كل قالب (ترتيب ما علّمتهم): المجموعة الأولى القالب 1، التانية القالب 2...">
            {!tpls.length ? (
              <Empty>ما في قوالب لسا، اعمل قوالب من تبويب «القوالب»</Empty>
            ) : (
              <div className="auto-checks">
                {tpls.map((t) => (
                  <label key={t.id} className="check-line">
                    <input type="checkbox" checked={f.templateIds.includes(t.id)} onChange={() => toggleTpl(t.id)} />
                    <span>
                      {f.templateIds.includes(t.id) && <Tag kind="ok">{f.templateIds.indexOf(t.id) + 1}</Tag>} <b>{t.title}</b>{" "}
                      <span className="muted small-text">— {String(t.text || "").slice(0, 60)}…</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </Field>
          <Toggle checked={f.mentionAll} onChange={(v) => set({ mentionAll: v })} label="منشن للكل" hint="منشن لكل أعضاء المجموعة مع كل منشور (ما عدا أرقامك)." />
          <div className="btn-row">
            <button className="btn primary small" disabled={busy || !dirty} onClick={() => save()}>
              {busy ? "جاري..." : "حفظ"}
            </button>
            {dirty && (
              <button className="btn small" onClick={() => setF(cfg)}>
                تراجع
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AutoPost() {
  const { waAccounts, toast } = useAdmin();
  const saved = useDocData("settings/waAuto");
  const [tpls] = useQuery(() => query(collection(db, "templates"), orderBy("createdAt", "desc")), []);
  const [states] = useQuery(() => collection(db, "wa_auto"), []);
  const [groups] = useQuery(() => collection(db, "wa_groups"), []);

  if (saved === undefined) return <div className="page muted">جاري التحميل…</div>;
  const ids = waAccounts.map((a) => a.id);
  const per = perFrom(saved, ids);
  const groupsOf = (id) => groups.filter((g) => g.accountId === id && g.status === "joined" && g.enabled !== false && g.jid).length;
  const on = waAccounts.filter((a) => per[a.id]?.enabled).length;

  async function saveAcc(id, cfg) {
    try {
      // بنحفظ كل الحسابات من النسخة المحفوظة + الحساب اللي تعدّل بس
      await setDoc(doc(db, "settings", "waAuto"), { per: { ...per, [id]: { ...ACC, ...cfg } }, updatedAt: serverTimestamp() });
      toast(cfg.enabled ? "انحفظ — الحساب شغّال ✓" : "انحفظ ✓", "ok");
      return true;
    } catch (e) {
      console.error(e);
      toast("صار خطأ بالحفظ", "bad");
      return false;
    }
  }

  return (
    <div className="page">
      <Panel title="النشر الآلي على المجموعات" actions={<Tag kind={on ? "ok" : ""}>{on ? `🟢 ${on} حساب شغّال` : "⚪ كله واقف"}</Tag>}>
        <p className="small-text muted">
          كل حساب إله إعداداته لحاله. الحساب الشغّال بينشر على <b>كل مجموعاته</b> مرة باليوم، مجموعة ورا مجموعة بين ساعة البداية والنهاية. الفاصل بينحسب لحاله
          (الوقت ÷ عدد المجموعات)، والقوالب بتتبدّل بالدور. وحماية الرقم (الحد اليومي وحد الساعة والإيقاف المؤقت) بتضل شغالة.
        </p>
      </Panel>
      {!waAccounts.length ? (
        <Empty>ما في حسابات واتساب</Empty>
      ) : (
        <div className="auto-list">
          {waAccounts.map((a) => (
            <AccountCard key={a.id} acc={a} cfg={{ ...ACC, ...(per[a.id] || {}) }} state={states.find((x) => x.id === a.id)} groupsCount={groupsOf(a.id)} tpls={tpls} onSave={saveAcc} />
          ))}
        </div>
      )}
    </div>
  );
}
