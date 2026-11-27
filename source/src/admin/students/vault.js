// ============================================================
//  خزنة كلمات سر الطلاب (بالرمز السري PIN)
//  كلمة السر بتتشفّر بالمتصفح بمفتاح مشتق من الـ PIN (PBKDF2 → AES-GCM)،
//  وقاعدة البيانات بتشوف بس النص المشفّر. الـ PIN نفسه ما بينحفظ بأي مكان.
//  بعد الفتح المفتاح بيضل بذاكرة الصفحة بس، وبيتسكّر لحاله بعد 30 دقيقة.
// ============================================================
import { useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const AUTO_LOCK_MS = 30 * 60_000;

let key = null;
let lockTimer = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f(key));

function subtle() {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("المتصفح ما بيدعم التشفير (لازم https)");
  return s;
}

async function derive(pin, salt) {
  const base = await subtle().importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", salt, iterations: 250_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function arm() {
  clearTimeout(lockTimer);
  lockTimer = setTimeout(lockVault, AUTO_LOCK_MS);
}

export async function seal(obj, k = key) {
  if (!k) throw new Error("افتح الخزنة بالرمز السري أول");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await subtle().encrypt({ name: "AES-GCM", iv }, k, enc.encode(JSON.stringify(obj)));
  return { v: 1, iv: b64(iv), c: b64(c) };
}

export async function unseal(box, k = key) {
  if (!box) return null;
  if (!k) throw new Error("افتح الخزنة بالرمز السري أول");
  const p = await subtle().decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.c));
  arm();
  return JSON.parse(dec.decode(p));
}

// أول مرة: بنعمل الخزنة بالرمز اللي اخترته
export async function setupVault(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const k = await derive(pin, salt);
  const check = await seal({ ok: true }, k);
  await setDoc(doc(db, "settings", "studentVault"), { salt: b64(salt), check, createdAt: serverTimestamp() });
  key = k;
  arm();
  emit();
}

export async function unlockVault(pin, cfg) {
  const k = await derive(pin, unb64(cfg.salt));
  let ok = false;
  try {
    ok = !!(await unseal(cfg.check, k))?.ok;
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("الرمز السري غلط");
  key = k;
  arm();
  emit();
}

export function lockVault() {
  clearTimeout(lockTimer);
  key = null;
  emit();
}

// true لما الخزنة مفتوحة
export function useVault() {
  const [k, setK] = useState(key);
  useEffect(() => {
    subs.add(setK);
    return () => subs.delete(setK);
  }, []);
  return !!k;
}
