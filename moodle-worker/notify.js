// ============================================================
//  التنبيهات على تيليجرام (بوت من @BotFather)
// ============================================================

export const KIND_LABEL = {
  assign: 'واجب',
  quiz: 'اختبار',
  workshop: 'مشروع',
  lesson: 'درس',
  forum: 'نقاش',
  h5pactivity: 'نشاط',
  choice: 'تصويت',
  feedback: 'استبيان',
  questionnaire: 'استبيان',
  survey: 'استبيان',
  scorm: 'نشاط',
  data: 'نشاط',
  glossary: 'نشاط',
  lti: 'نشاط خارجي',
  attendance: 'حضور',
  bigbluebuttonbn: 'محاضرة أونلاين',
  zoom: 'محاضرة أونلاين',
  resource: 'ملف',
  folder: 'مجلد ملفات',
  url: 'رابط',
  page: 'صفحة',
  book: 'كتاب',
  event: 'موعد',
}
export const KIND_ICON = { assign: '📝', quiz: '🧪', workshop: '🛠', forum: '💬', lesson: '📖', resource: '📄', folder: '📁', url: '🔗', page: '📃', bigbluebuttonbn: '🎥', zoom: '🎥' }

export const kindLabel = (k) => KIND_LABEL[k] || 'نشاط'
const icon = (k) => KIND_ICON[k] || '📌'
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])

export function makeFormat(timeZone) {
  const fmt = new Intl.DateTimeFormat('ar', { timeZone, weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
  const date = (ms) => (ms ? fmt.format(new Date(ms)) : 'بدون موعد')
  const left = (ms) => {
    const h = (ms - Date.now()) / 3600_000
    if (h < 0) return 'فات الموعد'
    if (h < 1) return `باقي ${Math.max(1, Math.round(h * 60))} دقيقة`
    if (h < 48) return `باقي ${Math.round(h)} ساعة`
    return `باقي ${Math.round(h / 24)} يوم`
  }
  const line = (it) =>
    `${icon(it.kind)} <b>${esc(it.student)}</b> · ${esc(it.course || '')}\n${kindLabel(it.kind)}: ${esc(it.title)}` +
    (it.due ? `\n⏰ ${date(it.due)} (${left(it.due)})` : '') +
    (it.submitted ? '\n✅ مسلّم' : '')
  return { date, left, line }
}

export function createNotifier({ token, chatId, log = console.log }) {
  const enabled = !!(token && chatId)
  const queue = []
  let busy = false

  async function sendNow(text, url) {
    const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }
    if (url) body.reply_markup = { inline_keyboard: [[{ text: 'افتح بالمودل', url }]] }
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch((e) => ({ ok: false, status: 0, json: async () => ({ description: e.message }) }))
      if (r.ok) return true
      const j = await r.json().catch(() => ({}))
      if (r.status === 429) {
        await new Promise((res) => setTimeout(res, ((j.parameters?.retry_after || 3) + 1) * 1000))
        continue
      }
      // رابط مش مقبول عند تيليجرام (مثلاً http) ← بنبعت بدون زر
      if (r.status === 400 && body.reply_markup) {
        delete body.reply_markup
        continue
      }
      throw new Error(`تيليجرام: ${j.description || r.status}`)
    }
    return false
  }

  // بنبعت بالدور مع فاصل صغير عشان ما ننحظر
  async function pump() {
    if (busy) return
    busy = true
    while (queue.length) {
      const { text, url, resolve } = queue.shift()
      try {
        resolve(await sendNow(text, url))
      } catch (e) {
        log(`⚠️ ${e.message}`)
        resolve(false)
      }
      await new Promise((res) => setTimeout(res, 1100))
    }
    busy = false
  }

  return {
    enabled,
    send(text, url) {
      if (!enabled) return Promise.resolve(false)
      return new Promise((resolve) => {
        queue.push({ text: text.slice(0, 4000), url, resolve })
        pump()
      })
    },
  }
}
