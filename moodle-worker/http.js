// ============================================================
//  الطلبات لمواقع الجامعات
//  بعض الجامعات (مثل الأقصى) ورا Cloudflare، وهو بيرد على طلبات Node بصفحة
//  "Just a moment..." (403)، بينما curl بيمر عادي — فبنستعمل curl إذا موجود
// ============================================================
import { execFile, execFileSync } from 'node:child_process'

let hasCurl
function curlAvailable() {
  if (hasCurl === undefined) {
    try {
      execFileSync('curl', ['--version'], { stdio: 'ignore' })
      hasCurl = process.env.MOODLE_NO_CURL !== '1'
    } catch {
      hasCurl = false
    }
  }
  return hasCurl
}

export class HttpError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const MARK = '\n__CURL_META__'

function viaCurl(url, { method, headers, body, timeout, cookieJar, maxRedirs = 10 }) {
  // الرابط والبيانات بيروحوا عن طريق stdin (ملف إعدادات curl) عشان ما يبينوا بقائمة العمليات
  const q = (s) => '"' + String(s).replace(/["\\]/g, '\\$&') + '"'
  const cfg = [`url = ${q(url)}`, ...Object.entries(headers).map(([k, v]) => `header = ${q(`${k}: ${v}`)}`)]
  if (body !== undefined) cfg.push(`data-binary = ${q(body)}`)
  if (cookieJar) cfg.push(`cookie = ${q(cookieJar)}`, `cookie-jar = ${q(cookieJar)}`)
  const args = ['-sS', '-L', '--max-redirs', String(maxRedirs), '--compressed', '--max-time', String(Math.round(timeout / 1000)), '-X', method, '-w', `${MARK}%{http_code} %{content_type}`, '-K', '-']
  return new Promise((resolve, reject) => {
    const p = execFile('curl', args, { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' }, (err, stdout, stderr) => {
      const i = stdout.lastIndexOf(MARK)
      if (i < 0) {
        const msg = String(stderr || err?.message || '').trim()
        if (/timed out|timeout/i.test(msg)) return reject(new HttpError('timeout', 'موقع المودل ما رد (انتهى الوقت)'))
        return reject(new HttpError('network', `ما قدرت أوصل للموقع: ${msg.split('\n')[0] || 'خطأ بالشبكة'}`))
      }
      const [status, ...ct] = stdout.slice(i + MARK.length).trim().split(' ')
      resolve({ status: Number(status) || 0, contentType: ct.join(' '), text: stdout.slice(0, i) })
    })
    p.stdin.end(cfg.join('\n') + '\n')
  })
}

async function viaFetch(url, { method, headers, body, timeout }) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const r = await fetch(url, { method, headers, body, signal: ctrl.signal, redirect: 'follow' })
    return { status: r.status, contentType: r.headers.get('content-type') || '', text: await r.text() }
  } catch (e) {
    if (e.name === 'AbortError') throw new HttpError('timeout', 'موقع المودل ما رد (انتهى الوقت)')
    throw new HttpError('network', `ما قدرت أوصل للموقع: ${e.cause?.code || e.message}`)
  } finally {
    clearTimeout(t)
  }
}

export const isCloudflareBlock = (r) => (r.status === 403 || r.status === 503) && /Just a moment|cf-chl|challenge-platform|cloudflare/i.test(r.text.slice(0, 3000))

// { status, contentType, text }
export async function request(url, { method = 'GET', headers = {}, body, timeout = 30_000, cookieJar } = {}) {
  const opts = { method, headers, body, timeout, cookieJar }
  if (curlAvailable()) return viaCurl(url, opts)
  if (cookieJar) throw new HttpError('no_curl', 'تسجيل الدخول بالمتصفح بدّه curl — ثبّته: pkg install curl')
  return viaFetch(url, opts)
}

export const transport = () => (curlAvailable() ? 'curl' : 'fetch')
export const hasCurlNow = () => curlAvailable()
