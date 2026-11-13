// مشترك بين ملفات Funnel (ثوابت ودوال مساعدة)
import { useEffect, useState } from "react";
import { meetingTimeOf, pct } from "../../funnelDefaults";

export const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const WAIT = {
  any: "أي رد",
  accept: "رد بقبول (تمام، جاهز...)",
  image: "صورة (لقطة شاشة)",
  none: "ما بنستنى — كمّل للخطوة الجاية",
};

export const STATUS = {
  queued: ["بالطابور", "wait"],
  active: ["بالمحادثة", "info"],
  attention: ["محتاج ردك", "bad"],
  completed: ["خلّص التسجيل (بوك)", "ok"],
  invite: ["دعوة للقاء الجاي", "info"],
  manual: ["عندك (البوت واقف)", "wait"],
  rejected: ["رفض", "bad"],
  expired: ["انتهى اليوم", ""],
  failed: ["مش على واتساب", "bad"],
  closed: ["انسكّر", ""],
};

export const ORDER = ["attention", "active", "invite", "queued", "manual", "completed", "rejected", "expired", "failed", "closed"];

export const statusOf = (c) => (c.attention && ["active", "completed", "invite"].includes(c.status) ? "attention" : c.status);

export const remSent = (v) => v && v !== "skip";

// ---------- وقت اللقاء ----------
export function meetingInstant(day, t) {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 4, mm));
}

export const timeIn = (date, tz) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date).replace(/\s*[AP]M$/i, "");

export const cairoWeekday = (d = new Date()) =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(d));

export const cairoHM = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

export function nextMeeting(cfg) {
  if (!cfg.days.length) return null;
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    if (!cfg.days.includes(cairoWeekday(d))) continue;
    if (i === 0 && cairoHM() >= cfg.closeTime) continue;
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);
    return { key, wd: cairoWeekday(d), today: i === 0, time: meetingTimeOf(cfg, key) };
  }
  return null;
}

export const addDayKey = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const meetingOf = (cfg, day) => meetingInstant(day, meetingTimeOf(cfg, day));

export const dayLabel = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}/${m}`;
};

export function useTick(ms = 30_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export const untilText = (msLeft) => {
  if (msLeft <= 0) return "هلأ";
  const m = Math.round(msLeft / 60_000);
  if (m < 60) return `بعد ${m} دقيقة`;
  const h = Math.floor(m / 60);
  return `بعد ${h} ساعة${m % 60 ? ` و${m % 60} د` : ""}`;
};

export const weekKey = (day) => {
  // بداية الأسبوع = السبت
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const back = (dt.getUTCDay() + 1) % 7;
  return new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
};

export const sumStats = (list) => {
  const t = { welcomed: 0, booked: 0, attended: 0, invBooked: 0, rejected: 0, bySource: {} };
  for (const s of list) {
    for (const k of ["welcomed", "booked", "attended", "invBooked", "rejected"]) t[k] += s?.[k] || 0;
    for (const [src, v] of Object.entries(s?.bySource || {})) {
      const b = (t.bySource[src] ||= { welcomed: 0, booked: 0, attended: 0 });
      b.welcomed += v.welcomed || 0;
      b.booked += v.booked || 0;
      b.attended += v.attended || 0;
    }
  }
  return t;
};

export const bookRate = (s) => pct((s.booked || 0) - (s.invBooked || 0), s.welcomed || 0);

export const RateHead = ({ first }) => (
  <thead>
    <tr>
      <th>{first}</th>
      <th>رسائل</th>
      <th>بوك</th>
      <th>نسبة البوك</th>
      <th>حضور</th>
      <th>نسبة الحضور</th>
    </tr>
  </thead>
);

export const TZS = {
  دبي: "Asia/Dubai",
  مصر: "Africa/Cairo",
  فلسطين: "Asia/Gaza",
  الأردن: "Asia/Amman",
  سوريا: "Asia/Damascus",
  لبنان: "Asia/Beirut",
  العراق: "Asia/Baghdad",
  السعودية: "Asia/Riyadh",
  الكويت: "Asia/Kuwait",
  قطر: "Asia/Qatar",
  عمان: "Asia/Muscat",
  ليبيا: "Africa/Tripoli",
  تونس: "Africa/Tunis",
  الجزائر: "Africa/Algiers",
  المغرب: "Africa/Casablanca",
  السودان: "Africa/Khartoum",
  اليمن: "Asia/Aden",
};

export function fillText(text, cfg, day, time, name) {
  const [y, m, d] = day.split("-");
  const at = meetingInstant(day, time);
  const vars = {
    name,
    الاسم: name,
    تاريخ: `${d}/${m}/${y}`,
    يوم: DAYS[new Date(Date.UTC(+y, +m - 1, +d)).getUTCDay()],
    المدة: String(cfg.duration),
    رابط: cfg.regLink,
    رقم: cfg.refNo,
    اسمي: cfg.senderName,
    التيم_ليدر: cfg.teamLeader,
    رابط_الإعادة: cfg.replayLink,
    التكلفة: cfg.costText,
    بلدك: "مصر",
    ساعة_محلي: timeIn(at, "Africa/Cairo"),
    تحية: Number(cairoHM().slice(0, 2)) < 12 ? "صباح الخير" : "مساء الخير",
  };
  for (const [l, tz] of Object.entries(TZS)) vars[`ساعة_${l}`] = timeIn(at, tz);
  let out = String(text || "");
  if (!String(cfg.costText || "").trim()) out = out.split("\n").filter((l) => !l.includes("{التكلفة}")).join("\n");
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v ?? "");
  // التنويع {أ|ب} ← أول خيار
  out = out.replace(/\{([^{}]*\|[^{}]*)\}/g, (_, inner) => inner.split("|")[0]);
  return out
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

export const VARS = [
  ["{name}", "الاسم الأول"],
  ["{يوم}", "يوم اللقاء"],
  ["{تاريخ}", "تاريخ اللقاء"],
  ["{ساعة_دبي}", "ساعة اللقاء بدبي"],
  ["{ساعة_مصر}", "بمصر"],
  ["{ساعة_فلسطين}", "بفلسطين"],
  ["{ساعة_الأردن}", "بالأردن"],
  ["{ساعة_السعودية}", "بالسعودية"],
  ["{ساعة_العراق}", "بالعراق"],
  ["{ساعة_محلي}", "ساعة اللقاء بتوقيت دولة الشخص (من رقمه)"],
  ["{بلدك}", "دولة الشخص"],
  ["{التكلفة}", "التكلفة الكاملة"],
  ["{المدة}", "مدة اللقاء"],
  ["{رابط}", "رابط التسجيل"],
  ["{رقم}", "الرقم المرجعي"],
  ["{اسمي}", "اسمك"],
  ["{التيم_ليدر}", "اسم التيم ليدر"],
  ["{رابط_الإعادة}", "رابط إعادة اللقاء"],
  ["{تحية}", "صباح/مساء الخير حسب الوقت"],
];

export const MAX_VOICE = 700 * 1024;

/* رسالة أولى حسب مصدر التسجيل */
