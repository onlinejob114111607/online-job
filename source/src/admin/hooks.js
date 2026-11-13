import { createContext, useContext, useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { mergeApp } from "../appSettings";
import { toMs } from "../utils";

// مستمع لاستعلام Firestore — بيرجع [الصفوف، جاري التحميل، الخطأ]
export function useQuery(makeQuery, deps = []) {
  const [state, setState] = useState({ rows: [], loading: true, error: null });
  useEffect(() => {
    const q = makeQuery();
    if (!q) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) => setState({ rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => {
        console.error(error);
        setState({ rows: [], loading: false, error });
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [state.rows, state.loading, state.error];
}

export function useDocData(path) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    if (!path) return undefined;
    return onSnapshot(
      doc(db, path),
      (s) => setData(s.exists() ? s.data() : null),
      (e) => {
        console.error(e);
        setData(null);
      }
    );
  }, [path]);
  return data;
}

// ===== حالة العمّال =====
const isOnline = (w) => !!w && w.state === "running" && Date.now() - toMs(w.lastSeen) < 150_000;

export function useWorkersState() {
  const wa = useDocData("workers/wa");
  const tg = useDocData("workers/tg");
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 20_000);
    return () => clearInterval(t);
  }, []);
  return { wa: wa || null, tg: tg || null, waOnline: isOnline(wa), tgOnline: isOnline(tg) };
}

// ===== سياق مشترك للوحة (الإعدادات، العمّال، التنبيهات) =====
export const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

export function useAppSettingsLive() {
  const raw = useDocData("settings/app");
  return { app: mergeApp(raw), loaded: raw !== undefined };
}

// ===== أوامر للعمّال =====
// بيرجع نتيجة الأمر لما العامل يخلّصه، أو خطأ لو فشل أو ما رد
export async function runCommand(worker, type, data = {}, { wait = true, timeout = 90_000 } = {}) {
  const ref = await addDoc(collection(db, "commands"), {
    worker,
    type,
    ...data,
    status: "new",
    createdAt: serverTimestamp(),
  });
  if (!wait) return null;
  return new Promise((resolve, reject) => {
    let unsub = () => {};
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("العامل ما رد — تأكد إنه شغال على الجوال"));
    }, timeout);
    unsub = onSnapshot(ref, (s) => {
      const d = s.data();
      if (!d) return;
      if (d.status === "done") {
        clearTimeout(timer);
        unsub();
        resolve(d.result ?? null);
      } else if (d.status === "error") {
        clearTimeout(timer);
        unsub();
        reject(new Error(d.error || "فشل الأمر"));
      }
    });
  });
}

// ===== تنبيهات صغيرة =====
export function useToastState() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const show = (msg, kind = "info", ms = 3000) => {
    clearTimeout(timer.current);
    setToast({ msg, kind });
    timer.current = setTimeout(() => setToast(null), ms);
  };
  return [toast, show];
}

// تخزين محلي بسيط للاختيارات (مع حماية لو التخزين مش متاح)
export const store = {
  get(k, def = null) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? def : v;
    } catch {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* تجاهل */
    }
  },
};
