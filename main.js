(() => {
  'use strict';

  const cfg = window.BTT_CONFIG || {};
  const db = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
    : null;

  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const panel = $('panelContent');

  const state = {
    user: null,
    profile: null,
    latestReport: null,
    selectedFile: null,
    afterAuth: null
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const fmtDate = (value) => {
    if (!value) return '';
    try { return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
    catch { return String(value); }
  };

  const roleLabel = (role) => ({
    admin: 'مدير المنصة — Admin',
    consultant: 'المستشارة — Consultant',
    candidate: 'باحث عن عمل',
    employer: 'شركة / صاحب عمل'
  }[role] || role || 'مستخدم');

  function show(html) {
    panel.innerHTML = html;
    overlay.classList.add('show');
    panel.closest('.panel')?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closePanel() {
    overlay.classList.remove('show');
  }

  function status(id, message, kind = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = message || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function errText(error, fallback = 'حدث خطأ غير متوقع.') {
    const msg = String(error?.message || error || '').trim();
    if (/Invalid login credentials/i.test(msg)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    if (/Email not confirmed/i.test(msg)) return 'يجب تأكيد البريد الإلكتروني أولًا.';
    if (/already registered|User already registered/i.test(msg)) return 'هذا البريد مسجل بالفعل. جرّب تسجيل الدخول.';
    if (/rate limit/i.test(msg)) return 'تم تجاوز حد المحاولات مؤقتًا. جرّب بعد قليل.';
    if (/Email address not authorized/i.test(msg)) return 'إرسال البريد غير مهيأ لهذا العنوان حاليًا.';
    if (/row-level security|permission denied|42501/i.test(msg)) return 'الصلاحية المطلوبة غير متاحة لهذا الحساب.';
    return msg ? msg : fallback;
  }

  async function loadSession() {
    if (!db) {
      state.user = null;
      state.profile = null;
      syncHeader();
      return null;
    }
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) {
      state.user = null;
      state.profile = null;
      syncHeader();
      return null;
    }
    state.user = data.user;
    const p = await db.from('profiles')
      .select('id,full_name,role,city,headline,skills,experience_years,target_field,updated_at')
      .eq('id', state.user.id)
      .maybeSingle();
    state.profile = p.data || null;
    syncHeader();
    return state.user;
  }

  function syncHeader() {
    const btn = $('accountButton');
    const staffBtn = $('staffButton');
    if (btn) {
      if (state.user) {
        btn.textContent = 'حسابي';
        btn.onclick = () => openPanel('account');
      } else {
        btn.textContent = 'تسجيل الدخول';
        btn.onclick = () => openPanel('auth-login');
      }
    }
    if (staffBtn) {
      if (state.profile?.role === 'admin') staffBtn.textContent = 'لوحة وليد';
      else if (state.profile?.role === 'consultant') staffBtn.textContent = 'مساحة مرام';
      else staffBtn.textContent = 'دخول الإدارة والاستشارة';
    }
  }

  async function requireAuth(nextRoute) {
    await loadSession();
    if (state.user) return true;
    state.afterAuth = nextRoute || 'account';
    renderAuth('login', state.afterAuth);
    return false;
  }

  async function afterLogin() {
    await loadSession();
    const target = state.afterAuth;
    state.afterAuth = null;
    if (target) return openPanel(target);
    if (['admin', 'consultant'].includes(state.profile?.role)) return openPanel('staff');
    return openPanel('account');
  }

  function renderAuth(mode = 'login', next = null) {
    state.afterAuth = next || state.afterAuth;
    const signup = mode === 'signup';
    show(
      '<span class="eyebrow">حسابك في ما وراء العنوان</span>' +
      '<h2>' + (signup ? 'إنشاء حساب جديد' : 'تسجيل الدخول') + '</h2>' +
      '<p>' + (signup
        ? 'أنشئ الحساب ثم أكد بريدك الإلكتروني. دور وليد ومرام يُحدد تلقائيًا من البريد المعتمد.'
        : 'أدخل البريد الإلكتروني وكلمة المرور.') + '</p>' +
      '<form class="form" id="authForm">' +
        (signup ? '<input id="authName" autocomplete="name" required placeholder="الاسم الكامل">' : '') +
        '<input id="authEmail" type="email" autocomplete="email" required placeholder="البريد الإلكتروني">' +
        '<input id="authPassword" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" minlength="8" required placeholder="كلمة المرور (8 أحرف على الأقل)">' +
        '<button class="primary" id="authSubmit" type="submit">' + (signup ? 'إنشاء الحساب' : 'تسجيل الدخول') + '</button>' +
      '</form>' +
      '<p id="authStatus" class="status"></p>' +
      (signup ? '<button class="secondary fullBtn" id="resendButton" type="button">إعادة إرسال رابط التأكيد</button>' : '<button class="secondary fullBtn" id="forgotPasswordButton" type="button">نسيت كلمة المرور؟</button>') +
      '<button class="secondary fullBtn" id="authSwitch" type="button">' + (signup ? 'عندي حساب بالفعل' : 'إنشاء حساب جديد') + '</button>'
    );

    $('authSwitch').onclick = () => renderAuth(signup ? 'login' : 'signup', state.afterAuth);
    if (signup) $('resendButton').onclick = resendConfirmation;
    else $('forgotPasswordButton').onclick = () => renderForgotPassword($('authEmail')?.value.trim() || '');
    $('authForm').onsubmit = submitAuth;
  }

  async function submitAuth(e) {
    e.preventDefault();
    if (!db) return status('authStatus', 'الاتصال بقاعدة البيانات غير متاح.', 'error');

    const mode = $('authName') ? 'signup' : 'login';
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const name = $('authName')?.value.trim() || '';
    const btn = $('authSubmit');

    btn.disabled = true;
    status('authStatus', 'جاري المعالجة...');

    try {
      if (mode === 'signup') {
        const result = await db.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: cfg.siteUrl || (location.origin + location.pathname)
          }
        });
        if (result.error) throw result.error;
        const identities = result.data?.user?.identities;
        if (Array.isArray(identities) && identities.length === 0) {
          status('authStatus', 'هذا البريد مسجل مسبقًا. جرّب تسجيل الدخول أو إعادة إرسال رابط التأكيد.', 'error');
        } else {
          status('authStatus', 'تم إنشاء الحساب. راجع البريد، أكد الحساب، ثم ارجع وسجّل الدخول.', 'ok');
        }
      } else {
        const result = await db.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        status('authStatus', 'تم تسجيل الدخول.', 'ok');
        setTimeout(afterLogin, 250);
      }
    } catch (error) {
      status('authStatus', errText(error), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function resendConfirmation() {
    if (!db) return status('authStatus', 'الاتصال بقاعدة البيانات غير متاح.', 'error');
    const email = $('authEmail')?.value.trim();
    if (!email) return status('authStatus', 'أدخل البريد الإلكتروني أولًا.', 'error');
    status('authStatus', 'جاري إرسال رابط التأكيد...');
    const { error } = await db.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: cfg.siteUrl || (location.origin + location.pathname) }
    });
    status('authStatus', error ? errText(error) : 'تم إرسال رابط التأكيد. افحص الوارد والرسائل غير المرغوب فيها.', error ? 'error' : 'ok');
  }


  function recoveryRedirectUrl() {
    const base = cfg.siteUrl || (location.origin + location.pathname);
    try {
      const url = new URL(base, location.href);
      url.searchParams.set('mode', 'recovery');
      return url.toString();
    } catch {
      return base;
    }
  }

  function renderForgotPassword(prefill = '') {
    show(
      '<span class="eyebrow">استعادة الحساب</span><h2>نسيت كلمة المرور؟</h2>' +
      '<p>أدخل بريد الحساب وسنرسل لك رابطًا آمنًا لتعيين كلمة مرور جديدة.</p>' +
      '<form class="form" id="forgotPasswordForm">' +
        '<input id="recoveryEmail" type="email" autocomplete="email" required placeholder="البريد الإلكتروني" value="' + esc(prefill) + '">' +
        '<button class="primary" id="recoverySend" type="submit">إرسال رابط تغيير كلمة المرور</button>' +
      '</form>' +
      '<p id="recoveryStatus" class="status"></p>' +
      '<button class="secondary fullBtn" type="button" onclick="openPanel(\'auth-login\')">العودة لتسجيل الدخول</button>'
    );
    $('forgotPasswordForm').onsubmit = requestPasswordReset;
  }

  async function requestPasswordReset(e) {
    e?.preventDefault();
    if (!db) return status('recoveryStatus', 'الاتصال بقاعدة البيانات غير متاح.', 'error');
    const email = $('recoveryEmail')?.value.trim();
    if (!email) return status('recoveryStatus', 'أدخل البريد الإلكتروني.', 'error');
    const btn = $('recoverySend');
    if (btn) btn.disabled = true;
    status('recoveryStatus', 'جاري إرسال رابط الاستعادة...');

    try {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: recoveryRedirectUrl()
      });
      if (error) throw error;
      status('recoveryStatus', 'تم إرسال طلب الاستعادة. افحص الوارد وSpam/Junk. قد يستغرق البريد دقيقة أو دقيقتين.', 'ok');
    } catch (error) {
      status('recoveryStatus', errText(error), 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderPasswordUpdate() {
    show(
      '<span class="eyebrow">تعيين كلمة مرور جديدة</span><h2>اختر كلمة مرور جديدة</h2>' +
      '<p>اكتب كلمة المرور الجديدة مرتين ثم احفظها.</p>' +
      '<form class="form" id="passwordUpdateForm">' +
        '<input id="newPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="كلمة المرور الجديدة (8 أحرف على الأقل)">' +
        '<input id="newPasswordConfirm" type="password" autocomplete="new-password" minlength="8" required placeholder="تأكيد كلمة المرور الجديدة">' +
        '<button class="primary" id="passwordUpdateButton" type="submit">حفظ كلمة المرور الجديدة</button>' +
      '</form><p id="passwordUpdateStatus" class="status"></p>'
    );
    $('passwordUpdateForm').onsubmit = updatePassword;
  }

  async function updatePassword(e) {
    e.preventDefault();
    const p1 = $('newPassword').value;
    const p2 = $('newPasswordConfirm').value;
    if (p1.length < 8) return status('passwordUpdateStatus', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.', 'error');
    if (p1 !== p2) return status('passwordUpdateStatus', 'كلمتا المرور غير متطابقتين.', 'error');

    const btn = $('passwordUpdateButton');
    btn.disabled = true;
    status('passwordUpdateStatus', 'جاري تحديث كلمة المرور...');
    const { error } = await db.auth.updateUser({ password: p1 });
    btn.disabled = false;

    if (error) return status('passwordUpdateStatus', errText(error), 'error');
    status('passwordUpdateStatus', 'تم تغيير كلمة المرور بنجاح. يمكنك استخدام كلمة المرور الجديدة من الآن.', 'ok');

    try {
      const url = new URL(location.href);
      url.searchParams.delete('mode');
      history.replaceState({}, document.title, url.pathname + url.search);
    } catch {}

    setTimeout(() => openPanel('account'), 900);
  }

  async function signOut() {
    if (db) await db.auth.signOut();
    state.user = null;
    state.profile = null;
    state.latestReport = null;
    state.selectedFile = null;
    syncHeader();
    closePanel();
  }

  async function renderAccount() {
    if (!(await requireAuth('account'))) return;
    await loadSession();
    const role = state.profile?.role || 'candidate';
    const name = state.profile?.full_name || state.user.email;
    show(
      '<span class="eyebrow">حسابي</span>' +
      '<h2>' + esc(name) + '</h2>' +
      '<div class="accountCard"><div><b>' + esc(state.user.email) + '</b><small>' + esc(roleLabel(role)) + '</small></div><span>متصل</span></div>' +
      '<div class="actionStack">' +
        (['admin', 'consultant'].includes(role) ? '<button class="primary" onclick="openPanel(\'staff\')">فتح ' + (role === 'admin' ? 'لوحة وليد' : 'مساحة مرام') + '</button>' : '') +
        (role !== 'consultant' ? '<button class="secondary" onclick="openPanel(\'profile\')">الملف المهني</button>' : '') +
        '<button class="secondary" onclick="openPanel(\'jobs\')">الوظائف</button>' +
        '<button class="secondary" onclick="openPanel(\'advisor\')">مستشار مرام</button>' +
        '<button class="secondary" onclick="bttSendOwnPasswordReset()">إرسال رابط تغيير كلمة المرور إلى بريدي</button>' +
        '<button class="dangerBtn" onclick="bttSignOut()">تسجيل الخروج</button>' +
      '</div>'
    );
  }

  async function renderProfile() {
    if (!(await requireAuth('profile'))) return;
    await loadSession();
    if (state.profile?.role === 'consultant') return openPanel('staff');

    const p = state.profile || {};
    const skills = Array.isArray(p.skills) ? p.skills.join('، ') : '';
    const fields = ['المبيعات', 'التسويق', 'الإدارة', 'التكنولوجيا', 'الموارد البشرية', 'أخرى'];
    show(
      '<span class="eyebrow">ملفك المهني</span><h2>خلّينا نتعرّف عليك</h2>' +
      '<p>هذه البيانات تستخدم في المطابقة، تقرير الاختبار وخطة التطوير.</p>' +
      '<form class="form" id="profileForm">' +
        '<input id="pName" required placeholder="الاسم الكامل" value="' + esc(p.full_name || '') + '">' +
        '<input id="pCity" placeholder="المدينة" value="' + esc(p.city || '') + '">' +
        '<input id="pExperience" type="number" min="0" max="60" placeholder="سنوات الخبرة" value="' + esc(p.experience_years ?? '') + '">' +
        '<select id="pField"><option value="">المجال المطلوب</option>' +
          fields.map((f) => '<option value="' + esc(f) + '"' + (p.target_field === f ? ' selected' : '') + '>' + esc(f) + '</option>').join('') +
        '</select>' +
        '<input id="pSkills" placeholder="المهارات، افصل بينها بفاصلة" value="' + esc(skills) + '">' +
        '<button class="primary" id="profileSave" type="submit">حفظ ومتابعة إلى الـCV</button>' +
      '</form><p id="profileStatus" class="status"></p>'
    );
    $('profileForm').onsubmit = saveProfile;
  }

  async function saveProfile(e) {
    e.preventDefault();
    const btn = $('profileSave');
    btn.disabled = true;
    status('profileStatus', 'جاري الحفظ...');

    const exp = $('pExperience').value;
    const patch = {
      full_name: $('pName').value.trim(),
      city: $('pCity').value.trim() || null,
      experience_years: exp === '' ? null : Number(exp),
      target_field: $('pField').value || null,
      skills: $('pSkills').value.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
      updated_at: new Date().toISOString()
    };

    const { error } = await db.from('profiles').update(patch).eq('id', state.user.id);
    btn.disabled = false;
    if (error) return status('profileStatus', errText(error), 'error');
    state.profile = { ...(state.profile || {}), ...patch };
    status('profileStatus', 'تم حفظ الملف المهني بنجاح.', 'ok');
    setTimeout(() => renderUpload(), 300);
  }

  async function renderUpload() {
    if (!(await requireAuth('upload'))) return;
    show(
      '<span class="eyebrow">السيرة الذاتية</span><h2>ارفع الـCV</h2>' +
      '<p class="testNotice">الرفع حقيقي وخاص بحسابك. تحليل النص بواسطة نموذج AI كامل غير مفعل بعد؛ تقرير الاختبار يعتمد حاليًا على ملفك المهني وبيانات الملف.</p>' +
      '<label class="drop fileDrop" for="cvFile"><h3 id="fileTitle">اضغط لاختيار الملف</h3><p id="fileMeta">PDF, DOC, DOCX • حتى 5MB</p><input id="cvFile" type="file" hidden accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>' +
      '<button class="primary fullBtn" id="cvUploadButton" type="button">رفع الملف وإنشاء تقرير الاختبار</button>' +
      '<p id="cvStatus" class="status"></p>'
    );

    $('cvFile').onchange = (e) => {
      state.selectedFile = e.target.files?.[0] || null;
      if (state.selectedFile) {
        $('fileTitle').textContent = state.selectedFile.name;
        $('fileMeta').textContent = (state.selectedFile.size / 1024 / 1024).toFixed(2) + ' MB';
      }
    };
    $('cvUploadButton').onclick = uploadCv;
  }

  function buildAnalysis(profile, file) {
    const p = profile || {};
    const exp = Number(p.experience_years || 0);
    const skills = Array.isArray(p.skills) ? p.skills.filter(Boolean) : [];
    const target = p.target_field || 'مسار مهني عام';
    let score = 52 + Math.min(exp * 3, 18) + Math.min(skills.length * 4, 16) + (p.city ? 4 : 0) + (p.target_field ? 7 : 0);
    score = Math.max(50, Math.min(92, score));

    let gaps = ['عرض الإنجازات بالأرقام', 'تحسين الكلمات المفتاحية', 'الاستعداد للمقابلات'];
    if (/مبيعات/.test(target)) gaps = ['عرض نتائج المبيعات بالأرقام', 'CRM وإدارة خط المبيعات', 'التفاوض والإغلاق'];
    else if (/تسويق/.test(target)) gaps = ['قياس نتائج الحملات', 'Portfolio للأعمال', 'تحليل البيانات التسويقية'];
    else if (/تكنولوجيا/.test(target)) gaps = ['مشاريع عملية موثقة', 'Portfolio / Git', 'ربط المهارات بمتطلبات الوظيفة'];
    else if (/موارد/.test(target)) gaps = ['مؤشرات HR قابلة للقياس', 'أنظمة HRIS', 'قياس أثر التدريب والتوظيف'];

    return {
      mode: 'profile_based_test',
      score,
      target,
      strengths: skills.length ? skills.slice(0, 4) : ['الخبرة العملية', 'التواصل', 'القدرة على التعلم'],
      gaps,
      opportunity: target,
      file_name: file.name,
      note: 'نتيجة تشغيلية للاختبار، مبنية على الملف المهني وبيانات الملف المرفوع وليست قراءة AI كاملة لنص السيرة بعد.'
    };
  }

  async function uploadCv() {
    await loadSession();
    const file = state.selectedFile || $('cvFile')?.files?.[0];
    if (!file) return status('cvStatus', 'اختر ملف CV أولًا.', 'error');
    if (file.size > 5 * 1024 * 1024) return status('cvStatus', 'الملف أكبر من 5MB.', 'error');

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'doc', 'docx'].includes(ext)) return status('cvStatus', 'نوع الملف غير مدعوم.', 'error');

    const mime = file.type || ({
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }[ext]);

    const btn = $('cvUploadButton');
    btn.disabled = true;
    status('cvStatus', 'جاري رفع الملف...');

    const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = state.user.id + '/' + Date.now() + '-' + clean;
    const up = await db.storage.from('cv-files').upload(path, file, { contentType: mime, upsert: false });
    if (up.error) {
      btn.disabled = false;
      return status('cvStatus', errText(up.error), 'error');
    }

    const analysis = buildAnalysis(state.profile || {}, file);
    const inserted = await db.from('cv_reports').insert({
      user_id: state.user.id,
      file_path: path,
      file_name: file.name,
      status: 'ready',
      analysis
    }).select('id,file_path,file_name,status,analysis,created_at').single();

    btn.disabled = false;
    if (inserted.error) return status('cvStatus', 'تم رفع الملف لكن فشل إنشاء التقرير: ' + errText(inserted.error), 'error');

    state.latestReport = inserted.data;
    status('cvStatus', 'تم رفع الملف وإنشاء التقرير.', 'ok');
    setTimeout(() => renderReport(), 250);
  }

  async function getLatestReport() {
    if (state.latestReport) return state.latestReport;
    if (!(await requireAuth('report'))) return null;
    const r = await db.from('cv_reports')
      .select('id,file_path,file_name,status,analysis,created_at')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    state.latestReport = r.data || null;
    return state.latestReport;
  }

  async function renderReport() {
    const report = await getLatestReport();
    if (!state.user) return;
    if (!report) {
      show('<span class="eyebrow">التقرير</span><h2>لا يوجد تقرير بعد</h2><p>ارفع الـCV أولًا لإنشاء تقرير الاختبار.</p><button class="primary" onclick="openPanel(\'upload\')">رفع CV</button>');
      return;
    }

    const a = report.analysis || {};
    const strengths = (a.strengths || []).map((x) => '<li>' + esc(x) + '</li>').join('');
    const gaps = (a.gaps || []).map((x) => '<li>' + esc(x) + '</li>').join('');

    show(
      '<span class="eyebrow">تقريرك الشخصي</span><h2>جاهزيتك المهنية — نسخة الاختبار</h2>' +
      '<div class="score">' + esc(a.score || 0) + '%</div>' +
      '<p class="testNotice">' + esc(a.note || '') + '</p>' +
      '<div class="miniCards">' +
        '<div><b>نقاط القوة</b><ul>' + strengths + '</ul></div>' +
        '<div><b>تحتاج تطوير</b><ul>' + gaps + '</ul></div>' +
        '<div><b>المسار المستهدف</b><p>' + esc(a.target || 'غير محدد') + '</p></div>' +
      '</div>' +
      '<p class="metaLine">الملف: ' + esc(report.file_name || 'CV') + ' • ' + esc(fmtDate(report.created_at)) + '</p>' +
      '<button class="primary" onclick="openPanel(\'plan\')">بناء خطة التطوير</button>'
    );
  }

  async function renderPlan() {
    const report = await getLatestReport();
    if (!state.user) return;
    if (!report) return renderReport();

    const a = report.analysis || {};
    const gaps = a.gaps || [];
    const target = a.target || 'المسار المستهدف';
    const steps = [
      'إعادة صياغة 3–5 إنجازات في الـCV بأرقام ونتائج قابلة للقياس.',
      gaps[0] ? 'العمل على: ' + gaps[0] + '.' : 'تحديد فجوة مهارية واحدة والعمل عليها.',
      gaps[1] ? 'العمل على: ' + gaps[1] + '.' : 'تحسين الكلمات المفتاحية في السيرة.',
      'تدريب مقابلة واحدة لوظيفة ضمن مسار ' + target + '.',
      'مراجعة الوظائف المنشورة والتقديم فقط على الفرص ذات التطابق الأعلى.'
    ];

    show(
      '<span class="eyebrow">خطة تطوير</span><h2>خطتك للأسبوع القادم</h2>' +
      '<ol class="planList">' + steps.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
      '<button class="primary" onclick="openPanel(\'advisor\')">اسأل مستشار مرام</button>'
    );
  }

  async function advisorAnswer(question) {
    const report = await getLatestReport();
    const a = report?.analysis || {};
    const q = question.trim();
    const tokens = q.toLowerCase().split(/\s+/).filter((x) => x.length >= 4).slice(0, 10);

    const knowledge = await db.from('knowledge')
      .select('title,body,source_role,status')
      .eq('status', 'approved')
      .limit(100);

    if (!knowledge.error && Array.isArray(knowledge.data)) {
      const hit = knowledge.data.find((row) => {
        const hay = ((row.title || '') + ' ' + (row.body || '')).toLowerCase();
        return tokens.some((t) => hay.includes(t));
      });
      if (hit) {
        const body = String(hit.body || '');
        return {
          answer: 'حسب المرجعية المهنية المعتمدة داخل المنصة: ' + body.slice(0, 800) + (body.length > 800 ? '…' : ''),
          source: hit.source_role === 'consultant' ? 'approved_consultant' : 'approved_knowledge'
        };
      }
    }

    const target = a.target || state.profile?.target_field || 'المسار المهني';
    const gaps = a.gaps || [];

    if (/وظيف|مسار|مناسب|أنسب/.test(q)) {
      return {
        answer: 'بناءً على بياناتك الحالية، ابدأ بمسار ' + target + '. ركّز على الوظائف التي تستفيد من مهاراتك الأساسية، ثم قارن متطلبات كل وظيفة بالفجوات في تقريرك' + (gaps[0] ? '. أول فجوة للعمل عليها: ' + gaps[0] : '') + '.',
        source: 'profile_test'
      };
    }
    if (/مقابل|انترفيو|interview/i.test(q)) {
      return {
        answer: 'حضّر 3 أمثلة عملية بطريقة الموقف–المهمة–الإجراء–النتيجة، واربط كل مثال بمتطلب من الوظيفة. حاول أن تضع رقمًا أو نتيجة قابلة للقياس في كل مثال.',
        source: 'test_advisor'
      };
    }
    if (/سير|cv|resume/i.test(q)) {
      return {
        answer: 'في نسخة الاختبار، الأولوية هي تحويل المسؤوليات إلى إنجازات قابلة للقياس وإضافة كلمات مفتاحية مرتبطة بمسار ' + target + (gaps.length ? '. الفجوات الحالية: ' + gaps.join('، ') : '') + '.',
        source: 'report_test'
      };
    }
    if (/مهار|تطوير|دور/.test(q)) {
      return {
        answer: 'ابدأ بمهارة واحدة ذات أثر مباشر على فرصك. ' + (gaps.length ? 'بحسب تقريرك: ' + gaps.join('، ') + '.' : 'اختر المهارة الأكثر تكرارًا في الوظائف التي تستهدفها.') + ' طبّقها في تمرين أو مشروع قصير.',
        source: 'report_test'
      };
    }
    return {
      answer: 'هذه إجابة تشغيلية من نسخة الاختبار. اسألني عن الوظائف المناسبة، الـCV، المقابلات أو المهارات. عندما تعتمد مرام مواد مرجعية مرتبطة بسؤالك سيظهر أثرها هنا.',
      source: 'test_advisor'
    };
  }

  function sourceLabel(source) {
    if (source === 'approved_consultant') return 'مرجعية مرام المعتمدة';
    if (source === 'approved_knowledge') return 'مرجعية معتمدة';
    return 'منطق نسخة الاختبار';
  }

  async function renderAdvisor() {
    if (!(await requireAuth('advisor'))) return;

    const history = await db.from('advisor_messages')
      .select('id,question,answer,source_type,created_at')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: true })
      .limit(40);

    const rows = history.data || [];
    show(
      '<span class="eyebrow">مستشار مرام</span><h2>شو حابب تعرف عن مسارك؟</h2>' +
      '<p class="testNotice">المحادثة تعمل وتُحفظ. تستخدم المرجعية المعتمدة عندما يوجد تطابق، وإلا تستخدم منطق نسخة الاختبار — وليس نموذج AI خارجي كامل حتى الآن.</p>' +
      '<div class="chat" id="advisorChat">' +
        (rows.length ? rows.map((m) =>
          '<div class="bubble me">' + esc(m.question) + '</div>' +
          '<div class="bubble">' + esc(m.answer) + '<small>' + esc(sourceLabel(m.source_type)) + '</small></div>'
        ).join('') : '<div class="bubble">اسألني عن الوظائف، السيرة الذاتية، المقابلات أو المهارات.</div>') +
      '</div>' +
      '<form class="form advisorForm" id="advisorForm"><input id="advisorQuestion" autocomplete="off" placeholder="اكتب سؤالك هنا..."><button class="primary" id="advisorSend" type="submit">إرسال</button></form>' +
      '<p id="advisorStatus" class="status"></p>'
    );

    $('advisorForm').onsubmit = sendAdvisor;
    const chat = $('advisorChat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  async function sendAdvisor(e) {
    e.preventDefault();
    const question = $('advisorQuestion').value.trim();
    if (!question) return status('advisorStatus', 'اكتب السؤال أولًا.', 'error');

    const btn = $('advisorSend');
    btn.disabled = true;
    status('advisorStatus', 'جاري تجهيز الإجابة...');

    try {
      const answer = await advisorAnswer(question);
      const saved = await db.from('advisor_messages').insert({
        user_id: state.user.id,
        question,
        answer: answer.answer,
        source_type: answer.source
      });
      if (saved.error) throw saved.error;
      await renderAdvisor();
    } catch (error) {
      status('advisorStatus', errText(error), 'error');
      btn.disabled = false;
    }
  }

  function jobScore(job) {
    const p = state.profile || {};
    const text = ((job.title || '') + ' ' + (job.requirements || '') + ' ' + (job.description || '')).toLowerCase();
    let score = 58;
    const target = String(p.target_field || '').toLowerCase();
    if (target && text.includes(target)) score += 18;
    (Array.isArray(p.skills) ? p.skills : []).forEach((skill) => {
      if (skill && text.includes(String(skill).toLowerCase())) score += 5;
    });
    return Math.min(96, score);
  }

  async function renderJobs() {
    await loadSession();

    const jobs = await db.from('jobs')
      .select('id,title,company,location,description,requirements,status,created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    let applied = new Set();
    if (state.user) {
      const apps = await db.from('applications').select('job_id').eq('user_id', state.user.id);
      if (!apps.error) applied = new Set((apps.data || []).map((x) => x.job_id));
    }

    show(
      '<span class="eyebrow">الوظائف</span><h2>فرص المطابقة</h2>' +
      '<p class="testNotice">الوظائف التي تحمل كلمة «تجريبية» موجودة لاختبار رحلة المنصة وليست إعلانات توظيف حقيقية.</p>' +
      '<div class="listStack">' +
        ((jobs.data || []).length ? (jobs.data || []).map((job) => {
          const score = jobScore(job);
          const done = applied.has(job.id);
          return '<div class="job jobFull">' +
            '<div><b>' + esc(job.title) + '</b><small>' + esc(job.company) + ' • ' + esc(job.location || '') + '</small><p>' + esc(job.description || '') + '</p><em>' + esc(job.requirements || '') + '</em></div>' +
            '<div class="jobActions"><strong>' + score + '%</strong><button class="secondary" ' + (done ? 'disabled' : '') + ' onclick="bttApplyJob(\'' + job.id + '\')">' + (done ? 'تم التقديم' : 'تقديم') + '</button></div>' +
          '</div>';
        }).join('') : '<p>لا توجد وظائف منشورة حاليًا.</p>') +
      '</div><p id="jobsStatus" class="status"></p>'
    );
  }

  async function applyJob(jobId) {
    if (!(await requireAuth('jobs'))) return;
    const r = await db.from('applications').insert({ job_id: jobId, user_id: state.user.id, status: 'submitted' });
    if (r.error && String(r.error.code) !== '23505') return status('jobsStatus', errText(r.error), 'error');
    status('jobsStatus', 'تم تسجيل طلب التقديم.', 'ok');
    setTimeout(renderJobs, 300);
  }

  async function renderCourses() {
    const r = await db.from('courses')
      .select('id,title,description,url,status,created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    show(
      '<span class="eyebrow">التطوير المستمر</span><h2>الدورات المقترحة</h2>' +
      '<p class="testNotice">المحتوى الحالي للاختبار. لن يظهر رابط فتح إلا عندما يكون هناك رابط دورة معتمد في قاعدة البيانات.</p>' +
      '<div class="listStack">' +
        ((r.data || []).length ? (r.data || []).map((course) =>
          '<div class="hubItem"><b>' + esc(course.title) + '</b><p>' + esc(course.description || '') + '</p>' +
          (course.url ? '<a class="secondary linkBtn" href="' + esc(course.url) + '" target="_blank" rel="noopener">فتح الدورة</a>' : '<small>لا يوجد رابط معتمد بعد.</small>') +
          '</div>'
        ).join('') : '<p>لا توجد دورات منشورة حاليًا.</p>') +
      '</div>'
    );
  }

  async function renderCompany() {
    await loadSession();
    show(
      '<span class="eyebrow">بوابة الشركات</span><h2>أرسل طلب توظيف</h2>' +
      '<p>الطلب يُحفظ فعليًا في قاعدة البيانات ويظهر للإدارة. لا نعرض مرشحين وهميين.</p>' +
      '<form class="form" id="companyForm">' +
        '<input id="companyName" required placeholder="اسم الشركة">' +
        '<input id="companyEmail" type="email" required placeholder="البريد الإلكتروني للعمل" value="' + esc(state.user?.email || '') + '">' +
        '<input id="companyJob" required placeholder="المسمى الوظيفي المطلوب">' +
        '<textarea id="companyRequirements" placeholder="المهارات والخبرة المطلوبة"></textarea>' +
        '<button class="primary" id="companySubmit" type="submit">إرسال الطلب</button>' +
      '</form><p id="companyStatus" class="status"></p>'
    );
    $('companyForm').onsubmit = submitCompany;
  }

  async function submitCompany(e) {
    e.preventDefault();
    const btn = $('companySubmit');
    btn.disabled = true;
    status('companyStatus', 'جاري الإرسال...');
    const payload = {
      company_name: $('companyName').value.trim(),
      work_email: $('companyEmail').value.trim(),
      job_title: $('companyJob').value.trim(),
      requirements: $('companyRequirements').value.trim() || null,
      submitted_by: state.user?.id || null,
      status: 'new'
    };
    const r = await db.from('company_requests').insert(payload);
    btn.disabled = false;
    if (r.error) return status('companyStatus', errText(r.error), 'error');
    $('companyForm').reset();
    status('companyStatus', 'تم حفظ الطلب وإرساله للإدارة.', 'ok');
  }

  async function renderStaff() {
    if (!(await requireAuth('staff'))) return;
    await loadSession();
    const role = state.profile?.role;
    if (role === 'admin') return renderAdmin();
    if (role === 'consultant') return renderConsultant();

    show(
      '<span class="eyebrow">الإدارة والاستشارة</span><h2>لا توجد صلاحية Staff لهذا الحساب</h2>' +
      '<p>هذا الحساب دوره: ' + esc(roleLabel(role)) + '.</p>' +
      '<button class="secondary" onclick="openPanel(\'account\')">العودة إلى حسابي</button>'
    );
  }

  async function renderAdmin() {
    const [feedback, knowledge, companyRequests, profiles] = await Promise.all([
      db.from('consultant_feedback').select('id,title,body,feedback_type,priority,status,admin_note,created_at').order('created_at', { ascending: false }).limit(100),
      db.from('knowledge').select('id,title,category,status,source_role,created_at,approved_at,created_by').order('created_at', { ascending: false }).limit(100),
      db.from('company_requests').select('id,company_name,work_email,job_title,requirements,status,created_at').order('created_at', { ascending: false }).limit(100),
      db.from('profiles').select('id,full_name,role,city,created_at').order('created_at', { ascending: false }).limit(100)
    ]);

    const problems = [feedback.error, knowledge.error, companyRequests.error, profiles.error].filter(Boolean);

    show(
      '<span class="eyebrow">لوحة وليد</span><h2>إدارة المنصة</h2>' +
      '<div class="hubIdentity"><div><b>وليد — Admin</b><small>' + esc(state.user.email) + '</small></div><span>صلاحية كاملة</span></div>' +
      (problems.length ? '<p class="status error">هناك أخطاء تحميل: ' + esc(problems.map(errText).join(' | ')) + '</p>' : '') +
      '<div class="miniCards">' +
        '<div><b>' + (profiles.data || []).length + '</b><p>مستخدمون</p></div>' +
        '<div><b>' + (feedback.data || []).filter((x) => x.status === 'new').length + '</b><p>ملاحظات جديدة</p></div>' +
        '<div><b>' + (companyRequests.data || []).filter((x) => x.status === 'new').length + '</b><p>طلبات شركات جديدة</p></div>' +
      '</div>' +
      '<button class="secondary fullBtn" onclick="openPanel(\'system-check\')">تشغيل فحص النظام الآن</button>' +

      '<h3>إضافة مرجعية إدارية</h3>' +
      '<form class="form staffForm" id="adminKnowledgeForm">' +
        '<input id="adminKTitle" required placeholder="عنوان المادة">' +
        '<select id="adminKCategory"><option value="cv">السيرة الذاتية</option><option value="interview">المقابلات</option><option value="development">التطوير والتدريب</option><option value="recruitment">التوظيف</option><option value="other">أخرى</option></select>' +
        '<textarea id="adminKBody" required placeholder="المحتوى"></textarea>' +
        '<button class="primary" type="submit">حفظ كمسودة</button>' +
      '</form><p id="adminKnowledgeStatus" class="status"></p>' +

      '<h3>صندوق مرام</h3><div class="listStack">' +
        ((feedback.data || []).length ? feedback.data.map((x) =>
          '<div class="hubItem"><b>' + esc(x.title) + '</b><small>' + esc(x.feedback_type) + ' • ' + esc(x.priority) + ' • ' + esc(x.status) + ' • ' + esc(fmtDate(x.created_at)) + '</small><p>' + esc(x.body) + '</p>' +
          '<textarea id="note-' + x.id + '" placeholder="رد أو ملاحظة إدارية">' + esc(x.admin_note || '') + '</textarea>' +
          '<div class="hubActions"><button class="secondary" onclick="bttFeedbackStatus(\'' + x.id + '\',\'reviewed\')">تمت المراجعة</button><button class="secondary" onclick="bttFeedbackStatus(\'' + x.id + '\',\'accepted\')">اعتماد</button><button class="secondary" onclick="bttFeedbackStatus(\'' + x.id + '\',\'implemented\')">تم التنفيذ</button><button class="dangerBtn smallBtn" onclick="bttFeedbackStatus(\'' + x.id + '\',\'rejected\')">رفض</button></div></div>'
        ).join('') : '<p>لا توجد ملاحظات من مرام بعد.</p>') +
      '</div>' +

      '<h3>المرجعية المهنية</h3><div class="listStack">' +
        ((knowledge.data || []).length ? knowledge.data.map((x) =>
          '<div class="hubItem"><b>' + esc(x.title) + '</b><small>' + esc(x.category) + ' • ' + esc(x.source_role) + ' • ' + esc(x.status) + '</small>' +
          '<div class="hubActions"><button class="secondary" onclick="bttKnowledgeStatus(\'' + x.id + '\',\'approved\')">اعتماد</button><button class="secondary" onclick="bttKnowledgeStatus(\'' + x.id + '\',\'draft\')">إرجاع لمسودة</button><button class="secondary" onclick="bttKnowledgeStatus(\'' + x.id + '\',\'paused\')">إيقاف</button></div></div>'
        ).join('') : '<p>لا توجد مواد معرفية بعد.</p>') +
      '</div>' +

      '<h3>طلبات الشركات</h3><div class="listStack">' +
        ((companyRequests.data || []).length ? companyRequests.data.map((x) =>
          '<div class="hubItem"><b>' + esc(x.company_name) + ' — ' + esc(x.job_title) + '</b><small>' + esc(x.work_email) + ' • ' + esc(x.status) + ' • ' + esc(fmtDate(x.created_at)) + '</small><p>' + esc(x.requirements || '') + '</p>' +
          '<div class="hubActions"><button class="secondary" onclick="bttCompanyStatus(\'' + x.id + '\',\'reviewed\')">تمت المراجعة</button><button class="secondary" onclick="bttCompanyStatus(\'' + x.id + '\',\'converted\')">تحويل للمتابعة</button><button class="dangerBtn smallBtn" onclick="bttCompanyStatus(\'' + x.id + '\',\'rejected\')">رفض</button></div></div>'
        ).join('') : '<p>لا توجد طلبات شركات بعد.</p>') +
      '</div>' +

      '<h3>المستخدمون</h3><div class="listStack">' +
        ((profiles.data || []).length ? profiles.data.map((x) =>
          '<div class="hubItem compact"><b>' + esc(x.full_name || 'بدون اسم') + '</b><small>' + esc(roleLabel(x.role)) + (x.city ? ' • ' + esc(x.city) : '') + '</small></div>'
        ).join('') : '<p>لا توجد حسابات.</p>') +
      '</div>' +

      '<button class="dangerBtn fullBtn" onclick="bttSignOut()">تسجيل الخروج</button>'
    );

    $('adminKnowledgeForm').onsubmit = saveAdminKnowledge;
  }

  async function saveAdminKnowledge(e) {
    e.preventDefault();
    status('adminKnowledgeStatus', 'جاري الحفظ...');
    const r = await db.from('knowledge').insert({
      title: $('adminKTitle').value.trim(),
      category: $('adminKCategory').value,
      body: $('adminKBody').value.trim(),
      status: 'draft',
      source_role: 'admin',
      created_by: state.user.id
    });
    if (r.error) return status('adminKnowledgeStatus', errText(r.error), 'error');
    status('adminKnowledgeStatus', 'تم حفظ المسودة.', 'ok');
    setTimeout(renderAdmin, 250);
  }

  async function feedbackStatus(id, newStatus) {
    const note = $('note-' + id)?.value.trim() || null;
    const r = await db.from('consultant_feedback').update({
      status: newStatus,
      admin_note: note,
      reviewed_by: state.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (r.error) return alert(errText(r.error));
    renderAdmin();
  }

  async function knowledgeStatus(id, newStatus) {
    const now = new Date().toISOString();
    const r = await db.from('knowledge').update({
      status: newStatus,
      approved_by: newStatus === 'approved' ? state.user.id : null,
      approved_at: newStatus === 'approved' ? now : null,
      updated_at: now
    }).eq('id', id);
    if (r.error) return alert(errText(r.error));
    renderAdmin();
  }

  async function companyStatus(id, newStatus) {
    const r = await db.from('company_requests').update({
      status: newStatus,
      updated_at: new Date().toISOString()
    }).eq('id', id);
    if (r.error) return alert(errText(r.error));
    renderAdmin();
  }

  async function renderConsultant() {
    const [feedback, knowledge] = await Promise.all([
      db.from('consultant_feedback').select('id,title,feedback_type,priority,status,admin_note,created_at').order('created_at', { ascending: false }).limit(100),
      db.from('knowledge').select('id,title,category,status,source_role,created_at').eq('created_by', state.user.id).order('created_at', { ascending: false }).limit(100)
    ]);

    show(
      '<span class="eyebrow">مساحة مرام</span><h2>المستشارة المهنية</h2>' +
      '<div class="hubIdentity"><div><b>مرام — Consultant</b><small>' + esc(state.user.email) + '</small></div><span>مرجعية مهنية</span></div>' +
      '<p class="testNotice">مرام لا تملك صلاحيات Admin. ترسل الملاحظات وتضيف المرجعية كمسودة، والاعتماد النهائي من وليد.</p>' +

      '<h3>إرسال ملاحظة أو توصية</h3>' +
      '<form class="form staffForm" id="consultantFeedbackForm">' +
        '<select id="fType"><option value="suggestion">اقتراح</option><option value="observation">ملاحظة</option><option value="data">بيانات مفيدة</option><option value="correction">تصحيح</option><option value="feature_request">طلب تطوير</option></select>' +
        '<select id="fPriority"><option value="normal">أولوية عادية</option><option value="high">أولوية عالية</option><option value="low">أولوية منخفضة</option></select>' +
        '<input id="fTitle" required placeholder="عنوان الملاحظة">' +
        '<textarea id="fBody" required placeholder="الملاحظة أو التوصية أو البيانات المفيدة"></textarea>' +
        '<button class="primary" type="submit">إرسال إلى وليد</button>' +
      '</form><p id="consultantFeedbackStatus" class="status"></p>' +

      '<h3>إضافة مرجعية مهنية</h3>' +
      '<form class="form staffForm" id="consultantKnowledgeForm">' +
        '<input id="cKTitle" required placeholder="عنوان المعرفة">' +
        '<select id="cKCategory"><option value="cv">السيرة الذاتية</option><option value="interview">المقابلات</option><option value="development">التطوير والتدريب</option><option value="recruitment">التوظيف</option><option value="other">أخرى</option></select>' +
        '<textarea id="cKBody" required placeholder="المعلومة أو المنهج أو التوجيه المهني"></textarea>' +
        '<button class="primary" type="submit">حفظ وإرسال للمراجعة</button>' +
      '</form><p id="consultantKnowledgeStatus" class="status"></p>' +

      '<h3>متابعة ملاحظاتي</h3><div class="listStack">' +
        ((feedback.data || []).length ? feedback.data.map((x) =>
          '<div class="hubItem"><b>' + esc(x.title) + '</b><small>' + esc(x.feedback_type) + ' • ' + esc(x.priority) + ' • ' + esc(x.status) + '</small>' +
          (x.admin_note ? '<p><b>رد الإدارة:</b> ' + esc(x.admin_note) + '</p>' : '') + '</div>'
        ).join('') : '<p>لا توجد ملاحظات مرسلة بعد.</p>') +
      '</div>' +

      '<h3>مرجعيتي المهنية</h3><div class="listStack">' +
        ((knowledge.data || []).length ? knowledge.data.map((x) =>
          '<div class="hubItem"><b>' + esc(x.title) + '</b><small>' + esc(x.category) + ' • ' + esc(x.status) + '</small></div>'
        ).join('') : '<p>لا توجد مواد بعد.</p>') +
      '</div>' +

      '<button class="dangerBtn fullBtn" onclick="bttSignOut()">تسجيل الخروج</button>'
    );

    $('consultantFeedbackForm').onsubmit = submitConsultantFeedback;
    $('consultantKnowledgeForm').onsubmit = submitConsultantKnowledge;
  }

  async function submitConsultantFeedback(e) {
    e.preventDefault();
    status('consultantFeedbackStatus', 'جاري الإرسال...');
    const r = await db.from('consultant_feedback').insert({
      consultant_id: state.user.id,
      feedback_type: $('fType').value,
      priority: $('fPriority').value,
      title: $('fTitle').value.trim(),
      body: $('fBody').value.trim(),
      status: 'new'
    });
    if (r.error) return status('consultantFeedbackStatus', errText(r.error), 'error');
    status('consultantFeedbackStatus', 'تم إرسال الملاحظة إلى وليد.', 'ok');
    setTimeout(renderConsultant, 250);
  }

  async function submitConsultantKnowledge(e) {
    e.preventDefault();
    status('consultantKnowledgeStatus', 'جاري الحفظ...');
    const r = await db.from('knowledge').insert({
      title: $('cKTitle').value.trim(),
      category: $('cKCategory').value,
      body: $('cKBody').value.trim(),
      status: 'draft',
      source_role: 'consultant',
      created_by: state.user.id
    });
    if (r.error) return status('consultantKnowledgeStatus', errText(r.error), 'error');
    status('consultantKnowledgeStatus', 'تم حفظ المسودة وإرسالها للمراجعة.', 'ok');
    setTimeout(renderConsultant, 250);
  }

  async function renderSystemCheck() {
    if (!(await requireAuth('system-check'))) return;
    await loadSession();
    if (state.profile?.role !== 'admin') return openPanel('staff');

    const tests = [];
    const run = async (name, fn) => {
      try {
        const result = await fn();
        tests.push({ name, ok: !result?.error, error: result?.error ? errText(result.error) : '' });
      } catch (error) {
        tests.push({ name, ok: false, error: errText(error) });
      }
    };

    await run('قراءة ملف الحساب', () => db.from('profiles').select('id,role').eq('id', state.user.id).maybeSingle());
    await run('قراءة الوظائف', () => db.from('jobs').select('id').limit(1));
    await run('قراءة الدورات', () => db.from('courses').select('id').limit(1));
    await run('قراءة التقارير', () => db.from('cv_reports').select('id').eq('user_id', state.user.id).limit(1));
    await run('قراءة صندوق مرام', () => db.from('consultant_feedback').select('id').limit(1));
    await run('قراءة طلبات الشركات', () => db.from('company_requests').select('id').limit(1));

    show(
      '<span class="eyebrow">فحص النظام</span><h2>نتيجة فحص الاتصال والصلاحيات</h2>' +
      '<div class="listStack">' + tests.map((t) =>
        '<div class="hubItem compact"><b>' + (t.ok ? '✓ ' : '✕ ') + esc(t.name) + '</b><small class="' + (t.ok ? 'okText' : 'errorText') + '">' + (t.ok ? 'يعمل' : esc(t.error)) + '</small></div>'
      ).join('') + '</div>' +
      '<button class="secondary" onclick="openPanel(\'staff\')">العودة للوحة وليد</button>'
    );
  }

  async function openPanel(route) {
    if (!db) {
      show('<span class="eyebrow">حالة النظام</span><h2>تعذر الاتصال بقاعدة البيانات</h2><p>مكتبة Supabase أو إعدادات الاتصال لم تُحمّل. حدّث الصفحة، وإذا استمرت المشكلة أرسل صورة الشاشة.</p>');
      return;
    }
    const routes = {
      'auth-login': () => renderAuth('login'),
      'auth-signup': () => renderAuth('signup'),
      'signup': () => renderAuth('signup'),
      'login': () => renderAuth('login'),
      'forgot-password': () => renderForgotPassword(''),
      'password-update': renderPasswordUpdate,
      'account': renderAccount,
      'profile': renderProfile,
      'upload': renderUpload,
      'analysis': renderReport,
      'report': renderReport,
      'plan': renderPlan,
      'advisor': renderAdvisor,
      'jobs': renderJobs,
      'courses': renderCourses,
      'company': renderCompany,
      'candidates': renderCompany,
      'staff': renderStaff,
      'admin': renderStaff,
      'system-check': renderSystemCheck
    };
    const fn = routes[route] || renderAccount;
    return fn();
  }

  window.openPanel = openPanel;
  window.closePanel = closePanel;
  window.bttSignOut = signOut;
  window.bttApplyJob = applyJob;
  window.bttFeedbackStatus = feedbackStatus;
  window.bttKnowledgeStatus = knowledgeStatus;
  window.bttCompanyStatus = companyStatus;
  window.bttSendOwnPasswordReset = async function() {
    if (!(await requireAuth('account'))) return;
    renderForgotPassword(state.user?.email || '');
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  if (db) {
    db.auth.onAuthStateChange((event, session) => {
      state.user = session?.user || null;
      if (event === 'SIGNED_OUT') {
        state.profile = null;
        state.latestReport = null;
      }
      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(renderPasswordUpdate, 0);
      }
      setTimeout(loadSession, 0);
    });
  }

  (async () => {
    await loadSession();
    const recoveryMode = new URLSearchParams(location.search).get('mode') === 'recovery' ||
      location.hash.includes('type=recovery');
    if (recoveryMode) {
      setTimeout(renderPasswordUpdate, 250);
    }
  })();
})();