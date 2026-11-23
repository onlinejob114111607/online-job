// ============================================================
//  التشفير: اللوحة بتشفّر كلمة السر (أو رابط التقويم) بالمفتاح العام للعامل،
//  والعامل بس بيقدر يفكها بمفتاحه الخاص المحفوظ على الجوال (data/key.pem).
//  الطريقة: مفتاح AES-256-GCM عشوائي للنص + RSA-OAEP-SHA256 لتغليف المفتاح.
//  نفس الصيغة اللي بتعملها اللوحة بـ source/src/admin/students/crypto.js
// ============================================================
import { createDecipheriv, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, constants, createCipheriv, randomBytes, publicEncrypt } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// بيرجع { privateKey, publicSpki (base64) } — وبيولّد مفتاح جديد أول مرة
export function loadOrCreateKeys(file) {
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true })
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  }
  const privateKey = createPrivateKey(readFileSync(file, 'utf8'))
  const publicSpki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64')
  return { privateKey, publicSpki }
}

// الصيغة: { v:1, k: مفتاح AES مغلّف (base64), iv (base64), c: النص المشفّر + وسم GCM آخر 16 بايت (base64) }
export function decryptBox(box, privateKey) {
  if (!box || box.v !== 1) throw new Error('صيغة تشفير غير معروفة')
  const aesKey = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(box.k, 'base64'))
  const all = Buffer.from(box.c, 'base64')
  const tag = all.subarray(all.length - 16)
  const data = all.subarray(0, all.length - 16)
  const d = createDecipheriv('aes-256-gcm', aesKey, Buffer.from(box.iv, 'base64'))
  d.setAuthTag(tag)
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'))
}

// للتجربة بس (نفس شغل اللوحة)
export function encryptBox(obj, publicSpki) {
  const pub = createPublicKey({ key: Buffer.from(publicSpki, 'base64'), format: 'der', type: 'spki' })
  const aesKey = randomBytes(32)
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', aesKey, iv)
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()])
  const k = publicEncrypt({ key: pub, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, aesKey)
  return { v: 1, k: k.toString('base64'), iv: iv.toString('base64'), c: enc.toString('base64') }
}
