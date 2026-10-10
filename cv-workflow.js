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
        status.textContent = "جاري تحليل السيرة…";
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