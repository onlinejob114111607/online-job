// ============================================================
//  الدخول المباشر على المودل (بدون خدمات الويب) وقراءة الصفحات
//  للجامعات اللي مسكّرة token.php بس صفحة الدخول شغالة (مثل جامعة الأقصى)
//  - بيسجّل دخول بالرقم وكلمة السر (نفس فورم المتصفح)
//  - بياخد رابط تصدير التقويم لحاله → قائمة المهام ومواعيدها
//  - بيقرأ حالة التسليم والعلامة من صفحة كل واجب/اختبار
// ============================================================
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request, hasCurlNow } from './http.js'
import { MoodleError } from './moodle.js'
import { fetchIcal } from './ical.js'

const UA = 'MoodleMobile'

const pick = (re, html) => {
  const m = re.exec(html)
  return m ? m[1] : null
}
// قيمة input مخفي بالاسم المعطى (ترتيب السمات غير مهم)
function hidden(html, name) {
  const re = new RegExp(`<input[^>]*\\bname=["']${name}["'][^>]*>`, 'i')
  const tag = pick(new RegExp(re.source, 'i'), html)
  if (!tag) {
    // بعض القوالب بتحط value قبل name
    const re2 = new RegExp(`<input[^>]*\\bvalue=["']([^"']*)["'][^>]*\\bname=["']${name}["']`, 'i')
    return pick(re2, html)
  }
  return pick(/\bvalue=["']([^"']*)["']/i, tag) || ''
}

// بيرجع مجلد فيه ملف كوكيز للجلسة — لازم ينمسح بعد الاستعمال
export function newJar() {
  const dir = mkdtempSync(join(tmpdir(), 'mdl-'))
  const path = join(dir, 'cj')
  return { path, dispose: () => rmSync(dir, { recursive: true, force: true }) }
}

async function get(url, jar) {
  return request(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, cookieJar: jar, timeout: 35_000 })
}
async function post(url, form, jar) {
  const body = new URLSearchParams(form).toString()
  return request(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body, cookieJar: jar, timeout: 35_000 })
}

// تسجيل الدخول. بيرجع { sesskey }. كلمة السر بتنستعمل هون بس.
export async function webLogin(base, username, password, jar) {
  if (!hasCurlNow()) throw new MoodleError('no_curl', 'الدخول المباشر بدّه curl — ثبّته على الجوال: pkg install curl')
  const page = await get(`${base}/login/index.php`, jar)
  if (page.status >= 500) throw new MoodleError('network', `موقع المودل فيه مشكلة هلأ (HTTP ${page.status})`)
  const token = hidden(page.text, 'logintoken') || ''
  const r = await post(`${base}/login/index.php`, { username, password, logintoken: token, anchor: '' }, jar)
  // نجاح الدخول: صفحة فيها sesskey ومش صفحة الدخول
  let sesskey = pick(/"sesskey":"(\w+)"/, r.text) || pick(/sesskey=(\w+)/, r.text)
  if (!sesskey) {
    const my = await get(`${base}/my/`, jar)
    sesskey = pick(/"sesskey":"(\w+)"/, my.text) || pick(/sesskey=(\w+)/, my.text)
    if (!sesskey) {
      if (/loginerrors|invalidlogin|error\/|اسم المستخدم|كلمة المرور غير صحيحة|Invalid login/i.test(r.text + my.text) || /login\/index\.php/.test(my.text))
        throw new MoodleError('invalidlogin', 'الرقم الجامعي أو كلمة السر غلط')
      throw new MoodleError('login_failed', 'فشل تسجيل الدخول على المودل (ما لقيت الجلسة)')
    }
  }
  return { sesskey }
}

