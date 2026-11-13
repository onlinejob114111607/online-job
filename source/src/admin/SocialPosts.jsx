// ============================================================
//  منشورات اليوم لفيسبوك وإنستغرام
//  العامل بيجهّزهم كل يوم (صور المنتج الأصلية + وصف عربي/إنجليزي بدون سعر)
//  وهون بتنزّل الصور وبتنسخ النص وبتعلّم «نشرته»
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { copyText } from "../utils";
import { runCommand, useAdmin, useDocData, useQuery } from "./hooks";
import { Empty, Field, Panel, Tag, Toggle } from "./ui";
import { mergeSocial } from "../socialDesign";
import { REGIONS } from "../groupIntel";

const TZ = "Africa/Cairo";
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const dayLabel = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${k === todayKey() ? "اليوم · " : ""}${DAYS[wd]} ${d}/${m}`;
};

async function downloadUrl(url, name) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`الصورة لسا بتجهز (${r.status}) — جرب بعد دقيقة`);
  const blob = await r.blob();
  const u = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: u, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 3000);
}

// ============================================================
export default function SocialPosts({ pub }) {
  const { toast, workers, waAccounts } = useAdmin();
  const raw = useDocData("store/social");
  const cfg = mergeSocial(raw || {});
  const [days] = useQuery(() => query(collection(db, "store_social"), orderBy("day", "desc"), limit(14)), []);
  const [day, setDay] = useState(todayKey());
  const cur = days.find((d) => d.id === day);
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (raw !== undefined && !form) setForm(mergeSocial(raw || {}));
  }, [raw, form]);
  const dayList = useMemo(() => [...new Set([todayKey(), ...days.map((d) => d.id)])], [days]);

  async function cmd(type, data, label) {
    setBusy(type + (data.index ?? ""));
    try {
      await runCommand("wa", type, { day, ...data }, { timeout: 60_000 });
      toast(label, "ok", 6000);
    } catch (e) {
      toast(e.message, "bad", 7000);
    }
    setBusy("");
  }
  const run = raw?.run;
  const working = run?.state === "working" && Date.now() - (run.at || 0) < 15 * 60_000;
  async function saveCfg() {
    await setDoc(doc(db, "store", "social"), { ...form, updatedAt: Date.now() }, { merge: true })
      .then(() => toast("انحفظ ✓", "ok"))
      .catch((e) => toast(e.message, "bad"));
  }
  async function setItem(i, patch) {
    const items = cur.items.map((x, j) => (j === i ? { ...x, ...patch } : x));
    await updateDoc(doc(db, "store_social", day), { items }).catch((e) => toast(e.message, "bad"));
  }
  async function downloadAll(it, i) {
    const list = (it.photos?.length ? it.photos : [it.post || it.photo]).filter(Boolean);
    setBusy("dl" + i);
    try {
      for (let k = 0; k < list.length; k++) {
        await downloadUrl(list[k], `joudi-${day}-${i + 1}-${k + 1}.jpg`);
        await new Promise((r) => setTimeout(r, 350));
      }
      toast(`نزلت ${list.length} صورة ✓`, "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy("");
  }
  const done = cur ? cur.items.filter((x) => x.posted).length : 0;

  return (
    <>
      <Panel
        title="📣 منشورات اليوم لفيسبوك وإنستغرام"
        actions={
          <div className="btn-row">
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {dayList.map((k) => (
                <option key={k} value={k}>
                  {dayLabel(k)}
                </option>
              ))}
            </select>
            {cur && (
              <button className="btn small" disabled={!!busy || !workers.waOnline} onClick={() => cmd("social_send", {}, "بلّش الإرسال — بيوصلوك عتيليجرام خلال دقيقة")}>
                {busy === "social_send" ? "جاري..." : "ابعتهم عتيليجرام"}
              </button>
            )}
            <button className="btn small primary" disabled={!!busy || working || !workers.waOnline} onClick={() => (!cur || confirm("تجهيز منشورات جديدة لهاليوم؟ (بتنحذف اللي موجودين)")) && cmd("social_generate", {}, "بلّش التجهيز — بياخد 2-5 دقايق، والصفحة بتتحدّث لحالها")}>
              {busy === "social_generate" || (working && run.type === "social_generate") ? "جاري التجهيز..." : cur ? "جهّز من جديد" : "جهّز منشورات اليوم هلأ"}
            </button>
          </div>
        }
      >
        {working && <div className="alert info">⏳ العامل عم {run.type === "social_send" ? "يبعت المنشورات عتيليجرام" : run.type === "social_replace" ? "يبدّل المنتج" : "يجهّز المنشورات"}... بتتحدّث الصفحة لحالها لما يخلص.</div>}
        {run?.state === "error" && run.day === day && <div className="alert danger">آخر محاولة فشلت: {run.error}</div>}
        {!cur ? (
          <Empty>{day === todayKey() ? `ما انجهزت لسا — بتنجهز لحالها الساعة ${cfg.at} وبتوصلك عتيليجرام، أو اكبس «جهّز منشورات اليوم هلأ».` : "ما في منشورات بهاليوم"}</Empty>
        ) : (
          <>
            <p className="small-text muted">
              {done}/{cur.items.length} انتشروا. لكل منتج: نزّل صوره وانسخ النص المناسب (فيسبوك أو إنستغرام) — السعر مش مكتوب، الزبون بيشوفه عالموقع أو بيسأل عالخاص. بنصيحة: انشر وحدة الصبح، وحدة العصر، ووحدة بالليل.
            </p>
            <div className="social-grid">
              {cur.items.map((it, i) => (
                <div key={it.pid + i} className={"social-card" + (it.posted ? " done" : "")}>
                  {(() => {
                    const list = (it.photos?.length ? it.photos : [it.post || it.photo]).filter(Boolean);
                    return (
                      <div className={"social-photos n" + Math.min(list.length, 4)}>
                        {list.slice(0, 4).map((u, k) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer">
                            <img src={u} alt="" loading="lazy" />
                            {k === 3 && list.length > 4 && <span dir="ltr">+{list.length - 4}</span>}
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="social-body">
                    <div className="row-between">
                      <b>{it.name}</b>
                      {it.posted ? <Tag kind="ok">✓ انتشر</Tag> : <Tag>{i + 1}</Tag>}
                    </div>
                    <div className="small-text muted">
                      {(it.photos?.length || 1)} صورة{it.category ? ` · ${it.category}` : ""} · السعر بالمنشور: عالموقع أو عالخاص
                    </div>
                    <div className="btn-row">
                      <button className="btn small" disabled={!!busy} onClick={() => downloadAll(it, i)}>
                        {busy === "dl" + i ? "جاري التنزيل..." : `⬇️ نزّل الصور (${it.photos?.length || 1})`}
                      </button>
                    </div>
                    <div className="btn-row">
                      <button className="btn small" onClick={() => copyText(it.fb).then(() => toast("انتسخ نص فيسبوك ✓", "ok"))}>
                        📋 نص فيسبوك
                      </button>
                      <button className="btn small" onClick={() => copyText(it.ig).then(() => toast("انتسخ نص إنستغرام ✓", "ok"))}>
                        📋 نص إنستغرام
                      </button>
                      <button className="btn small" onClick={() => copyText(it.link).then(() => toast("انتسخ رابط المنتج ✓", "ok"))}>
                        🔗 الرابط
                      </button>
                    </div>
                    <details className="social-text">
                      <summary>شوف النص</summary>
                      <pre>{it.fb}</pre>
                    </details>
                    <div className="btn-row">
                      <button className={"btn small" + (it.posted ? "" : " primary")} onClick={() => setItem(i, { posted: !it.posted, postedAt: it.posted ? null : Date.now() })}>
                        {it.posted ? "↩️ لسا ما نشرته" : "✓ نشرته"}
                      </button>
                      {!it.posted && (
                        <button className="btn small" disabled={!!busy || !workers.waOnline} onClick={() => cmd("social_replace", { index: i }, "عم يتبدّل — دقيقة وبيطلع الجديد")}>
                          {busy === "social_replace" + i ? "جاري..." : "🔄 بدّل المنتج"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Panel>

      {form && (
        <Panel title="إعدادات منشورات اليوم">
          <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="تجهيز تلقائي كل يوم" hint="بيختار المنتجات (جديد، عرض، ومميز — من أقسام مختلفة)، بياخد صورهم الأصلية، بيكتب الوصف عربي وإنجليزي بدون سعر، وبيبعتهم عتيليجرام." />
          <div className="form-grid">
            <Field label="الساعة (توقيت مصر)">
              <input type="time" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value || "08:00" })} />
            </Field>
            <Field label="عدد المنتجات باليوم">
              <input type="number" min={1} max={5} value={form.count} onChange={(e) => setForm({ ...form, count: Math.min(5, Math.max(1, Number(e.target.value) || 3)) })} />
            </Field>
            <Field label="ما يكرر نفس المنتج قبل (يوم)">
              <input type="number" min={3} max={120} value={form.cooldownDays} onChange={(e) => setForm({ ...form, cooldownDays: Number(e.target.value) || 30 })} />
            </Field>
          </div>
          <h4 className="sub-title">📲 نشرهم كمان بمجموعات الواتساب</h4>
          <Toggle checked={form.waOn} onChange={(v) => setForm({ ...form, waOn: v })} label="نشر منتجات اليوم بالمجموعات لحاله" hint="كل منتج بينزل بصورته ونص فيسبوك، بوقت مختلف من اليوم، على مجموعات التصنيف والبلد اللي بتختارهم." />
          {form.waOn && (
            <>
              <div className="form-grid">
                <Field label="تصنيف المجموعات" hint="التصنيف التلقائي بيحط مجموعات البيع تحت «بيع وشراء».">
                  <input list="wa-cats" value={form.waCategory} onChange={(e) => setForm({ ...form, waCategory: e.target.value })} />
                  <datalist id="wa-cats">
                    {["بيع وشراء", "عام", "نسائي", "طلاب"].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </Field>
                {[0, 1, 2].map((i) => (
                  <Field key={i} label={`وقت المنتج ${i + 1}`}>
                    <input
                      type="time"
                      value={form.waTimes[i] || ""}
                      onChange={(e) => {
                        const t = [...form.waTimes];
                        t[i] = e.target.value;
                        setForm({ ...form, waTimes: t.filter(Boolean) });
                      }}
                    />
                  </Field>
                ))}
              </div>
              <div className="field">
                <label>بلد المجموعات</label>
                <div className="chips">
                  {Object.entries(REGIONS).map(([k, l]) => (
                    <button key={k} type="button" className={"chip" + (form.waRegions.includes(k) ? " active" : "")} onClick={() => setForm({ ...form, waRegions: form.waRegions.includes(k) ? form.waRegions.filter((x) => x !== k) : [...form.waRegions, k] })}>
                      {l}
                    </button>
                  ))}
                </div>
                <p className="small-text muted">{form.waRegions.length ? "بس المجموعات اللي بلدها معروف ومن هدول." : "كل المجموعات بهالتصنيف."}</p>
              </div>
              <div className="field">
                <label>الأرقام اللي بتنشر</label>
                <div className="chips">
                  <button type="button" className={"chip" + (!form.waAccounts.length ? " active" : "")} onClick={() => setForm({ ...form, waAccounts: [] })}>
                    كل الأرقام
                  </button>
                  {waAccounts.map((a) => (
                    <button key={a.id} type="button" className={"chip" + (form.waAccounts.includes(a.id) ? " active" : "")} onClick={() => setForm({ ...form, waAccounts: form.waAccounts.includes(a.id) ? form.waAccounts.filter((x) => x !== a.id) : [...form.waAccounts, a.id] })}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle checked={form.waMention} onChange={(v) => setForm({ ...form, waMention: v })} label="منشن الكل بمنشورات المتجر" />
            </>
          )}
          <button className="btn small primary" onClick={saveCfg}>
            حفظ
          </button>
          <p className="small-text muted">التنبيه بيوصل على نفس بوت تيليجرام اللي بالإعدادات ← التنبيهات.</p>
        </Panel>
      )}
    </>
  );
}
