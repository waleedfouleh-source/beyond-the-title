/* Beyond the Title | functional test flows */
(function(){
  'use strict';

  const db = window.db;
  const previousOpenPanel = window.openPanel;
  const panel = document.getElementById('panelContent');
  const overlay = document.getElementById('overlay');
  const state = { user:null, profile:null, latestReport:null, selectedFile:null };

  const safe = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  function show(html){
    panel.innerHTML = html;
    overlay.classList.add('show');
  }

  function status(id,msg,ok){
    const el=document.getElementById(id);
    if(!el)return;
    el.textContent=msg||'';
    el.className=ok===true?'status ok':ok===false?'status error':'status';
  }

  async function loadSession(){
    if(!db)return null;
    const r=await db.auth.getUser();
    state.user=r.data && r.data.user ? r.data.user : null;
    state.profile=null;
    if(state.user){
      const p=await db.from('profiles')
        .select('id,full_name,role,city,headline,skills,experience_years,target_field')
        .eq('id',state.user.id).maybeSingle();
      state.profile=p.data||null;
    }
    syncHeader();
    return state.user;
  }

  function requireLogin(after){
    sessionStorage.setItem('btt_after_login',after||'account');
    if(typeof window.showAuth==='function') window.showAuth('login');
    else previousOpenPanel('signup');
  }

  async function syncHeader(){
    const btn=document.querySelector('header .ghost');
    if(!btn)return;
    if(!state.user && db){
      const r=await db.auth.getUser();
      state.user=r.data && r.data.user ? r.data.user : null;
    }
    if(state.user){
      btn.textContent='حسابي';
      btn.onclick=()=>window.openPanel('account');
    }else{
      btn.textContent='تسجيل الدخول';
      btn.onclick=()=>window.openPanel('signup');
    }
  }

  async function openAccount(){
    await loadSession();
    if(!state.user)return requireLogin('account');
    const role=state.profile && state.profile.role ? state.profile.role : 'candidate';
    let roleText=role;
    if(role==='admin')roleText='Admin — مدير المنصة';
    if(role==='consultant')roleText='Consultant — المستشارة';
    if(role==='candidate')roleText='باحث عن عمل';
    if(role==='employer')roleText='شركة / صاحب عمل';
    show(
      '<span class="eyebrow">حسابي</span>'+
      '<h2>'+safe(state.profile && state.profile.full_name ? state.profile.full_name : state.user.email)+'</h2>'+
      '<div class="accountCard"><b>'+safe(state.user.email)+'</b><span>'+safe(roleText)+'</span></div>'+
      '<div class="form">'+
        (role==='admin'||role==='consultant'?'<button class="primary" onclick="openPanel(\'admin\')">فتح لوحة الصلاحية</button>':'')+
        (role!=='consultant'?'<button class="secondary" onclick="openPanel(\'profile\')">الملف المهني</button>':'')+
        '<button class="secondary" onclick="platformSignOut()">تسجيل الخروج</button>'+
      '</div>'
    );
  }

  async function openProfile(){
    await loadSession();
    if(!state.user)return requireLogin('profile');
    if(state.profile && state.profile.role==='consultant'){
      show('<span class="eyebrow">مساحة مرام</span><h2>حساب المستشارة</h2><p>الملف المهني للباحثين عن عمل منفصل عن مساحة المستشارة.</p><button class="primary" onclick="openPanel(\'admin\')">فتح مساحة مرام</button>');
      return;
    }
    const p=state.profile||{};
    const skills=Array.isArray(p.skills)?p.skills.join('، '):'';
    show(
      '<span class="eyebrow">ملفك المهني</span><h2>خلّينا نتعرّف عليك</h2>'+
      '<p>هذه البيانات تدخل في المطابقة والتقرير وخطة التطوير.</p>'+
      '<form class="form" id="profileForm">'+
        '<input id="pName" placeholder="الاسم الكامل" value="'+safe(p.full_name||'')+'">'+
        '<input id="pCity" placeholder="المدينة" value="'+safe(p.city||'')+'">'+
        '<input id="pExperience" type="number" min="0" max="60" placeholder="سنوات الخبرة" value="'+safe(p.experience_years==null?'':p.experience_years)+'">'+
        '<select id="pField">'+
          '<option value="">المجال المطلوب</option>'+
          option('المبيعات',p.target_field)+option('التسويق',p.target_field)+option('الإدارة',p.target_field)+option('التكنولوجيا',p.target_field)+option('الموارد البشرية',p.target_field)+option('أخرى',p.target_field)+
        '</select>'+
        '<input id="pSkills" placeholder="المهارات، افصل بينها بفاصلة" value="'+safe(skills)+'">'+
        '<button class="primary" type="submit">حفظ ومتابعة إلى الـCV</button>'+
      '</form><p id="profileStatus" class="status"></p>'
    );
    document.getElementById('profileForm').onsubmit=saveProfile;
  }

  function option(value,current){
    return '<option value="'+safe(value)+'" '+(current===value?'selected':'')+'>'+safe(value)+'</option>';
  }

  async function saveProfile(e){
    e.preventDefault();
    const yearsRaw=document.getElementById('pExperience').value;
    const skills=document.getElementById('pSkills').value.split(/[,،]/).map(x=>x.trim()).filter(Boolean);
    const patch={
      full_name:document.getElementById('pName').value.trim()||null,
      city:document.getElementById('pCity').value.trim()||null,
      experience_years:yearsRaw===''?null:Number(yearsRaw),
      target_field:document.getElementById('pField').value||null,
      skills,
      updated_at:new Date().toISOString()
    };
    status('profileStatus','جاري الحفظ...');
    const r=await db.from('profiles').update(patch).eq('id',state.user.id);
    if(r.error)return status('profileStatus','تعذر الحفظ: '+r.error.message,false);
    state.profile=Object.assign({},state.profile||{},patch);
    status('profileStatus','تم حفظ الملف المهني.',true);
    setTimeout(()=>openUpload(),350);
  }

  async function openUpload(){
    await loadSession();
    if(!state.user)return requireLogin('upload');
    show(
      '<span class="eyebrow">تحليل السيرة الذاتية</span><h2>ارفع الـ CV</h2>'+
      '<p>الرفع فعلي إلى مساحة خاصة بحسابك. في اختبار اليوم، التقرير يُبنى من ملفك المهني وبيانات الملف؛ قراءة نص PDF/DOCX بالذكاء الاصطناعي ستكون المرحلة التالية.</p>'+
      '<label class="drop fileDrop" for="cvFile">'+
        '<h3 id="cvFileTitle">اضغط لاختيار الملف</h3>'+
        '<p id="cvFileMeta">PDF, DOC, DOCX • حتى 5MB</p>'+
        '<input id="cvFile" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>'+
      '</label><br>'+
      '<button class="primary" id="cvAnalyzeButton" onclick="platformUploadCv()">رفع الملف وإنشاء تقرير الاختبار</button>'+
      '<p id="cvStatus" class="status"></p>'
    );
    document.getElementById('cvFile').onchange=e=>{
      state.selectedFile=e.target.files && e.target.files[0] ? e.target.files[0] : null;
      if(state.selectedFile){
        document.getElementById('cvFileTitle').textContent=state.selectedFile.name;
        document.getElementById('cvFileMeta').textContent=(state.selectedFile.size/1024/1024).toFixed(2)+' MB';
      }
    };
  }

  function buildAnalysis(profile,file){
    const exp=Number(profile && profile.experience_years || 0);
    const skills=Array.isArray(profile && profile.skills)?profile.skills.filter(Boolean):[];
    const target=profile && profile.target_field ? profile.target_field : 'مسار مهني عام';
    let score=55+Math.min(exp*3,18)+Math.min(skills.length*4,12)+(profile&&profile.city?4:0)+(profile&&profile.target_field?6:0);
    score=Math.max(55,Math.min(92,score));
    const strengths=skills.length?skills.slice(0,3):['الخبرة العملية','القدرة على التعلم','التواصل'];
    let gaps=['عرض الإنجازات بالأرقام','تحسين الكلمات المفتاحية في السيرة','الاستعداد للمقابلة'];
    if(/مبيعات/.test(target))gaps=['عرض نتائج المبيعات بالأرقام','CRM وإدارة خط المبيعات','التفاوض والإغلاق'];
    else if(/تسويق/.test(target))gaps=['قياس نتائج الحملات','Portfolio للأعمال','تحليل البيانات التسويقية'];
    else if(/تكنولوجيا/.test(target))gaps=['مشاريع عملية موثقة','Git/Portfolio','ربط المهارات بمتطلبات الوظيفة'];
    else if(/موارد/.test(target))gaps=['مؤشرات HR قابلة للقياس','أنظمة HRIS','عرض أثر التدريب والتوظيف'];
    return {
      mode:'profile_based_test',
      score,
      target,
      strengths,
      gaps,
      opportunity:target,
      file_name:file?file.name:null,
      note:'هذه نتيجة اختبار تشغيلية مبنية على الملف المهني وبيانات الملف المرفوع، وليست قراءة AI كاملة لنص السيرة بعد.'
    };
  }

  async function uploadCv(){
    await loadSession();
    if(!state.user)return requireLogin('upload');
    const file=state.selectedFile||document.getElementById('cvFile')?.files?.[0];
    if(!file)return status('cvStatus','اختر ملف CV أولًا.',false);
    if(file.size>5*1024*1024)return status('cvStatus','حجم الملف أكبر من 5MB.',false);
    const allowed=['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const ext=(file.name.split('.').pop()||'').toLowerCase();
    if(!allowed.includes(file.type)&&!['pdf','doc','docx'].includes(ext))return status('cvStatus','نوع الملف غير مدعوم.',false);
    const btn=document.getElementById('cvAnalyzeButton');
    if(btn)btn.disabled=true;
    status('cvStatus','جاري رفع الملف...');
    const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path=state.user.id+'/'+Date.now()+'-'+clean;
    const up=await db.storage.from('cv-files').upload(path,file,{contentType:file.type||undefined,upsert:false});
    if(up.error){
      if(btn)btn.disabled=false;
      return status('cvStatus','تعذر رفع الملف: '+up.error.message,false);
    }
    const analysis=buildAnalysis(state.profile||{},file);
    const ins=await db.from('cv_reports').insert({
      user_id:state.user.id,
      file_path:path,
      file_name:file.name,
      status:'ready',
      analysis
    }).select('id,user_id,file_path,file_name,status,analysis,created_at').single();
    if(ins.error){
      if(btn)btn.disabled=false;
      return status('cvStatus','تم رفع الملف لكن تعذر إنشاء التقرير: '+ins.error.message,false);
    }
    state.latestReport=ins.data;
    status('cvStatus','تم الرفع وإنشاء التقرير.',true);
    setTimeout(()=>openReport(),300);
  }

  async function getLatestReport(){
    if(state.latestReport)return state.latestReport;
    await loadSession();
    if(!state.user)return null;
    const r=await db.from('cv_reports')
      .select('id,file_path,file_name,status,analysis,created_at')
      .eq('user_id',state.user.id)
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    state.latestReport=r.data||null;
    return state.latestReport;
  }

  async function openAnalysis(){
    const report=await getLatestReport();
    if(!state.user)return requireLogin('analysis');
    if(!report){
      show('<span class="eyebrow">التحليل</span><h2>لا يوجد CV محلل بعد</h2><p>ارفع السيرة الذاتية أولًا.</p><button class="primary" onclick="openPanel(\'upload\')">رفع CV</button>');
      return;
    }
    show(
      '<span class="eyebrow">تحليل السيرة</span><h2>اكتمل تحليل نسخة الاختبار</h2>'+
      '<p>✓ تم رفع الملف وحفظه بشكل خاص</p><p>✓ تم ربط التقرير بملفك المهني</p><p>✓ تم تحديد نقاط قوة وفجوات أولية</p>'+
      '<button class="primary" onclick="openPanel(\'report\')">عرض التقرير</button>'
    );
  }

  async function openReport(){
    const report=await getLatestReport();
    if(!state.user)return requireLogin('report');
    if(!report)return openAnalysis();
    const a=report.analysis||{};
    const strengths=(a.strengths||[]).map(s=>'<li>'+safe(s)+'</li>').join('');
    const gaps=(a.gaps||[]).map(s=>'<li>'+safe(s)+'</li>').join('');
    show(
      '<span class="eyebrow">تقريرك الشخصي</span><h2>جاهزيتك لسوق العمل</h2>'+
      '<div class="score">'+safe(a.score||0)+'%</div>'+
      '<p class="testNotice">نسخة اختبار تشغيلية — لا تدّعي قراءة AI كاملة لمحتوى الملف بعد.</p>'+
      '<div class="miniCards">'+
        '<div><b>نقاط القوة</b><ul>'+strengths+'</ul></div>'+
        '<div><b>تحتاج تطوير</b><ul>'+gaps+'</ul></div>'+
        '<div><b>المسار الأقرب</b><p>'+safe(a.opportunity||a.target||'غير محدد')+'</p></div>'+
      '</div>'+
      '<h3>ملاحظة التحليل</h3><p>'+safe(a.note||'')+'</p>'+
      '<small>الملف: '+safe(report.file_name||'CV')+'</small><br><br>'+
      '<button class="primary" onclick="openPanel(\'plan\')">ابنِ خطة تطويري</button>'
    );
  }

  async function openPlan(){
    const report=await getLatestReport();
    if(!state.user)return requireLogin('plan');
    if(!report){
      show('<span class="eyebrow">الخطة</span><h2>نحتاج تقريرًا أولًا</h2><button class="primary" onclick="openPanel(\'upload\')">رفع CV</button>');
      return;
    }
    const a=report.analysis||{}, gaps=a.gaps||[];
    const items=[
      'إعادة صياغة 3–5 إنجازات في الـCV بأرقام ونتائج.',
      gaps[0]?'العمل على: '+gaps[0]+'.':'تحديد فجوة مهارية واحدة والعمل عليها.',
      gaps[1]?'العمل على: '+gaps[1]+'.':'تحسين الكلمات المفتاحية في السيرة.',
      'تدريب مقابلة واحدة للمسار المستهدف: '+(a.target||'المسار المهني')+'.',
      'مراجعة الوظائف التجريبية والتقديم على الأعلى تطابقًا.'
    ];
    show(
      '<span class="eyebrow">خطة مخصصة</span><h2>خطتك للأسبوع القادم</h2>'+
      '<ol class="planList">'+items.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ol>'+
      '<button class="primary" onclick="openPanel(\'advisor\')">اسأل مستشار مرام</button>'
    );
  }

  async function buildAdvisorAnswer(question){
    await loadSession();
    const report=await getLatestReport();
    const a=report&&report.analysis?report.analysis:{};
    const q=question.trim();
    const tokens=q.toLowerCase().split(/\s+/).filter(x=>x.length>=4).slice(0,8);
    let trusted=null;
    const k=await db.from('knowledge').select('title,body,source_role,status').eq('status','approved').limit(50);
    if(!k.error && Array.isArray(k.data)){
      trusted=k.data.find(row=>{
        const hay=(row.title+' '+row.body).toLowerCase();
        return tokens.some(t=>hay.includes(t));
      })||null;
    }
    if(trusted){
      const excerpt=String(trusted.body||'').slice(0,650);
      return {
        answer:'حسب المرجعية المهنية المعتمدة داخل المنصة: '+excerpt+(String(trusted.body||'').length>650?'…':''),
        source:trusted.source_role==='consultant'?'approved_consultant':'approved_knowledge'
      };
    }
    const track=a.target || (state.profile&&state.profile.target_field) || 'المسار المهني';
    const gaps=a.gaps||[];
    if(/وظيف|مسار|أنسب|مناسب/.test(q)){
      return {answer:'بناءً على ملفك الحالي، ابدأ بمسار '+track+'. ركّز في التقديم على الوظائف التي تتطابق مع مهاراتك الأساسية، ثم قارن متطلبات كل وظيفة بالفجوات الظاهرة في تقريرك'+(gaps[0]?'، وأول فجوة للعمل عليها هي: '+gaps[0]:'')+'.',source:'profile_test'};
    }
    if(/مقابل|انترفيو|interview/i.test(q)){
      return {answer:'للمقابلة: جهّز 3 قصص قصيرة بطريقة الموقف–المهمة–الإجراء–النتيجة، واربط كل قصة بمتطلب من الوظيفة. حضّر رقمًا أو نتيجة قابلة للقياس لكل إنجاز، وسؤالين واضحين عن الدور والفريق.',source:'test_advisor'};
    }
    if(/سير|cv|resume/i.test(q)){
      return {answer:'في نسخة الاختبار، أهم تحسين للـCV هو تحويل المسؤوليات إلى نتائج قابلة للقياس، ثم إضافة كلمات مفتاحية مرتبطة بالمسار '+track+'. '+(gaps.length?'الفجوات الحالية: '+gaps.join('، ')+'.':'') ,source:'report_test'};
    }
    if(/مهار|تطوير|دور/.test(q)){
      return {answer:'ابدأ بمهارة واحدة ذات أثر مباشر على فرصك. '+(gaps.length?'بحسب تقريرك: '+gaps.join('، ')+'.':'حدّد المهارة الأكثر تكرارًا في الوظائف التي تستهدفها.')+' بعد ذلك طبّقها في تمرين أو مشروع قصير بدل الاكتفاء بالمشاهدة.',source:'report_test'};
    }
    return {answer:'هذه إجابة نسخة اختبار من مستشار مرام، مبنية حاليًا على ملفك وتقريرك. اسألني عن الوظائف المناسبة، الـCV، المقابلات أو المهارات. عندما تعتمد مرام موادها المرجعية، سأستخدمها تلقائيًا في الإجابات.',source:'test_advisor'};
  }

  async function openAdvisor(){
    await loadSession();
    if(!state.user)return requireLogin('advisor');
    const history=await db.from('advisor_messages')
      .select('id,question,answer,source_type,created_at')
      .eq('user_id',state.user.id).order('created_at',{ascending:true}).limit(30);
    const rows=history.data||[];
    show(
      '<span class="eyebrow">مستشار مرام — نسخة الاختبار</span><h2>شو حابب تعرف عن مسارك؟</h2>'+
      '<p class="testNotice">الإرسال يعمل الآن. الإجابات تعتمد على ملفك والتقرير والمرجعية المعتمدة؛ بدون مرجعية مطابقة يستخدم النظام منطق اختبار واضح وليس نموذج AI خارجي.</p>'+
      '<div class="chat" id="advisorChat">'+
        (rows.length?rows.map(m=>'<div class="bubble me">'+safe(m.question)+'</div><div class="bubble">'+safe(m.answer)+'<small>'+safe(sourceLabel(m.source_type))+'</small></div>').join(''):'<div class="bubble">اسألني عن الوظائف، السيرة الذاتية، المقابلات أو المهارات.</div>')+
      '</div><br>'+
      '<form class="form" id="advisorForm"><input id="advisorQuestion" autocomplete="off" placeholder="اكتب سؤالك هنا..."><button class="primary" id="advisorSend" type="submit">إرسال</button></form>'+
      '<p id="advisorStatus" class="status"></p>'
    );
    document.getElementById('advisorForm').onsubmit=sendAdvisor;
    const chat=document.getElementById('advisorChat'); if(chat)chat.scrollTop=chat.scrollHeight;
  }

  function sourceLabel(source){
    if(source==='approved_consultant')return 'مرجعية مرام المعتمدة';
    if(source==='approved_knowledge')return 'مرجعية معتمدة';
    return 'منطق نسخة الاختبار';
  }

  async function sendAdvisor(e){
    e.preventDefault();
    const input=document.getElementById('advisorQuestion');
    const q=input.value.trim();
    if(!q)return status('advisorStatus','اكتب السؤال أولًا.',false);
    const btn=document.getElementById('advisorSend'); if(btn)btn.disabled=true;
    status('advisorStatus','جاري تجهيز الإجابة...');
    const result=await buildAdvisorAnswer(q);
    const ins=await db.from('advisor_messages').insert({
      user_id:state.user.id,question:q,answer:result.answer,source_type:result.source
    });
    if(ins.error){
      if(btn)btn.disabled=false;
      return status('advisorStatus','تعذر حفظ المحادثة: '+ins.error.message,false);
    }
    input.value='';
    await openAdvisor();
  }

  function matchScore(job,profile){
    const text=((job.title||'')+' '+(job.requirements||'')).toLowerCase();
    const field=String(profile&&profile.target_field||'').toLowerCase();
    const skills=Array.isArray(profile&&profile.skills)?profile.skills:[];
    let score=58;
    if(field && text.includes(field))score+=20;
    skills.forEach(s=>{if(s && text.includes(String(s).toLowerCase()))score+=5;});
    return Math.min(96,score);
  }

  async function openJobs(){
    await loadSession();
    const r=await db.from('jobs').select('id,title,company,location,description,requirements,status').eq('status','published').order('created_at',{ascending:false});
    const jobs=r.data||[];
    show(
      '<span class="eyebrow">وظائف مناسبة لك</span><h2>الفرص المتاحة للاختبار</h2>'+
      '<p class="testNotice">الوظائف التي تحمل كلمة «تجريبية» ليست إعلانات توظيف حقيقية؛ موجودة لاختبار المطابقة والتقديم.</p>'+
      '<div id="jobsList">'+(jobs.length?jobs.map(j=>{
        const score=matchScore(j,state.profile||{});
        return '<div class="job jobFull"><div><b>'+safe(j.title)+'</b><small>'+safe(j.company)+' • '+safe(j.location||'')+'</small><p>'+safe(j.description||'')+'</p></div><div class="jobActions"><strong>'+score+'%</strong><button class="secondary" onclick="platformApplyJob(\''+j.id+'\')">تقديم</button></div></div>';
      }).join(''):'<p>لا توجد وظائف منشورة حاليًا.</p>')+'</div>'+
      '<p id="jobStatus" class="status"></p>'
    );
  }

  async function applyJob(id){
    await loadSession();
    if(!state.user)return requireLogin('jobs');
    const r=await db.from('applications').insert({job_id:id,user_id:state.user.id,status:'submitted'});
    if(r.error){
      if(String(r.error.code)==='23505')return status('jobStatus','أنت متقدم لهذه الوظيفة بالفعل.',true);
      return status('jobStatus','تعذر التقديم: '+r.error.message,false);
    }
    status('jobStatus','تم تسجيل طلب التقديم بنجاح.',true);
  }

  async function openCompany(){
    await loadSession();
    show(
      '<span class="eyebrow">بوابة الشركات</span><h2>أرسل طلب توظيف</h2>'+
      '<p>هذا المسار يعمل الآن كطلب شركة فعلي يُحفظ في قاعدة البيانات ليظهر للإدارة، بدل عرض مرشحين وهميين.</p>'+
      '<form class="form" id="companyForm">'+
        '<input id="companyName" required placeholder="اسم الشركة">'+
        '<input id="companyEmail" type="email" required placeholder="البريد الإلكتروني للعمل" value="'+safe(state.user&&state.user.email?state.user.email:'')+'">'+
        '<input id="companyJobTitle" required placeholder="المسمى الوظيفي المطلوب">'+
        '<textarea id="companyReq" placeholder="المهارات والخبرة المطلوبة"></textarea>'+
        '<button class="primary" type="submit">إرسال الطلب</button>'+
      '</form><p id="companyStatus" class="status"></p>'
    );
    document.getElementById('companyForm').onsubmit=submitCompany;
  }

  async function submitCompany(e){
    e.preventDefault();
    const payload={
      company_name:document.getElementById('companyName').value.trim(),
      work_email:document.getElementById('companyEmail').value.trim(),
      job_title:document.getElementById('companyJobTitle').value.trim(),
      requirements:document.getElementById('companyReq').value.trim()||null,
      submitted_by:state.user?state.user.id:null,
      status:'new'
    };
    status('companyStatus','جاري الإرسال...');
    const r=await db.from('company_requests').insert(payload);
    if(r.error)return status('companyStatus','تعذر إرسال الطلب: '+r.error.message,false);
    document.getElementById('companyForm').reset();
    status('companyStatus','تم حفظ الطلب وإرساله للإدارة.',true);
  }

  async function openCourses(){
    const r=await db.from('courses').select('id,title,description,url,status').eq('status','published').order('created_at',{ascending:false});
    const courses=r.data||[];
    show(
      '<span class="eyebrow">التطوير المستمر</span><h2>الدورات المقترحة</h2>'+
      '<p class="testNotice">المحتوى الحالي تجريبي لاختبار الرحلة، وسيتم ربط روابط الدورات المعتمدة لاحقًا.</p>'+
      '<div class="courseModalGrid">'+(courses.length?courses.map(c=>'<div class="hubItem"><b>'+safe(c.title)+'</b><p>'+safe(c.description||'')+'</p>'+(c.url?'<a class="secondary linkBtn" target="_blank" rel="noopener" href="'+safe(c.url)+'">فتح الدورة</a>':'<small>لا يوجد رابط معتمد بعد.</small>')+'</div>').join(''):'<p>لا توجد دورات منشورة بعد.</p>')+'</div>'
    );
  }

  async function appendAdminRequests(){
    await loadSession();
    if(!state.profile || state.profile.role!=='admin')return;
    const area=document.getElementById('hubArea');
    if(!area || document.getElementById('companyRequestsAdmin'))return;
    const section=document.createElement('div');
    section.id='companyRequestsAdmin';
    section.innerHTML='<h3>طلبات الشركات</h3><div id="companyRequestsList"><p>جاري التحميل...</p></div>';
    area.insertBefore(section,area.lastElementChild);
    const r=await db.from('company_requests').select('id,company_name,work_email,job_title,requirements,status,created_at').order('created_at',{ascending:false}).limit(50);
    const target=document.getElementById('companyRequestsList');
    if(r.error)return target.textContent=r.error.message;
    target.innerHTML=(r.data||[]).map(x=>'<div class="hubItem"><b>'+safe(x.company_name)+' — '+safe(x.job_title)+'</b><small>'+safe(x.work_email)+' • '+safe(x.status)+'</small><p>'+safe(x.requirements||'')+'</p><div class="hubActions"><button class="secondary" onclick="platformCompanyStatus(\''+x.id+'\',\'reviewed\')">تمت المراجعة</button><button class="secondary" onclick="platformCompanyStatus(\''+x.id+'\',\'converted\')">تحويل لمتابعة</button><button class="secondary" onclick="platformCompanyStatus(\''+x.id+'\',\'rejected\')">رفض</button></div></div>').join('')||'<p>لا توجد طلبات شركات بعد.</p>';
  }

  async function companyStatus(id,newStatus){
    const r=await db.from('company_requests').update({status:newStatus,updated_at:new Date().toISOString()}).eq('id',id);
    if(r.error)return alert('تعذر تحديث الطلب: '+r.error.message);
    document.getElementById('companyRequestsAdmin')?.remove();
    await appendAdminRequests();
  }

  async function platformOpen(view){
    if(view==='signup')return previousOpenPanel('signup');
    if(view==='admin'){
      const result=await previousOpenPanel('admin');
      setTimeout(appendAdminRequests,80);
      return result;
    }
    if(view==='account')return openAccount();
    if(view==='profile')return openProfile();
    if(view==='upload')return openUpload();
    if(view==='analysis')return openAnalysis();
    if(view==='report')return openReport();
    if(view==='plan')return openPlan();
    if(view==='advisor')return openAdvisor();
    if(view==='jobs')return openJobs();
    if(view==='company')return openCompany();
    if(view==='courses')return openCourses();
    if(view==='candidates')return openCompany();
    return previousOpenPanel(view);
  }

  async function signOut(){
    if(db)await db.auth.signOut();
    state.user=null;state.profile=null;state.latestReport=null;state.selectedFile=null;
    sessionStorage.removeItem('btt_after_login');
    syncHeader();
    closePanel();
  }

  window.platformUploadCv=uploadCv;
  window.platformApplyJob=applyJob;
  window.platformCompanyStatus=companyStatus;
  window.platformSignOut=signOut;
  window.openPanel=platformOpen;

  if(db){
    db.auth.onAuthStateChange((event,session)=>{
      state.user=session&&session.user?session.user:null;
      if(event==='SIGNED_IN'){
        const after=sessionStorage.getItem('btt_after_login');
        sessionStorage.removeItem('btt_after_login');
        setTimeout(async()=>{
          await loadSession();
          if(after)platformOpen(after);
          else if(state.profile && (state.profile.role==='admin'||state.profile.role==='consultant'))platformOpen('admin');
          else platformOpen('account');
        },1050);
      }
      if(event==='SIGNED_OUT')syncHeader();
    });
  }

  loadSession();
})();