// رابط تصدير التقويم (authtoken) من صفحة التصدير وإحنا مسجّلين دخول
export async function discoverCalendarUrl(base, sesskey, jar) {
  const page = await get(`${base}/calendar/export.php`, jar)
  const sk = hidden(page.text, 'sesskey') || sesskey
  // بنختار: كل الأحداث + الأيام الأخيرة والقادمة، ونطلب توليد الرابط
  const forms = { 'events[exportevents]': 'all', 'period[timeperiod]': 'recentupcoming', sesskey: sk, _qf__core_calendar_export_form: '1', generateurl: 'إنشاء رابط التقويم' }
  let r = await post(`${base}/calendar/export.php`, forms, jar)
  let url = pick(/(https?:\/\/[^\s"'<>]*calendar\/export_execute\.php\?[^\s"'<>]*authtoken=[^\s"'<>]+)/i, r.text)
  if (url) return url.replace(/&amp;/g, '&')
  // بعض النسخ بتستعمل أسماء حقول مختلفة
  const forms2 = { preset_what: 'all', preset_time: 'recentupcoming', sesskey: sk, generateurl: '1' }
  r = await post(`${base}/calendar/export.php`, forms2, jar)
  url = pick(/(https?:\/\/[^\s"'<>]*calendar\/export_execute\.php\?[^\s"'<>]*authtoken=[^\s"'<>]+)/i, r.text)
  return url ? url.replace(/&amp;/g, '&') : null
}

// ---------- قراءة حالة التسليم ----------
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

// صف جدول عنوانه يطابق re → نص الخلية المجاورة
function tableValue(html, re) {
  // <th...>عنوان</th><td...>قيمة</td>  (أو العكس بالعربي)
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) || []
  for (const row of rows) {
    if (re.test(stripTags(row))) {
      const cells = row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []
      if (cells.length >= 2) {
        // الخلية اللي ما فيها العنوان
        const labelIdx = cells.findIndex((c) => re.test(stripTags(c)))
        const valCell = cells[labelIdx === 0 ? 1 : 0]
        return { text: stripTags(valCell), html: valCell }
      }
    }
  }
  return null
}

const SUBMITTED_RE = /submissionstatussubmitted|تم التسليم|تم التقديم|تم الإرسال|Submitted for grading|تم تقديمه/i
const NOTSUB_RE = /submissionstatus0|submission_not|لم يتم|لم تقم|No attempt|Not submitted|لم يُسلّم/i

export function parseAssign(html) {
  const out = { submitted: null, grade: null }
  const status = tableValue(html, /حالة التسليم|Submission status|حالة الإرسال/)
  const blob = status ? status.html : html
  if (SUBMITTED_RE.test(blob)) out.submitted = true
  else if (NOTSUB_RE.test(blob)) out.submitted = false
  const grade = tableValue(html, /العلامة|الدرجة|درجة الإرسال|Grade/)
  if (grade && /\d/.test(grade.text)) out.grade = grade.text.slice(0, 40)
  return out
}

export function parseQuiz(html) {
  const out = { submitted: null, grade: null }
  // جدول المحاولات: صف فيه "منتهية/Finished" → في محاولة مكتملة
  if (/الحالة|State|محاولة/i.test(html)) {
    if (/منتهية|Finished|تم الإرسال/i.test(html)) out.submitted = true
    else if (/لم تقم بأي محاولة|No attempt|لم تُجرِ/i.test(html)) out.submitted = false
  }
  const grade = tableValue(html, /العلامة النهائية|Final grade|درجتك|Your grade/)
  if (grade && /\d/.test(grade.text)) out.grade = grade.text.slice(0, 40)
  return out
}

// بيقرأ صفحة نشاط ويحدّث submitted/grade — بيرجع {} لو ما قدر
export async function fetchActivityStatus(base, item, jar) {
  if (!item.url || !/\/mod\/(assign|quiz)\/view\.php/.test(item.url)) return {}
  try {
    const r = await get(item.url, jar)
    if (r.status !== 200 || /login\/index\.php/.test(r.text.slice(0, 1500))) return {}
    return item.kind === 'quiz' ? parseQuiz(r.text) : parseAssign(r.text)
  } catch {
    return {}
  }
}
