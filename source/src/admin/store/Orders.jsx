import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../../firebase";
import { copyText, fmtAgo, fmtDateTime, toDate, toMs } from "../../utils";
import { DEFAULT_REGIONS, ORDER_STATUS, STORE_PRIVATE_DEFAULTS, displayPhone, fillTpl, itemLine, money, orderVars, waLinkTo } from "../../store/shared";
import { useAdmin, useQuery } from "../hooks";
import { Empty, Kpi, Modal, Panel, Tag } from "../ui";
import { LATE_MS, blCol, blacklistAdd, syncTrack, ORDER_FLOW, orderProfit, storeUrlOf, reviewText } from "./shared";

export function Orders({ products, priv, pub }) {
  const [n, setN] = useState(100);
  const [rows, loading] = useQuery(() => query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(n)), [n]);
  const [f, setF] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const isLate = (o) => o.status === "awaiting" && Date.now() - toMs(o.confirm?.sentAt) > LATE_MS;
  const keyOf = (o) => (o.attention && o.status === "awaiting" ? "_att" : isLate(o) ? "_late" : o.status);

  const counts = {};
  rows.forEach((o) => {
    counts[o.status] = (counts[o.status] || 0) + 1;
    if (o.attention && o.status === "awaiting") counts._att = (counts._att || 0) + 1;
    if (isLate(o)) counts._late = (counts._late || 0) + 1;
  });
  const shown = rows.filter(
    (o) =>
      (!f || (f === "_att" ? o.attention && o.status === "awaiting" : f === "_late" ? isLate(o) : o.status === f)) &&
      (!q || [o.code, o.name, o.phone1, o.phone2, o.city].some((v) => String(v || "").toLowerCase().includes(q.toLowerCase())))
  );

  // إحصائيات
  const weekAgo = Date.now() - 7 * 86_400_000;
  const delivered = rows.filter((o) => o.status === "delivered");
  const weekProfit = rows.filter((o) => ["confirmed", "sent", "shipping", "delivered"].includes(o.status) && toMs(o.createdAt) > weekAgo).reduce((s, o) => s + orderProfit(o, byId), 0);
  const today = new Date().toDateString();
  const cur = open && rows.find((o) => o.id === open);

  return (
    <>
      <div className="kpis">
        <Kpi label="طلبات اليوم" value={rows.filter((o) => toDate(o.createdAt)?.toDateString() === today).length} color="#f97316" />
        <Kpi label="بانتظار التأكيد" value={(counts.awaiting || 0) + (counts.confirm_queued || 0)} sub={counts._late ? `${counts._late} متأخر` : ""} color="#d97706" />
        <Kpi label="ربح آخر 7 أيام" value={`${money(weekProfit)} ₪`} hint="الطلبات المؤكدة وما بعدها" color="#059669" />
        <Kpi label="مستلمة" value={delivered.length} sub={`حافز ${Math.floor(delivered.length / 5) * 10} ₪`} hint="كل 5 طلبيات مستلمة = 10 شيكل (من آخر الطلبات المعروضة)" color="#1d4ed8" />
      </div>
      <Panel title={`الطلبات (${rows.length})`}>
        <div className="chips">
          <button className={"chip" + (!f ? " active" : "")} onClick={() => setF("")}>
            الكل {rows.length}
          </button>
          {counts._att > 0 && (
            <button className={"chip chip-alert" + (f === "_att" ? " active" : "")} onClick={() => setF("_att")}>
              رد محتاجك {counts._att}
            </button>
          )}
          {counts._late > 0 && (
            <button className={"chip chip-alert" + (f === "_late" ? " active" : "")} onClick={() => setF("_late")}>
              ما أكّد خلال ساعة {counts._late}
            </button>
          )}
          {ORDER_FLOW.filter((k) => counts[k]).map((k) => (
            <button key={k} className={"chip" + (f === k ? " active" : "")} onClick={() => setF(k)}>
              {ORDER_STATUS[k][0]} {counts[k]}
            </button>
          ))}
        </div>
        <div className="filters">
          <input type="search" placeholder="بحث برقم الطلب أو الاسم أو الجوال أو البلد..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {loading && !rows.length ? (
          <Empty>جاري التحميل...</Empty>
        ) : !shown.length ? (
          <Empty>{rows.length ? "ما في نتائج" : "لسا ما في طلبات"}</Empty>
        ) : (
          <div className="list">
            {shown.map((o) => {
              const [l, k] = ORDER_STATUS[o.status] || [o.status, ""];
              const alert = ["_att", "_late"].includes(keyOf(o));
              return (
                <div key={o.id} className={"item conv-item" + (alert ? " conv-alert" : "")} onClick={() => setOpen(o.id)}>
                  <div className="item-head">
                    <div className="item-title">
                      <span className="m-code">#{o.code}</span> <b>{o.name}</b>
                    </div>
                    <Tag kind={k}>{l}</Tag>
                  </div>
                  <div className="item-meta">
                    <span>{(o.items || []).map(itemLine).join(" + ")}</span>
                  </div>
                  <div className="item-meta">
                    <b>{money(o.total)} ₪</b>
                    <span>
                      {o.city} · {o.regionName}
                    </span>
                    <span className="muted">{fmtAgo(o.createdAt)}</span>
                    {o.lang === "he" && <Tag kind="info">עברית</Tag>}
                    {o.lang === "en" && <Tag kind="info">EN</Tag>}
                    {o.attention && o.status === "awaiting" && <span className="err-text">رد: {o.lastReply}</span>}
                    {isLate(o) && !o.attention && <span className="err-text">ما أكّد خلال ساعة</span>}
                    {o.confirm?.error && <span className="err-text">{o.confirm.error}</span>}
                  </div>
                </div>
              );
            })}
            {rows.length >= n && (
              <button className="btn small block-center" onClick={() => setN((x) => x + 100)}>
                عرض المزيد
              </button>
            )}
          </div>
        )}
      </Panel>
      {cur && <OrderModal o={cur} byId={byId} priv={priv} pub={pub} onClose={() => setOpen(null)} />}
    </>
  );
}

