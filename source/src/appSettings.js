// الإعدادات العامة للنظام (settings/app) — نفس القيم الافتراضية اللي بالعامل (worker/common.js)
export const APP_DEFAULTS = {
  siteUrl: "",
  trackRef: "wa",
  welcomeAccountId: "",
  notify: { enabled: false, botToken: "", chatId: "", registrations: true, workerDown: true, accountIssues: true, funnel: true, daily: true, dailyAt: "23:00", replies: true },
  system: { repo: "", branch: "main" },
  wa: { autoJoin: false, includeUnchecked: false, dailyJoinLimit: 10, allAccounts: true, postUnlimited: false, warmupDays: 14, muteGroups: false, autoClean: false, hourLimit: 40, groupGapHours: 0, autoStop: true, stopAfterFails: 6, pauseHours: 3, minMembers: 20, spamFilter: true, smartSpread: true, typingSeconds: 5, mentionAll: false, replyAlerts: true, autoCategory: true, riskThrottle: true, harvestLinks: true },
  tg: {
    apiId: "",
    apiHash: "",
    dailyLimit: 15,
    delay: 60,
    scanLimit: 3000,
    joinPublic: true,
    autoCheck: true,
    muteAll: false,
    keywords: [],
    blacklist: [],
    categories: [],
  },
};

export function mergeApp(data) {
  const d = data || {};
  const out = { ...APP_DEFAULTS, ...d };
  for (const k of ["notify", "wa", "tg", "system"]) out[k] = { ...APP_DEFAULTS[k], ...(d[k] || {}) };
  return out;
}

// إعدادات كل حساب واتساب
export const WA_DEFAULTS = {
  minDelay: 40,
  maxDelay: 100,
  dailyLimit: 150,
  joinMinDelay: 90,
  joinMaxDelay: 180,
  joinDailyLimit: 0,
  quietStart: 1,
  quietEnd: 8,
  warmup: false,
};

export const waSettingsOf = (a) => ({ ...WA_DEFAULTS, ...(a?.settings || {}) });
