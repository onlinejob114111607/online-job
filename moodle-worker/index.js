// ============================================================
//  عامل متابعة المودل
//  - بيستقبل أوامر اللوحة (ربط طالب، فحص موقع، مزامنة، حذف)
//  - كل ساعة بيسحب الواجبات والاختبارات والأنشطة لكل طالب
//  - بيبعت تنبيه تيليجرام لكل إشي جديد + تذكير قبل الموعد بـ 3 أيام / يوم / 3 ساعات
//  كلمات السر ما بتنحفظ أبداً: بتنستعمل مرة لأخذ التوكن، والتوكن محفوظ على هالجوال بس (data/secrets.json)
// ============================================================
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { createStore, Timestamp } from './supadocs.js'
import { loadOrCreateKeys, decryptBox } from './crypto.js'
import { checkSite, getToken, fetchStudent, MoodleError, TASK_KINDS } from './moodle.js'
import { fetchIcal, checkIcalUrl } from './ical.js'
import { createNotifier, makeFormat, kindLabel } from './notify.js'
import { transport } from './http.js'

const VERSION = '1.1.0'
const DIR = dirname(fileURLToPath(import.meta.url))
const DATA = join(DIR, 'data')

// ---------- الإعدادات ----------
if (existsSync(join(DIR, '.env'))) {
  for (const line of readFileSync(join(DIR, '.env'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const env = process.env
const CFG = {
  url: env.SUPABASE_URL,
  key: env.SUPABASE_KEY,
  email: env.ADMIN_EMAIL,
  password: env.ADMIN_PASSWORD,
  syncMin: Math.max(15, Number(env.SYNC_MINUTES) || 60),
  digestHour: env.DIGEST_HOUR === '' || env.DIGEST_HOUR === undefined ? 8 : Number(env.DIGEST_HOUR),
  tz: env.TIMEZONE || 'Asia/Gaza',
}
if (!CFG.url || !CFG.key) {
  console.error('❌ لازم تعبّي SUPABASE_URL و SUPABASE_KEY بملف .env (شوف .env.example)')
  process.exit(1)
}

const log = (...a) => console.log(new Date().toLocaleTimeString('en-GB', { timeZone: CFG.tz }), ...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- الأسرار المحلية (التوكنات وروابط التقويم) ----------
mkdirSync(DATA, { recursive: true })
const SECRETS = join(DATA, 'secrets.json')
const secrets = existsSync(SECRETS) ? JSON.parse(readFileSync(SECRETS, 'utf8')) : {}
function saveSecrets() {
  writeFileSync(SECRETS + '.tmp', JSON.stringify(secrets, null, 1), { mode: 0o600 })
  renameSync(SECRETS + '.tmp', SECRETS)
}
const keys = loadOrCreateKeys(join(DATA, 'key.pem'))

// ---------- قاعدة البيانات ----------
const supabase = createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: true } })
if (CFG.email && CFG.password) {
  const { error } = await supabase.auth.signInWithPassword({ email: CFG.email, password: CFG.password })
  if (error) {
    console.error('❌ فشل الدخول لحساب الأدمن:', error.message)
    process.exit(1)
  }
}
const db = createStore(supabase)
const now = () => ({ __ts: Date.now() })
const STUDENTS = 'moodle_students'
const ITEMS = 'moodle_items'
const itemId = (sid, key) => `${sid}__${key}`.replace(/[\/\s#?]/g, '_').slice(0, 200)

const tg = createNotifier({ token: env.TG_BOT_TOKEN, chatId: env.TG_CHAT_ID, log })
const F = makeFormat(CFG.tz)
const toMs = (v) => (v?.toMillis ? v.toMillis() : typeof v === 'number' ? v : v?.__ts || 0)

async function heartbeat(extra = {}) {
  await db.write([
    {
      t: 'merge',
      col: 'workers',
      id: 'moodle',
      data: { state: 'running', lastSeen: now(), version: VERSION, publicKey: keys.publicSpki, telegram: tg.enabled, syncMinutes: CFG.syncMin, ...extra },
    },
  ])
}

const setStudent = (id, data) => db.write([{ t: 'merge', col: STUDENTS, id, data }])

// ============================================================
//  المزامنة لطالب واحد
// ============================================================
const running = new Set()

async function syncStudent(st, { reason = 'دوري' } = {}) {
  if (running.has(st.id)) return
  running.add(st.id)
  try {
    const sec = secrets[st.id]
    if (!sec) {
      if (st.data.status !== 'pending' && st.data.status !== 'relink') {
        await setStudent(st.id, { status: 'relink', statusMsg: 'ما في ربط محفوظ على جوال العامل — اربطه من جديد' })
      }
      return
    }
    let res
    try {
      res = sec.ical ? await fetchIcal(sec.ical) : await fetchStudent(sec.base, sec.token, { log: (m) => log(`  ${st.data.name}: ${m}`) })
    } catch (e) {
      if (e instanceof MoodleError && e.code === 'invalidtoken') {
        if (st.data.status !== 'relink') {
          await setStudent(st.id, { status: 'relink', statusMsg: e.message, lastError: now() })
          await tg.send(`🔴 <b>${st.data.name}</b>: ${e.message}`)
        }
        return
      }
      await setStudent(st.id, { status: 'error', statusMsg: e.message, lastError: now() })
      log(`❌ ${st.data.name}: ${e.message}`)
      return
    }

    const first = !st.data.baselineAt
    const existing = new Map((await db.query(ITEMS, { filters: [['studentId', '==', st.id]] })).map((r) => [r.id, r.data]))
    const ops = []
    const fresh = []
    const t = Date.now()
    const seen = new Set()

    for (const it of res.items) {
      const id = itemId(st.id, it.key)
      seen.add(id)
      const old = existing.get(id)
      const base = {
        studentId: st.id,
        student: st.data.name,
        key: it.key,
        kind: it.kind,
        title: it.title,
        course: it.course || '',
        url: it.url || '',
        due: it.due ? { __ts: it.due } : null,
        opens: it.opens ? { __ts: it.opens } : null,
        cutoff: it.cutoff ? { __ts: it.cutoff } : null,
        submitted: it.submitted ?? null,
        grade: it.grade || null,
        timeLimitMin: it.timeLimitMin || null,
        task: TASK_KINDS.has(it.kind) || !!it.due,
        gone: false,
        lastSeen: { __ts: t },
      }
      if (!old) {
        // التذكيرات اللي وقتها فات وقت الاكتشاف بتنحسب مبعوتة (التنبيه الجديد بيغطيها)
        const sent = { new: true }
        for (const [k, h] of REMINDERS) if (it.due && it.due - t <= h * 3600_000) sent[k] = true
        ops.push({ t: 'set', col: ITEMS, id, data: { ...base, firstSeen: { __ts: t }, done: false, sent } })
        if (!first && !(it.due && it.due < t)) fresh.push({ ...base, due: it.due })
        continue
      }
      const oldDue = toMs(old.due)
      const changed = Math.abs((it.due || 0) - oldDue) > 60_000
      const patch = {}
      for (const k of ['title', 'course', 'url', 'kind', 'grade', 'timeLimitMin']) if ((base[k] ?? null) !== (old[k] ?? null)) patch[k] = base[k]
      if (base.submitted !== null && base.submitted !== old.submitted) patch.submitted = base.submitted
      if (old.gone) patch.gone = false
      if (changed) {
        patch.due = base.due
        // موعد جديد ← بنرجّع التذكيرات اللي لسا وقتها ما إجا
        const sent = { ...(old.sent || {}) }
        for (const [k, h] of REMINDERS) sent[k] = !!(it.due && it.due - t <= h * 3600_000)
        patch.sent = sent
        if (it.due && it.due > t && !old.done) {
          await tg.send(`🔁 <b>تغيّر الموعد</b>\n${F.line({ ...base, due: it.due })}\nكان: ${F.date(oldDue)}`, it.url)
        }
      }
      // بنحدّث "آخر ظهور" مرة كل يوم بس عشان ما نكثّر كتابة
      if (Object.keys(patch).length || t - toMs(old.lastSeen) > 86400_000) ops.push({ t: 'update', col: ITEMS, id, data: { ...patch, lastSeen: { __ts: t } } })
    }

    // اللي اختفى من المودل (انحذف أو انخفى) — وبنمسح القديم كتير
    for (const [id, old] of existing) {
      if (seen.has(id)) continue
      const due = toMs(old.due)
      if (t - toMs(old.lastSeen) > 45 * 86400_000 || (due && t - due > 45 * 86400_000)) ops.push({ t: 'delete', col: ITEMS, id })
      else if (!old.gone) ops.push({ t: 'update', col: ITEMS, id, data: { gone: true } })
    }

    for (let i = 0; i < ops.length; i += 300) await db.write(ops.slice(i, i + 300))

    const upcoming = res.items.filter((it) => it.due && it.due > t && !it.submitted && (TASK_KINDS.has(it.kind) || it.kind === 'event')).length
    await setStudent(st.id, {
      status: 'ok',
      statusMsg: null,
      lastSync: now(),
      ...(first ? { baselineAt: now() } : {}),
      ...(res.user ? { fullname: res.user.fullname, siteName: res.user.siteName } : {}),
      ...(res.courses ? { courses: res.courses.map((c) => c.name).slice(0, 40), coursesCount: res.courses.length } : {}),
      itemsCount: res.items.length,
      upcoming,
    })

    if (first) {
      await tg.send(`🟢 <b>تم ربط ${st.data.name}</b>${res.courses ? `\nالمواد: ${res.courses.length}` : ''}\nمهام قادمة: ${upcoming}\nمن هلأ رح يوصلك تنبيه بكل إشي جديد.`)
    } else {
      for (const it of fresh.sort((a, b) => (a.due || Infinity) - (b.due || Infinity))) {
        const head = it.task ? `🆕 <b>${kindLabel(it.kind)} جديد</b>` : `🆕 <b>${kindLabel(it.kind)} جديد بالمادة</b>`
        await tg.send(`${head}\n${F.line(it)}`, it.url)
      }
    }
    log(`✓ ${st.data.name} (${reason}): ${res.items.length} عنصر، ${fresh.length} جديد`)
  } finally {
    running.delete(st.id)
  }
}

// ============================================================
//  التذكيرات (بتشتغل كل 5 دقايق من البيانات المحفوظة)
// ============================================================
const REMINDERS = [
  ['d3', 72],
  ['d1', 24],
  ['h3', 3],
]
const REMINDER_HEAD = { d3: '⏳ تذكير: باقي 3 أيام', d1: '⚠️ تذكير: باقي يوم', h3: '🚨 باقي أقل من 3 ساعات!' }

async function reminders() {
  const t = Date.now()
  const rows = await db.query(ITEMS, {
    filters: [
      ['task', '==', true],
      ['due', '>', Timestamp.fromMillis(t)],
    ],
  })
  for (const { id, data: it } of rows) {
    if (it.done || it.submitted || it.gone) continue
    const due = toMs(it.due)
    const sent = { ...(it.sent || {}) }
    let fire = null
    for (const [k, h] of REMINDERS) if (!sent[k] && due - t <= h * 3600_000) ((sent[k] = true), (fire = k))
    if (!fire) continue
    await db.write([{ t: 'update', col: ITEMS, id, data: { sent } }])
    await tg.send(`${REMINDER_HEAD[fire]}\n${F.line({ ...it, due })}`, it.url)
  }
}

// ملخص الصبح: كل اللي مستحق خلال 7 أيام
let lastDigest = ''
async function digest() {
  if (!(CFG.digestHour >= 0 && CFG.digestHour <= 23)) return
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: CFG.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]))
  const day = `${parts.year}-${parts.month}-${parts.day}`
  if (Number(parts.hour) !== CFG.digestHour || lastDigest === day) return
  lastDigest = day
  const t = Date.now()
  const rows = (await db.query(ITEMS, { filters: [['task', '==', true], ['due', '>', Timestamp.fromMillis(t)]] }))
    .map((r) => ({ ...r.data, due: toMs(r.data.due) }))
    .filter((it) => !it.done && !it.submitted && !it.gone && it.due < t + 7 * 86400_000)
    .sort((a, b) => a.due - b.due)
  if (!rows.length) return tg.send('☀️ صباح الخير — ما في ولا مهمة مستحقة هالأسبوع 🎉')
  const text = rows.map((it, i) => `${i + 1}. ${F.line(it)}`).join('\n\n')
  await tg.send(`☀️ <b>ملخص الأسبوع — ${rows.length} مهمة</b>\n\n${text}`)
}

// ============================================================
//  أوامر اللوحة
// ============================================================
const handlers = {
  async moodle_check_site(c) {
    if (c.ical) return { ok: true, ical: !!checkIcalUrl(c.ical) }
    return await checkSite(c.url)
  },

  async moodle_link(c) {
    const st = await db.getDoc(STUDENTS, c.studentId)
    if (!st) throw new Error('الطالب مش موجود')
    const secret = decryptBox(c.box, keys.privateKey)
    try {
      if (secret.ical) {
        const url = checkIcalUrl(secret.ical)
        const r = await fetchIcal(url)
        secrets[st.id] = { ical: url, linkedAt: Date.now() }
        saveSecrets()
        await setStudent(st.id, { status: 'ok', mode: 'ical', statusMsg: null, linkedAt: now(), base: new URL(url).origin })
        syncStudent({ id: st.id, data: { ...st.data, status: 'ok' } }, { reason: 'ربط' }).catch((e) => log('sync', e.message))
        return { items: r.items.length }
      }
      const site = await checkSite(st.data.site)
      if (site.loginType === 'disabled') throw new MoodleError('disabled', 'الجامعة مسكّرة خدمة تطبيق الموبايل — استعمل رابط التقويم بدل كلمة السر')
      if (site.loginType !== 'app')
        throw new MoodleError('sso', `دخول هالجامعة عن طريق ${site.providers.join(' / ') || 'المتصفح'} — كلمة السر ما بتزبط هون، استعمل رابط التقويم`)
      const token = await getToken(site.base, String(st.data.studentNo).trim(), secret.password)
      secrets[st.id] = { base: site.base, token, linkedAt: Date.now() }
      saveSecrets()
      await setStudent(st.id, { status: 'ok', mode: 'password', base: site.base, siteName: site.siteName, statusMsg: null, linkedAt: now() })
      syncStudent({ id: st.id, data: { ...st.data, status: 'ok' } }, { reason: 'ربط' }).catch((e) => log('sync', e.message))
      return { siteName: site.siteName }
    } catch (e) {
      await setStudent(st.id, { status: e.code === 'sso' || e.code === 'disabled' ? 'sso' : 'error', statusMsg: e.message })
      throw e
    } finally {
      secret.password = secret.ical = undefined
    }
  },

  async moodle_sync(c) {
    // كل الطلاب ← بالخلفية عشان ما توقف باقي الأوامر
    if (!c.studentId) {
      fullCycle().catch((e) => log(`⚠️ sync: ${e.message}`))
      return { started: true }
    }
    const st = await db.getDoc(STUDENTS, c.studentId)
    if (!st) throw new Error('الطالب مش موجود')
    await syncStudent(st, { reason: 'يدوي' })
    const after = await db.getDoc(STUDENTS, c.studentId)
    if (after?.data.status !== 'ok') throw new Error(after?.data.statusMsg || 'فشلت المزامنة')
    return { items: after.data.itemsCount ?? null }
  },

  async moodle_delete(c) {
    delete secrets[c.studentId]
    saveSecrets()
    const items = await db.query(ITEMS, { filters: [['studentId', '==', c.studentId]] })
    const ops = items.map((r) => ({ t: 'delete', col: ITEMS, id: r.id }))
    ops.push({ t: 'delete', col: STUDENTS, id: c.studentId })
    for (let i = 0; i < ops.length; i += 300) await db.write(ops.slice(i, i + 300))
    return { deleted: items.length }
  },

  async moodle_test_tg() {
    if (!tg.enabled) throw new Error('بوت تيليجرام مش معبّى بملف .env على الجوال (TG_BOT_TOKEN و TG_CHAT_ID)')
    const ok = await tg.send('✅ تجربة: تنبيهات المودل شغالة')
    if (!ok) throw new Error('ما انبعتت — تأكد من التوكن ورقم المحادثة')
    return { ok }
  },
}

async function pollCommands() {
  const rows = await db.query('commands', { filters: [['worker', '==', 'moodle'], ['status', '==', 'new']], limit: 20 })
  for (const { id, data: c } of rows) {
    // بنحجز الأمر وبنمسح أي سر فيه فوراً
    await db.write([{ t: 'update', col: 'commands', id, data: { status: 'working', box: null, startedAt: now() } }])
    const fn = handlers[c.type]
    try {
      if (!fn) throw new Error(`أمر مش معروف: ${c.type}`)
      const result = await fn(c)
      await db.write([{ t: 'update', col: 'commands', id, data: { status: 'done', result: result ?? null, doneAt: now() } }])
    } catch (e) {
      log(`❌ أمر ${c.type}: ${e.message}`)
      await db.write([{ t: 'update', col: 'commands', id, data: { status: 'error', error: e.message, doneAt: now() } }])
    }
  }
}

// ============================================================
//  الحلقات
// ============================================================
async function fullCycle() {
  const list = await db.query(STUDENTS)
  for (const st of list) {
    if (st.data.enabled === false || st.data.status === 'pending' || st.data.status === 'sso') continue
    try {
      await syncStudent(st)
    } catch (e) {
      log(`❌ ${st.data.name}: ${e.message}`)
    }
    await sleep(2000)
  }
  // طلاب انحذفوا من اللوحة ← بنمسح أسرارهم
  const ids = new Set(list.map((s) => s.id))
  let removed = false
  for (const id of Object.keys(secrets)) if (!ids.has(id)) (delete secrets[id], (removed = true))
  if (removed) saveSecrets()
  await heartbeat({ lastCycle: now(), nextCycle: { __ts: Date.now() + CFG.syncMin * 60_000 } })
}

function loop(name, everyMs, fn) {
  const tick = async () => {
    try {
      await fn()
    } catch (e) {
      log(`⚠️ ${name}: ${e.message}`)
    }
    setTimeout(tick, everyMs)
  }
  tick()
}

log(`🎓 عامل المودل ${VERSION} — المزامنة كل ${CFG.syncMin} دقيقة، تيليجرام: ${tg.enabled ? 'شغال' : 'مش معبّى'}، الطلبات عن طريق ${transport()}`)
await heartbeat()
loop('heartbeat', 60_000, () => heartbeat())
loop('commands', 4_000, pollCommands)
loop('reminders', 5 * 60_000, async () => (await reminders(), await digest()))
loop('sync', CFG.syncMin * 60_000, fullCycle)

process.on('SIGINT', async () => {
  await heartbeat({ state: 'stopped' }).catch(() => {})
  process.exit(0)
})
