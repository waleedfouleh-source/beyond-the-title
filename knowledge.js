/* Beyond the Title | role-aware Admin + Consultant hub */
const BTT = window.BTT_CONFIG || {};
const db = BTT.supabaseUrl && BTT.supabaseAnonKey && window.supabase
  ? window.supabase.createClient(BTT.supabaseUrl, BTT.supabaseAnonKey)
  : null;
window.db = db;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const baseOpenPanel = window.openPanel;

function hubShell(title, eyebrow, intro) {
  baseOpenPanel('admin');
  const p = document.getElementById('panelContent');
  p.innerHTML =
    '<span class="eyebrow">' + esc(eyebrow) + '</span>' +
    '<h2>' + esc(title) + '</h2>' +
    '<p>' + esc(intro) + '</p>' +
    '<div id="hubStatus"></div><div id="hubArea"></div>';
  return p;
}

async function getHubContext() {
  if (!db) return { user:null, profile:null, error:new Error('db_unavailable') };
  const { data:{ user }, error } = await db.auth.getUser();
  if (error || !user) return { user:null, profile:null, error };
  const { data:profile, error:profileError } = await db
    .from('profiles')
    .select('id,full_name,role')
    .eq('id', user.id)
    .single();
  return { user, profile, error:profileError };
}

async function hubOpen() {
  hubShell(
    'الدخول المخصص',
    'ما وراء العنوان',
    'يتم فتح اللوحة حسب صلاحية الحساب: وليد للإدارة الكاملة، ومرام للاستشارة والمرجعية المهنية.'
  );

  if (!db) {
    document.getElementById('hubStatus').textContent =
      'الاتصال بقاعدة البيانات غير متاح حاليًا.';
    return;
  }

  const ctx = await getHubContext();
  if (!ctx.user) {
    renderHubLogin();
    return;
  }

  if (!ctx.profile) {
    document.getElementById('hubStatus').textContent =
      'الحساب مسجل، لكن ملف الصلاحية غير موجود.';
    document.getElementById('hubArea').innerHTML =
      '<button class="secondary" onclick="hubLogout()">تسجيل الخروج</button>';
    return;
  }

  if (ctx.profile.role === 'admin') return renderAdminHub(ctx.user);
  if (ctx.profile.role === 'consultant') return renderConsultantHub(ctx.user);

  document.getElementById('hubStatus').textContent =
    'هذا الحساب لا يملك صلاحية دخول لوحة الإدارة أو مساحة المستشارة.';
  document.getElementById('hubArea').innerHTML =
    '<button class="secondary" onclick="hubLogout()">تسجيل الخروج</button>';
}

function renderHubLogin() {
  document.getElementById('hubArea').innerHTML =
    '<div class="form">' +
      '<input id="hubEmail" type="email" autocomplete="email" placeholder="البريد الإلكتروني">' +
      '<input id="hubPass" type="password" autocomplete="current-password" placeholder="كلمة المرور">' +
      '<button class="primary" onclick="hubLogin()">تسجيل الدخول</button>' +
      '<button class="secondary" onclick="hubSignup()">إنشاء الحساب لأول مرة</button>' +
      '<p id="authMessage" role="status"></p>' +
    '</div>';
}

async function hubLogin() {
  const email = document.getElementById('hubEmail').value.trim();
  const password = document.getElementById('hubPass').value;
  const out = document.getElementById('authMessage');
  if (!email || !password) {
    out.textContent = 'أدخل البريد وكلمة المرور.';
    return;
  }
  out.textContent = 'جاري تسجيل الدخول...';
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    out.textContent = 'تعذر تسجيل الدخول: ' + error.message;
    return;
  }
  hubOpen();
  syncRoleButton();
}

async function hubSignup() {
  const email = document.getElementById('hubEmail').value.trim();
  const password = document.getElementById('hubPass').value;
  const out = document.getElementById('authMessage');
  if (!email || password.length < 8) {
    out.textContent = 'أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.';
    return;
  }
  out.textContent = 'جاري إنشاء الحساب...';
  const { error } = await db.auth.signUp({
    email,
    password,
    options:{ emailRedirectTo:(window.BTT_CONFIG?.siteUrl || location.origin + location.pathname) }
  });
  out.textContent = error
    ? 'تعذر إنشاء الحساب: ' + error.message
    : 'تم إنشاء الحساب. راجع البريد لتأكيده ثم سجل الدخول.';
}

