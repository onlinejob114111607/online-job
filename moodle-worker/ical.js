// ============================================================
//  رابط تقويم المودل (iCal) — للجامعات اللي دخولها عن طريق Microsoft/Google
//  الطالب بيجيبه من: التقويم ← استيراد أو تصدير التقويمات ← تصدير ← "الحصول على رابط التقويم"
// ============================================================
import { MoodleError } from './moodle.js'
import { request, isCloudflareBlock } from './http.js'

export function checkIcalUrl(url) {
  let u
  try {
    u = new URL(String(url).trim())
  } catch {
    throw new MoodleError('bad_url', 'رابط التقويم مش صحيح')
  }
  if (!/export_execute\.php$/i.test(u.pathname) || !u.searchParams.get('authtoken')) {
    throw new MoodleError('bad_url', 'هاد مش رابط تقويم مودل — لازم يكون فيه export_execute.php و authtoken')
  }
  // بنطلب كل الأحداث للفترة الجاية بدل الافتراضي
  if (!u.searchParams.get('preset_what')) u.searchParams.set('preset_what', 'all')
  u.searchParams.set('preset_time', 'recentupcoming')
  return u.toString()
}

// فك الأسطر المطوية (RFC 5545) وتقسيم الأحداث
export function parseIcal(text) {
  const lines = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const events = []
  let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {}
    else if (line === 'END:VEVENT') {
      if (cur) events.push(cur)
      cur = null
    } else if (cur) {
      const i = line.indexOf(':')
      if (i < 0) continue
      const [name, ...params] = line.slice(0, i).split(';')
      const value = line
        .slice(i + 1)
        .replace(/\\n/gi, '\n')
        .replace(/\\([,;\\])/g, '$1')
      cur[name.toUpperCase()] = { value, params: params.join(';') }
    }
  }
  return events
}

// 20261124T215900Z أو 20261124
export function icalDate(v) {
  if (!v) return null
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v.value || v)
  if (!m) return null
  const [, y, mo, d, h = '23', mi = '59', s = '00', z] = m
  return z || !m[4] ? Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) : new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime()
}

function guessKind(ev) {
  const t = `${ev.SUMMARY?.value || ''} ${ev.DESCRIPTION?.value || ''}`
  const comp = ev['X-MOODLE-COMPONENT']?.value || ''
  const m = /^mod_(\w+)/.exec(comp)
  if (m) return m[1]
  if (/quiz|اختبار|امتحان|كويز/i.test(t)) return 'quiz'
  if (/assign|واجب|تكليف|تسليم|due|يستحق|مستحق/i.test(t)) return 'assign'
  if (/forum|منتدى|نقاش/i.test(t)) return 'forum'
  if (/workshop|مشروع|ورشة/i.test(t)) return 'workshop'
  return 'event'
}

export async function fetchIcal(url) {
  let r
  try {
    r = await request(checkIcalUrl(url), { headers: { 'User-Agent': 'MoodleMobile', Accept: 'text/calendar,*/*' } })
  } catch (e) {
    throw new MoodleError('network', `ما قدرت أفتح رابط التقويم: ${e.message}`)
  }
  if (isCloudflareBlock(r)) throw new MoodleError('blocked', `حماية Cloudflare بموقع الجامعة رفضت الطلب (HTTP ${r.status}) — تأكد إنه curl مثبّت: pkg install curl`)
  const text = r.text
  if (!/BEGIN:VCALENDAR/.test(text)) {
    if (r.status >= 500 || r.status === 0) throw new MoodleError('network', `موقع الجامعة فيه مشكلة هلأ (HTTP ${r.status}) — رح نحاول كمان شوي`)
    throw new MoodleError('invalidtoken', `رابط التقويم ما رجّع تقويم (HTTP ${r.status}) — ممكن انتهى، خلّي الطالب يطلع رابط جديد`)
  }

  const base = new URL(url).origin
  const items = parseIcal(text).map((ev) => {
    const uid = (ev.UID?.value || '').replace(/[^\w.@-]/g, '')
    const title = (ev.SUMMARY?.value || '').replace(/\s+(is due|is closing|closes|opens|ends|يستحق|مستحق|مستحقة|يغلق|يُغلق|يفتح|يُفتح|ينتهي|يبدأ|تغلق|تفتح).*$/i, '').trim() || ev.SUMMARY?.value
    return {
      key: `ical-${uid}`,
      kind: guessKind(ev),
      title,
      course: ev.CATEGORIES?.value || '',
      url: `${base}/calendar/view.php?view=upcoming`,
      due: icalDate(ev.DTSTART), // مودل بيحط موعد التسليم بـ DTSTART
      submitted: null,
    }
  })
  return { items: items.filter((it) => it.title && it.key !== 'ical-') }
}
