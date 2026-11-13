# موقع فرصة العمل — لوحة التحكم + صفحة التسجيل + المتجر (الإصدار 2026.11.13)

React + Vite + Firebase (المشروع: online-job-ec267)

## التشغيل على جهازك
```
npm install
npm run dev          # تشغيل محلي
npm run build        # بناء اللوحة والموقع ← مجلد dist
```
على GitHub ما في داعي تبني بإيدك: أي تعديل على `source/` بفرع main بينبني وبينشر تلقائياً.
```
```
المتجر بينبني لحاله بـ `vite.store.config.js` (ريبو shop).

## أهم المجلدات
- `src/admin/` — لوحة التحكم (واتساب، الصياد، المتجر، الإعدادات، الصحة...)
- `src/admin/funnel/` — أجزاء صفحة المتابعة (كانت ملف واحد `Funnel.jsx`)
- `src/admin/store/` — أجزاء إدارة المتجر (كانت ملف واحد `StoreAdmin.jsx`)
- `src/landing.css` و `src/admin-theme.css` — الثيم الجديد (بنفسجي غامق + ذهبي)
- `src/components/Icons.jsx` — الأيقونات (SVG)
- `src/admin/wa/` — الناشر وإدارة مجموعات الواتساب
- `src/admin/tg/` — صياد التيليجرام والمصادر
- `src/` — صفحة التسجيل والمكونات المشتركة (firebase.js, appSettings.js, groupIntel.js ...)
- `store/` — كود المتجر
- `public/` — الصور والأيقونات

العمّال (wa / tg على Termux) بمستودع منفصل: onlinejob114111607/system
