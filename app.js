const content=document.getElementById('panelContent'),overlay=document.getElementById('overlay');const views={
signup:`<span class="eyebrow">ابدأ رحلتك</span><h2>أنشئ حسابك</h2><p>خطوة واحدة تفصلك عن ملف مهني يفهمك فعلًا.</p><div class="form"><input placeholder="الاسم الكامل"><input placeholder="البريد الإلكتروني"><input type="password" placeholder="كلمة المرور"><button class="primary" onclick="openPanel('profile')">إنشاء الحساب ←</button></div>`,
profile:`<span class="eyebrow">ملفك المهني</span><h2>خلّينا نتعرّف عليك</h2><div class="form"><input placeholder="المدينة"><input placeholder="سنوات الخبرة"><select><option>المجال المطلوب</option><option>المبيعات</option><option>التسويق</option><option>الإدارة</option><option>التكنولوجيا</option></select><input placeholder="أهم مهاراتك"><button class="primary" onclick="openPanel('upload')">التالي</button></div>`,
upload:`<span class="eyebrow">تحليل السيرة الذاتية</span><h2>ارفع الـ CV</h2><div class="drop"><h3>اسحب الملف هنا أو اضغط للاختيار</h3><p>PDF, DOC, DOCX • حتى 5MB</p></div><br><button class="primary" onclick="openPanel('analysis')">تحليل السيرة الذاتية</button>`,
analysis:`<span class="eyebrow">الذكاء الاصطناعي يعمل الآن</span><h2>جاري تحليل سيرتك...</h2><p>✓ قراءة الخبرات والمهارات</p><p>✓ مقارنة متطلبات سوق العمل</p><p>✓ تحديد نقاط القوة والفجوات</p><button class="primary" onclick="openPanel('report')">عرض نتيجة العرض التجريبي</button>`,
report:`<span class="eyebrow">تقريرك الشخصي</span><h2>جاهزيتك لسوق العمل</h2><div class="score">78%</div><div class="miniCards"><div><b>نقاط القوة</b><p>المبيعات، العلاقات، قيادة الفريق</p></div><div><b>تحتاج تطوير</b><p>عرض الإنجازات، CRM، الإنجليزية المهنية</p></div><div><b>فرصتك الأسرع</b><p>Sales / Account Management</p></div></div><h3>ملاحظة من منهج مرام</h3><p>خبرتك أقوى مما يظهر في سيرتك الحالية. الأولوية ليست إضافة معلومات أكثر، بل تحويل مسؤولياتك إلى إنجازات واضحة وقابلة للقياس.</p><button class="primary" onclick="openPanel('plan')">ابنِ خطة تطويري</button>`,
plan:`<span class="eyebrow">خطة مخصصة</span><h2>خطتك للأسبوع القادم</h2><p>① إعادة صياغة 5 إنجازات في الـCV بالأرقام.</p><p>② تحديث LinkedIn بما يتوافق مع المسار المستهدف.</p><p>③ إكمال أساسيات CRM خلال 3 ساعات.</p><p>④ تدريب مقابلة لوظيفتين مستهدفتين.</p><p>⑤ التقديم على 5 فرص ذات تطابق مرتفع.</p><button class="primary" onclick="openPanel('advisor')">اسأل مستشار مرام</button>`,
advisor:`<span class="eyebrow">مستشار مرام الذكي</span><h2>شو حابب تعرف عن مسارك؟</h2><div class="chat"><div class="bubble me">حسب خبرتي، شو الوظائف الأنسب إلي؟</div><div class="bubble">بناءً على ملفك، أقرب المسارات لك هي Account Manager وSales Executive وBusiness Development. أنصحك تبدأ بالفرص التي تستفيد من خبرتك في العلاقات والمبيعات، وبنفس الوقت تقوي CRM وطريقة عرض إنجازاتك.</div></div><br><div class="form"><input placeholder="اكتب سؤالك هنا..."><button class="primary">إرسال</button></div>`,
jobs:`<span class="eyebrow">وظائف مناسبة لك</span><h2>الفرص الأعلى تطابقًا</h2><div class="job"><div><b>Sales Executive</b><small>رام الله • دوام كامل</small></div><strong>92%</strong></div><div class="job"><div><b>Account Manager</b><small>رام الله • شركة خدمات</small></div><strong>84%</strong></div><div class="job"><div><b>Business Development</b><small>Hybrid</small></div><strong>78%</strong></div>`,
company:`<span class="eyebrow">بوابة الشركات</span><h2>اعثر على المرشح الأنسب</h2><p>سجل شركتك، انشر الوظيفة، واستقبل قائمة مرشحين مرتبة حسب التطابق الفعلي مع احتياجك.</p><div class="form"><input placeholder="اسم الشركة"><input placeholder="البريد الإلكتروني للعمل"><input placeholder="المسمى الوظيفي المطلوب"><textarea placeholder="المهارات والخبرة المطلوبة"></textarea><button class="primary" onclick="openPanel('candidates')">نشر الوظيفة التجريبية</button></div>`,
admin:`<span class="eyebrow">الإدارة والاستشارة</span><h2>لوحة الصلاحيات</h2><p>بعد تسجيل الدخول تفتح لوحة وليد للإدارة الكاملة أو مساحة مرام للاستشارات والمرجعية المهنية حسب دور الحساب.</p><button class="primary" onclick="hubOpen()">تسجيل الدخول</button>`,candidates:`<span class="eyebrow">مرشحون مقترحون</span><h2>الأقرب لهذه الوظيفة</h2><div class="job"><div><b>أحمد محمود</b><small>5 سنوات • مبيعات B2B • CRM</small></div><strong>94%</strong></div><div class="job"><div><b>سارة خالد</b><small>4 سنوات • Account Management</small></div><strong>89%</strong></div><div class="job"><div><b>محمد علي</b><small>3 سنوات • Business Development</small></div><strong>82%</strong></div>`};function openPanel(v){if(v==='signup')return showAuth('signup');content.innerHTML=views[v]||views.signup;overlay.classList.add('show')}function closePanel(){overlay.classList.remove('show')}document.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel()});
/* Live candidate signup and login */
async function showAuth(mode='signup'){
 content.innerHTML=views.signup;overlay.classList.add('show');
 const el=document.getElementById('panelContent');
 el.innerHTML='<span class="eyebrow">حسابك المهني</span><h2>'+(mode==='signup'?'إنشاء حساب جديد':'تسجيل الدخول')+'</h2><p>'+(mode==='signup'?'أنشئ حسابك ثم أكد بريدك الإلكتروني.':'أدخل بريدك وكلمة المرور للدخول.')+'</p><form class="form" id="authForm"><input id="authName" autocomplete="name" placeholder="الاسم الكامل" '+(mode==='login'?'style="display:none"':'required')+'><input id="authEmail" type="email" autocomplete="email" required placeholder="البريد الإلكتروني"><input id="authPassword" type="password" autocomplete="'+(mode==='signup'?'new-password':'current-password')+'" minlength="8" required placeholder="كلمة المرور (8 أحرف على الأقل)"><button class="primary" type="submit">'+(mode==='signup'?'إنشاء الحساب وإرسال رابط التأكيد':'تسجيل الدخول')+'</button></form><p id="authFeedback" role="status"></p>'+(mode==='signup'?'<button class="secondary" id="authResend" style="display:none">إعادة إرسال رابط التأكيد</button>':'')+'<button class="secondary" id="authSwitch">'+(mode==='signup'?'عندي حساب بالفعل':'إنشاء حساب جديد')+'</button>';
 document.getElementById('authSwitch').onclick=()=>showAuth(mode==='signup'?'login':'signup');
 if(mode==='signup') document.getElementById('authResend').onclick=resendAuthConfirmation;
 document.getElementById('authForm').onsubmit=async e=>{
   e.preventDefault();
   const out=document.getElementById('authFeedback');
   if(!window.db){out.textContent='الاتصال بقاعدة البيانات غير متاح حاليًا';return}
   const email=document.getElementById('authEmail').value.trim();
   const password=document.getElementById('authPassword').value;
   const name=document.getElementById('authName').value.trim();
   if(mode==='signup'&&!name){out.textContent='أدخل الاسم الكامل';return}
   out.textContent='جاري المعالجة...';
   let result;
   try{
     result=mode==='signup'
       ? await window.db.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:(window.BTT_CONFIG?.siteUrl || location.origin+location.pathname)}})
       : await window.db.auth.signInWithPassword({email,password});
   }catch(err){
     out.textContent='تعذر إكمال العملية: '+(err?.message||'خطأ غير متوقع');
     return;
   }
   if(result.error){
     out.textContent=friendlyAuthError(result.error);
     if(mode==='signup') document.getElementById('authResend').style.display='inline-block';
     return;
   }
   if(mode==='signup'){
     const identities=result.data?.user?.identities;
     if(Array.isArray(identities)&&identities.length===0){
       out.textContent='هذا البريد مسجل مسبقًا. إذا لم تؤكد الحساب بعد، استخدم زر إعادة إرسال رابط التأكيد أو جرّب تسجيل الدخول.';
     }else{
       out.textContent='تم إنشاء الحساب. راجع بريدك واضغط رابط التأكيد، ثم سجل الدخول.';
     }
     document.getElementById('authResend').style.display='inline-block';
     return;
   }
   out.textContent='تم تسجيل الدخول بنجاح.';
   setTimeout(()=>{closePanel();},900);
 };
}

