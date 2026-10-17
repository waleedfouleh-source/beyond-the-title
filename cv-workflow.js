(() => {
  "use strict";
  const cfg = window.BTT_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase || !window.openPanel) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const panel = document.getElementById("panelContent");
  const baseOpen = window.openPanel;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let activeReport = "";
  async function userNow() {
    const { data } = await db.auth.getUser();
    return data?.user || null;
  }
  function show(html) {
    panel.innerHTML = html;
    panel.closest(".panel")?.scrollTo({ top: 0, behavior: "instant" });
  }
  async function callCoach(action, id, answers) {
    const { data, error } = await db.functions.invoke("cv-followup", { body: { action, report_id: id, answers: answers || [] } });
    if (error) {
      let details = {};
      try { details = await error.context.json(); } catch {}
      throw new Error(details.message || error.message || "تعذر الاتصال بخدمة السيرة.");
    }
    if (data?.error) throw new Error(data.message || "تعذر إكمال العملية.");
    return data || {};
  }
  async function askQuestions(id) {
    activeReport = id;
    show('<span class="eyebrow">خطوتك التالية</span><h2>نجهّز أسئلة قصيرة</h2><p>نراجع خبراتك ونختار أسئلة قليلة لتوضيح التفاصيل، مع مراعاة توصيات مرام المعتمدة.</p><p class="status">جاري تجهيز الأسئلة…</p>');
    try {
      const data = await callCoach("questions", id);
      if (data.revised_cv) return renderCv(data.revised_cv, id);
      renderQuestions(data.questions || []);
    } catch (e) {
      show('<span class="eyebrow">استكمال السيرة</span><h2>تعذر إنشاء الأسئلة</h2><p class="status error">' + esc(e.message) + '</p><button class="secondary" id="retryQuestions">إعادة المحاولة</button>');
      document.getElementById("retryQuestions").onclick = () => askQuestions(id);
    }
  }
  function renderQuestions(questions) {
    if (!Array.isArray(questions) || !questions.length) return show('<h2>لم يتم إنشاء أسئلة</h2><p>أعد المحاولة بعد قليل.</p>');
    let html = '<span class="eyebrow">توضيح الخبرة</span><h2>بضع أسئلة قصيرة عن خبرتك</h2><p>أجب على سؤال واحد على الأقل. اترك ما لا ينطبق فارغًا.</p><div class="testNotice">ستُستخدم إجاباتك مع السيرة والتوصيات المهنية المعتمدة لإعداد النسخة المعدلة.</div><form id="cvAnswers" class="form">';
    questions.forEach((q, i) => {
      html += '<label for="cvAnswer' + i + '"><b>' + esc((i + 1) + ". " + q.question) + '</b><small>' + esc(q.reason || "") + '</small></label><textarea id="cvAnswer' + i + '" maxlength="700" placeholder="' + esc(q.placeholder || "اكتب إجابة قصيرة") + '"></textarea>';
    });
    html += '<button class="primary" id="createCv" type="submit">إنشاء سيرتي المعدلة</button><p id="cvAnswerStatus" class="status"></p></form>';
    show(html);
    document.getElementById("cvAnswers").onsubmit = async (event) => {
      event.preventDefault();
      const button = document.getElementById("createCv");
      button.disabled = true;
      document.getElementById("cvAnswerStatus").textContent = "جاري تحسين السيرة…";
      const answers = questions.map((_, i) => document.getElementById("cvAnswer" + i).value);
      try { renderCv((await callCoach("finalize", activeReport, answers)).revised_cv, activeReport); }
      catch (e) {
        button.disabled = false;
        document.getElementById("cvAnswerStatus").textContent = e.message;
      }
    };
  }
  function makeDoc(cv) {
    const sections = (cv.sections || []).map((s) => '<section><h2>' + esc(s.title) + '</h2><ul>' + (s.items || []).map((x) => '<li>' + esc(x) + '</li>').join("") + '</ul></section>').join("");
    return '<!doctype html><html lang="ar" dir="auto"><head><meta charset="utf-8"><title>' + esc(cv.headline || "السيرة الذاتية") + '</title><style>body{font-family:Arial,Tahoma,sans-serif;max-width:850px;margin:38px auto;padding:0 36px;color:#172b3a;line-height:1.7}h1,h2{color:#176e69}h1{font-size:26px;border-bottom:2px solid #176e69;padding-bottom:12px}h2{font-size:18px;margin:22px 0 7px}li{margin:5px 0}section{break-inside:avoid}</style></head><body><h1>' + esc(cv.headline || "السيرة الذاتية") + '</h1><p>' + esc(cv.summary || "") + '</p>' + sections + '</body></html>';
  }
  function renderCv(cv, id) {
    if (!cv) return askQuestions(id);
    activeReport = id;
    const sections = (cv.sections || []).map((s) => '<div class="hubItem"><b>' + esc(s.title) + '</b><ul>' + (s.items || []).map((x) => '<li>' + esc(x) + '</li>').join("") + '</ul></div>').join("");
    let html = '<span class="eyebrow">نسختك المطورة</span><h2>' + esc(cv.headline || "السيرة الذاتية المعدلة") + '</h2><p>' + esc(cv.summary || "") + '</p><div class="testNotice">راجع الأسماء والتواريخ والوقائع قبل إرسال السيرة.</div>' + sections;
    if (cv.applied_guidance?.length) html += '<h3>توصيات مرام المطبقة</h3><p>' + esc(cv.applied_guidance.join("، ")) + '</p>';
    if (cv.key_changes?.length) html += '<h3>أبرز التحسينات</h3><ul>' + cv.key_changes.map((x) => '<li>' + esc(x) + '</li>').join("") + '</ul>';
    html += '<div class="actions"><button class="primary" id="downloadCv">تحميل السيرة (Word)</button><button class="secondary" id="copyCv">نسخ النص</button></div><button class="secondary" id="backReport">العودة إلى تقرير التحليل</button>';
    show(html);
    document.getElementById("downloadCv").onclick = () => {
      const blob = new Blob(["\ufeff", makeDoc(cv)], { type: "application/msword;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "السيرة-المعدلة.doc";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    };
    document.getElementById("copyCv").onclick = async () => {
      const value = [cv.headline, cv.summary].concat((cv.sections || []).flatMap((s) => [s.title].concat(s.items || []))).join("\n");
      try { await navigator.clipboard.writeText(value); document.getElementById("copyCv").textContent = "تم النسخ"; }
      catch { alert("تعذر النسخ تلقائيًا."); }
    };
    document.getElementById("backReport").onclick = () => baseOpen("report");
  }
  async function resumeLatest() {
    const user = await userNow();
    if (!user) return baseOpen("auth-login");
    const { data, error } = await db.from("cv_reports").select("id,analysis").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) {
      show('<h2>لا يوجد تقرير سيرة بعد</h2><p>ارفع سيرتك أولًا.</p><button class="primary" id="uploadCvAgain">رفع السيرة</button>');
      document.getElementById("uploadCvAgain").onclick = () => baseOpen("upload");
      return;
    }
    const revised = data.analysis?.cv_coach?.revised_cv;
    return revised ? renderCv(revised, data.id) : askQuestions(data.id);
  }
  window.bttEnhanceCv = resumeLatest;
  window.openPanel = async function(route, ...args) {
    const result = await baseOpen(route, ...args);
    if (route === "upload") {
      const privacyNote = panel.querySelector(".testNotice");
      if (privacyNote) privacyNote.textContent = "تُحفظ سيرتك الذاتية في مساحة خاصة بحسابك، ولا تكون متاحة لمستخدمين آخرين في المنصة. وبعد موافقتك، يُرسل محتواها إلى Google Gemini لتحليل الخبرات وإعداد أسئلة ونسخة محسّنة.";
      const input = document.getElementById("cvFile");
      const button = document.getElementById("cvUploadButton");
      if (input && button) button.onclick = async () => {
        const user = await userNow(), file = input.files?.[0], status = document.getElementById("cvStatus");
        if (!user) return baseOpen("auth-login");
        if (!file) { status.textContent = "اختر ملف السيرة أولًا."; return; }
        if (!document.getElementById("cvConsent")?.checked) { status.textContent = "يجب الموافقة على تحليل السيرة أولًا."; return; }
        if (file.size > 5 * 1024 * 1024 || !/\.(pdf|docx)$/i.test(file.name)) { status.textContent = "ارفع PDF أو DOCX بحجم لا يتجاوز 5MB."; return; }
        button.disabled = true;
        status.textContent = "جاري رفع السيرة وتحليلها…";
        const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = user.id + "/" + Date.now() + "-" + clean;
        const uploaded = await db.storage.from("cv-files").upload(path, file, { contentType: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), upsert: false });
        if (uploaded.error) { button.disabled = false; status.textContent = uploaded.error.message || "تعذر رفع الملف."; return; }
        // Persist the original CV even when the AI service is temporarily unavailable.
        const at = new Date().toISOString();
        const saved = await db.from("profiles").update({
          cv_file_path: path, cv_file_name: file.name, cv_uploaded_at: at, updated_at: at
        }).eq("id", user.id);
        if (saved.error) {
          await db.storage.from("cv-files").remove([path]);
          button.disabled = false;
          status.textContent = "تعذر حفظ السيرة في حسابك. تحقّق من صلاحيات ملفك الشخصي وحاول مجددًا.";
          return;
        }
        status.textContent = "تم حفظ السيرة الأصلية في حسابك. جاري تحليل السيرة…";
        const analyzed = await db.functions.invoke("analyze-cv", { body: { file_path: path, file_name: file.name } }).catch((error) => ({ data: null, error }));
        if (analyzed.error || !analyzed.data?.report) {
          button.disabled = false;
          let detail = analyzed.data?.message || analyzed.error?.message || "تعذر التحليل.";
          try { detail = (await analyzed.error.context.json()).message || detail; } catch {}
          status.textContent = detail;
          return;
        }
        status.textContent = "اكتمل التحليل. نجهّز أسئلة قصيرة…";
        return askQuestions(analyzed.data.report.id);
      };
    } else if (route === "report" || route === "analysis") {
      const user = await userNow();
      if (user) {
        const { data } = await db.from("cv_reports").select("id,analysis").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data && panel) {
          const button = document.createElement("button");
          button.className = "primary fullBtn";
          button.style.marginTop = "18px";
          button.textContent = data.analysis?.cv_coach?.revised_cv ? "عرض سيرتي المعدلة" : "تطوير سيرتي بأسئلة قصيرة";
          button.onclick = () => data.analysis?.cv_coach?.revised_cv ? renderCv(data.analysis.cv_coach.revised_cv, data.id) : askQuestions(data.id);
          panel.appendChild(button);
        }
      }
    }
    return result;
  };
})();

