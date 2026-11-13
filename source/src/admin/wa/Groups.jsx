import { useMemo, useState } from "react";
import { REGIONS, autoCategory } from "../../groupIntel";
import { collection, deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { waSettingsOf } from "../../appSettings";
import { fmtDuration, parseInviteCode, randomKey } from "../../utils";
import { runCommand, useAdmin } from "../hooks";
import { Empty, Panel, Tag } from "../ui";
import { G_STATUS, HEALTH, catOf } from "./waShared";

export default function Groups({ acc, groups }) {
  const { workers, toast } = useAdmin();
  const [links, setLinks] = useState("");
  const [category, setCategory] = useState("عام");
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");
  const [fc, setFc] = useState("");
  const [fs, setFs] = useState("");
  const [fr, setFr] = useState("");
  const [limitN, setLimitN] = useState(150);

  const cats = useMemo(() => [...new Set(["عام", ...groups.map(catOf)])].sort((a, b) => a.localeCompare(b, "ar")), [groups]);
  const list = groups.filter(
    (g) =>
      (!q || (g.name || g.inviteCode || "").toLowerCase().includes(q.toLowerCase())) &&
      (!fc || catOf(g) === fc) &&
      (!fs || (fs === "_off" ? g.enabled === false : fs === "_health" ? !!g.health : g.status === fs)) &&
      (!fr || (fr === "?" ? !g.region : g.region === fr))
  );
  // تصنيف تلقائي من اسم المجموعة (للي تصنيفها «عام» أو «صياد الروابط»)
  const autoCats = groups.filter((g) => ["عام", "صياد الروابط", ""].includes(catOf(g)) && autoCategory(g.name));
  const joined = groups.filter((g) => g.status === "joined").length;
  const autoOff = groups.filter((g) => g.health && g.enabled === false);

  async function add(e) {
    e.preventDefault();
    const lines = links.split(/\s+/).filter(Boolean);
    const existing = new Set(groups.map((g) => parseInviteCode(g.inviteCode)).filter(Boolean));
    const codes = [];
    let bad = 0;
    for (const l of lines) {
      const c = parseInviteCode(l);
      if (!c) bad++;
      else if (!existing.has(c) && !codes.includes(c)) codes.push(c);
    }
    if (!codes.length) return setMsg(bad ? "ما في روابط صالحة" : "كل الروابط مضافة مسبقاً");
    for (let i = 0; i < codes.length; i += 400) {
      const batch = writeBatch(db);
      codes.slice(i, i + 400).forEach((code) =>
        batch.set(doc(collection(db, "wa_groups")), {
          accountId: acc.id,
          inviteCode: code,
          linkCode: code,
          name: null,
          jid: null,
          k: randomKey(),
          category: category.trim() || "عام",
          status: "pending",
          enabled: true,
          failCount: 0,
          source: "link",
          createdAt: serverTimestamp(),
        })
      );
      await batch.commit();
    }
    setLinks("");
    const s = waSettingsOf(acc);
    setMsg(`تمت إضافة ${codes.length} رابط${bad ? ` (${bad} غير صالح)` : ""} — الانضمام رح ياخد تقريباً ${fmtDuration(codes.length * ((s.joinMinDelay + s.joinMaxDelay) / 2))} (مع الحد اليومي وساعات الهدوء)`);
  }

  async function sync() {
    if (!workers.waOnline) return toast("العامل مطفي — شغّله على الجوال أول", "bad");
    if (acc.state !== "open") return toast("الحساب مش متصل", "bad");
    toast("جاري جلب المجموعات من واتساب...");
    try {
      const r = await runCommand("wa", "sync_groups", { accountId: acc.id });
      toast(`تمت المزامنة: ${r?.total ?? 0} مجموعة (${r?.added ?? 0} جديدة)`, "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
  }

  async function reEnableAuto() {
    if (!autoOff.length || !confirm(`إعادة تفعيل ${autoOff.length} مجموعة اتوقفت تلقائياً؟`)) return;
    const b = writeBatch(db);
    autoOff.forEach((g) => b.update(doc(db, "wa_groups", g.id), { enabled: true, health: null, failCount: 0, error: null }));
    await b.commit();
    toast("تم ✓", "ok");
  }

  async function autoCategorize() {
    if (!autoCats.length) return;
    const by = {};
    autoCats.forEach((g) => (by[autoCategory(g.name)] = (by[autoCategory(g.name)] || 0) + 1));
    if (!confirm(`تصنيف ${autoCats.length} مجموعة حسب اسمها:\n${Object.entries(by).map(([k, v]) => `• ${k}: ${v}`).join("\n")}`)) return;
    for (let i = 0; i < autoCats.length; i += 400) {
      const b = writeBatch(db);
      autoCats.slice(i, i + 400).forEach((g) => b.update(doc(db, "wa_groups", g.id), { category: autoCategory(g.name) }));
      await b.commit();
    }
    toast("تصنّفوا ✓", "ok");
  }

  async function bulkCategory() {
    if (!list.length) return;
    const c = prompt(`تصنيف جديد لـ ${list.length} مجموعة (حسب الفلتر الحالي):`, fc || "عام");
    if (!c || !c.trim()) return;
    for (let i = 0; i < list.length; i += 400) {
      const b = writeBatch(db);
      list.slice(i, i + 400).forEach((g) => b.update(doc(db, "wa_groups", g.id), { category: c.trim() }));
      await b.commit();
    }
    toast("تم ✓", "ok");
  }

  return (
    <div className="page">
      <Panel title={`إضافة مجموعات — ${acc.name}`}>
        <form onSubmit={add}>
          <div className="field">
            <label>روابط الدعوة (كل رابط بسطر)</label>
            <textarea rows={5} value={links} onChange={(e) => setLinks(e.target.value)} required placeholder="https://chat.whatsapp.com/XXXXXXXXXXXX" dir="ltr" />
          </div>
          <div className="row-form">
            <input list="catList" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="التصنيف" />
            <datalist id="catList">
              {cats.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button className="btn primary">أضف</button>
          </div>
          <p className="small-text muted">الحساب بينضم للمجموعات وحدة وحدة مع فاصل زمني عشان ما ينحظر الرقم.</p>
          {msg && <p className="small-text ok-text">{msg}</p>}
        </form>
      </Panel>

      <Panel
        title={`المجموعات (${joined} منضم من ${groups.length})`}
        actions={
          <>
            {autoOff.length > 0 && (
              <button className="btn small" onClick={reEnableAuto}>
                إعادة تفعيل المتوقفة تلقائياً ({autoOff.length})
              </button>
            )}
            {autoCats.length > 0 && (
              <button className="btn small" onClick={autoCategorize} title="وظائف، بيع وشراء، طلاب، عمل أونلاين، نسائي — من اسم المجموعة">
                تصنيف تلقائي ({autoCats.length})
              </button>
            )}
            <button className="btn small" onClick={bulkCategory} disabled={!list.length}>
              تصنيف المعروض
            </button>
            <button className="btn small" onClick={sync}>
              مزامنة من واتساب
            </button>
          </>
        }
      >
        <div className="filters">
          <input type="search" placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={fc} onChange={(e) => setFc(e.target.value)}>
            <option value="">كل التصنيفات</option>
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={fs} onChange={(e) => setFs(e.target.value)}>
            <option value="">كل الحالات</option>
            {Object.entries(G_STATUS).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
            <option value="_off">موقوفة</option>
            <option value="_health">متوقفة تلقائياً</option>
          </select>
          <select value={fr} onChange={(e) => setFr(e.target.value)}>
            <option value="">كل البلدان</option>
            {Object.entries(REGIONS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
            <option value="?">بلد غير معروف</option>
          </select>
        </div>

        {!list.length ? (
          <Empty>ما في مجموعات{groups.length ? " بهالفلتر" : " لسا"}</Empty>
        ) : (
          <div className="list">
            {list.slice(0, limitN).map((g) => (
              <GroupRow key={g.id} g={g} />
            ))}
            {list.length > limitN && (
              <button className="btn small block-center" onClick={() => setLimitN((n) => n + 150)}>
                عرض المزيد ({list.length - limitN})
              </button>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function GroupRow({ g }) {
  const [label, cls] = G_STATUS[g.status] || [g.status, ""];
  const off = g.enabled === false;
  const ref = doc(db, "wa_groups", g.id);
  return (
    <div className="item">
      <div className="item-head">
        <div className="item-title">{g.name || g.inviteCode || "مجموعة"}</div>
        <div className="item-actions">
          <button className="icon-btn txt" onClick={() => updateDoc(ref, off ? { enabled: true, health: null, failCount: 0 } : { enabled: false })}>
            {off ? "تفعيل" : "إيقاف"}
          </button>
          <button
            className="icon-btn txt"
            onClick={async () => {
              const c = prompt("التصنيف الجديد:", catOf(g));
              if (c && c.trim()) await updateDoc(ref, { category: c.trim() });
            }}
          >
            تصنيف
          </button>
          <button
            className="icon-btn txt"
            onClick={() => confirm(`حذف "${g.name || "المجموعة"}" من القائمة؟ (ما رح تطلع منها بواتساب)`) && deleteDoc(ref)}
          >
            حذف
          </button>
        </div>
      </div>
      <div className="item-meta">
        <Tag kind={cls}>{label}</Tag>
        {off && <Tag kind="bad">موقوفة</Tag>}
        {g.health && <Tag kind={HEALTH[g.health]?.[1]}>{HEALTH[g.health]?.[0]}</Tag>}
        {g.announce && <Tag kind="wait">للمشرفين فقط</Tag>}
        {g.source === "hunter" && <Tag kind="info">من الصياد</Tag>}
        {g.muted && <Tag>🔕 مكتومة</Tag>}
        <span>{catOf(g)}</span>
        {g.participants ? <span>{g.participants} عضو</span> : null}
        {g.region && (
          <Tag kind={g.region === "ps" ? "ok" : ""} title={g.regionPct ? Object.entries(g.regionPct).map(([k, v]) => `${REGIONS[k] || k}: ${v}%`).join(" · ") : ""}>
            {REGIONS[g.region] || g.region}
            {g.regionPct?.[g.region] ? ` ${g.regionPct[g.region]}%` : ""}
          </Tag>
        )}
        {g.failCount > 0 && !g.health && <span className="err-text">فشل {g.failCount}</span>}
        {g.error && <span className="err-text">{g.error}</span>}
      </div>
    </div>
  );
}
