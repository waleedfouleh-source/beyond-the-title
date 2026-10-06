# إعداد ما وراء العنوان
1. أنشئ مشروع Supabase جديدًا.
2. افتح SQL Editor وشغّل ملف supabase/schema.sql.
3. انسخ config.example.js إلى config.js، وضع Project URL و publishable/anon key فقط.
4. سجّل مستخدمًا من Supabase Authentication ثم أضف ملفه في profiles.
5. امنح حساب مرام صلاحية admin يدويًا من SQL Editor بعد التأكد من UUID، كما في تعليق نهاية schema.sql.
6. لا تضع service_role أو API keys الخاصة بالنماذج في GitHub أو المتصفح.
7. بعد الربط يمكن إدارة المعرفة المعتمدة من لوحة مرام. الاسترجاع الدلالي وتحليل PDF/Word يحتاجان Edge Function آمنة ومرحلة فهرسة embeddings.
8. إعدادات Authentication > URL Configuration: أضف رابط GitHub Pages ضمن Redirect URLs.
9. هذه نسخة إعداد أولية؛ اختبر سياسات RLS قبل إدخال بيانات مستخدمين حقيقية.
