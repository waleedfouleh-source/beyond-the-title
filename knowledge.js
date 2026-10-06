/* Knowledge Hub: admin-only writes via Supabase RLS. */
const BTT = window.BTT_CONFIG || {};
const db = BTT.supabaseUrl && BTT.supabaseAnonKey && window.supabase ? window.supabase.createClient(BTT.supabaseUrl,BTT.supabaseAnonKey) : null;
window.db=db;
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function hubOpen(){
  openPanel('admin');
  const p=document.getElementById('panelContent');
  p.innerHTML='<span class="eyebrow">مركز معرفة مرام</span><h2>المرجعية المهنية الذكية</h2><p>المحتوى المعتمد فقط يدخل ضمن مرجعية الذكاء الاصطناعي بعد تشغيل خدمة الاسترجاع الآمنة.</p><div id="hubStatus"></div><div id="hubArea"></div>';
  if(!db){document.getElementById('hubStatus').textContent='وضع التجهيز: لم تُربط قاعدة Supabase بعد. راجع SETUP.md.';return}
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user){p.innerHTML+='<div class="form"><input id="hubEmail" type="email" value="waleed.fouleh@gmail.com" placeholder="البريد الإلكتروني"><input id="hubPass" type="password" placeholder="كلمة مرور جديدة أو الحالية"><button class="primary" onclick="hubLogin()">تسجيل الدخول</button><button class="secondary" onclick="hubSignup()">إنشاء حساب وإرسال تأكيد البريد</button><p id="authMessage" role="status"></p></div>';return}
  const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).single();
  if(!['admin','knowledge_manager'].includes(profile?.role)){document.getElementById('hubStatus').textContent='هذه اللوحة متاحة للمسؤول المعتمد فقط.';return}
  document.getElementById('hubArea').innerHTML='<div class="form"><input id="kTitle" placeholder="عنوان المعرفة"><select id="kCategory"><option value="cv">السيرة الذاتية</option><option value="interview">المقابلات</option><option value="development">التطوير والتدريب</option><option value="recruitment">التوظيف</option><option value="other">أخرى</option></select><textarea id="kBody" rows="6" placeholder="اكتبي خبرتك وتوجيهاتك المهنية"></textarea><button class="primary" onclick="hubSave()">حفظ كمسودة</button><div id="hubMessage" role="status"></div></div><h3>المواد المعرفية</h3><div id="hubList"></div><button class="secondary" onclick="hubLogout()">تسجيل الخروج</button>';
  hubRefresh();
}
async function hubLogin(){const {error}=await db.auth.signInWithPassword({email:document.getElementById('hubEmail').value,password:document.getElementById('hubPass').value});if(error){alert('تعذر تسجيل الدخول: '+error.message);return}hubOpen()}
async function hubLogout(){await db.auth.signOut();hubOpen()}
async function hubSave(){const title=document.getElementById('kTitle').value.trim(),body=document.getElementById('kBody').value.trim(),category=document.getElementById('kCategory').value;if(!title||!body){document.getElementById('hubMessage').textContent='العنوان والمحتوى مطلوبان';return}const {data:{user}}=await db.auth.getUser();const {error}=await db.from('knowledge').insert({title,body,category,status:'draft',created_by:user.id});document.getElementById('hubMessage').textContent=error?'تعذر الحفظ: '+error.message:'تم حفظ المسودة';if(!error){document.getElementById('kTitle').value='';document.getElementById('kBody').value='';hubRefresh()}}
async function hubRefresh(){const {data,error}=await db.from('knowledge').select('id,title,category,status,created_at').order('created_at',{ascending:false}).limit(100);const target=document.getElementById('hubList');if(!target)return;if(error){target.textContent=error.message;return}target.innerHTML=(data||[]).map(x=>'<div class="hubItem"><b>'+esc(x.title)+'</b><small>'+esc(x.category)+' • '+esc(x.status)+'</small><div><button class="secondary" onclick="hubStatusChange(\''+x.id+'\',\'approved\')">اعتماد</button> <button class="secondary" onclick="hubStatusChange(\''+x.id+'\',\'paused\')">إيقاف</button> <button class="secondary" onclick="hubStatusChange(\''+x.id+'\',\'draft\')">مسودة</button></div></div>').join('')||'<p>لا توجد مواد بعد.</p>'}
async function hubStatusChange(id,status){const {error}=await db.from('knowledge').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(error)alert(error.message);else hubRefresh()}
const priorOpenPanel=window.openPanel;
window.openPanel=function(view){if(view==='admin')return hubOpen();return priorOpenPanel(view)};

async function hubSignup(){const email=document.getElementById('hubEmail').value.trim(),password=document.getElementById('hubPass').value;if(!email||password.length<8){document.getElementById('authMessage').textContent='أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل';return}const {error}=await db.auth.signUp({email,password,options:{emailRedirectTo:'https://waleedfouleh-source.github.io/beyond-the-title/'}});document.getElementById('authMessage').textContent=error?'تعذر التسجيل: '+error.message:'راجع بريدك لتأكيد الحساب، ثم ارجع وسجّل الدخول. إذا كان الحساب موجودًا مسبقًا، استخدم تسجيل الدخول.'}
