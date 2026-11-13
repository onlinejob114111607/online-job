# موقع فرصة العمل — صفحة التسجيل + لوحة التحكم

الموقع: https://onlinejob114111607.github.io/online-job/
لوحة التحكم: https://onlinejob114111607.github.io/online-job/#/admin

## بنية الريبو
| المسار | شو فيه |
|---|---|
| `source/` | **الكود الأصلي** (React + Vite + Firebase). أي تعديل بيصير هون. |
| `index.html`، `assets/`، الصور بالجذر | الملفات الجاهزة اللي GitHub Pages بيعرضها — **لا تعدّلها بإيدك**، بتنبني تلقائياً. |
| `.github/workflows/deploy.yml` | البناء والنشر التلقائي. |
| `backup/` | نسخة احتياطية من ملف اللوحة القديم. |

## النشر التلقائي
أي تعديل على `source/` بيوصل لفرع `main` → GitHub Actions بيبني الموقع وبيحط الملفات الجاهزة بجذر الريبو لحاله.
بتقدر كمان تشغّله يدوياً من تبويب **Actions ← Build & deploy site ← Run workflow**.

## التشغيل على جهازك
```
cd source
npm install
npm run dev      # تشغيل محلي
npm run build    # بناء ← source/dist
```

العمّال (واتساب / تيليجرام على Termux) بمستودع منفصل: `onlinejob114111607/system`.
المتجر بينبني من نفس الكود بـ `vite.store.config.js` وبينرفع على ريبو `shop`.
