export const WA_STATE = {
  new: ["جديد", "wait"],
  starting: ["بيشتغل", "wait"],
  connecting: ["بيتصل", "wait"],
  reconnecting: ["إعادة اتصال", "wait"],
  qr: ["بانتظار المسح", "info"],
  pairing: ["بانتظار كود الربط", "info"],
  open: ["متصل", "ok"],
  logged_out: ["مش مربوط", "bad"],
  paused: ["موقوف", "bad"],
};

export function waStateOf(a, workerOnline) {
  if (a.enabled === false) return WA_STATE.paused;
  if (!workerOnline) return ["العامل مطفي", "bad"];
  return WA_STATE[a.state] || WA_STATE.new;
}

export const G_STATUS = {
  joined: ["منضم", "ok"],
  pending: ["بالانتظار", "wait"],
  requested: ["طلب انضمام", "info"],
  error: ["خطأ", "bad"],
  left: ["خرجت منها", "bad"],
};

export const P_STATUS = {
  scheduled: ["مجدول", "info"],
  queued: ["بالطابور", "wait"],
  sending: ["عم ينشر", "wait"],
  done: ["خلص", "ok"],
  cancelled: ["ملغي", "bad"],
};

export const HEALTH = {
  blocked: ["للمشرفين فقط — اتوقفت تلقائياً", "bad"],
  failing: ["فشلت 3 مرات — اتوقفت تلقائياً", "bad"],
};

export const catOf = (g) => g.category || "عام";
