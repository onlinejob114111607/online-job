// ============================================================
//  التعامل مع مودل: نفس الطريقة اللي بيستخدمها تطبيق Moodle على الموبايل
//  (login/token.php + webservice/rest/server.php)
// ============================================================

const UA = 'MoodleMobile' // بعض المواقع بتسمح للتطبيق بس
const TIMEOUT = 30_000

export class MoodleError extends Error {
  constructor(code, message) {
    super(message || code)
    this.code = code
  }
}

// رابط أي صفحة بالمودل ← رابط الموقع الأساسي
export function normalizeSite(input) {
  let s = String(input || '').trim()
  if (!s) throw new MoodleError('bad_url', 'رابط المودل فاضي')
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  let u
  try {
    u = new URL(s)
  } catch {
    throw new MoodleError('bad_url', 'رابط المودل مش صحيح')
  }
  let path = u.pathname
  const cut = path.search(/\/(login|my|course|mod|calendar|user|admin|blocks|local|auth|theme|lib|webservice|grade|message)(\/|$)|\/index\.php$/i)
  if (cut >= 0) path = path.slice(0, cut)
  path = path.replace(/\/+$/, '')
  return `${u.protocol}//${u.host}${path}`
}

async function http(url, { method = 'GET', form, json } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const headers = { 'User-Agent': UA, Accept: 'application/json' }
    let body
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(form).toString()
    } else if (json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(json)
    }
    const r = await fetch(url, { method, headers, body, signal: ctrl.signal, redirect: 'follow' })
    const text = await r.text()
    return { status: r.status, text }
  } catch (e) {
    if (e.name === 'AbortError') throw new MoodleError('timeout', 'موقع المودل ما رد (انتهى الوقت)')
    throw new MoodleError('network', `ما قدرت أوصل لموقع المودل: ${e.cause?.code || e.message}`)
  } finally {
    clearTimeout(t)
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// ---------- فحص الموقع ----------
// loginType: 'app' = بيزبط بالرقم وكلمة السر | 'browser' / 'embedded' = دخول عن طريق متصفح (Microsoft / Google...)
export async function checkSite(input) {
  const base = normalizeSite(input)
  const r = await http(`${base}/lib/ajax/service-nologin.php?info=tool_mobile_get_public_config`, {
    method: 'POST',
    json: [{ index: 0, methodname: 'tool_mobile_get_public_config', args: {} }],
  })
  const j = parseJson(r.text)
  const cfg = Array.isArray(j) && j[0] && !j[0].error ? j[0].data : null
  if (cfg) {
    const loginType = { 1: 'app', 2: 'browser', 3: 'embedded' }[cfg.typeoflogin] || 'app'
    const www = normalizeSite(cfg.httpswwwroot || cfg.wwwroot || base)
    return {
      base: www,
      siteName: cfg.sitename || '',
      loginType,
      providers: (cfg.identityproviders || []).map((p) => p.name).filter(Boolean),
      mobile: true,
    }
  }
  // نسخة قديمة أو الخدمة مسكّرة: بنجرب token.php مباشرة
  const t = await http(`${base}/login/token.php`)
  const tj = parseJson(t.text)
  if (tj && (tj.error || tj.errorcode)) {
    const off = /enablewsdescription|servicenotavailable|webservicesdisabled/i.test(tj.errorcode || '')
    return { base, siteName: '', loginType: off ? 'disabled' : 'app', providers: [], mobile: !off }
  }
  throw new MoodleError('not_moodle', 'هاد الرابط مش موقع مودل، أو الموقع مش شغال')
}

// ---------- تسجيل الدخول: كلمة السر بتنستعمل هون بس وما بتنحفظ ----------
const LOGIN_ERRORS = {
  invalidlogin: 'الرقم الجامعي أو كلمة السر غلط',
  enablewsdescription: 'الجامعة مسكّرة خدمة تطبيق الموبايل — استعمل رابط التقويم بدلها',
  servicenotavailable: 'الجامعة مسكّرة خدمة تطبيق الموبايل — استعمل رابط التقويم بدلها',
  sitepolicynotagreed: 'لازم الطالب يدخل المودل مرة ويوافق على سياسة الموقع',
  usernotconfirmed: 'حساب الطالب مش مفعّل',
  forcepasswordchangenotice: 'الجامعة طالبة من الطالب يغيّر كلمة السر — خليه يدخل ويغيّرها أول',
  restoredaccountresetpassword: 'لازم الطالب يعيد تعيين كلمة السر',
}

export async function getToken(base, username, password) {
  const r = await http(`${base}/login/token.php`, {
    method: 'POST',
    form: { username, password, service: 'moodle_mobile_app' },
  })
  const j = parseJson(r.text)
  if (!j) throw new MoodleError('bad_response', `رد غريب من المودل (HTTP ${r.status})`)
  if (j.token) return j.token
  const code = j.errorcode || 'login_failed'
  throw new MoodleError(code, LOGIN_ERRORS[code] || j.error || 'فشل تسجيل الدخول')
}

// ---------- استدعاء دوال المودل ----------
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v === undefined || v === null) continue
    if (typeof v === 'object') flatten(v, key, out)
    else out[key] = typeof v === 'boolean' ? (v ? 1 : 0) : v
  }
  return out
}

