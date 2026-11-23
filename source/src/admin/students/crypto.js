// تشفير كلمة السر (أو رابط التقويم) بالمفتاح العام لعامل المودل قبل ما تطلع من المتصفح.
// العامل بس بيقدر يفكها بمفتاحه الخاص المحفوظ على الجوال — قاعدة البيانات ما بتشوف النص أبداً.
// نفس صيغة moodle-worker/crypto.js
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function encryptForWorker(obj, publicSpki) {
  if (!publicSpki) throw new Error("عامل المودل لسا ما اشتغل — شغّله على الجوال أول");
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("المتصفح ما بيدعم التشفير (لازم https)");
  const pub = await subtle.importKey("spki", unb64(publicSpki), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
  const raw = await subtle.exportKey("raw", aes);
  const k = await subtle.encrypt({ name: "RSA-OAEP" }, pub, raw);
  return { v: 1, k: b64(k), iv: b64(iv), c: b64(c) };
}
