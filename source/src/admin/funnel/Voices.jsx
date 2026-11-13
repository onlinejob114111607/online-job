import { useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { VOICE_SLOTS } from "../../funnelDefaults";
import { useAdmin, useQuery } from "../hooks";
import { Panel, Tag, Toggle } from "../ui";
import { MAX_VOICE } from "./shared";

export function SrcTemplates({ value, first, onChange }) {
  const [runs] = useQuery(() => query(collection(db, "funnel_runs"), orderBy("day", "desc"), limit(30)), []);
  const [add, setAdd] = useState("");
  const known = useMemo(() => {
    const m = {};
    for (const r of runs) for (const [k, v] of Object.entries(r.stats?.bySource || {})) m[k] = (m[k] || 0) + (v.welcomed || 0);
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .map(([k]) => k);
  }, [runs]);
  const keys = Object.keys(value);
  const free = known.filter((k) => !keys.includes(k));
  const put = (k, v) => onChange({ ...value, [k]: v });
  const del = (k) => {
    const n = { ...value };
    delete n[k];
    onChange(n);
  };
  return (
    <Panel title="رسالة أولى حسب مصدر التسجيل">
      <p className="small-text muted">
        لكل مصدر (فيسبوك، تيك توك، إعلان معيّن...) بتقدر تكتب مسج تعريفي مختلف يناسب اللي شافه الشخص. المصدر اللي ما إله قالب بياخد الرسالة العادية. نفس المتغيرات شغالة: {"{الاسم}"}، {"{تحية}"}، {"{يوم}"}، {"{ساعة_محلي}"}...
      </p>
      {keys.map((k) => (
        <div key={k} className="step-card">
          <div className="step-head">
            <b className="step-label">📍 {k}</b>
            <button type="button" className="icon-btn" onClick={() => del(k)}>
              🗑
            </button>
          </div>
          <textarea rows={5} value={value[k]} onChange={(e) => put(k, e.target.value)} />
        </div>
      ))}
      <div className="chips">
        {free.slice(0, 12).map((k) => (
          <button key={k} type="button" className="chip" onClick={() => put(k, first)}>
            ➕ {k}
          </button>
        ))}
      </div>
      <div className="copy-row">
        <input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="اسم مصدر تاني (زي ما بيطلع بالنسب)" />
        <button type="button" className="btn small" disabled={!add.trim() || keys.includes(add.trim())} onClick={() => (put(add.trim(), first), setAdd(""))}>
          إضافة
        </button>
      </div>
    </Panel>
  );
}

export function VoicesPanel({ on, setOn }) {
  const { toast } = useAdmin();
  const [rows] = useQuery(() => collection(db, "funnel_voices"), []);
  const [rec, setRec] = useState(null); // { slot, mr }
  const bySlot = Object.fromEntries(rows.map((r) => [r.id, r]));

  async function saveBlob(slot, blob, name) {
    if (blob.size > MAX_VOICE) return toast(`الفويس كبير (${Math.round(blob.size / 1024)}KB) — الحد 700KB (تقريباً دقيقة ونص)`, "bad", 6000);
    const data = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.readAsDataURL(blob);
    });
    try {
      await setDoc(doc(db, "funnel_voices", slot), { data, mime: blob.type || "audio/mpeg", name: name || "تسجيل", size: blob.size, updatedAt: serverTimestamp() });
      toast("انرفع الفويس ✓", "ok");
    } catch (e) {
      toast("فشل الرفع: " + e.message, "bad");
    }
  }
  async function startRec(slot) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || "";
      const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        saveBlob(slot, new Blob(chunks, { type: (mr.mimeType || "audio/webm").split(";")[0] }), "تسجيل من اللوحة");
        setRec(null);
      };
      mr.start();
      setRec({ slot, mr });
    } catch {
      toast("ما قدرت أفتح المايك — اسمح للمتصفح يستعمله", "bad");
    }
  }

  return (
    <Panel title="الفويسات بصوتك">
      <Toggle checked={on} onChange={setOn} label="إرسال الفويسات" hint="بتنبعت كرسالة صوتية بعد الترحيب، وعند الموعد (البوك)، وعند تأكيد الزووم، وللي ما تفاعل قبل اللقاء — حسب اختيارك بكل خطوة وتذكير." />
      <p className="small-text muted">
        ارفع ملف (mp3 / m4a / ogg) أو سجّل من هون. عشان يوصل كرسالة صوتية (مش ملف) لازم ffmpeg على الجوال: <code>pkg install ffmpeg</code>. الحد 700KB لكل فويس.
      </p>
      <div className="list">
        {VOICE_SLOTS.map(([slot, label]) => {
          const v = bySlot[slot];
          return (
            <div key={slot} className="item">
              <div className="item-head">
                <div className="item-title">
                  🎤 <b>{label}</b> {v ? <Tag kind="ok">موجود · {Math.round((v.size || 0) / 1024)}KB</Tag> : <Tag>ما في</Tag>}
                </div>
                <div className="row-gap">
                  <label className="btn small">
                    رفع ملف
                    <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files[0] && saveBlob(slot, e.target.files[0], e.target.files[0].name)} />
                  </label>
                  {rec?.slot === slot ? (
                    <button className="btn small danger-outline" onClick={() => rec.mr.stop()}>
                      ⏹ وقف وحفظ
                    </button>
                  ) : (
                    <button className="btn small" disabled={!!rec} onClick={() => startRec(slot)}>
                      ⏺ سجّل
                    </button>
                  )}
                  {v && (
                    <button className="icon-btn" onClick={() => confirm("حذف الفويس؟") && deleteDoc(doc(db, "funnel_voices", slot))}>
                      🗑
                    </button>
                  )}
                </div>
              </div>
              {v?.data && <audio controls preload="none" src={`data:${v.mime};base64,${v.data}`} style={{ width: "100%", marginTop: 6 }} />}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
