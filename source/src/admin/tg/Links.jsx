import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { copyText, downloadFile, fmtAgo, fmtDateTime, toDate } from "../../utils";
import { runCommand, useAdmin, useQuery } from "../hooks";
import { Empty, Panel, Progress, Tag } from "../ui";
import { LINK_STATUS, WA_LINK } from "./tgShared";

const linksCol = collection(db, "tg_links");

export default function Links() {
  const { workers, app, toast } = useAdmin();
  const [status, setStatus] = useState("");
  const [wa, setWa] = useState("");
  const [q, setQ] = useState("");
  const [n, setN] = useState(100);
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);

  const [rows, loading] = useQuery(() => {
    const parts = [];
    if (status) parts.push(where("status", "==", status));
    if (wa) parts.push(where("waStatus", "==", wa));
    return query(linksCol, ...parts, orderBy("firstSeen", "desc"), limit(n));
  }, [status, wa, n]);

  async function loadCounts() {
    const keys = ["", ...Object.keys(LINK_STATUS)];
    const res = await Promise.all(
      keys.map((k) => getCountFromServer(k ? query(linksCol, where("status", "==", k)) : linksCol).then((s) => s.data().count).catch(() => null))
    );
    const c = {};
    keys.forEach((k, i) => (c[k || "_all"] = res[i]));
    setCounts(c);
  }
  useEffect(() => {
    loadCounts();
    const t = setInterval(() => document.visibilityState === "visible" && loadCounts(), 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const shown = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [r.id, r.groupName, r.sourceTitle, r.category].some((v) => String(v || "").toLowerCase().includes(s));
  });

  const check = workers.tg?.check;
  const checking = check?.running;

  async function cmd(type, data = {}, ok) {
    if (!workers.tgOnline) return toast("عامل تيليجرام مطفي", "bad");
    try {
      const r = await runCommand("tg", type, data);
      if (ok) toast(typeof ok === "function" ? ok(r) : ok, "ok");
    } catch (e) {
      toast(e.message, "bad");
    }
  }

  async function allMatching() {
    const parts = [];
    if (status) parts.push(where("status", "==", status));
    if (wa) parts.push(where("waStatus", "==", wa));
    const snap = await getDocs(query(linksCol, ...parts, orderBy("firstSeen", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function exportAs(fmt) {
    setBusy(true);
    try {
      const all = await allMatching();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      if (fmt === "copy") {
        await copyText(all.map((x) => x.url).join("\n"));
        toast(`انسخ ${all.length} رابط`, "ok");
      } else if (fmt === "txt") downloadFile(`wa-links-${stamp}.txt`, all.map((x) => x.url).join("\n"));
      else {
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const lines = all.map((x) =>
          [x.url, x.groupName, LINK_STATUS[x.status]?.[0] || x.status, x.category, x.sourceTitle, WA_LINK[x.waStatus]?.[0] || "", fmtDateTime(toDate(x.firstSeen))]
            .map(esc)
            .join(",")
        );
        downloadFile(
          `wa-links-${stamp}.csv`,
          "﻿" + ["الرابط,اسم الجروب,الحالة,التصنيف,المصدر,واتساب,أول ظهور", ...lines].join("\n"),
          "text/csv;charset=utf-8"
        );
      }
    } catch (e) {
      console.error(e);
      toast("فشل التصدير", "bad");
    }
    setBusy(false);
  }

  async function bulk(qry, patch, label) {
    setBusy(true);
    try {
      const snap = await getDocs(qry);
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => (patch === "delete" ? b.delete(d.ref) : b.update(d.ref, patch)));
        await b.commit();
      }
      toast(`${label}: ${snap.size}`, "ok");
      loadCounts();
    } catch (e) {
      console.error(e);
      toast("فشلت العملية", "bad");
    }
    setBusy(false);
  }

  return (
    <div className="page">
      <Panel title="فحص صلاحية الروابط">
        {checking ? (
          <>
            <Progress parts={[[(check.done / Math.max(1, check.total)) * 100, "s"]]} />
            <p className="small-text">
              {check.done} / {check.total} · شغال {check.active} · منتهي {check.inactive}
            </p>
            <button className="btn small" onClick={() => cmd("tg_check_stop", {}, "رح يوقف بعد الرابط الحالي")}>
              إيقاف الفحص
            </button>
          </>
        ) : (
          <div className="btn-row">
            <button className="btn small primary" onClick={() => cmd("tg_check", { all: false }, (r) => `بدأ فحص ${r?.total ?? 0} رابط جديد`)}>
              فحص الجديد
            </button>
            <button className="btn small" onClick={() => cmd("tg_check", { all: true }, (r) => `بدأ فحص ${r?.total ?? 0} رابط`)}>
              فحص الكل
            </button>
            <button
              className="btn small"
              disabled={busy}
              onClick={() =>
                confirm(`حذف كل الروابط المنتهية (${counts.inactive ?? "?"})؟`) &&
                bulk(query(linksCol, where("status", "==", "inactive")), "delete", "انحذف")
              }
            >
              حذف المنتهي
            </button>
            <button
              className="btn small"
              disabled={busy}
              onClick={() =>
                bulk(query(linksCol, where("waStatus", "==", "error")), { waStatus: "none", waDetail: deleteField(), waError: null }, "رجعوا لطابور واتساب")
              }
            >
              إعادة فاشل واتساب
            </button>
            {app.tg.categories?.length > 0 && (
              <button className="btn small" onClick={() => cmd("tg_recategorize", {}, (r) => `اتصنف ${r?.updated ?? 0} رابط`)}>
                إعادة التصنيف
              </button>
            )}
          </div>
        )}
        <p className="small-text muted">
          {app.tg.autoCheck !== false ? "الروابط الجديدة بتنفحص تلقائياً كل 5 دقائق. " : ""}
          {app.wa.autoJoin
            ? `الروابط ${app.wa.includeUnchecked ? "الشغالة وغير المفحوصة" : "الشغالة"} بتروح تلقائياً لحسابات الواتساب للانضمام.`
            : "الانضمام التلقائي بواتساب موقوف (فعّله من الإعدادات ← واتساب)."}
        </p>
      </Panel>

      <Panel
        title={`الروابط (${counts._all ?? "…"})`}
        actions={
          <>
            <button className="btn small" disabled={busy} onClick={() => exportAs("copy")}>
              نسخ الكل
            </button>
            <button className="btn small" disabled={busy} onClick={() => exportAs("txt")}>
              ⬇ TXT
            </button>
            <button className="btn small" disabled={busy} onClick={() => exportAs("csv")}>
              ⬇ Excel
            </button>
          </>
        }
      >
        <div className="chips">
          <button className={"chip" + (!status ? " active" : "")} onClick={() => (setStatus(""), setN(100))}>
            الكل {counts._all ?? ""}
          </button>
          {Object.entries(LINK_STATUS).map(([k, [l]]) => (
            <button key={k} className={"chip" + (status === k ? " active" : "")} onClick={() => (setStatus(k), setN(100))}>
              {l} {counts[k] ?? ""}
            </button>
          ))}
        </div>
        <div className="filters">
          <input type="search" placeholder="بحث بالمعروض (اسم، مصدر، تصنيف)..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={wa} onChange={(e) => (setWa(e.target.value), setN(100))}>
            <option value="">واتساب: الكل</option>
            {Object.entries(WA_LINK).map(([k, [l]]) => (
              <option key={k} value={k}>
                واتساب: {l}
              </option>
            ))}
          </select>
        </div>

        {loading && !rows.length ? (
          <Empty>جاري التحميل...</Empty>
        ) : !shown.length ? (
          <Empty>ما في روابط</Empty>
        ) : (
          <div className="list">
            {shown.map((l) => (
              <LinkRow key={l.id} l={l} />
            ))}
            {rows.length >= n && (
              <button className="btn small block-center" onClick={() => setN((x) => x + 100)}>
                عرض المزيد
              </button>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

function LinkRow({ l }) {
  const { waAccounts } = useAdmin();
  const [label, kind] = LINK_STATUS[l.status] || [l.status, ""];
  const [wl, wk] = WA_LINK[l.waStatus] || ["", ""];
  const ref = doc(db, "tg_links", l.id);
  const detail = Object.entries(l.waDetail || {});
  const accName = (id) => waAccounts.find((a) => a.id === id)?.name || id;

  return (
    <div className="item">
      <div className="item-head">
        <div className="item-title">
          <a href={l.url} target="_blank" rel="noreferrer" dir="ltr" className="link-url">
            {l.groupName || l.url.replace("https://", "")}
          </a>
        </div>
        <div className="item-actions">
          <button className="icon-btn txt" onClick={() => copyText(l.url)}>
            نسخ
          </button>
          {["error", "duplicate", "queued"].includes(l.waStatus) && (
            <button className="icon-btn txt" onClick={() => updateDoc(ref, { waStatus: "none", waDetail: deleteField(), waError: null })}>
              إعادة واتساب
            </button>
          )}
          <button className="icon-btn txt" onClick={() => confirm("حذف الرابط؟") && deleteDoc(ref)}>
            حذف
          </button>
        </div>
      </div>
      <div className="item-meta">
        <Tag kind={kind}>{label}</Tag>
        {l.waStatus && l.waStatus !== "none" && <Tag kind={wk}>واتساب: {wl}</Tag>}
        {l.category && <Tag kind="info">{l.category}</Tag>}
        {l.sourceTitle && <span>من: {l.sourceTitle}</span>}
        <span className="muted">{fmtAgo(l.firstSeen)}</span>
        {l.waError && <span className="err-text">{l.waError}</span>}
      </div>
      {detail.length > 0 && (
        <div className="item-meta small-text">
          {detail.map(([acc, v]) => (
            <span key={acc}>
              {accName(acc)}: <Tag kind={WA_LINK[v.s]?.[1]}>{WA_LINK[v.s]?.[0] || v.s}</Tag>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