async function hubLogout() {
  if (db) await db.auth.signOut();
  syncRoleButton();
  hubOpen();
}

function renderAdminHub(user) {
  document.getElementById('hubStatus').innerHTML =
    '<div class="hubIdentity"><b>وليد — Admin</b><small>' + esc(user.email) + '</small></div>';

  document.getElementById('hubArea').innerHTML =
    '<div class="miniCards">' +
      '<div><b>إدارة كاملة</b><p>الصلاحيات والمحتوى والاعتماد</p></div>' +
      '<div><b>صندوق مرام</b><p>مراجعة الاستشارات والملاحظات</p></div>' +
      '<div><b>المرجعية</b><p>اعتماد المعرفة قبل نشرها</p></div>' +
    '</div>' +
    '<h3>إضافة معرفة إدارية</h3>' +
    '<div class="form">' +
      '<input id="kTitle" placeholder="عنوان المادة">' +
      '<select id="kCategory">' +
        '<option value="cv">السيرة الذاتية</option>' +
        '<option value="interview">المقابلات</option>' +
        '<option value="development">التطوير والتدريب</option>' +
        '<option value="recruitment">التوظيف</option>' +
        '<option value="other">أخرى</option>' +
      '</select>' +
      '<textarea id="kBody" placeholder="المحتوى"></textarea>' +
      '<button class="primary" onclick="hubSaveKnowledge(\'admin\')">حفظ كمسودة</button>' +
      '<div id="hubMessage" role="status"></div>' +
    '</div>' +
    '<h3>صندوق استشارات وملاحظات مرام</h3><div id="feedbackList"></div>' +
    '<h3>المواد المعرفية</h3><div id="hubList"></div>' +
    '<button class="secondary" onclick="hubLogout()">تسجيل الخروج</button>';

  hubRefreshFeedbackAdmin();
  hubRefreshKnowledge('admin');
}

function renderConsultantHub(user) {
  document.getElementById('hubStatus').innerHTML =
    '<div class="hubIdentity"><b>مرام — Consultant</b><small>' + esc(user.email) + '</small></div>';

  document.getElementById('hubArea').innerHTML =
    '<div class="miniCards">' +
      '<div><b>استشارات</b><p>ملاحظات تساعد في تطوير المنصة</p></div>' +
      '<div><b>بيانات مهنية</b><p>إضافة مرجعية موثوقة كمسودة</p></div>' +
      '<div><b>بدون Admin</b><p>الاعتماد النهائي من وليد</p></div>' +
    '</div>' +
    '<h3>صندوق الاستشارات والملاحظات</h3>' +
    '<div class="form">' +
      '<select id="fType">' +
        '<option value="suggestion">اقتراح</option>' +
        '<option value="observation">ملاحظة</option>' +
        '<option value="data">بيانات مفيدة</option>' +
        '<option value="correction">تصحيح</option>' +
        '<option value="feature_request">طلب تطوير</option>' +
      '</select>' +
      '<select id="fPriority">' +
        '<option value="normal">أولوية عادية</option>' +
        '<option value="high">أولوية عالية</option>' +
        '<option value="low">أولوية منخفضة</option>' +
      '</select>' +
      '<input id="fTitle" placeholder="عنوان الملاحظة">' +
      '<textarea id="fBody" placeholder="اكتبي الملاحظة أو التوصية أو البيانات التي تفيد في تطوير المنصة"></textarea>' +
      '<button class="primary" onclick="hubSubmitFeedback()">إرسال إلى وليد</button>' +
      '<div id="feedbackMessage" role="status"></div>' +
    '</div>' +
    '<h3>إضافة مادة للمرجعية المهنية</h3>' +
    '<div class="form">' +
      '<input id="kTitle" placeholder="عنوان المعرفة">' +
      '<select id="kCategory">' +
        '<option value="cv">السيرة الذاتية</option>' +
        '<option value="interview">المقابلات</option>' +
        '<option value="development">التطوير والتدريب</option>' +
        '<option value="recruitment">التوظيف</option>' +
        '<option value="other">أخرى</option>' +
      '</select>' +
      '<textarea id="kBody" placeholder="المعلومة أو المنهج أو التوجيه المهني"></textarea>' +
      '<button class="primary" onclick="hubSaveKnowledge(\'consultant\')">حفظ وإرسال للمراجعة</button>' +
      '<div id="hubMessage" role="status"></div>' +
    '</div>' +
    '<h3>متابعة ملاحظاتي</h3><div id="feedbackList"></div>' +
    '<h3>مرجعيتي المهنية</h3><div id="hubList"></div>' +
    '<button class="secondary" onclick="hubLogout()">تسجيل الخروج</button>';

  hubRefreshFeedbackConsultant();
  hubRefreshKnowledge('consultant');
}

