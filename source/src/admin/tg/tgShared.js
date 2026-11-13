import { toMs } from "../../utils";

export function tgStateOf(a, workerOnline, app) {
  if (a.enabled === false) return ["موقوف", "bad"];
  if (a.status === "banned") return ["محظور", "bad"];
  if (a.status === "unauthorized") return ["محتاج دخول من جديد", "bad"];
  if (a.status === "full") return ["وصل حد الجروبات", "bad"];
  if (a.status === "error") return ["خطأ", "bad"];
  if (!workerOnline) return ["العامل مطفي", "bad"];
  if ((Number(a.floodUntil) || 0) > Date.now()) return [`FloodWait ${Math.ceil((a.floodUntil - Date.now()) / 60000)} د`, "wait"];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
  const j = a.joinsDate === today ? a.joinsToday || 0 : 0;
  if (j >= (a.dailyLimit || app?.tg?.dailyLimit || 15)) return ["وصل حد اليوم", "wait"];
  if (!a.connected) return ["بيتصل", "wait"];
  return ["شغال", "ok"];
}

export const SRC_STATUS = {
  pending: ["بالانتظار", "wait"],
  working: ["عم ينضم", "info"],
  scanning: ["عم يسحب", "info"],
  done: ["خلص", "ok"],
  failed: ["فشل", "bad"],
  duplicate: ["مكرر", ""],
};

export const LINK_STATUS = {
  unchecked: ["مش مفحوص", "wait"],
  active: ["شغال", "ok"],
  inactive: ["منتهي", "bad"],
  error: ["خطأ فحص", "bad"],
  blocked: ["محظور (قائمة سوداء)", "bad"],
};

export const WA_LINK = {
  none: ["لسا", ""],
  queued: ["بالطابور", "wait"],
  joined: ["انضم", "ok"],
  requested: ["بانتظار الأدمن", "info"],
  error: ["فشل", "bad"],
  duplicate: ["مكرر", ""],
};

export function parseSource(raw) {
  let s = String(raw || "").trim().replace(/\/+$/, "");
  s = s.replace(/^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.(?:me|dog)\//i, "");
  s = s.split("?")[0];
  if (s.startsWith("@")) s = s.slice(1);
  let h = null;
  if (s.startsWith("+")) h = s.slice(1).split("/")[0];
  else if (/^joinchat\//i.test(s)) h = s.split("/")[1];
  if (h !== null) {
    if (!/^[A-Za-z0-9_-]{8,}$/.test(h)) return null;
    return { kind: "invite", val: h, id: `invite_${h}` };
  }
  if (/^s\//i.test(s)) s = s.slice(2);
  const name = s.split("/")[0];
  if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(name)) return null;
  return { kind: "public", val: name, id: `public_${name.toLowerCase()}` };
}

export const isFlood = (a) => toMs(a.floodUntil) > Date.now();
