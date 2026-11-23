# راشن · Ration

**التطبيق:** https://hgharib89.github.io/Todo-app/ration/

تطبيق يتنزّل على الجوال (PWA) بالعربي والإنجليزي: الزبون يكتب أو يصوّر قائمة أغراضه، والتطبيق يطلع له أرخص سعر لكل منتج، وأرخص محل، وأوفر خطة على محلين. وفيه مساعد يجاوب عن العروض، وأداة للمشرف يقرأ فيها البروشورات بالذكاء الاصطناعي.

## الملفات

| الملف | الوظيفة |
|---|---|
| `index.html` | التطبيق كامل |
| `supabase/setup.sql` | قاعدة البيانات: العروض، قوائم المستخدمين، المشرفين، الأسعار التجريبية |
| `supabase/functions/ai/index.ts` | دالة الذكاء الاصطناعي، والمفتاح يبقى في الخادم |
| `vendor/supabase-2.118.0.js` | مكتبة Supabase |
| `sw.js`، `manifest.webmanifest`، `icons/` | التنزيل على الجوال والعمل بدون إنترنت |

## تشغيل Supabase (مرة وحدة)

1. **قاعدة البيانات:** SQL Editor ← New query ← الصق محتوى `supabase/setup.sql` ← Run
2. **الدخول المجهول:** Authentication ← Sign In / Providers ← فعّل **Allow anonymous sign-ins**
3. **رابط التطبيق:** Authentication ← URL Configuration ← Site URL: `https://hgharib89.github.io/Todo-app/ration/`
4. **دالة الذكاء الاصطناعي:** Edge Functions ← Deploy a new function ← Via Editor ← الاسم `ai` ← الصق `supabase/functions/ai/index.ts` ← Deploy
5. **مفتاح Claude:** Edge Functions ← Secrets ← أضف `ANTHROPIC_API_KEY` وقيمته مفتاحك من console.anthropic.com
6. **حساب المشرف:** افتح التطبيق ← تبويب العروض ← حساب جديد بـ `h.gharib89@gmail.com` ← أكّد البريد ← ادخل

لإضافة مشرف ثاني: `insert into public.admins (email) values ('email@example.com');`

## الأمان

- المفتاح العام (`sb_publishable_…`) موجود داخل التطبيق، وهذا عادي.
- المفتاح السري وكلمة سر قاعدة البيانات ومفتاح Claude ما ينحطون في الكود أبداً.
- كل مستخدم يشوف قائمته بس. العروض يقراها الكل، وما يضيفها أو يحذفها إلا المشرف.