async function hubSubmitFeedback() {
  const out = document.getElementById('feedbackMessage');
  const title = document.getElementById('fTitle').value.trim();
  const body = document.getElementById('fBody').value.trim();
  if (!title || !body) {
    out.textContent = 'العنوان والملاحظة مطلوبان.';
    return;
  }
  const { data:{ user } } = await db.auth.getUser();
  const { error } = await db.from('consultant_feedback').insert({
    consultant_id:user.id,
    feedback_type:document.getElementById('fType').value,
    priority:document.getElementById('fPriority').value,
    title,
    body,
    status:'new'
  });
  if (error) {
    out.textContent = 'تعذر الإرسال: ' + error.message;
    return;
  }
  out.textContent = 'تم إرسال الملاحظة إلى صندوق وليد.';
  document.getElementById('fTitle').value = '';
  document.getElementById('fBody').value = '';
  hubRefreshFeedbackConsultant();
}

async function hubRefreshFeedbackConsultant() {
  const target = document.getElementById('feedbackList');
  if (!target) return;
  const { data, error } = await db
    .from('consultant_feedback')
    .select('id,title,feedback_type,priority,status,admin_note,created_at')
    .order('created_at',{ascending:false})
    .limit(100);
  if (error) return target.textContent = error.message;
  target.innerHTML = (data || []).map(x =>
    '<div class="hubItem">' +
      '<b>' + esc(x.title) + '</b>' +
      '<small>' + esc(x.feedback_type) + ' • ' + esc(x.priority) + ' • ' + esc(x.status) + '</small>' +
      (x.admin_note ? '<p><b>رد الإدارة:</b> ' + esc(x.admin_note) + '</p>' : '') +
    '</div>'
  ).join('') || '<p>لا توجد ملاحظات مرسلة بعد.</p>';
}

async function hubRefreshFeedbackAdmin() {
  const target = document.getElementById('feedbackList');
  if (!target) return;
  const { data, error } = await db
    .from('consultant_feedback')
    .select('id,title,body,feedback_type,priority,status,admin_note,created_at')
    .order('created_at',{ascending:false})
    .limit(100);
  if (error) return target.textContent = error.message;
  target.innerHTML = (data || []).map(x =>
    '<div class="hubItem">' +
      '<b>' + esc(x.title) + '</b>' +
      '<small>' + esc(x.feedback_type) + ' • ' + esc(x.priority) + ' • ' + esc(x.status) + '</small>' +
      '<p>' + esc(x.body) + '</p>' +
      '<textarea id="feedbackNote-' + x.id + '" placeholder="ملاحظة أو رد من الإدارة">' + esc(x.admin_note || '') + '</textarea>' +
      '<div class="hubActions">' +
        '<button class="secondary" onclick="hubFeedbackUpdate(\'' + x.id + '\',\'reviewed\')">تمت المراجعة</button>' +
        '<button class="secondary" onclick="hubFeedbackUpdate(\'' + x.id + '\',\'accepted\')">اعتماد</button>' +
        '<button class="secondary" onclick="hubFeedbackUpdate(\'' + x.id + '\',\'implemented\')">تم التنفيذ</button>' +
        '<button class="secondary" onclick="hubFeedbackUpdate(\'' + x.id + '\',\'rejected\')">رفض</button>' +
      '</div>' +
    '</div>'
  ).join('') || '<p>صندوق مرام فارغ حاليًا.</p>';
}