const TOKEN_ERRORS = /invalidtoken|accessexception.*token|invalidsesskey/i

export async function ws(base, token, fn, params = {}) {
  const r = await http(`${base}/webservice/rest/server.php?moodlewsrestformat=json&wsfunction=${fn}`, {
    method: 'POST',
    form: { wstoken: token, wsfunction: fn, moodlewsrestformat: 'json', ...flatten(params) },
  })
  const j = parseJson(r.text)
  if (j === undefined) throw new MoodleError('bad_response', `رد غريب من المودل على ${fn} (HTTP ${r.status})`)
  if (j && typeof j === 'object' && j.exception) {
    if (TOKEN_ERRORS.test(j.errorcode || '')) throw new MoodleError('invalidtoken', 'الربط انتهى — بدها إعادة ربط بكلمة السر')
    throw new MoodleError(j.errorcode || 'ws_error', `${fn}: ${j.message || j.errorcode}`)
  }
  return j
}

// ---------- سحب كل شي بخص الطالب ----------
// أنواع الأنشطة اللي إلها موعد أو بدها شغل
export const TASK_KINDS = new Set(['assign', 'quiz', 'workshop', 'lesson', 'forum', 'h5pactivity', 'choice', 'feedback', 'scorm', 'data', 'glossary', 'lti', 'survey', 'questionnaire', 'attendance', 'bigbluebuttonbn', 'zoom'])
const SKIP_KINDS = new Set(['label', 'subsection', 'qbank'])

const sec = (n) => (Number(n) > 0 ? Number(n) * 1000 : null)
const cmidFromUrl = (url) => {
  const m = /[?&]id=(\d+)/.exec(String(url || ''))
  return m ? Number(m[1]) : null
}