function friendlyAuthError(error){
 const msg=String(error?.message||'');
 if(/Email address not authorized/i.test(msg)) return 'لا يمكن إرسال رسالة التأكيد لهذا البريد حاليًا لأن خدمة البريد للمشروع غير مهيأة بعد للمستخدمين الخارجيين.';
 if(/already registered/i.test(msg)) return 'هذا البريد مسجل بالفعل. جرّب تسجيل الدخول أو إعادة إرسال رابط التأكيد.';
 if(/rate limit/i.test(msg)) return 'تم تجاوز حد إرسال رسائل التأكيد مؤقتًا. استخدم إعادة الإرسال لاحقًا.';
 return 'تعذر إكمال العملية: '+msg;
}

async function resendAuthConfirmation(){
 const out=document.getElementById('authFeedback');
 const email=document.getElementById('authEmail')?.value.trim();
 if(!email){out.textContent='أدخل البريد الإلكتروني أولًا.';return}
 if(!window.db){out.textContent='الاتصال بقاعدة البيانات غير متاح حاليًا';return}
 out.textContent='جاري إعادة إرسال رابط التأكيد...';
 const {error}=await window.db.auth.resend({type:'signup',email,options:{emailRedirectTo:(window.BTT_CONFIG?.siteUrl || location.origin+location.pathname)}});
 out.textContent=error?friendlyAuthError(error):'تم طلب إعادة إرسال رابط التأكيد. افحص الوارد والرسائل غير المرغوب فيها.';
}

