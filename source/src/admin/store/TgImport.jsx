import { useEffect, useState } from "react";
import { collection, doc, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { runCommand, useAdmin, useDocData, useQuery } from "../hooks";
import { Empty, Field, Panel, Toggle } from "../ui";
import { publishCatalog, uploaderOf, SKIP_CHANNELS, KINDS, guessKind, SORT_KEYS } from "./shared";

export function TgImport({ pub, priv, products }) {
  const { toast, workers } = useAdmin();
  const raw = useDocData("store/tg_import");
  const [c, setC] = useState(null);
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState("");
  const [tgAccounts] = useQuery(() => collection(db, "tg_accounts"), []);
  useEffect(() => {
    if (raw !== undefined && c === null) setC({ enabled: false, accountId: "", channels: [], ...(raw || {}) });
  }, [raw, c]);
  if (!c) return <Empty>جاري التحميل...</Empty>;
  const setCh = (id, patch) => setC((x) => ({ ...x, channels: x.channels.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)) }));
  const guessCat = (title) => pub.categories.find((k) => String(title).includes(k.split(" ")[0])) || (/مطبخ/.test(title) ? "أدوات مطبخ" : /ملابس/.test(title) ? "ملابس" : /تجميل|مكياج/.test(title) ? "تجميل ومكياج" : /اطفال|أطفال/.test(title) ? "مستلزمات أطفال" : /معدات/.test(title) ? "معدات" : "");

  async function save(next = c) {
    try {
      await setDoc(doc(db, "store", "tg_import"), { ...next, updatedAt: serverTimestamp() });
      toast("انحفظ ✓ — عامل تيليجرام بياخدها فوراً", "ok");
    } catch (e) {
      toast("فشل الحفظ: " + e.message, "bad");
    }
  }
  async function load() {
    setBusy("load");
    try {
      const r = await runCommand("tg", "shop_tg_channels", { accountId: c.accountId }, { timeout: 90_000 });
      setFound(r);
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy("");
  }
  function add(ch) {
    if (c.channels.some((x) => x.id === ch.id)) return;
    const kind = guessKind(ch.title);
    setC((x) => ({ ...x, channels: [...x.channels, { id: ch.id, title: ch.title, username: ch.username || "", kind, category: kind === "products" ? guessCat(ch.title) : "", extraProfit: 0, delivery: "normal", enabled: true }] }));
  }
  async function backfill(ch) {
    const k = ch.kind || "products";
    const n = Number(prompt(k === "feedback" ? "كم منشور آخر بدك تسحب من الفيدباك؟ (لحد 3000)" : k === "soldout" ? "كم منشور آخر بدك تفحص بقناة النافدة؟ (لحد 3000)" : "كم منتج آخر بدك تسحب من القناة؟ (لحد 3000 — الكل تقريباً)", k === "products" ? "300" : "200"));
    if (!n) return;
    setBusy(ch.id);
    try {
      await runCommand("tg", "shop_tg_backfill", { channelId: ch.id, limit: n, accountId: c.accountId }, { timeout: 120_000 });
      toast("بدأ السحب بالخلفية — التقدّم بيطلع تحت القناة، وبيوصلك تنبيه لما يخلص", "ok", 6000);
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy("");
  }

  return (
    <div className="settings-page">
      <Panel title="استيراد المنتجات من قنوات تيليجرام">
        {!workers.tgOnline && <div className="alert warn">عامل تيليجرام مطفي — شغّله على الجوال.</div>}
        {!uploaderOf(priv) && <div className="alert warn">لازم تجهّز رفع الصور لـ GitHub (إعدادات المتجر ← رفع الصور) عشان صور المنتجات تنرفع.</div>}
        <Toggle checked={!!c.enabled} onChange={(v) => setC({ ...c, enabled: v })} label="تفعيل الاستيراد التلقائي" hint="أي منتج جديد بينزل بالقنوات اللي تحت بينسحب لحاله (الصور + الوصف + السعر + المقاسات والألوان) ويوصلك كمسودة بانتظار المراجعة." />
        <Field label="حساب تيليجرام اللي عضو بالقنوات">
          <select value={c.accountId} onChange={(e) => (setC({ ...c, accountId: e.target.value }), setFound(null))}>
            <option value="">أول حساب متصل</option>
            {tgAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name || a.id} {a.phone ? `(+${String(a.phone).replace(/\D/g, "")})` : ""} {a.connected ? "" : "— مش متصل"}
              </option>
            ))}
          </select>
        </Field>
        <p className="small-text muted">بيعرف المنتج من رسالة السعر: "السعر / 350 شيكل · الربح / 50" — كل اللي قبلها (ألبوم الصور + الوصف) = منتج واحد. السعر بالمتجر = السعر + الربح + ربحك الإضافي.</p>
      </Panel>

      <Panel
        title={`القنوات (${c.channels.length})`}
        actions={
          <button className="btn small" disabled={busy === "load"} onClick={load}>
            {busy === "load" ? "جاري..." : "جيب قنوات حسابي"}
          </button>
        }
      >
        {found && (
          <div className="alert info">
            <b>قنوات حساب {found.account}:</b> اكبس على القناة لتضيفها. قناة الفيدباك وقناة المنتجات النافدة كمان بتنضاف — نوعها بيتحدد لحاله وبتقدر تغيّره.
            <div className="chips" style={{ marginTop: 8 }}>
              {found.channels.map((ch) => {
                const has = c.channels.some((x) => x.id === ch.id);
                return (
                  <button key={ch.id} type="button" className={"chip" + (has ? " active" : "")} disabled={has} onClick={() => add(ch)} title={SKIP_CHANNELS.test(ch.title) ? "شكلها مش قناة منتجات" : ""}>
                    {guessKind(ch.title) === "feedback" ? "💬 " : guessKind(ch.title) === "soldout" ? "🚫 " : SKIP_CHANNELS.test(ch.title) ? "⚪ " : "➕ "}
                    {ch.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!c.channels.length ? (
          <Empty>اكبس "جيب قنوات حسابي" واختار قنوات المنتجات</Empty>
        ) : (
          <div className="list">
            {c.channels.map((ch) => (
              <div key={ch.id} className="step-card">
                <div className="step-head">
                  <Toggle checked={ch.enabled !== false} onChange={(v) => setCh(ch.id, { enabled: v })} label="" />
                  <b className="step-label">{ch.title}</b>
                  <button type="button" className="icon-btn" onClick={() => setC({ ...c, channels: c.channels.filter((x) => x.id !== ch.id) })}>
                    🗑
                  </button>
                </div>
                <Field label="نوع القناة">
                  <select value={ch.kind || "products"} onChange={(e) => setCh(ch.id, { kind: e.target.value })}>
                    {Object.entries(KINDS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                {(ch.kind || "products") === "products" ? (
                  <>
                    <div className="form-grid">
                      <Field label={ch.autoSort ? "القسم لو ما عرف يفرز" : "القسم بالمتجر"}>
                        <select value={ch.category} onChange={(e) => setCh(ch.id, { category: e.target.value })}>
                          <option value="">— بدون —</option>
                          {pub.categories.map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="ربح إضافي فوق ربح القناة (₪)" hint="0 = السعر = سعر القناة + الربح المكتوب">
                        <input type="number" min={0} value={ch.extraProfit || 0} onChange={(e) => setCh(ch.id, { extraProfit: Number(e.target.value) || 0 })} />
                      </Field>
                      <Field label="التوصيل">
                        <select value={ch.delivery || "normal"} onChange={(e) => setCh(ch.id, { delivery: e.target.value })}>
                          <option value="normal">عادي</option>
                          <option value="perPiece">لكل قطعة (أثاث)</option>
                        </select>
                      </Field>
                    </div>
                    <Toggle checked={!!ch.autoSort} onChange={(v) => setCh(ch.id, { autoSort: v })} label="فرز تلقائي (حريمي / رجالي / أطفال / أحذية)" hint="بيقرأ اسم ووصف المنتج (فستان، رجالي، ولادي، حذاء...) وبيحطه بالقسم الصح. اللي ما بيعرفه بيروح للقسم اللي فوق، وبتقدر تغيّره من المسودات." />
                    {ch.autoSort && (
                      <div className="form-grid">
                        {SORT_KEYS.map(([k, label]) => (
                          <Field key={k} label={label}>
                            <select value={ch.sort?.[k] || ""} onChange={(e) => setCh(ch.id, { sort: { ...(ch.sort || {}), [k]: e.target.value } })}>
                              <option value="">— ما بدي —</option>
                              {pub.categories.map((x) => (
                                <option key={x}>{x}</option>
                              ))}
                            </select>
                          </Field>
                        ))}
                      </div>
                    )}
                    {ch.autoSort && !SORT_KEYS.some(([k]) => ch.sort?.[k]) && <p className="small-text muted">💡 اختار قسم لكل نوع — لو الأقسام مش موجودة ضيفها بإعدادات المتجر ← الأقسام (مثلاً: ملابس حريمي، ملابس رجالي، ملابس أطفال، أحذية).</p>}
                    <Toggle checked={!!ch.autoPublish} onChange={(v) => setCh(ch.id, { autoPublish: v })} label="نشر تلقائي بالمتجر (بدون مراجعة)" hint="المنتج بينزل عالمتجر مباشرة أول ما ينزل بالقناة. لو طافي بيوصلك مسودة تراجعها قبل." />
                  </>
                ) : ch.kind === "soldout" ? (
                  <p className="small-text muted">أي منشور بهالقناة = منتج خلص. لو المنشور محوّل (Forward) من قناة المنتجات بيعرفه مباشرة، وإلا بيدوّر على اسم المنتج بالنص. المنتج بيتعلّم «نفذت الكمية» بالمتجر لحاله، واللي ما بيعرفه بيوصلك تنبيه عليه.</p>
                ) : (
                  <p className="small-text muted">صور الزباين بهالقناة بتنعرض بصفحة «آراء زبائننا» بالمتجر وبشريط بالرئيسية — لحالها أول ما تنزل.</p>
                )}
                {(() => {
                  const pr = raw?.progress?.[ch.id];
                  const running = pr && ["reading", "saving"].includes(pr.state) && Date.now() - pr.at < 30 * 60_000;
                  return (
                    <>
                      <button className="btn small" disabled={busy === ch.id || running || !workers.tgOnline} onClick={() => backfill(ch)}>
                        {busy === ch.id ? "جاري..." : running ? "السحب شغال..." : ch.kind === "soldout" ? "افحص المنشورات القديمة" : "اسحب المنشورات القديمة"}
                      </button>
                      {pr && (
                        <div className="small-text muted">
                          {pr.state === "reading" && "📥 بيقرأ منشورات القناة..."}
                          {pr.state === "saving" && `📦 ${pr.done}/${pr.total} — انضاف ${pr.added} منتج (الصور بتنرفع بهدوء عشان GitHub)`}
                          {pr.state === "done" && (ch.kind === "feedback" ? `✅ آخر سحب: ${pr.added} صورة جديدة` : ch.kind === "soldout" ? `✅ آخر فحص: ${pr.added} منتج تعلّم نافد` : `✅ آخر سحب: انضاف ${pr.added} منتج جديد من ${pr.total}`)}
                          {pr.state === "error" && <span className="err-text">❌ {pr.error}</span>}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
        {pub.categories.length > 0 && !["أدوات مطبخ", "معدات", "ملابس", "تجميل ومكياج", "مستلزمات أطفال"].every((k) => pub.categories.includes(k)) && (
          <p className="small-text muted">💡 لو بدك أقسام زي القنوات (أدوات مطبخ، معدات، ملابس، تجميل ومكياج، مستلزمات أطفال) ضيفها بإعدادات المتجر ← الأقسام.</p>
        )}
      </Panel>
      <FeedbackPanel products={products} pub={pub} />
      <div className="save-bar">
        <div className="save-status" />
        <button className="btn primary" onClick={() => save()}>
          حفظ
        </button>
      </div>
    </div>
  );
}

export function FeedbackPanel({ products, pub }) {
  const { toast } = useAdmin();
  const [items] = useQuery(() => query(collection(db, "store_feedback"), orderBy("at", "desc"), limit(120)), []);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  if (!items.length) return null;
  async function toggle(f) {
    await updateDoc(doc(db, "store_feedback", f.id), { hidden: !f.hidden }).catch((e) => toast("فشل: " + e.message, "bad"));
    setDirty(true);
  }
  async function republish() {
    setBusy(true);
    try {
      await publishCatalog(products, pub);
      setDirty(false);
      toast("تحدّثت صفحة آراء الزباين ✓", "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
    setBusy(false);
  }
  return (
    <Panel
      title={`صور آراء الزباين (${items.filter((f) => !f.hidden).length})`}
      actions={
        dirty && (
          <button className="btn small primary" disabled={busy} onClick={republish}>
            {busy ? "جاري..." : "حدّث المتجر"}
          </button>
        )
      }
    >
      <p className="small-text muted">اكبس على صورة لتخفيها من المتجر (أو ترجّعها)، وبعدين «حدّث المتجر».</p>
      <div className="fb-admin-grid">
        {items.map((f) => (
          <button key={f.id} type="button" className={"fb-admin" + (f.hidden ? " off" : "")} onClick={() => toggle(f)} title={f.hidden ? "مخفية — اكبس لترجعها" : "اكبس لتخفيها"}>
            <img src={f.img} alt="" loading="lazy" />
            {f.hidden && <span>مخفية</span>}
          </button>
        ))}
      </div>
    </Panel>
  );
}
