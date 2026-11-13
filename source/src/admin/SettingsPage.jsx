import { useEffect, useRef, useState } from "react";
import { collection, doc, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { SITE } from "../config";
import { loadSiteContent } from "../siteContent";
import SiteEditor from "../components/SiteEditor";
import { mergeApp } from "../appSettings";
import { downloadFile, linesOf } from "../utils";
import { runCommand, store, useAdmin } from "./hooks";
import { Field, Panel, SubTabs, Toggle } from "./ui";
import Icon from "../components/Icons";

const SETTINGS_TABS = [
  ["general", "عام"],
  ["notify", "التنبيهات"],
  ["wa", "واتساب"],
  ["tg", "تيليجرام"],
  ["site", "نصوص الموقع"],
  ["backup", "نسخة احتياطية"],
];
const FORM_TABS = { general: General, notify: Notify, wa: WaGlobal, tg: TgGlobal };

// تطبيع النص العربي للبحث (أ/إ/آ = ا، ة = ه، ى = ي، بدون تشكيل)
const norm = (t) =>
  String(t || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");

export default function SettingsPage() {
  const { app, appLoaded } = useAdmin();
  const [tab, setTab] = useState(() => store.get("set.tab", "general"));
  const [q, setQ] = useState("");
  useEffect(() => store.set("set.tab", tab), [tab]);
  const searching = q.trim().length >= 2;

  return (
    <div className="page settings-shell">
      <div className="settings-bar">
        <div className="settings-search">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دوّر بالإعدادات… مثلاً: حظر، تنبيهات، حساب الترحيب" aria-label="بحث بالإعدادات" />
        </div>
        {!searching && <SubTabs value={tab} onChange={setTab} tabs={SETTINGS_TABS} />}
      </div>
      {!appLoaded ? (
        <div className="empty">جاري التحميل...</div>
      ) : searching ? (
        <SearchResults q={q} app={app} onOpen={(k) => { setTab(k); setQ(""); }} />
      ) : (
        <>
          {FORM_TABS[tab] && <AppForm key={tab} app={app} render={FORM_TABS[tab]} />}
          {tab === "site" && <SiteTab />}
          {tab === "backup" && <Backup />}
        </>
      )}
    </div>
  );
}

// البحث: بيعرض كل تبويبات الإعدادات وبيخبّي الأقسام اللي ما فيها الكلمة
function SearchResults({ q, app, onOpen }) {
  const ref = useRef(null);
  const [found, setFound] = useState(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const needle = norm(q.trim());
    let total = 0;
    root.querySelectorAll("[data-search-tab]").forEach((block) => {
      let inTab = 0;
      block.querySelectorAll(".panel").forEach((panel) => {
        const title = panel.querySelector(".panel-title");
        const titleHit = title && norm(title.textContent).includes(needle);
        let hits = 0;
        panel.querySelectorAll(".field, .toggle").forEach((row) => {
          const hit = titleHit || norm(row.textContent).includes(needle);
          row.style.display = hit ? "" : "none";
          if (hit) hits++;
        });
        const show = titleHit || hits > 0;
        panel.style.display = show ? "" : "none";
        if (show) inTab++;
      });
      block.style.display = inTab ? "" : "none";
      total += inTab;
    });
    setFound(total);
  }, [q]);

  return (
    <div ref={ref} className="settings-results">
      {found === 0 && <div className="panel settings-empty">ما لقيت إشي بهالكلمة. جرّب كلمة تانية.</div>}
      {Object.entries(FORM_TABS).map(([k, Render]) => (
        <div key={k} data-search-tab={k} className="settings-result-tab">
          <div className="settings-result-head">
            <b>{SETTINGS_TABS.find((t) => t[0] === k)[1]}</b>
            <button className="btn small" onClick={() => onOpen(k)}>
              افتح التبويب
            </button>
          </div>
          <AppForm app={app} render={Render} />
        </div>
      ))}
    </div>
  );
}

// نموذج عام: نسخة محلية من الإعدادات + زر حفظ
function AppForm({ app, render: Render }) {
  const { toast } = useAdmin();
  const [s, setS] = useState(() => mergeApp(app));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) setS(mergeApp(app));
  }, [app, dirty]);

  const set = (path, value) => {
    setDirty(true);
    setS((p) => {
      const [a, b] = path.split(".");
      return b ? { ...p, [a]: { ...p[a], [b]: value } } : { ...p, [a]: value };
    });
  };

  async function save() {
    setSaving(true);
    try {
      const data = { ...s, tg: cleanTg(s.tg), siteUrl: String(s.siteUrl || "").trim() };
      await setDoc(doc(db, "settings", "app"), { ...data, updatedAt: serverTimestamp() });
      setDirty(false);
      toast("انحفظت الإعدادات ✓ — العمّال بياخدوها فوراً", "ok");
    } catch (e) {
      console.error(e);
      toast("فشل الحفظ", "bad");
    }
    setSaving(false);
  }

  return (
    <div className="settings-page">
      <Render s={s} set={set} />
      <div className="save-bar">
        <div className="save-status">{dirty ? <span className="muted">في تعديلات ما انحفظت</span> : <span className="ok">كل شي محفوظ</span>}</div>
        <button className="btn primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

const numIn = (s, set, path, props = {}) => {
  const [a, b] = path.split(".");
  return {
    type: "number",
    value: s[a][b],
    onChange: (e) => set(path, e.target.value === "" ? "" : Number(e.target.value)),
    ...props,
  };
};

/* ===== عام ===== */
function General({ s, set }) {
  const { waAccounts } = useAdmin();
  const guess = window.location.origin + window.location.pathname;
  return (
    <>
      <Panel title="موقع التسجيل والتتبع">
        <Field label="رابط موقع التسجيل" hint="الرابط اللي بيفتح صفحة التسجيل. بيستعمل بروابط التتبع بالمنشورات وروابط الفريق.">
          <div className="row-form">
            <input dir="ltr" value={s.siteUrl} onChange={(e) => set("siteUrl", e.target.value.trim())} placeholder="https://online-job-ec267.web.app/" />
            {!s.siteUrl && (
              <button type="button" className="btn small" onClick={() => set("siteUrl", guess)}>
                استعمل الحالي
              </button>
            )}
          </div>
        </Field>
        <Field label="كود المسوّق بروابط التتبع (ref)" hint="بيظهر بعمود المسوّق للتسجيلات اللي جاية من منشورات الواتساب.">
          <input dir="ltr" value={s.trackRef} onChange={(e) => set("trackRef", e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20))} />
        </Field>
      </Panel>
      <Panel title="رسائل الترحيب">
        <Field label="حساب الترحيب الافتراضي" hint="الحساب اللي بيكون مختار تلقائياً لما تبعت ترحيب من صفحة التسجيلات. نص الرسالة من نصوص الموقع ← الواتساب.">
          <select value={s.welcomeAccountId} onChange={(e) => set("welcomeAccountId", e.target.value)}>
            <option value="">— بدون —</option>
            {waAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.phone ? `(+${a.phone})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </Panel>
      <Panel title="⬇️ تحديث العمّال (بدون ملفات zip)">
        <p className="small-text muted">
          حط ملفات النظام (مجلد <code>worker</code> وملفات <code>.sh</code>) بريبو على GitHub، واكتب اسمه هون. بعدها كل ما تحدّث الريبو، اكبس «حدّث العمّال» من صفحة الصحة — الجوال بيسحب الجديد ويعيد التشغيل لحاله، والملفات السرية ما بتنلمس.
        </p>
        <div className="form-grid">
          <Field label="الريبو" hint="مثال: onlinejob114111607/system">
            <input dir="ltr" value={s.system?.repo || ""} onChange={(e) => set("system.repo", e.target.value.trim())} placeholder="username/system" />
          </Field>
          <Field label="الفرع">
            <input dir="ltr" value={s.system?.branch || "main"} onChange={(e) => set("system.branch", e.target.value.trim() || "main")} />
          </Field>
        </div>
        <p className="small-text muted">
          لو الريبو <b>خاص</b>: اعمل توكن GitHub «قراءة فقط» لهاد الريبو واحفظه على الجوال مرة وحدة (مش هون):{" "}
          <code dir="ltr">echo TOKEN &gt; ~/system/.update-token</code>
        </p>
      </Panel>
    </>
  );
}

/* ===== التنبيهات ===== */
function Notify({ s, set }) {
  const { toast, workers } = useAdmin();
  const [testing, setTesting] = useState(false);
  async function test() {
    if (!workers.waOnline) return toast("التجربة بتنبعت من عامل الواتساب — شغّله أول", "bad");
    setTesting(true);
    try {
      await runCommand("wa", "notify_test", {}, { timeout: 30_000 });
      toast("انبعتت رسالة تجربة ✓", "ok");
    } catch (e) {
      toast(e.message, "bad", 6000);
    }
    setTesting(false);
  }
  return (
    <Panel title="تنبيهات على تيليجرام">
      <ol className="steps-mini">
        <li>
          افتح <b>@BotFather</b> بتيليجرام واكتب <code>/newbot</code> واختار اسم، وانسخ التوكن.
        </li>
        <li>افتح البوت الجديد واضغط Start وابعتله أي رسالة.</li>
        <li>
          افتح <b>@userinfobot</b> وانسخ رقم الـ Id تبعك.
        </li>
      </ol>
      <Toggle checked={s.notify.enabled} onChange={(v) => set("notify.enabled", v)} label="تفعيل التنبيهات" />
      <div className="form-grid">
        <Field label="توكن البوت">
          <input dir="ltr" value={s.notify.botToken} onChange={(e) => set("notify.botToken", e.target.value.trim())} placeholder="123456:ABC-DEF..." />
        </Field>
        <Field label="رقم المحادثة (Chat ID)">
          <input dir="ltr" value={s.notify.chatId} onChange={(e) => set("notify.chatId", e.target.value.trim())} placeholder="123456789" />
        </Field>
      </div>
      <Toggle checked={s.notify.registrations} onChange={(v) => set("notify.registrations", v)} label="تسجيل جديد على الموقع" />
      <Toggle checked={s.notify.workerDown} onChange={(v) => set("notify.workerDown", v)} label="عامل وقف أو رجع" hint="كل عامل بيراقب التاني، فلو الاتنين وقفوا مع بعض (الجوال طفى) ما رح يوصل تنبيه." />
      <Toggle checked={s.notify.funnel !== false} onChange={(v) => set("notify.funnel", v)} label="متابعة المسجلين" hint="حدا محتاج ردك بالمحادثة، أو حدا خلّص كل خطوات التسجيل." />
      <Toggle checked={s.notify.orders !== false} onChange={(v) => set("notify.orders", v)} label="طلبات المتجر" hint="طلب جديد، زبون أكّد، أو رد على رسالة التأكيد محتاجك." />
      <Toggle checked={s.notify.accountIssues} onChange={(v) => set("notify.accountIssues", v)} label="مشاكل الحسابات" hint="رقم واتساب انفصل، حساب تيليجرام انحظر أو انتهت جلسته، أو النشر وقف لحماية رقم." />
      <Toggle checked={s.notify.replies !== false} onChange={(v) => set("notify.replies", v)} label="ردود المجموعات" hint="حدا رد على منشورك أو سأل عن السعر/التسجيل، ونتيجة اختبار النصوص." />
      <Toggle checked={s.notify.daily !== false} onChange={(v) => set("notify.daily", v)} label="تقرير يومي" hint="ملخص اليوم: تسجيلات، متابعة (بوك وحضور)، طلبات وأرباح، نشر وانضمام، روابط الصياد، وحالة العمّال." />
      {s.notify.daily !== false && (
        <Field label="ساعة التقرير (توقيت مصر)">
          <input type="time" value={s.notify.dailyAt || "23:00"} onChange={(e) => set("notify.dailyAt", e.target.value || "23:00")} />
        </Field>
      )}
      <button type="button" className="btn small" onClick={test} disabled={testing || !s.notify.botToken || !s.notify.chatId}>
        {testing ? "جاري..." : "إرسال رسالة تجربة (احفظ أول)"}
      </button>
    </Panel>
  );
}

/* ===== واتساب ===== */
function WaGlobal({ s, set }) {
  return (
    <>
      <Panel title="الانضمام التلقائي لروابط الصياد">
        <Toggle checked={s.wa.autoJoin} onChange={(v) => set("wa.autoJoin", v)} label="تفعيل الانضمام التلقائي" hint="روابط الواتساب اللي بيلاقيها الصياد بتنضاف لحسابات الواتساب وبتنضم إلها بالتدريج." />
        <Toggle checked={s.wa.harvestLinks} onChange={(v) => set("wa.harvestLinks", v)} label="🎣 الصياد من مجموعات الواتساب" hint="روابط المجموعات اللي بتنبعت بمجموعاتك بتنلقط لحالها وبتدخل طابور الصياد." />
        <Toggle checked={s.wa.includeUnchecked} onChange={(v) => set("wa.includeUnchecked", v)} label="ابعت الروابط غير المفحوصة كمان" hint="الأفضل تخليها موقوفة، عشان ما تضيع انضمامات على روابط منتهية." />
        <Toggle checked={s.wa.allAccounts} onChange={(v) => set("wa.allAccounts", v)} label="كل الأرقام تنضم لنفس الجروب" hint="لو موقوفة: كل جروب بيروح لرقم واحد بس (اللي عنده مساحة أكتر)." />
        <div className="form-grid">
          <Field label="حد الانضمام اليومي لكل رقم" hint="بيشمل كل الانضمامات. بتقدر تغيّره لكل حساب لحاله من إعدادات الحساب.">
            <input min={1} max={100} {...numIn(s, set, "wa.dailyJoinLimit")} />
          </Field>
          <Field label="ما ينضم لمجموعة أقل من (عضو)" hint="0 = بدون. المجموعات الصغيرة ما بتجيب نتيجة وبتضيّع انضمام من حد اليوم.">
            <input min={0} max={1000} {...numIn(s, set, "wa.minMembers")} />
          </Field>
        </div>
        <Toggle checked={s.wa.spamFilter !== false} onChange={(v) => set("wa.spamFilter", v)} label="فلتر السبام" hint="ما بينضم لمجموعات أسماؤها قمار/مراهنات/إباحي/نصب أو مليانة إيموجي (والفحص بيعلّمها «محظور» من الأول)." />
        <Toggle checked={s.wa.smartSpread !== false} onChange={(v) => set("wa.smartSpread", v)} label="توزيع ذكي على الأرقام" hint="لما «كل الأرقام لنفس الجروب» موقوفة: الرابط بيروح للرقم اللي عنده مساحة أكتر ومجموعات أقل، وبينوّع التصنيفات بين الأرقام بدل ما يتكدسوا على رقم واحد." />
      </Panel>
      <WaMutePanel s={s} set={set} />
      <WaCleanPanel s={s} set={set} />
      <Panel title="النشر">
        <Toggle
          checked={s.wa.postUnlimited}
          onChange={(v) => set("wa.postUnlimited", v)}
          label="النشر بدون حد يومي"
          hint="⚠️ أكبر سبب لتبنيد الأرقام. الفواصل وساعات الهدوء بتضل شغالة، والحسابات اللي بوضع التسخين بتلتزم بحدها."
        />
        <div className="form-grid">
          <Field label="مدة التسخين (أيام)" hint="الرقم بوضع التسخين بيبدأ بـ 20% من حدوده وبيوصل 100% بعد هالمدة.">
            <input min={3} max={60} {...numIn(s, set, "wa.warmupDays")} />
          </Field>
        </div>
      </Panel>
      <Panel title="🛡️ الحماية من الحظر (النشر)">
        <div className="form-grid">
          <Field label="حد الرسائل بالساعة لكل رقم" hint="0 = بدون. الأفضل 30–50. الأرقام اللي بالتسخين بياخدوا نسبة منه.">
            <input min={0} max={500} {...numIn(s, set, "wa.hourLimit")} />
          </Field>
          <Field label="ما ينشر بنفس المجموعة خلال (ساعات)" hint="0 = بدون. مثلاً 6: لو نزّلت منشورين ورا بعض، المجموعة اللي انتشر فيها من أقل من 6 ساعات بتتخطى.">
            <input min={0} max={72} {...numIn(s, set, "wa.groupGapHours")} />
          </Field>
        </div>
        <Toggle
          checked={s.wa.autoStop !== false}
          onChange={(v) => set("wa.autoStop", v)}
          label="إيقاف تلقائي لما يكتر الفشل"
          hint="لو فشلت كذا رسالة ورا بعض أو واتساب طلب تهدئة مرتين، الرقم بيوقف نشر لفترة وبيوصلك تنبيه، وبعدها بيكمل لحاله."
        />
        {s.wa.autoStop !== false && (
          <div className="form-grid">
            <Field label="بعد كم فشل ورا بعض">
              <input min={3} max={30} {...numIn(s, set, "wa.stopAfterFails")} />
            </Field>
            <Field label="مدة الإيقاف (ساعات)">
              <input min={1} max={24} {...numIn(s, set, "wa.pauseHours")} />
            </Field>
          </div>
        )}
        <div className="form-grid">
          <Field label="«بيكتب...» قبل كل رسالة (ثواني)" hint="النص بيضل بخانة الكتابة هالمدة قبل ما ينبعت — زي الإنسان.">
            <input min={0} max={30} {...numIn(s, set, "wa.typingSeconds")} />
          </Field>
        </div>
        <Toggle checked={!!s.wa.mentionAll} onChange={(v) => set("wa.mentionAll", v)} label="منشن الكل (افتراضياً بالنشر)" hint="بيوصل إشعار لكل أعضاء المجموعة. بتقدر تشغّله أو تطفيه لكل منشور لحاله من صفحة النشر." />
        <Toggle checked={s.wa.riskThrottle !== false} onChange={(v) => set("wa.riskThrottle", v)} label="مقياس خطر الحظر" hint="من الفشل والتهدئة والانقطاع آخر 24 ساعة. فوق 60/100 الرقم بيخفف نشره للنص لحاله، وفوق 80 بيوقف 6 ساعات." />
        <Toggle checked={s.wa.replyAlerts !== false} onChange={(v) => set("wa.replyAlerts", v)} label="تنبيه الردود على منشوراتي" hint="رد على منشورك، منشن، أو سؤال (كم السعر / كيف بسجل) بعد منشورك ← تنبيه عتيليجرام فيه رقم الشخص." />
        <Toggle checked={s.wa.autoCategory !== false} onChange={(v) => set("wa.autoCategory", v)} label="تصنيف المجموعات تلقائياً من اسمها" hint="وظائف، بيع وشراء، طلاب، عمل أونلاين، نسائي — للمجموعات الجديدة اللي تصنيفها «عام» أو من الصياد." />
        <p className="small-text muted">ومعها شغالين من قبل: الفاصل العشوائي بين الرسائل، الحد اليومي، ساعات الهدوء، التسخين، وتدوير النص (نسخ بديلة + {"{أ|ب}"}).</p>
      </Panel>
    </>
  );
}

/* ===== تيليجرام ===== */
function TgGlobal({ s, set }) {
  const { toast, workers } = useAdmin();
  const cats = s.tg.categories || [];
  const setCats = (v) => set("tg.categories", v);
  return (
    <>
      <Panel title="بيانات تطبيق تيليجرام">
        <p className="small-text muted">
          ادخل <b dir="ltr">my.telegram.org</b> ← API development tools ← أنشئ تطبيق، وانسخ api_id و api_hash.
        </p>
        <div className="form-grid">
          <Field label="api_id">
            <input dir="ltr" value={s.tg.apiId} onChange={(e) => set("tg.apiId", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="api_hash">
            <input dir="ltr" value={s.tg.apiHash} onChange={(e) => set("tg.apiHash", e.target.value.trim())} />
          </Field>
        </div>
      </Panel>
      <Panel title="الحماية من الحظر">
        <div className="form-grid">
          <Field label="حد الانضمام اليومي لكل حساب" hint="ابدأ بـ 10–15 وزيد تدريجياً.">
            <input min={1} max={200} {...numIn(s, set, "tg.dailyLimit")} />
          </Field>
          <Field label="الفاصل بين العمليات (ث)" hint="لنفس الحساب، مع تغيير عشوائي ±30%.">
            <input min={5} max={3600} {...numIn(s, set, "tg.delay")} />
          </Field>
        </div>
      </Panel>
      <Panel title="السحب">
        <div className="form-grid">
          <Field label="عدد الرسائل اللي بتنقرأ من كل مصدر" hint="0 = كل الرسائل">
            <input min={0} {...numIn(s, set, "tg.scanLimit")} />
          </Field>
        </div>
        <Toggle checked={s.tg.joinPublic} onChange={(v) => set("tg.joinPublic", v)} label="الانضمام للجروبات والقنوات العامة" hint="لو موقوفة، الحساب بيقرأ العامة من غير ما ينضم (بعض الجروبات ما بتسمح)." />
        <Toggle checked={s.tg.autoCheck} onChange={(v) => set("tg.autoCheck", v)} label="فحص الروابط الجديدة تلقائياً كل 5 دقائق" />
      </Panel>
      <TgMutePanel s={s} set={set} />
      <Panel title="الفلترة">
        <Field label="كلمات مطلوبة (سطر لكل كلمة)" hint="لو حطيت كلمات، بيسحب الروابط بس من الرسائل اللي فيها وحدة منها على الأقل. فاضي = كل الرسائل.">
          <textarea rows={4} value={(s.tg.keywords || []).join("\n")} onChange={(e) => set("tg.keywords", e.target.value.split("\n"))} placeholder={"شغل\nعمل\nوظائف"} />
        </Field>
        <Field label="القائمة السوداء (سطر لكل كلمة)" hint="أي رسالة أو اسم جروب فيه وحدة من هالكلمات ما بينسحب، وإذا اسم الجروب فيه بيتعلّم 'محظور' وما بينضم إله.">
          <textarea rows={4} value={(s.tg.blacklist || []).join("\n")} onChange={(e) => set("tg.blacklist", e.target.value.split("\n"))} placeholder={"قمار\nكازينو"} />
        </Field>
      </Panel>
      <Panel title="التصنيف التلقائي للروابط">
        <p className="small-text muted">
          بعد الفحص، كل رابط شغال بياخد أول تصنيف بتطابق كلماته اسم الجروب أو المصدر. والمجموعات بتنضاف للواتساب بنفس التصنيف، فبتقدر تنشر لتصنيف معيّن.
        </p>
        <div className="list-editor">
          {cats.map((c, i) => (
            <div className="list-item" key={i}>
              <div className="list-item-head">
                <span className="muted small-text">#{i + 1}</span>
                <button type="button" className="icon-btn" onClick={() => setCats(cats.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
              <div className="form-grid">
                <Field label="اسم التصنيف">
                  <input value={c.name} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                </Field>
                <Field label="الكلمات (مفصولة بفاصلة)">
                  <input
                    value={Array.isArray(c.words) ? c.words.join("، ") : c.words || ""}
                    onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, words: e.target.value } : x)))}
                    placeholder="شغل، وظائف، عمل"
                  />
                </Field>
              </div>
            </div>
          ))}
          <button type="button" className="btn small dashed" onClick={() => setCats([...cats, { name: "", words: "" }])}>
            + إضافة تصنيف
          </button>
        </div>
        {cats.length > 0 && (
          <button
            type="button"
            className="btn small"
            onClick={async () => {
              if (!workers.tgOnline) return toast("عامل تيليجرام مطفي", "bad");
              try {
                const r = await runCommand("tg", "tg_recategorize");
                toast(`اتصنف ${r?.updated ?? 0} رابط (احفظ قبل)`, "ok");
              } catch (e) {
                toast(e.message, "bad");
              }
            }}
          >
            طبّق على الروابط الموجودة
          </button>
        )}
      </Panel>
    </>
  );
}

/* ===== كتم الإشعارات ===== */
function WaMutePanel({ s, set }) {
  const { waAccounts, workers, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  async function muteNow() {
    if (!workers.waOnline) return toast("عامل الواتساب مطفي", "bad");
    setBusy(true);
    try {
      const r = await runCommand("wa", "mute_all");
      toast(r?.started ? `بلّش الكتم على ${r.started} حساب — بياخد وقت حسب عدد المجموعات` : "ما في حسابات متصلة", r?.started ? "ok" : "bad", 5000);
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy(false);
  }
  return (
    <Panel title="🔕 كتم إشعارات المجموعات">
      <Toggle
        checked={s.wa.muteGroups}
        onChange={(v) => set("wa.muteGroups", v)}
        label="كتم كل مجموعات الواتساب للأبد"
        hint="بيكتم كل المجموعات اللي الأرقام عضوة فيها، وأي مجموعة جديدة بينضملها الرقم بتنكتم لحالها. الكتم بيوصل للموبايل الأساسي للرقم. أول مرة بياخد وقت (مجموعة كل 2–4 ثواني تقريباً) عشان واتساب ما يشك. إيقاف المفتاح بيوقف الكتم التلقائي بس، وما بيرجّع صوت المجموعات المكتومة."
      />
      <button type="button" className="btn small" onClick={muteNow} disabled={busy}>
        {busy ? "جاري..." : "اكتم الكل هلأ"}
      </button>
      {waAccounts.some((a) => a.mute) && (
        <table className="mini-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>الحساب</th>
              <th>المكتوم</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {waAccounts
              .filter((a) => a.mute)
              .map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>
                    {a.mute.done || 0} / {a.mute.total || 0}
                  </td>
                  <td className="small-text">
                    {a.mute.error ? <span className="warn-text">{a.mute.error}</span> : a.mute.running ? "عم يكتم..." : a.mute.done >= a.mute.total ? "✓ خلص" : "موقوف"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

/* ===== تنظيف المجموعات ===== */
function WaCleanPanel({ s, set }) {
  const { waAccounts, workers, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  async function cleanNow() {
    if (!workers.waOnline) return toast("عامل الواتساب مطفي", "bad");
    setBusy(true);
    try {
      const r = await runCommand("wa", "clean_groups", {}, { timeout: 120_000 });
      toast(r?.queued ? `بلّش تنظيف ${r.queued} مجموعة — وحدة وحدة` : "ما في مجموعات للتنظيف", "ok", 5000);
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy(false);
  }
  const rows = waAccounts.filter((a) => a.clean);
  return (
    <Panel title="🧹 تنظيف المجموعات">
      <Toggle
        checked={s.wa.autoClean}
        onChange={(v) => set("wa.autoClean", v)}
        label="تنظيف تلقائي"
        hint="المجموعات المغلقة (الشات للمشرفين بس) بيطلع منها الرقم وبيحذف محادثتها، إلا لو إنت مشرف فيها. اللي انطردت منها بتنحذف محادثتها. وكلهم بينحذفوا من اللوحة. روابط الصياد لمجموعات مغلقة ما بينضم إلها أصلاً. الخروج مجموعة كل 10–15 ثانية تقريباً."
      />
      <p className="small-text muted">حذف المحادثة من قائمة الواتساب بيشتغل بأغلب الحالات، بس أحياناً الواتساب بيرفضه، فممكن تضل محادثة فاضية تحذفها بإيدك.</p>
      <button type="button" className="btn small" onClick={cleanNow} disabled={busy}>
        {busy ? "جاري الفحص..." : "نظّف هلأ"}
      </button>
      {rows.length > 0 && (
        <table className="mini-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>الحساب</th>
              <th>طلع من</th>
              <th>انحذف من اللوحة</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.clean.left || 0}</td>
                <td>{a.clean.deleted || 0}</td>
                <td className="small-text">{a.clean.running ? `عم ينظف... (باقي ${a.clean.pending || 0})` : "✓"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function TgMutePanel({ s, set }) {
  const { tgAccounts, workers, toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  async function muteNow() {
    if (!workers.tgOnline) return toast("عامل تيليجرام مطفي", "bad");
    setBusy(true);
    try {
      const r = await runCommand("tg", "tg_mute_all", { on: true });
      toast(`انكتم ${r?.muted ?? 0} حساب ✓`, "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy(false);
  }
  const muted = tgAccounts.filter((a) => a.muted).length;
  return (
    <Panel title="🔕 كتم الإشعارات">
      <Toggle
        checked={s.tg.muteAll}
        onChange={(v) => set("tg.muteAll", v)}
        label="كتم كل الجروبات والقنوات للأبد"
        hint="إعداد عام بتيليجرام لكل حساب: كل الجروبات والقنوات (الحالية والجديدة) بتنكتم فوراً. المحادثات الخاصة ما بتتأثر. إيقاف المفتاح بيرجّع الصوت."
      />
      <div className="row-gap">
        <button type="button" className="btn small" onClick={muteNow} disabled={busy}>
          {busy ? "جاري..." : "اكتم الكل هلأ"}
        </button>
        {tgAccounts.length > 0 && (
          <span className="small-text muted">
            مكتوم: {muted} من {tgAccounts.length} حساب
          </span>
        )}
      </div>
    </Panel>
  );
}

// تنظيف القوائم قبل الحفظ بيصير بالعامل (بيقبل نص أو مصفوفة)، بس منرتبها هون كمان
export function cleanTg(tg) {
  return {
    ...tg,
    keywords: linesOf(tg.keywords),
    blacklist: linesOf(tg.blacklist),
    categories: (tg.categories || []).filter((c) => String(c.name || "").trim()).map((c) => ({ name: String(c.name).trim(), words: linesOf(c.words) })),
  };
}

/* ===== نصوص الموقع ===== */
function SiteTab() {
  const [site, setSite] = useState(null);
  useEffect(() => {
    loadSiteContent()
      .then(setSite)
      .catch(() => setSite(SITE));
  }, []);
  if (!site) return <div className="empty">جاري التحميل...</div>;
  return <SiteEditor initial={site} onSaved={setSite} />;
}

/* ===== نسخة احتياطية ===== */
const BACKUP = [
  ["registrations", "التسجيلات"],
  ["settings", "الإعدادات ونصوص الموقع"],
  ["templates", "القوالب"],
  ["wa_accounts", "حسابات واتساب"],
  ["wa_groups", "مجموعات واتساب"],
  ["wa_posts", "المنشورات"],
  ["tg_accounts", "حسابات تيليجرام"],
  ["tg_sources", "مصادر تيليجرام"],
  ["tg_links", "روابط الصياد"],
];

function plain(v) {
  if (v === null || v === undefined) return v;
  if (typeof v?.toDate === "function") return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
}

function Backup() {
  const { toast } = useAdmin();
  const [pick, setPick] = useState(() => new Set(BACKUP.map(([k]) => k)));
  const [busy, setBusy] = useState("");

  async function run() {
    const out = { exportedAt: new Date().toISOString(), collections: {} };
    try {
      for (const [col, label] of BACKUP) {
        if (!pick.has(col)) continue;
        setBusy(label);
        const snap = await getDocs(collection(db, col));
        out.collections[col] = snap.docs.map((d) => {
          const x = plain(d.data());
          if (col === "wa_accounts") delete x.qr;
          return { id: d.id, ...x };
        });
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`backup-${stamp}.json`, JSON.stringify(out, null, 1), "application/json");
      toast("تم تنزيل النسخة ✓", "ok");
    } catch (e) {
      console.error(e);
      toast("فشل التصدير", "bad");
    }
    setBusy("");
  }

  return (
    <Panel title="نسخة احتياطية">
      <p className="small-text muted">
        بتنزّل ملف JSON فيه البيانات المختارة. احفظه بمكان آمن، لأن الإعدادات فيها توكن البوت و api_hash. جلسات واتساب وتيليجرام نفسها ما بتكون فيه (موجودة على الجوال بس: مجلدات <code>worker/auth</code> و <code>worker/data</code>).
      </p>
      <div className="check-grid">
        {BACKUP.map(([k, l]) => (
          <label key={k} className="check-line">
            <input
              type="checkbox"
              checked={pick.has(k)}
              onChange={(e) =>
                setPick((p) => {
                  const n = new Set(p);
                  e.target.checked ? n.add(k) : n.delete(k);
                  return n;
                })
              }
            />{" "}
            {l}
          </label>
        ))}
      </div>
      <button className="btn primary" onClick={run} disabled={!!busy || !pick.size}>
        {busy ? `جاري تحميل ${busy}...` : "تنزيل النسخة"}
      </button>
    </Panel>
  );
}