// Dashboard CV library: original and AI-generated versions remain tied to the applicant.
(() => {
  "use strict";
  const cfg = window.BTT_CONFIG || {};
  const panel = document.getElementById("panelContent");
  if (!panel || !cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const esc = (x) => String(x ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
  const dt = (x) => x ? new Date(x).toLocaleDateString("ar", {year:"numeric",month:"short",day:"numeric"}) : "";
  const button = (action,label,extra="",kind="secondary") =>
    '<button class="'+kind+'" data-cv-action="'+action+'" '+extra+'>'+esc(label)+'</button>';
  function cvHtml(cv) {
    if (!cv) return "";
    return '<div class="cvDocument"><h3>'+esc(cv.headline || "السيرة الذاتية المعدلة")+'</h3>'+
      '<p>'+esc(cv.summary || "")+'</p>'+
      (Array.isArray(cv.sections) ? cv.sections.map(x =>
        '<section><h4>'+esc(x.title)+'</h4><ul>'+((x.items||[]).map(y=>'<li>'+esc(y)+'</li>').join(""))+'</ul></section>').join("") : "")+
      ((cv.key_changes||[]).length ? '<section><h4>التعديلات الأساسية</h4><ul>'+
        cv.key_changes.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></section>' : "")+'</div>';
  }
  function cvDocument(cv) {
    const html=cvHtml(cv);
    return '<!doctype html><html lang="ar" dir="auto"><meta charset="utf-8"><title>السيرة الذاتية المعدلة</title>'+
      '<style>body{font-family:Arial,sans-serif;margin:35px auto;max-width:850px;padding:20px;line-height:1.6;color:#102b3f}h3,h4{color:#176e69}li{margin:5px}section{break-inside:avoid}</style><body>'+
      html+'</body></html>';
  }
  function downloadBlob(blob, filename) {
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=filename; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 15000);
  }
  function fileAttrs(path,name) {
    return 'data-cv-path="'+esc(path)+'" data-cv-name="'+esc(name || "CV")+'"';
  }
  function originalCard(path,name) {
    if(!path) return '<div class="cvVersionCard"><h4>السيرة الأصلية</h4><p>لم تُرفع سيرة بعد.</p></div>';
    const attrs=fileAttrs(path,name);
    return '<div class="cvVersionCard"><h4>السيرة الأصلية</h4><p class="cvFileName">'+esc(name||"ملف السيرة")+'</p>'+
      '<div class="hubActions">'+button("preview", "عرض الأصلية", attrs)+
      button("download", "تنزيل الأصلية", attrs)+'</div><div class="cvOriginalPreview" aria-live="polite"></div></div>';
  }
  function revisedCard(report, allowEnhance=false) {
    const cv=report?.analysis?.cv_coach?.revised_cv;
    if (!cv) return '<div class="cvVersionCard"><h4>السيرة المعدلة بواسطة AI</h4>'+
      '<p>لم تكتمل النسخة المعدلة بعد. تظهر هنا تلقائيًا بعد إنهاء الأسئلة وإنشاء السيرة.</p>'+
      (report?.id && allowEnhance ? button("enhance","إنشاء/استكمال السيرة المعدلة") : "")+'</div>';
    return '<div class="cvVersionCard"><h4>السيرة المعدلة بواسطة AI</h4>'+
      '<p>النسخة التي أنشأها الذكاء الاصطناعي محفوظة في حساب المتقدم.</p>'+
      '<details open><summary>عرض السيرة المعدلة</summary>'+cvHtml(cv)+'</details>'+
      button("word","تنزيل النسخة المعدلة (Word)",'data-report="'+esc(report.id)+'"')+'</div>';
  }
  function profileHtml(p) {
    if(!p) return "";
    return '<p class="cvApplicantBio">'+esc(p.headline || "لا توجد نبذة مهنية مسجلة.")+'</p>'+
      '<div class="cvApplicantMeta">'+
      (p.city?'<span>المدينة: '+esc(p.city)+'</span>':"")+
      (p.target_field?'<span>المجال: '+esc(p.target_field)+'</span>':"")+
      (p.experience_years != null?'<span>الخبرة: '+esc(p.experience_years)+' سنة</span>':"")+
      (Array.isArray(p.skills) && p.skills.length ? '<span>المهارات: '+esc(p.skills.join("، "))+'</span>':"")+
      '</div>';
  }
  const cache=new Map();
  async function checkAuth() {
    const {data}=await db.auth.getUser();
    if (!data?.user) return null;
    const {data:profile}=await db.from("profiles").select("id,role").eq("id",data.user.id).maybeSingle();
    return profile ? {user:data.user, role:profile.role}:null;
  }
  async function previewFile(btn, asDownload=false) {
    const path=btn.dataset.cvPath, name=btn.dataset.cvName || "CV";
    if(!path) return;
    const card=btn.closest(".cvVersionCard");
    const target=card?.querySelector(".cvOriginalPreview");
    if (!asDownload && target) target.textContent="جاري فتح السيرة الأصلية…";
    const {data,error}=await db.storage.from("cv-files").download(path);
    if(error || !data) {
      if(target) target.textContent="تعذر فتح الملف؛ تحقق من صلاحية الوصول للسير الذاتية.";
      else alert("تعذر تنزيل السيرة الأصلية.");
      return;
    }
    if(asDownload) return downloadBlob(data,name);
    if(!target || !target.isConnected) return;
    if(/\.pdf$/i.test(name) || data.type === "application/pdf") {
      const url=URL.createObjectURL(data);
      target.replaceChildren();
      const frame=document.createElement("iframe");
      frame.title="معاينة السيرة الأصلية"; frame.src=url; frame.className="cvPdfFrame";
      target.append(frame);
      setTimeout(()=>URL.revokeObjectURL(url), 5*60*1000);
    } else {
      target.textContent="المعاينة المباشرة متاحة لملفات PDF. اضغط «تنزيل الأصلية» لفتح ملف Word.";
    }
  }
  function wire(root, reports) {
    const byId=new Map(reports.filter(Boolean).map(r=>[r.id,r]));
    root.addEventListener("click", async e=>{
      const btn=e.target.closest("button[data-cv-action]");
      if(!btn || !root.contains(btn)) return;
      const action=btn.dataset.cvAction;
      if(action==="enhance") return window.bttEnhanceCv?.();
      if(action==="preview" || action==="download") {
        btn.disabled=true;
        try { await previewFile(btn,action==="download"); }
        finally {btn.disabled=false;}
      }
      if(action==="word") {
        const report=byId.get(btn.dataset.report);
        const cv=report?.analysis?.cv_coach?.revised_cv;
        if(cv) downloadBlob(new Blob(["\ufeff",cvDocument(cv)],{type:"application/msword;charset=utf-8"}),"السيرة-المعدلة.doc");
      }
    });
  }
  async function renderMyCv(slot) {
    const auth=await checkAuth();
    if(!slot.isConnected) return;
    if(!auth || auth.role==="consultant" || auth.role==="admin") { slot.remove(); return; }
    const [reports, prof] = await Promise.all([
      db.from("cv_reports").select("id,file_path,file_name,analysis,created_at").eq("user_id",auth.user.id).order("created_at",{ascending:false}).limit(1),
      db.from("profiles").select("full_name,headline,cv_file_path,cv_file_name,cv_uploaded_at").eq("id",auth.user.id).maybeSingle()
    ]);
    if(!slot.isConnected) return;
    if(reports.error || prof.error) {
      slot.innerHTML='<p class="status error">تعذر عرض ملفاتك المحفوظة الآن.</p>';return;
    }
    const latestReport=reports.data?.[0], profile=prof.data||{};
    const report = latestReport && (!profile.cv_file_path || latestReport.file_path === profile.cv_file_path) ? latestReport : null;
    const path=profile.cv_file_path || report?.file_path;
    const name=profile.cv_file_name || report?.file_name;
    slot.innerHTML='<h3>سيرتك الذاتية — الأصلية والمعدلة</h3>'+
      '<p>كل نسخة محفوظة ضمن ملفك وتستطيع العودة إليها بعد تسجيل الدخول.</p>'+
      profileHtml(profile)+
      '<div class="cvDualCards">'+originalCard(path,name)+revisedCard(report,true)+'</div>';
    wire(slot,[report]);
  }
  function personBlock(p, r, questions) {
    const id=p.id, name=p.full_name || "مستخدم";
    const path=p.cv_file_path || r?.file_path;
    const filename=p.cv_file_name || r?.file_name;
    if(r && p.cv_file_path && r.file_path!==p.cv_file_path) r=null;
    const coach=r?.analysis?.cv_coach || {};
    const answers=Array.isArray(coach.answers) ? coach.answers : [];
    const followups=Array.isArray(coach.questions) ? coach.questions : [];
    const questionList=questions.filter(x=>x.user_id===id);
    const qHtml=followups.length ? '<h5>أسئلة تحسين السيرة وإجابات المتقدم</h5><ol>'+
      followups.map((q,i)=>'<li><b>'+esc(q.question)+'</b><p>'+esc(answers[i]?.answer || "لم تتم الإجابة بعد")+'</p></li>').join("")+'</ol>' : "";
    const advisorHtml=questionList.length ? '<h5>أسئلة المستخدم إلى مرام</h5><ol>'+
      questionList.map(q=>'<li><b>'+esc(q.question)+'</b><small> · '+esc(q.status)+'</small>'+
      (q.admin_reply?'<p>الرد: '+esc(q.admin_reply)+'</p>':"")+'</li>').join("")+'</ol>' : "";
    return '<article class="cvApplicant"><h4>'+esc(name)+'</h4>'+
      '<small>المتقدم '+esc(id.slice(0,8))+' · '+esc(dt(p.cv_uploaded_at || r?.created_at))+'</small>'+
      profileHtml(p)+
      '<div class="cvDualCards">'+originalCard(path,filename)+revisedCard(r)+'</div>'+
      (qHtml || advisorHtml ? '<details class="cvQuestionDetails"><summary>أسئلة وإجابات المتقدم ('+(followups.length+questionList.length)+')</summary>'+qHtml+advisorHtml+'</details>' :
        '<p class="cvMuted">لا توجد أسئلة مرتبطة بهذا المستخدم بعد.</p>')+'</article>';
  }
  async function renderStaffCv(slot,role) {
    const auth=await checkAuth();
    if(!slot.isConnected || !auth || auth.role!==role) return;
    const [reports, profiles, questions]=await Promise.all([
      db.from("cv_reports").select("id,user_id,file_path,file_name,analysis,created_at").order("created_at",{ascending:false}).limit(100),
      db.from("profiles").select("id,role,full_name,city,headline,skills,experience_years,target_field,cv_file_path,cv_file_name,cv_uploaded_at").eq("role","candidate").limit(200),
      db.from("advisor_questions").select("user_id,question,status,admin_reply,created_at").order("created_at",{ascending:false}).limit(100)
    ]);
    if(!slot.isConnected) return;
    if(reports.error || profiles.error || questions.error) {
      slot.innerHTML='<h3>السير الذاتية والمتقدمون</h3><p class="status error">تعذر عرض ملفات المتقدمين. تأكد من تطبيق تحديث صلاحيات Supabase الخاص بلوحة مرام ووليد.</p>';
      return;
    }
    const byId=new Map();
    (reports.data||[]).forEach(r=>{if(!byId.has(r.user_id)) byId.set(r.user_id,r);});
    const people=(profiles.data||[]).filter(p=>p.cv_file_path || byId.has(p.id) || (questions.data||[]).some(q=>q.user_id===p.id));
    people.sort((a,b)=>new Date(b.cv_uploaded_at||byId.get(b.id)?.created_at||0)-new Date(a.cv_uploaded_at||byId.get(a.id)?.created_at||0));
    slot.innerHTML='<h3>ملفات المتقدمين ومراجعة الـAI</h3>'+
      '<p>عرض مباشر للبيانات والأسئلة والسيرة الأصلية ومقابلها النسخة المعدلة. لا يمكن للمتقدمين الاطلاع على ملفات بعضهم.</p>'+
      '<p class="cvMuted">عدد المتقدمين المعروضين: '+people.length+'</p>'+
      (people.length?people.map(p=>personBlock(p,byId.get(p.id),questions.data||[])).join("") :
        '<p class="maramEmpty">لا توجد ملفات أو أسئلة مقدمة بعد.</p>');
    wire(slot, reports.data||[]);
  }
  function prepareMaram(dashboard) {
    if(dashboard.dataset.cvLibraryMounted) return;
    dashboard.dataset.cvLibraryMounted="1";
    const form=dashboard.querySelector("#maram-add");
    const stats=dashboard.querySelector(".maramStats");
    if(form && stats) {
      dashboard.insertBefore(form,stats);
      const heading=form.querySelector("h3");
      if(heading) heading.textContent="توصيات مرام للذكاء الاصطناعي";
      const description=form.querySelector("p");
      if(description) description.textContent="اكتبي هنا تعليمات تحسين السير الذاتية وملاحظاتك المهنية. تُرسل إلى وليد للاعتماد قبل استخدامها بواسطة الذكاء الاصطناعي.";
      const body=form.querySelector("#cKBody");
      if(body) body.placeholder="مثال: يجب إبراز النتائج الفعلية بالأرقام، وعدم إضافة شهادات أو خبرات غير مثبتة في السيرة الأصلية.";
    }
    const slot=document.createElement("section");
    slot.className="maramSection cvLibrarySection";slot.setAttribute("aria-live","polite");
    slot.innerHTML="<h3>ملفات المتقدمين ومراجعة الذكاء الاصطناعي</h3><p>جاري تحميل الملفات…</p>";
    if(form) form.insertAdjacentElement("afterend",slot);
    else dashboard.querySelector(".maramWelcome")?.insertAdjacentElement("afterend",slot);
    renderStaffCv(slot,"consultant");
  }
  function prepareAdmin(identity) {
    if(identity.dataset.cvLibraryMounted) return;
    identity.dataset.cvLibraryMounted="1";
    const slot=document.createElement("section");
    slot.className="maramSection cvLibrarySection";
    slot.innerHTML="<h3>معلومات المتقدمين والأسئلة</h3><p>جاري تحميل الملفات…</p>";
    identity.insertAdjacentElement("afterend",slot);
    renderStaffCv(slot,"admin");
  }
  function prepareAccount(card) {
    if(card.dataset.cvLibraryMounted) return;
    card.dataset.cvLibraryMounted="1";
    const slot=document.createElement("section");
    slot.className="cvMyLibrary";
    slot.innerHTML="<h3>السير الذاتية المحفوظة</h3><p>جاري تحميل ملفاتك…</p>";
    card.insertAdjacentElement("afterend",slot);
    renderMyCv(slot);
  }
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled) return;scheduled=true;
    queueMicrotask(()=>{
      scheduled=false;
      const maram=panel.querySelector(".maramDashboard");
      if(maram) return prepareMaram(maram);
      const admin=panel.querySelector(".hubIdentity");
      if(admin) return prepareAdmin(admin);
      const account=panel.querySelector(".accountCard");
      if(account) return prepareAccount(account);
    });
  });
  observer.observe(panel,{childList:true,subtree:true});
  const existing=panel.querySelector(".maramDashboard, .hubIdentity, .accountCard");
  if(existing) {
    if(existing.classList.contains("maramDashboard")) prepareMaram(existing);
    else if(existing.classList.contains("hubIdentity")) prepareAdmin(existing);
    else prepareAccount(existing);
  }
})();
