// تحميل وحفظ نصوص الموقع من Firestore (settings/site)
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { SITE } from "./config";

const CACHE_KEY = "site_content_v1";

export function mergeSite(data) {
  const out = { ...SITE };
  if (!data) return out;
  for (const k of Object.keys(SITE)) {
    if (data[k] === undefined || data[k] === null) continue;
    if (Array.isArray(SITE[k]) && !Array.isArray(data[k])) continue;
    out[k] = data[k];
  }
  return out;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* تجاهل */
  }
}

export async function loadSiteContent() {
  const snap = await getDoc(doc(db, "settings", "site"));
  const data = snap.exists() ? snap.data() : null;
  if (data) {
    delete data.updatedAt;
    writeCache(data);
  }
  return mergeSite(data);
}

export async function saveSiteContent(site) {
  const clean = {};
  for (const k of Object.keys(SITE)) clean[k] = site[k];
  await setDoc(doc(db, "settings", "site"), { ...clean, updatedAt: serverTimestamp() });
  writeCache(clean);
}

// للزوار: بيعرض النسخة المحفوظة على الجهاز فوراً، وبيحدّث من السيرفر بالخلفية
export function useSiteContent() {
  const cached = readCache();
  const [site, setSite] = useState(() => mergeSite(cached));
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => alive && setReady(true), 3500);
    loadSiteContent()
      .then((s) => alive && setSite(s))
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer);
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return { site, ready };
}