async function hubFeedbackUpdate(id, status) {
  const { data:{ user } } = await db.auth.getUser();
  const noteEl = document.getElementById('feedbackNote-' + id);
  const { error } = await db.from('consultant_feedback').update({
    status,
    admin_note:noteEl ? noteEl.value.trim() : null,
    reviewed_by:user.id,
    reviewed_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('id', id);
  if (error) alert('تعذر تحديث الملاحظة: ' + error.message);
  else hubRefreshFeedbackAdmin();
}

async function hubSaveKnowledge(sourceRole) {
  const title = document.getElementById('kTitle').value.trim();
  const body = document.getElementById('kBody').value.trim();
  const category = document.getElementById('kCategory').value;
  const out = document.getElementById('hubMessage');
  if (!title || !body) {
    out.textContent = 'العنوان والمحتوى مطلوبان.';
    return;
  }
  const { data:{ user } } = await db.auth.getUser();
  const { error } = await db.from('knowledge').insert({
    title,
    body,
    category,
    status:'draft',
    source_role:sourceRole,
    created_by:user.id
  });
  if (error) {
    out.textContent = 'تعذر الحفظ: ' + error.message;
    return;
  }
  out.textContent = sourceRole === 'consultant'
    ? 'تم حفظ المادة كمسودة وإرسالها للمراجعة.'
    : 'تم حفظ المسودة.';
  document.getElementById('kTitle').value = '';
  document.getElementById('kBody').value = '';
  hubRefreshKnowledge(sourceRole);
}

async function hubRefreshKnowledge(role) {
  const target = document.getElementById('hubList');
  if (!target) return;
  const { data:{ user } } = await db.auth.getUser();
  let query = db.from('knowledge')
    .select('id,title,category,status,source_role,created_at,approved_at')
    .order('created_at',{ascending:false})
    .limit(100);
  if (role === 'consultant') query = query.eq('created_by', user.id);
  const { data, error } = await query;
  if (error) return target.textContent = error.message;
  target.innerHTML = (data || []).map(x => {
    const actions = role === 'admin'
      ? '<div class="hubActions">' +
          '<button class="secondary" onclick="hubKnowledgeStatus(\'' + x.id + '\',\'approved\')">اعتماد</button>' +
          '<button class="secondary" onclick="hubKnowledgeStatus(\'' + x.id + '\',\'paused\')">إيقاف</button>' +
          '<button class="secondary" onclick="hubKnowledgeStatus(\'' + x.id + '\',\'draft\')">إرجاع لمسودة</button>' +
        '</div>'
      : '';
    return '<div class="hubItem">' +
      '<b>' + esc(x.title) + '</b>' +
      '<small>' + esc(x.category) + ' • ' + esc(x.source_role || 'general') + ' • ' + esc(x.status) + '</small>' +
      actions +
    '</div>';
  }).join('') || '<p>لا توجد مواد بعد.</p>';
}

async function hubKnowledgeStatus(id, status) {
  const { data:{ user } } = await db.auth.getUser();
  const now = new Date().toISOString();
  const { error } = await db.from('knowledge').update({
    status,
    updated_at:now,
    approved_by:status === 'approved' ? user.id : null,
    approved_at:status === 'approved' ? now : null
  }).eq('id', id);
  if (error) alert('تعذر تحديث المادة: ' + error.message);
  else hubRefreshKnowledge('admin');
}

async function syncRoleButton() {
  const btn = document.getElementById('rolePanelButton');
  if (!btn) return;
  if (!db) return btn.textContent = 'دخول الإدارة والاستشارة';
  const ctx = await getHubContext();
  if (ctx.profile && ctx.profile.role === 'admin') btn.textContent = 'لوحة وليد';
  else if (ctx.profile && ctx.profile.role === 'consultant') btn.textContent = 'مساحة مرام';
  else btn.textContent = 'دخول الإدارة والاستشارة';
}

window.openPanel = function(view) {
  if (view === 'admin') return hubOpen();
  return baseOpenPanel(view);
};

if (db) db.auth.onAuthStateChange(() => setTimeout(syncRoleButton, 0));
document.addEventListener('DOMContentLoaded', syncRoleButton);