// بيرجع { user, courses, items: [{ key, kind, title, course, courseId, url, due, opens, cutoff, submitted }] }
export async function fetchStudent(base, token, { log = () => {} } = {}) {
  const info = await ws(base, token, 'core_webservice_get_site_info')
  const has = new Set((info.functions || []).map((f) => f.name))
  const can = (fn) => !has.size || has.has(fn)
  const now = Date.now()

  const allCourses = await ws(base, token, 'core_enrol_get_users_courses', { userid: info.userid })
  // المواد الحالية بس: مش مخفية ومش منتهية من أكتر من شهر
  const courses = (allCourses || []).filter((c) => c.visible !== 0 && !(c.enddate && c.enddate * 1000 < now - 30 * 86400_000))
  const courseIds = courses.map((c) => c.id)
  const courseName = new Map(courses.map((c) => [c.id, c.fullname || c.shortname]))

  const items = new Map() // key -> item
  const put = (key, patch) => {
    const old = items.get(key) || { key, submitted: null }
    for (const [k, v] of Object.entries(patch)) if (v !== undefined && v !== null && v !== '') old[k] = v
    items.set(key, old)
  }

  // 1) محتوى كل مادة: كل نشاط أو ملف جديد
  if (can('core_course_get_contents')) {
    for (const c of courses) {
      try {
        const sections = await ws(base, token, 'core_course_get_contents', { courseid: c.id, options: [{ name: 'excludecontents', value: 1 }] })
        for (const s of sections || []) {
          for (const m of s.modules || []) {
            if (SKIP_KINDS.has(m.modname) || m.uservisible === false || m.visible === 0) continue
            const dates = Object.fromEntries((m.dates || []).map((d) => [d.dataid, sec(d.timestamp)]))
            put(`${m.modname}-${m.id}`, {
              kind: m.modname,
              title: m.name,
              course: courseName.get(c.id),
              courseId: c.id,
              url: m.url || `${base}/mod/${m.modname}/view.php?id=${m.id}`,
              due: dates.duedate || dates.timeclose || dates.timedue || dates.deadline || dates.submissionend || dates.cutoffdate || null,
              opens: dates.allowsubmissionsfromdate || dates.timeopen || dates.timeavailablefrom || dates.submissionstart || null,
              section: s.name,
            })
          }
        }
      } catch (e) {
        if (e.code === 'invalidtoken') throw e
        log(`محتوى المادة ${c.id}: ${e.message}`)
      }
    }
  }

  // 2) الواجبات بمواعيدها الدقيقة
  const assignIds = new Map() // key -> assignid
  if (courseIds.length && can('mod_assign_get_assignments')) {
    try {
      const r = await ws(base, token, 'mod_assign_get_assignments', { courseids: courseIds })
      for (const c of r.courses || []) {
        for (const a of c.assignments || []) {
          const key = `assign-${a.cmid}`
          put(key, {
            kind: 'assign',
            title: a.name,
            course: courseName.get(c.id) || c.fullname,
            courseId: c.id,
            url: `${base}/mod/assign/view.php?id=${a.cmid}`,
            due: sec(a.duedate),
            cutoff: sec(a.cutoffdate),
            opens: sec(a.allowsubmissionsfromdate),
          })
          assignIds.set(key, a.id)
        }
      }
    } catch (e) {
      if (e.code === 'invalidtoken') throw e
      log(`الواجبات: ${e.message}`)
    }
  }

  // 3) الاختبارات بمواعيدها
  const quizIds = new Map()
  if (courseIds.length && can('mod_quiz_get_quizzes_by_courses')) {
    try {
      const r = await ws(base, token, 'mod_quiz_get_quizzes_by_courses', { courseids: courseIds })
      for (const q of r.quizzes || []) {
        const key = `quiz-${q.coursemodule}`
        put(key, {
          kind: 'quiz',
          title: q.name,
          course: courseName.get(q.course),
          courseId: q.course,
          url: `${base}/mod/quiz/view.php?id=${q.coursemodule}`,
          due: sec(q.timeclose),
          opens: sec(q.timeopen),
          timeLimitMin: q.timelimit ? Math.round(q.timelimit / 60) : null,
        })
        quizIds.set(key, q.id)
      }
    } catch (e) {
      if (e.code === 'invalidtoken') throw e
      log(`الاختبارات: ${e.message}`)
    }
  }

  // 4) تقويم المودل (المواعيد القادمة لكل الأنشطة)
  if (can('core_calendar_get_action_events_by_timesort')) {
    try {
      const r = await ws(base, token, 'core_calendar_get_action_events_by_timesort', { timesortfrom: Math.floor(now / 1000) - 3 * 86400, limitnum: 100 })
      for (const ev of r.events || []) {
        if (!ev.modulename) continue
        const cmid = cmidFromUrl(ev.url) || ev.instance
        const key = `${ev.modulename}-${cmid}`
        const old = items.get(key)
        put(key, {
          kind: ev.modulename,
          title: old?.title || ev.activityname || ev.name,
          course: old?.course || ev.course?.fullname,
          courseId: old?.courseId || ev.course?.id,
          url: ev.url,
          due: old?.due || sec(ev.timesort),
        })
        if (ev.action && ev.action.actionable === false && ev.modulename !== 'quiz') put(key, { submitted: true })
      }
    } catch (e) {
      if (e.code === 'invalidtoken') throw e
      log(`التقويم: ${e.message}`)
    }
  }

  // 5) هل سلّم؟ (بس للي موعدها قريب أو فات من قريب — عشان ما نكثّر طلبات)
  const near = (it) => it.due && it.due > now - 7 * 86400_000 && it.due < now + 60 * 86400_000
  if (can('mod_assign_get_submission_status')) {
    for (const [key, id] of assignIds) {
      const it = items.get(key)
      if (!near(it)) continue
      try {
        const s = await ws(base, token, 'mod_assign_get_submission_status', { assignid: id })
        const sub = s.lastattempt?.submission || s.lastattempt?.teamsubmission
        it.submitted = sub ? sub.status === 'submitted' : false
        if (s.feedback?.gradefordisplay) it.grade = String(s.feedback.gradefordisplay).replace(/<[^>]+>/g, '').trim()
      } catch (e) {
        if (e.code === 'invalidtoken') throw e
      }
    }
  }
  if (can('mod_quiz_get_user_attempts')) {
    for (const [key, id] of quizIds) {
      const it = items.get(key)
      if (!near(it)) continue
      try {
        const s = await ws(base, token, 'mod_quiz_get_user_attempts', { quizid: id, status: 'finished' })
        it.submitted = (s.attempts || []).length > 0
      } catch (e) {
        if (e.code === 'invalidtoken') throw e
      }
    }
  }

  return {
    user: { id: info.userid, fullname: info.fullname, siteName: info.sitename },
    courses: courses.map((c) => ({ id: c.id, name: c.fullname || c.shortname })),
    items: [...items.values()].filter((it) => it.title),
  }
}
