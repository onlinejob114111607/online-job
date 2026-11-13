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
  const priv = useDocData("store/settings");
  const [token, setToken] = useState("");
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
    try {
      await setDoc(doc(db, "store", "social"), { ...mergeSocial(form), updatedAt: Date.now() }, { merge: true });
      // التوكن سري ← بنحفظه مع إعدادات المتجر الخاصة (مش مع إعدادات المنشورات)
      if (token.trim()) {
        await setDoc(doc(db, "store", "settings"), { metaToken: token.trim() }, { merge: true });
        setToken("");
      }
      toast("انحفظ ✓", "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
  }
  async function metaTest() {
    setBusy("meta_test");
    try {
      const r = await runCommand("wa", "social_meta_test", {}, { timeout: 60_000 });
      toast(r?.igUsername ? `✓ متصل: صفحة «${r.pageName}» + إنستغرام @${r.igUsername}` : `✓ متصل بصفحة «${r?.pageName}» — بس ما في حساب إنستغرام مربوط فيها`, r?.igUsername ? "ok" : "bad", 8000);
    } catch (e) {
      toast(e.message, "bad", 9000);
    }
    setBusy("");
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
                    {(cfg.metaOn || it.meta) && <MetaStatus it={it} cfg={cfg} i={i} day={day} />}
                    {!!cfg.metaPageId && (
                      <div className="btn-row">
                        <button className="btn small" disabled={!!busy || !workers.waOnline} onClick={() => confirm(`ننشر «${it.name}» هلأ على فيسبوك وإنستغرام؟`) && cmd("social_meta_publish", { index: i }, "بلّش النشر — بياخد دقيقة، والحالة بتتحدّث هون")}>
                          {busy === "social_meta_publish" + i ? "جاري..." : "📤 انشر هلأ على فيسبوك وإنستا"}
                        </button>
                      </div>
                    )}
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
          <h4 className="sub-title">📢 النشر المباشر على فيسبوك وإنستغرام (Meta)</h4>
          <Toggle checked={form.metaOn} onChange={(v) => setForm({ ...form, metaOn: v })} label="انشر منشورات اليوم لحالها" hint="كل منتج بينزل بوقته: منشور + قصة على صفحة الفيسبوك، ومنشور + قصة على إنستغرام. لازم العامل يكون شغّال على الجوال بهالأوقات." />
          <div className="chips">
            {[
              ["metaFbPost", "منشور فيسبوك"],
              ["metaFbStory", "قصة فيسبوك"],
              ["metaIgPost", "منشور إنستغرام"],
              ["metaIgStory", "قصة إنستغرام"],
            ].map(([k, l]) => (
              <button key={k} type="button" className={"chip" + (form[k] ? " active" : "")} onClick={() => setForm({ ...form, [k]: !form[k] })}>
                {form[k] ? "✓ " : ""}
                {l}
              </button>
            ))}
          </div>
          <div className="form-grid">
            {[0, 1, 2].map((i) => (
              <Field key={i} label={`وقت نشر المنتج ${i + 1}`}>
                <input
                  type="time"
                  value={form.metaTimes[i] || ""}
                  onChange={(e) => {
                    const t = [...form.metaTimes];
                    t[i] = e.target.value;
                    setForm({ ...form, metaTimes: t.filter(Boolean) });
                  }}
                />
              </Field>
            ))}
            <Field label="رقم صفحة الفيسبوك (Page ID)" hint="من صفحتك ← حول ← شفافية الصفحة، أو من Meta Business Suite ← الإعدادات.">
              <input dir="ltr" inputMode="numeric" value={form.metaPageId} onChange={(e) => setForm({ ...form, metaPageId: e.target.value.replace(/\D/g, "") })} placeholder="1234567890" />
            </Field>
            <Field label="توكن الصفحة (Page access token)" hint={priv?.metaToken ? "✓ في توكن محفوظ — اكتب جديد بس لو بدك تغيّره." : "لسا ما في توكن."}>
              <input dir="ltr" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={priv?.metaToken ? "••••••••  (محفوظ)" : "EAAG..."} />
            </Field>
          </div>
          {raw?.metaCheck?.pageName && (
            <p className="small-text">
              آخر فحص: صفحة <b>{raw.metaCheck.pageName}</b>
              {raw.metaCheck.igUsername ? (
                <>
                  {" "}+ إنستغرام <b dir="ltr">@{raw.metaCheck.igUsername}</b> ✓
                </>
              ) : (
                " — ⚠️ ما في حساب إنستغرام مربوط بالصفحة"
              )}
            </p>
          )}
          <div className="btn-row">
            <button className="btn small" disabled={!!busy || !workers.waOnline || !raw?.metaPageId} onClick={metaTest} title={!raw?.metaPageId ? "احفظ رقم الصفحة والتوكن أول" : ""}>
              {busy === "meta_test" ? "جاري الفحص..." : "🔌 جرّب الاتصال"}
            </button>
          </div>
          <details className="social-text">
            <summary>كيف بجيب التوكن؟ (مرة وحدة)</summary>
            <ol className="small-text">
              <li>لازم يكون حساب الإنستغرام <b>بزنس أو كريتور</b> ومربوط بصفحة الفيسبوك.</li>
              <li>
                افتح <b dir="ltr">business.facebook.com/settings</b> ← المستخدمين ← <b>مستخدمي النظام</b> ← أضف مستخدم (Admin).
              </li>
              <li>«إضافة أصول» ← اختار الصفحة وحساب الإنستغرام ← تحكم كامل.</li>
              <li>
                من <b dir="ltr">developers.facebook.com</b> اعمل تطبيق (نوع Business)، وحطه بوضع <b>Live</b> (بيطلب رابط سياسة خصوصية — ممكن تحط رابط المتجر).
              </li>
              <li>
                ارجع لمستخدم النظام ← «إنشاء توكن» ← اختار التطبيق، ومدة <b>بدون انتهاء</b>، وفعّل الصلاحيات:
                <div dir="ltr" className="small-text">pages_show_list · pages_read_engagement · pages_manage_posts · instagram_basic · instagram_content_publish · business_management</div>
              </li>
              <li>
                التوكن اللي بيطلع هو توكن مستخدم. لتحوّله لتوكن صفحة افتح بالمتصفح:
                <div dir="ltr" className="small-text">graph.facebook.com/me/accounts?access_token=التوكن</div>
                وانسخ <b dir="ltr">access_token</b> اللي جنب اسم صفحتك، وحطه هون مع رقم الصفحة (<b dir="ltr">id</b>).
              </li>
              <li>احفظ واكبس «جرّب الاتصال».</li>
            </ol>
            <p className="small-text muted">إنستغرام بيقبل صور JPG بس، والقصص بتنزل بصورة المنتج الأولى.</p>
          </details>
          <button className="btn small primary" onClick={saveCfg}>
            حفظ
          </button>
          <p className="small-text muted">التنبيه بيوصل على نفس بوت تيليجرام اللي بالإعدادات ← التنبيهات.</p>
        </Panel>
      )}
    </>
  );
}

// حالة النشر على Meta لمنتج واحد
const META_LABELS = [
  ["fbPost", "metaFbPost", "منشور فيسبوك"],
  ["fbStory", "metaFbStory", "قصة فيسبوك"],
  ["igPost", "metaIgPost", "منشور إنستغرام"],
  ["igStory", "metaIgStory", "قصة إنستغرام"],
];
function MetaStatus({ it, cfg, i }) {
  const at = cfg.metaTimes[i % (cfg.metaTimes.length || 1)];
  return (
    <div className="meta-status">
      {META_LABELS.filter(([k, flag]) => cfg[flag] || it.meta?.[k]).map(([k, , label]) => {
        const m = it.meta?.[k];
        if (m?.id) return <Tag key={k} kind="ok">✓ {label}</Tag>;
        if (m?.error) return <Tag key={k} kind="bad" title={m.error}>⚠️ {label}</Tag>;
        return <Tag key={k} kind="wait">⏳ {label}{at ? ` ${at}` : ""}</Tag>;
      })}
      {Object.values(it.meta || {}).some((m) => m?.error) && <div className="small-text danger-text">{Object.values(it.meta).find((m) => m?.error)?.error}</div>}
    </div>
  );
}