export function OrderModal({ o, byId, priv, pub, onClose }) {
  const { toast, waAccounts, workers, app } = useAdmin();
  const [sheet, setSheet] = useState(null); // { title, text }
  const [confirmText, setConfirmText] = useState(null);
  const ref = doc(db, "orders", o.id);
  const vars = orderVars(o, storeUrlOf(priv));
  const [banned] = useQuery(() => query(blCol, where("phone", "in", [o.phone1, o.phone2].filter(Boolean).slice(0, 2).concat(["-"]))), [o.phone1, o.phone2]);
  const profit = orderProfit(o, byId);
  const accId = priv.confirmAccountId || app.welcomeAccountId || waAccounts[0]?.id || "";

  async function setStatus(status) {
    const patch = { status, updatedAt: serverTimestamp() };
    if (typeof o.profit !== "number" && ["confirmed", "sent", "shipping", "delivered"].includes(status)) patch.profit = profit;
    if (status === "delivered") patch.deliveredAt = serverTimestamp();
    try {
      await updateDoc(ref, patch);
      syncTrack(o, status);
      if (status === "returned" && !banned.length && confirm(`الطلب رجع. تضيف رقم ${o.name} للقائمة السوداء؟\n(ما رح يقدر يطلب من المتجر مرة تانية)`)) {
        await blacklistAdd([o.phone1, o.phone2].filter(Boolean), o);
        toast("انضاف للقائمة السوداء", "ok");
      }
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
  }

  async function queueConfirm() {
    if (!accId) return toast("اختار حساب واتساب للتأكيد من إعدادات المتجر", "bad");
    try {
      await updateDoc(ref, { status: "confirm_queued", attention: false, confirm: { text: confirmText.trim(), accountId: accId, queuedAt: serverTimestamp() } });
      setConfirmText(null);
      toast(workers.waOnline ? "رسالة التأكيد بتنبعت هلأ" : "انحفظت — بتنبعت لما يشتغل عامل الواتساب", "ok");
    } catch (e) {
      toast("فشل: " + e.message, "bad");
    }
  }

  // نموذج المشرف لكل منتج (كل منتج إله مشرف بقروبه)
  function itemDelivery(it, idx) {
    const region = (pub?.regions || DEFAULT_REGIONS).find((r) => r.id === o.regionId);
    const rp = Number(region?.price) || 0;
    const q = Number(it.qty) || 1;
    if (it.delivery === "perPiece") return rp * q;
    if (it.delivery === "custom") return (Number(it.deliveryPrice) || 0) * q;
    const firstNormal = (o.items || []).findIndex((x) => !x.delivery || x.delivery === "normal");
    if (idx !== firstNormal) return 0;
    const extra = (o.items || []).reduce((s, x) => s + (x.delivery === "perPiece" ? rp * (Number(x.qty) || 1) : x.delivery === "custom" ? (Number(x.deliveryPrice) || 0) * (Number(x.qty) || 1) : 0), 0);
    return Math.max(0, (Number(o.delivery) || 0) - extra);
  }
  function itemVars(it, idx) {
    const p = byId[it.id];
    const q = Number(it.qty) || 1;
    const many = (o.items || []).length > 1;
    return {
      ...vars,
      المنتج: itemLine(it),
      السعر: money(it.price * q + itemDelivery(it, idx)),
      الربح: p ? money((Number(p.profit) || 0) * q) : "",
      سعر_الجملة: p ? money((Number(p.cost) || 0) * q) : "",
      المندوبة: priv.repName,
      ملاحظة: [o.notes, many ? `ضمن طلب #${o.code} مع منتجات تانية` : ""].filter(Boolean).join(" — ") || "—",
    };
  }

  const mismatch = (o.items || []).filter((it) => byId[it.id] && Number(byId[it.id].price) !== Number(it.price));

  return (
    <Modal
      wide
      title={`طلب #${o.code}`}
      onClose={onClose}
      actions={
        <button className="btn" onClick={onClose}>
          إغلاق
        </button>
      }
    >
      <div className="item-meta">
        <Tag kind={ORDER_STATUS[o.status]?.[1]}>{ORDER_STATUS[o.status]?.[0] || o.status}</Tag>
        <span className="muted">{fmtDateTime(toDate(o.createdAt))}</span>
        {o.lang === "he" && <Tag kind="info">طلب من النسخة العبرية</Tag>}
        {banned.length > 0 && <Tag kind="bad">⛔ بالقائمة السوداء</Tag>}
        <select className="status-select" value={o.status} onChange={(e) => setStatus(e.target.value)}>
          {ORDER_FLOW.map((k) => (
            <option key={k} value={k}>
              {ORDER_STATUS[k][0]}
            </option>
          ))}
        </select>
      </div>

      <table className="mini-table" style={{ margin: "10px 0" }}>
        <tbody>
          <tr>
            <th>الاسم</th>
            <td>{o.name}</td>
          </tr>
          <tr>
            <th>العنوان</th>
            <td>
              {o.city} — {o.address} <span className="muted">({o.regionName})</span>
            </td>
          </tr>
          <tr>
            <th>الجوال</th>
            <td>
              {[o.phone1, o.phone2].filter(Boolean).map((p) => (
                <a key={p} className="wa-btn" href={waLinkTo(p, "")} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>
                  <span dir="ltr">{displayPhone(p)}</span>
                </a>
              ))}
            </td>
          </tr>
          {o.notes && (
            <tr>
              <th>ملاحظة</th>
              <td>{o.notes}</td>
            </tr>
          )}
        </tbody>
      </table>

      <table className="mini-table">
        <thead>
          <tr>
            <th>المنتج</th>
            <th>السعر</th>
            <th>ربحك</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(o.items || []).map((it, i) => (
            <tr key={i}>
              <td>{itemLine(it)}</td>
              <td>{money(it.price * it.qty)} ₪</td>
              <td>{byId[it.id] ? `${money((Number(byId[it.id].profit) || 0) * it.qty)} ₪` : "—"}</td>
              <td>
                <button className="btn small" onClick={() => setSheet({ title: `نموذج المشرف — ${it.name}`, text: fillTpl(priv.supervisorTpl, itemVars(it, i)) })}>
                  نموذج المشرف
                </button>{" "}
                <button className="btn small" onClick={() => setSheet({ title: `نموذج الدفتر — ${it.name}`, text: fillTpl(priv.ledgerTpl, itemVars(it, i)) })}>
                  الدفتر
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td>التوصيل</td>
            <td>{money(o.delivery)} ₪</td>
            <td></td>
            <td></td>
          </tr>
          <tr>
            <th>المجموع</th>
            <th>{money(o.total)} ₪</th>
            <th>{money(profit)} ₪</th>
            <th></th>
          </tr>
        </tbody>
      </table>
      {mismatch.length > 0 && <div className="alert warn">انتبه: سعر {mismatch.map((m) => m.name).join("، ")} بالطلب غير عن سعره الحالي بالمتجر.</div>}

      {(o.replies || []).length > 0 && (
        <div className="chat">
          {o.confirm?.text && (
            <div className="bubble out">
              <div className="bubble-text">{o.confirm.text}</div>
            </div>
          )}
          {o.replies.map((r, i) => (
            <div key={i} className="bubble in">
              <div className="bubble-text">{r.t}</div>
              <div className="bubble-time">{fmtAgo(r.at)}</div>
            </div>
          ))}
        </div>
      )}

      {confirmText !== null ? (
        <div className="field">
          <label>رسالة التأكيد (بتنبعت من رقم المتابعة للزبون)</label>
          <textarea rows={10} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <div className="btn-row">
            <button className="btn small primary" onClick={queueConfirm} disabled={!confirmText.trim()}>
              إرسال
            </button>
            <button className="btn small" onClick={() => setConfirmText(null)}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="btn-row" style={{ marginTop: 10 }}>
          {["new", "awaiting"].includes(o.status) && (
            <button className="btn small primary" onClick={() => setConfirmText(fillTpl(o.lang === "he" ? priv.confirmTplHe || STORE_PRIVATE_DEFAULTS.confirmTplHe : o.lang === "en" && priv.confirmTplEn ? priv.confirmTplEn : priv.confirmTpl, vars))}>
              {o.status === "awaiting" ? "إعادة إرسال رسالة التأكيد" : "إرسال رسالة التأكيد على واتساب"}
            </button>
          )}
          {o.status === "awaiting" && (
            <button className="btn small" onClick={() => setStatus("confirmed")}>
              علّمه مؤكد
            </button>
          )}
          {o.status === "delivered" && (
            <a className="btn small wa-solid" href={waLinkTo(o.phone1, reviewText(o, priv))} target="_blank" rel="noreferrer">
              اطلب تقييم على واتساب
            </a>
          )}
          {o.attention && (
            <button className="btn small" onClick={() => updateDoc(ref, { attention: false })}>
              شيل "محتاج ردك"
            </button>
          )}
          <button
            className="btn small"
            onClick={() =>
              setSheet({
                title: "كل نماذج المشرف",
                text: (o.items || []).map((it, i) => fillTpl(priv.supervisorTpl, itemVars(it, i))).join("\n\n➖➖➖➖➖\n\n"),
              })
            }
          >
            نسخ للمشرف (كل المنتجات)
          </button>
          {o.code && (
            <button className="btn small" onClick={() => copyText(`${storeUrlOf(priv)}#/track/${o.code}`).then(() => toast("انتسخ رابط التتبع", "ok"))}>
              رابط تتبع الطلب
            </button>
          )}
          {!banned.length && (
            <button className="btn small danger-outline" onClick={() => confirm(`حظر رقم ${o.name}؟ ما رح يقدر يطلب من المتجر.`) && blacklistAdd([o.phone1, o.phone2].filter(Boolean), o, "حظر يدوي").then(() => toast("انحظر", "ok"))}>
              حظر الرقم
            </button>
          )}
          <button className="btn small danger-outline" onClick={() => confirm(`حذف الطلب #${o.code} نهائياً؟`) && deleteDoc(ref).then(onClose)}>
            حذف
          </button>
        </div>
      )}

      {sheet && <CopySheet sheet={sheet} onClose={() => setSheet(null)} />}
    </Modal>
  );
}

export function CopySheet({ sheet, onClose }) {
  const { toast } = useAdmin();
  const [t, setT] = useState(sheet.text);
  return (
    <Modal
      title={sheet.title}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            إغلاق
          </button>
          <button className="btn primary" onClick={() => copyText(t).then(() => toast("انسخ ✓", "ok", 1200))}>
            نسخ
          </button>
        </>
      }
    >
      <textarea rows={16} value={t} onChange={(e) => setT(e.target.value)} style={{ width: "100%" }} />
      <div className="hint">بتقدر تعدّل قبل النسخ (مربح زائد / ناقص...).</div>
    </Modal>
  );
}
