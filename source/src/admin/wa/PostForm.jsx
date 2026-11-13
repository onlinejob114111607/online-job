import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { waSettingsOf } from "../../appSettings";
import { cairoDayKey, fillVars, fmtDuration, randomKey, spin } from "../../utils";
import { useAdmin, useDocData, useQuery } from "../hooks";
import { Panel, Toggle } from "../ui";
import { catOf } from "./waShared";
import { REGIONS } from "../../groupIntel";

export default function PostForm({ acc, groups, draft, onDraftUsed, onPosted }) {
  const { app, workers, toast } = useAdmin();
  const [text, setText] = useState("");
  const [variants, setVariants] = useState([]); // نسخ بديلة للنص (تدوير)
  const [preview, setPreview] = useState("");
  const [target, setTarget] = useState("all");
  const [category, setCategory] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [pickQ, setPickQ] = useState("");
  const [when, setWhen] = useState("now");
  const [at, setAt] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [track, setTrack] = useState(true);
  const [regions, setRegions] = useState([]); // [] = كل البلدان
  const [includeUnknown, setIncludeUnknown] = useState(true);
  const [mentionAll, setMentionAll] = useState(!!app.wa.mentionAll);
  const [bestTime, setBestTime] = useState(false);
  const best = useDocData("wa_stats/best_hours");
  const [busy, setBusy] = useState(false);
  const [templates] = useQuery(() => query(collection(db, "templates"), orderBy("createdAt", "desc")), []);

  useEffect(() => {
    if (draft) {
      setText(draft);
      onDraftUsed();
    }
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setPicked(new Set()), [acc.id]);

  const joined = useMemo(() => groups.filter((g) => g.status === "joined" && g.enabled !== false && g.jid), [groups]);
  const cats = useMemo(() => [...new Set(["عام", ...groups.map(catOf)])].sort((a, b) => a.localeCompare(b, "ar")), [groups]);
  useEffect(() => {
    if (!cats.includes(category)) setCategory(cats[0] || "عام");
  }, [cats, category]);

  const inRegion = (g) => !regions.length || (g.region ? regions.includes(g.region) : includeUnknown);
  const count = (target === "all" ? joined : target === "category" ? joined.filter((g) => catOf(g) === category) : joined.filter((g) => picked.has(g.id))).filter(inRegion).length;
  const regionCounts = useMemo(() => {
    const c = {};
    joined.forEach((g) => (c[g.region || "?"] = (c[g.region || "?"] || 0) + 1));
    return c;
  }, [joined]);
  const bestFor = (cat) => best?.byCat?.[cat]?.hour ?? best?.all?.hour ?? null;
  const fmtH = (h) => (h == null ? "" : `${h % 12 || 12}:00 ${h < 12 ? "الصبح" : h < 17 ? "الظهر" : "المسا"}`);

  const s = waSettingsOf(acc);
  const today = cairoDayKey();
  const sentToday = acc.dayKey === today ? acc.sentToday || 0 : 0;
  const unlimited = !s.warmup && (app.wa.postUnlimited || s.dailyLimit <= 0);
  let estimate = "";
  if (count) {
    estimate = `المدة المتوقعة: ${fmtDuration(count * ((Number(s.minDelay) + Number(s.maxDelay)) / 2 + 3.5))}`;
    if (!unlimited && !s.warmup) {
      const left = s.dailyLimit - sentToday;
      if (count > left) estimate += ` — باقي ${Math.max(left, 0)} رسالة من حد اليوم، الباقي بيكمل بكرة`;
    }
    if (s.quietStart !== s.quietEnd) estimate += ` · ما في نشر من ${s.quietStart}:00 لـ ${s.quietEnd}:00`;
  }

  const canTrack = !!app.siteUrl;
  const sample = () => {
    const url = canTrack && track ? `${app.siteUrl}?ref=${app.trackRef}&src=xxxxxx-yyyyyy` : app.siteUrl;
    const all = [text, ...variants].map((x) => x.trim()).filter(Boolean);
    let t = all[Math.floor(Math.random() * all.length)] || "";
    if (/\{(?:الرابط|رابط)\}/.test(t)) t = fillVars(t, { رابط: url, الرابط: url });
    else if (canTrack && track && app.siteUrl) {
      // رابط الموقع اللي كاتبه بالنص بيتبدل برابط متتبّع — وما بنضيف رابط من عندنا
      const b = app.siteUrl.replace(/\/+$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      t = t.replace(new RegExp(`${b}\\/?(?=$|[\\s)\\]،,.!؟?])`), url);
    }
    return spin(t);
  };

  async function saveTemplate() {
    if (!text.trim()) return toast("اكتب نص أول", "bad");
    const title = prompt("اسم القالب:", text.trim().split("\n")[0].slice(0, 40));
    if (!title) return;
    await addDoc(collection(db, "templates"), { title: title.trim().slice(0, 60), text: text.trim(), createdAt: serverTimestamp() });
    toast("انحفظ القالب ✓", "ok");
  }

  async function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (!count) return toast("ما في ولا مجموعة مختارة", "bad");
    let scheduledAt = null;
    if (when === "later") {
      if (!at) return toast("حدد الوقت", "bad");
      const d = new Date(at);
      if (d.getTime() < Date.now() - 60_000) return toast("الوقت لازم يكون بالمستقبل", "bad");
      scheduledAt = Timestamp.fromDate(d);
    } else if (repeat) scheduledAt = Timestamp.now();

    if (when === "now" && (!workers.waOnline || acc.state !== "open" || acc.enabled === false)) {
      if (!confirm(`حساب "${acc.name}" مش متصل هلأ. المنشور رح يستنى لحد ما يتصل. أكمل؟`)) return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "wa_posts"), {
        accountId: acc.id,
        text: t,
        variants: variants.map((x) => x.trim()).filter(Boolean).slice(0, 10),
        target,
        category: target === "category" ? category : null,
        groupIds: target === "selected" ? [...picked] : [],
        regions,
        includeUnknown,
        mentionAll,
        bestTime: when === "now" && bestTime,
        repeat: repeat ? "daily" : null,
        track: canTrack && track,
        trackKey: canTrack && track ? randomKey() : null,
        trackRef: canTrack && track ? app.trackRef || "wa" : null,
        status: when === "later" ? "scheduled" : "queued",
        scheduledAt,
        sent: 0,
        failed: 0,
        total: count,
        createdAt: serverTimestamp(),
      });
      setText("");
      setVariants([]);
      setPreview("");
      setRepeat(false);
      toast(when === "later" ? "تمت الجدولة ✓" : "دخل الطابور ✓", "ok");
      onPosted();
    } catch (err) {
      console.error(err);
      toast("صار خطأ بالحفظ", "bad");
    } finally {
      setBusy(false);
    }
  }

  const pickList = joined.filter((g) => !pickQ || (g.name || "").toLowerCase().includes(pickQ.toLowerCase()));

  return (
    <Panel title={`منشور جديد — ${acc.name}`}>
      <form onSubmit={submit} className="post-form">
        {templates.length > 0 && (
          <div className="field">
            <label>من قالب جاهز</label>
            <select
              value=""
              onChange={(e) => {
                const tp = templates.find((x) => x.id === e.target.value);
                if (tp) setText(tp.text);
              }}
            >
              <option value="">اختار قالب...</option>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label>نص المنشور</label>
          <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} required placeholder="اكتب المنشور هون..." />
          <div className="hint row-between">
            <span>
              للتنويع: <code>{"{مرحبا|أهلاً|السلام عليكم}"}</code> · مكان الرابط: <code>{"{رابط}"}</code>
            </span>
            <span>{text.length} حرف</span>
          </div>
        </div>
        {variants.map((v, i) => (
          <div key={i} className="field">
            <label className="row-between">
              <span>نسخة بديلة {i + 2}</span>
              <button type="button" className="icon-btn" onClick={() => setVariants(variants.filter((_, j) => j !== i))}>
                🗑
              </button>
            </label>
            <textarea rows={5} value={v} onChange={(e) => setVariants(variants.map((x, j) => (j === i ? e.target.value : x)))} placeholder="نفس الفكرة بصياغة تانية..." />
          </div>
        ))}
        {variants.length < 10 && (
          <button type="button" className="btn small ghost-btn" onClick={() => setVariants([...variants, ""])}>
            ➕ نسخة بديلة للنص (تدوير)
          </button>
        )}
        {variants.length > 0 && <p className="small-text muted">كل مجموعة بتاخد نسخة عشوائية من {variants.filter((x) => x.trim()).length + 1} نسخ — هيك واتساب ما بيشوف نفس الرسالة بالضبط بكل المجموعات (حماية من الحظر).</p>}
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => (text.trim() ? setPreview(sample()) : toast("اكتب نص أول", "bad"))}>
            معاينة نسخة عشوائية
          </button>
          <button type="button" className="btn small" onClick={saveTemplate}>
            حفظ كقالب
          </button>
        </div>
        {preview && <div className="preview">{preview}</div>}

        <Toggle
          checked={canTrack && track}
          onChange={setTrack}
          label="أضف رابط تسجيل متتبع"
          hint={
            canTrack
              ? "كل مجموعة بتوصلها نسخة من رابط التسجيل خاصة فيها، وبتعرف من قسم التسجيلات ← تتبع المنشورات أي منشور وأي مجموعة جابت ناس. اكتب الرابط بنص الرسالة بنفسك (أو حط {رابط}) — ما في رابط بينضاف من عندنا، فما بيطلع مرتين. رابط الموقع اللي بتكتبه بيتحوّل لحاله لرابط متتبّع."
              : "حط رابط موقع التسجيل من الإعدادات ← عام عشان تقدر تفعّل التتبع."
          }
        />

        <fieldset>
          <legend>وين ينزل؟</legend>
          <div className="seg">
            {[
              ["all", "كل المجموعات"],
              ["category", "تصنيف"],
              ["selected", "اختيار يدوي"],
            ].map(([k, l]) => (
              <label key={k} className={target === k ? "on" : ""}>
                <input type="radio" name="target" checked={target === k} onChange={() => setTarget(k)} /> {l}
              </label>
            ))}
          </div>
          {target === "category" && (
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {c} ({joined.filter((g) => catOf(g) === c).length})
                </option>
              ))}
            </select>
          )}
          {target === "selected" && (
            <div className="picker">
              <input type="search" placeholder="ابحث باسم المجموعة..." value={pickQ} onChange={(e) => setPickQ(e.target.value)} />
              <div className="btn-row">
                <button type="button" className="btn small" onClick={() => setPicked(new Set([...picked, ...pickList.map((g) => g.id)]))}>
                  تحديد الكل
                </button>
                <button type="button" className="btn small" onClick={() => setPicked(new Set())}>
                  إلغاء الكل
                </button>
              </div>
              <div className="pick-list">
                {pickList.length ? (
                  pickList.map((g) => (
                    <label key={g.id}>
                      <input
                        type="checkbox"
                        checked={picked.has(g.id)}
                        onChange={(e) =>
                          setPicked((p) => {
                            const n = new Set(p);
                            e.target.checked ? n.add(g.id) : n.delete(g.id);
                            return n;
                          })
                        }
                      />
                      <span>{g.name}</span> <span className="muted small-text">· {catOf(g)}</span>
                    </label>
                  ))
                ) : (
                  <div className="empty small">ما في مجموعات منضم إلها</div>
                )}
              </div>
            </div>
          )}
          <div className="field">
            <label>بلد المجموعة (من أرقام أعضائها)</label>
            <div className="chips">
              <button type="button" className={"chip" + (!regions.length ? " active" : "")} onClick={() => setRegions([])}>
                الكل
              </button>
              {Object.entries(REGIONS).map(([k, l]) =>
                regionCounts[k] ? (
                  <button key={k} type="button" className={"chip" + (regions.includes(k) ? " active" : "")} onClick={() => setRegions((r) => (r.includes(k) ? r.filter((x) => x !== k) : [...r, k]))}>
                    {l} {regionCounts[k]}
                  </button>
                ) : null
              )}
            </div>
            {regions.length > 0 && (
              <label className="check-line">
                <input type="checkbox" checked={includeUnknown} onChange={(e) => setIncludeUnknown(e.target.checked)} /> وكمان المجموعات اللي بلدها لسا مش معروف ({regionCounts["?"] || 0})
              </label>
            )}
          </div>
          <p className="small-text muted">رح ينزل على {count} مجموعة</p>
        </fieldset>

        <fieldset>
          <legend>خيارات</legend>
          <Toggle checked={mentionAll} onChange={setMentionAll} label="منشن الكل" hint="بيوصل إشعار لكل أعضاء المجموعة (منشن مخفي ما بيبين بالنص). بيرفع التفاعل بس بيزعج — استعمله للمنشورات المهمة، وكتر منه بيزيد خطر الحظر." />
          {when === "now" && (
            <Toggle
              checked={bestTime}
              onChange={setBestTime}
              label="انشر بأفضل وقت لكل تصنيف"
              hint={
                bestFor(target === "category" ? category : null) != null
                  ? `المنشور بيتقسم حسب تصنيف المجموعات وكل قسم بينزل بأحسن ساعة إله (خلال 24 ساعة). ${target === "category" ? `أحسن وقت لـ «${category}»: ${fmtH(bestFor(category))}` : `أحسن وقت عام: ${fmtH(best?.all?.hour)}`}`
                  : "لسا ما في بيانات كافية (بتتجمع من الضغطات والتسجيلات) — لحد ما تصير، المنشور بينزل هلأ عادي."
              }
            />
          )}
        </fieldset>

        <fieldset>
          <legend>إمتى؟</legend>
          <div className="seg">
            <label className={when === "now" ? "on" : ""}>
              <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} /> هلأ
            </label>
            <label className={when === "later" ? "on" : ""}>
              <input
                type="radio"
                name="when"
                checked={when === "later"}
                onChange={() => {
                  setWhen("later");
                  if (!at) {
                    const d = new Date(Date.now() + 3600_000);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    setAt(d.toISOString().slice(0, 16));
                  }
                }}
              />{" "}
              بوقت محدد
            </label>
          </div>
          {when === "later" && <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />}
          <label className="check-line">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> كرّر يومياً بنفس الوقت
          </label>
        </fieldset>

        {estimate && <p className="small-text muted">{estimate}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? "جاري..." : when === "later" ? "جدولة" : "انشر"}
        </button>
      </form>
    </Panel>
  );
}
