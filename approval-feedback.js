(() => {
  'use strict';

  const original = {
    knowledge: window.bttKnowledgeStatus,
    feedback: window.bttFeedbackStatus,
    company: window.bttCompanyStatus,
    job: window.bttJobStatus,
    course: window.bttCourseStatus
  };
  if (!original.knowledge) return;

  let toastTimer;
  let notificationClient;

  function showApprovalToast(message, kind) {
    let toast = document.getElementById('bttApprovalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bttApprovalToast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      Object.assign(toast.style, {
        position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)',
        zIndex: '10000', maxWidth: 'calc(100vw - 32px)', padding: '12px 18px',
        borderRadius: '12px', boxShadow: '0 8px 28px rgba(0,0,0,.2)', color: '#fff',
        fontFamily: 'inherit', fontWeight: '700', textAlign: 'center', transition: 'opacity .2s ease'
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.background = kind === 'error' ? '#a83232' : kind === 'pending' ? '#475569' : '#087f5b';
    toast.style.opacity = '1';
    clearTimeout(toastTimer);
    if (kind !== 'pending') toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 5500);
  }

  function dbClient() {
    if (notificationClient) return notificationClient;
    const cfg = window.BTT_CONFIG || {};
    if (!window.supabase || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    notificationClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return notificationClient;
  }

  const names = {
    knowledge: 'bttKnowledgeStatus',
    feedback: 'bttFeedbackStatus',
    company: 'bttCompanyStatus',
    job: 'bttJobStatus',
    course: 'bttCourseStatus'
  };

  function findCard(kind, id) {
    const marker = names[kind] + "('" + id + "'";
    return [...document.querySelectorAll('#panelContent .hubItem')].find((card) =>
      [...card.querySelectorAll('button')].some((button) =>
        (button.getAttribute('onclick') || '').includes(marker)
      )
    );
  }

  function statusOf(kind, card) {
    const meta = card?.querySelector('small')?.textContent || '';
    const parts = meta.split('•').map((x) => x.trim());
    if (kind === 'knowledge') {
      if (parts.includes('معتمدة')) return 'approved';
      if (parts.includes('موقوفة')) return 'paused';
      if (parts.some((x) => x.includes('بانتظار اعتماد') || x.includes('مسودة'))) return 'draft';
      return '';
    }
    return parts.find((x) => ['new','reviewed','accepted','implemented','rejected','converted','published','draft','closed'].includes(x)) || '';
  }

  function waitForStatus(kind, id, wanted, timeoutMs = 8500) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (statusOf(kind, findCard(kind, id)) === wanted) return resolve(true);
        if (Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(check, 120);
      };
      check();
    });
  }

  function messageFor(kind, status, title) {
    const subject = title || 'المادة';
    if (status === 'accepted' || status === 'approved') {
      return { title: kind === 'knowledge' ? 'تم اعتماد خبرتك المهنية' : 'تم اعتماد توصيتك',
        body: 'اعتمد وليد «' + subject + '». أصبحت محفوظة ضمن المواد المعتمدة في المنصة.' };
    }
    if (status === 'rejected') {
      return { title: 'لم يتم اعتماد التوصية',
        body: 'راجع وليد «' + subject + '» ولم يعتمدها. يمكنك الاطلاع على ملاحظته في متابعتك.' };
    }
    if (status === 'implemented') {
      return { title: 'تم تنفيذ توصيتك',
        body: 'تم تنفيذ الملاحظة «' + subject + '» من قبل وليد.' };
    }
    if (status === 'reviewed') {
      return { title: 'تمت مراجعة توصيتك',
        body: 'راجع وليد «' + subject + '». ما زالت بانتظار القرار النهائي.' };
    }
    if (status === 'draft') {
      return { title: 'لم يتم اعتماد المادة بعد',
        body: 'أعاد وليد «' + subject + '» إلى المسودة لمراجعتها قبل اعتمادها.' };
    }
    if (status === 'paused') {
      return { title: 'تم إيقاف نشر المادة',
        body: 'أوقف وليد نشر «' + subject + '». يمكنك مراجعة حالتها في الأرشيف المهني.' };
    }
    if (status === 'published') {
      return { title: 'تم نشر المحتوى',
        body: 'تم نشر «' + subject + '» وأصبح ظاهرًا للمستخدمين.' };
    }
    if (status === 'closed') {
      return { title: 'تم إغلاق العنصر',
        body: 'أغلق وليد «' + subject + '» ونقله إلى الأرشيف.' };
    }
    if (status === 'converted') {
      return { title: 'تم تحويل طلبك للمتابعة',
        body: 'حوّل وليد «' + subject + '» إلى المتابعة.' };
    }
    return { title: 'تحديث على طلبك', body: 'حدّث وليد حالة «' + subject + '» إلى ' + status + '.' };
  }

  async function sendNotification(kind, id, status, actorId) {
    const client = dbClient();
    if (!client) return { ok: false, error: 'اتصال الإشعارات غير متاح.' };

    const sources = {
      feedback: { table: 'consultant_feedback', entity: 'consultant_feedback', fields: 'id,consultant_id,title', recipient: 'consultant_id' },
      knowledge: { table: 'knowledge', entity: 'knowledge', fields: 'id,created_by,title,source_role', recipient: 'created_by' },
      company: { table: 'company_requests', entity: 'company_request', fields: 'id,submitted_by,company_name,job_title', recipient: 'submitted_by' },
      job: { table: 'jobs', entity: 'job', fields: 'id,employer_id,title,company', recipient: 'employer_id' }
    };
    const source = sources[kind];
    if (!source) return { ok: true, sent: false };
    const { data: row, error: readError } = await client.from(source.table)
      .select(source.fields).eq('id', id).maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    if (!row || (kind === 'knowledge' && row.source_role !== 'consultant')) return { ok: true, sent: false };

    const recipientId = row[source.recipient];
    if (!recipientId || recipientId === actorId) return { ok: true, sent: false };
    const message = messageFor(kind, status, kind === 'company' ? (row.company_name + ' — ' + row.job_title) : (row.title || row.company));
    const { error } = await client.from('approval_notifications').insert({
      recipient_id: recipientId,
      sender_id: actorId,
      entity_type: source.entity,
      entity_id: id,
      event_type: status + ':' + Date.now(),
      title: message.title,
      body: message.body
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, sent: true };
  }

  function defaultAdminReply(kind, status, title) {
    const subject = title || 'توصيتك';
    if (status === 'accepted' || status === 'approved') return 'تم اعتماد «' + subject + '» من وليد.';
    if (status === 'rejected') return 'لم يتم اعتماد «' + subject + '» من وليد.';
    if (status === 'implemented') return 'تم تنفيذ «' + subject + '» من وليد.';
    if (status === 'reviewed') return 'تمت مراجعة «' + subject + '» وهي بانتظار القرار النهائي.';
    if (status === 'draft') return 'لم يتم اعتماد «' + subject + '» بعد؛ أعادها وليد للمراجعة.';
    if (status === 'paused') return 'أوقف وليد نشر «' + subject + '».';
    return '';
  }

  function successMessage(kind, status, notified) {
    if (notified && (kind === 'feedback' || kind === 'knowledge')) {
      if (status === 'rejected' || status === 'draft' || status === 'paused')
        return 'تم حفظ القرار وإرسال رسالة إلى مرام توضح الحالة.';
      return 'تم حفظ القرار وإرسال رسالة إلى مرام.';
    }
    if (status === 'published') return 'تم النشر ونقل العنصر إلى الأرشيف.';
    if (status === 'approved' || status === 'accepted' || status === 'implemented' || status === 'rejected' || status === 'paused' || status === 'closed' || status === 'converted')
      return 'تم حفظ القرار ونقل العنصر إلى الأرشيف.';
    return 'تم حفظ الحالة.';
  }

  async function applyStatus(kind, id, newStatus) {
    const action = original[kind];
    if (typeof action !== 'function') return;
    const card = findCard(kind, id);
    const oldStatus = statusOf(kind, card);
    if (oldStatus === newStatus) {
      showApprovalToast('هذه الحالة محفوظة بالفعل.', 'success');
      return;
    }

    const title = card?.querySelector('b')?.textContent?.trim() || '';
    if (kind === 'feedback') {
      const reply = document.getElementById('note-' + id);
      if (reply && !reply.value.trim()) {
        const autoReply = defaultAdminReply(kind, newStatus, title);
        if (autoReply) reply.value = autoReply;
      }
    }
    if (card) {
      for (const button of card.querySelectorAll('button')) button.disabled = true;
    }

    showApprovalToast('جارٍ حفظ التغيير…', 'pending');
    let operationError = '';
    const nativeAlert = window.alert;
    window.alert = (message) => { operationError = String(message || 'تعذر حفظ التغيير.'); };
    try {
      await action(id, newStatus);
    } catch (error) {
      operationError = String(error?.message || error || 'تعذر حفظ التغيير.');
    } finally {
      window.alert = nativeAlert;
    }

    if (operationError) {
      showApprovalToast('لم يتم حفظ التغيير: ' + operationError, 'error');
      return;
    }
    if (!(await waitForStatus(kind, id, newStatus))) {
      showApprovalToast('لم يتأكد حفظ التغيير. حدّث لوحة وليد وتحقق من الحالة.', 'error');
      return;
    }

    const client = dbClient();
    const { data: userData, error: userError } = client ? await client.auth.getUser() : { data: null, error: new Error('تعذر التحقق من الحساب.') };
    if (userError || !userData?.user) {
      showApprovalToast('تم حفظ الحالة، لكن تعذر إرسال رسالة مرام: تعذر التحقق من حساب وليد.', 'error');
      return;
    }
    const notification = await sendNotification(kind, id, newStatus, userData.user.id);
    if (!notification.ok) {
      showApprovalToast('تم حفظ الحالة، لكن تعذر إرسال رسالة مرام: ' + notification.error, 'error');
      return;
    }
    showApprovalToast(successMessage(kind, newStatus, notification.sent), 'success');
  }

  window.bttKnowledgeStatus = (id, status) => applyStatus('knowledge', id, status);
  window.bttFeedbackStatus = (id, status) => applyStatus('feedback', id, status);
  window.bttCompanyStatus = (id, status) => applyStatus('company', id, status);
  window.bttJobStatus = (id, status) => applyStatus('job', id, status);
  window.bttCourseStatus = (id, status) => applyStatus('course', id, status);

  const adminArchives = [
    { key: 'feedback', heading: 'صندوق مرام', id: 'bttArchiveFeedback', title: 'أرشيف التوصيات والملاحظات المحسومة', description: 'التوصيات المعتمدة أو المرفوضة أو المنفذة محفوظة هنا.' },
    { key: 'knowledge', heading: 'المرجعية المهنية', id: 'bttArchiveKnowledge', title: 'أرشيف المواد المهنية المعتمدة أو الموقوفة', description: 'المواد المنشورة والمعتمدة تبقى محفوظة هنا.' },
    { key: 'job', heading: 'الوظائف', id: 'bttArchiveJobs', title: 'أرشيف الوظائف المنشورة أو المغلقة', description: 'الوظائف المنشورة أو المغلقة محفوظة هنا.' },
    { key: 'course', heading: 'الدورات', id: 'bttArchiveCourses', title: 'أرشيف الدورات المنشورة', description: 'الدورات المنشورة محفوظة هنا.' },
    { key: 'company', heading: 'طلبات الشركات', id: 'bttArchiveCompanies', title: 'أرشيف طلبات الشركات المحسومة', description: 'الطلبات المحولة للمتابعة أو المرفوضة محفوظة هنا.' }
  ];

  function cardIsArchived(kind, card) {
    const meta = card.querySelector('small')?.textContent || '';
    const parts = meta.split('•').map((x) => x.trim());
    if (kind === 'feedback') return parts.some((x) => ['accepted','rejected','implemented'].includes(x));
    if (kind === 'knowledge') return parts.some((x) => ['معتمدة','موقوفة'].includes(x));
    if (kind === 'job') return parts.some((x) => ['published','closed'].includes(x));
    if (kind === 'course') return parts.includes('published');
    if (kind === 'company') return parts.some((x) => ['converted','rejected'].includes(x));
    return false;
  }

  function sectionHeading(panel, text) {
    return [...panel.querySelectorAll('h3')].find((h) => h.textContent.trim().startsWith(text));
  }

  function firstListBeforeNextHeading(heading) {
    for (let node = heading?.nextElementSibling; node && node.tagName !== 'H3'; node = node.nextElementSibling) {
      if (node.classList?.contains('listStack')) return node;
    }
    return null;
  }

  function ensureArchive(activeList, id, title, description) {
    const parent = activeList.closest('#panelContent');
    let archive = parent.querySelector('#' + id);
    if (!archive) {
      archive = document.createElement('details');
      archive.id = id;
      archive.style.cssText = 'margin:12px 0 22px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc';
      const summary = document.createElement('summary');
      summary.style.cssText = 'cursor:pointer;font-weight:700;color:#334155';
      const note = document.createElement('p');
      note.textContent = description;
      note.style.cssText = 'margin:10px 0;color:#64748b;font-size:.92em';
      const list = document.createElement('div');
      list.className = 'listStack';
      list.id = id + 'List';
      archive.append(summary, note, list);
      activeList.insertAdjacentElement('afterend', archive);
    }
    return archive;
  }

  function syncArchive(activeList, archive, predicate, title) {
    const archivedList = archive.querySelector('.listStack');
    for (const card of [...activeList.querySelectorAll(':scope > .hubItem')]) {
      if (predicate(card)) archivedList.appendChild(card);
    }
    for (const card of [...archivedList.querySelectorAll(':scope > .hubItem')]) {
      if (!predicate(card)) activeList.appendChild(card);
    }
    const count = archivedList.querySelectorAll(':scope > .hubItem').length;
    const label = title + ' (' + count + ')';
    const summary = archive.querySelector('summary');
    if (summary.textContent !== label) summary.textContent = label;
  }

  function updateAdminArchives(panel) {
    if (!panel.querySelector('.hubIdentity')) return;
    for (const config of adminArchives) {
      const heading = sectionHeading(panel, config.heading);
      const activeList = firstListBeforeNextHeading(heading);
      if (!activeList) continue;
      const archive = ensureArchive(activeList, config.id, config.title, config.description);
      syncArchive(activeList, archive, (card) => cardIsArchived(config.key, card), config.title);
    }
  }

  function updateMaramArchives(panel) {
    const dashboard = panel.querySelector('.maramDashboard');
    if (!dashboard) return;

    const notesSection = dashboard.querySelector('#maram-followup');
    const notesList = notesSection?.querySelector('.listStack');
    if (notesList) {
      const archive = ensureArchive(notesList, 'bttMaramNotesArchive', 'أرشيف ملاحظاتي المحسومة', 'القرارات النهائية على ملاحظاتك محفوظة هنا.');
      syncArchive(notesList, archive, (card) => {
        const meta = card.querySelector('small')?.textContent || '';
        return /معتمدة|مرفوضة|تم التنفيذ/.test(meta);
      }, 'أرشيف ملاحظاتي المحسومة');
    }

    const approvedSection = dashboard.querySelector('#maram-approved');
    const approvedHeading = approvedSection?.querySelector('h3');
    const approvedList = approvedSection?.querySelector('.listStack');
    if (approvedHeading && approvedList) {
      const label = 'الأرشيف المهني المعتمد';
      if (!approvedHeading.textContent.startsWith(label)) approvedHeading.textContent = label;
      const archive = ensureArchive(approvedList, 'bttMaramKnowledgeArchive', label, 'المواد التي اعتمدها وليد محفوظة هنا.');
      syncArchive(approvedList, archive, () => true, label);
    }
  }

  function updateMaramDecisionBadges(panel) {
    const sections = [
      ['maram-followup', 'feedback'],
      ['maram-pending', 'knowledge'],
      ['maram-approved', 'knowledge']
    ];
    for (const [sectionId, kind] of sections) {
      const section = panel.querySelector('#' + sectionId);
      if (!section) continue;
      for (const card of section.querySelectorAll('.hubItem')) {
        const meta = card.querySelector('small')?.textContent || '';
        let label = '';
        let tone = '';
        if (kind === 'feedback') {
          if (/مرفوضة/.test(meta)) { label = 'لم يتم الاعتماد'; tone = 'rejected'; }
          else if (/تم التنفيذ/.test(meta)) { label = 'تم الاعتماد والتنفيذ'; tone = 'approved'; }
          else if (/معتمدة/.test(meta)) { label = 'تم الاعتماد'; tone = 'approved'; }
          else if (/تمت المراجعة/.test(meta)) { label = 'قيد المراجعة — لم يصدر قرار بعد'; tone = 'review'; }
          else if (/جديدة/.test(meta)) { label = 'لم يتم الاعتماد بعد — بانتظار مراجعة وليد'; tone = 'pending'; }
        } else if (sectionId === 'maram-approved' || /معتمدة/.test(meta)) {
          label = 'تم اعتماد المادة';
          tone = 'approved';
        } else if (/بانتظار اعتماد وليد/.test(meta)) {
          label = 'لم يتم الاعتماد بعد — بانتظار مراجعة وليد';
          tone = 'pending';
        }
        if (!label) continue;
        const title = card.querySelector('b');
        if (!title) continue;
        let badge = card.querySelector('.bttMaramDecision');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'bttMaramDecision';
          badge.setAttribute('role', 'status');
          title.insertAdjacentElement('afterend', badge);
        }
        const colors = {
          approved: 'background:#dcfce7;color:#166534',
          rejected: 'background:#fee2e2;color:#991b1b',
          pending: 'background:#fef3c7;color:#92400e',
          review: 'background:#dbeafe;color:#1e40af'
        };
        if (badge.textContent !== label) badge.textContent = label;
        badge.style.cssText = 'display:inline-block;margin:6px 8px 6px 0;padding:5px 10px;border-radius:999px;font-size:.82em;font-weight:700;line-height:1.5;' + colors[tone];
      }
    }
  }

  async function markNotificationRead(client, row, card, button, dashboard) {
    button.disabled = true;
    const { data, error } = await client.from('approval_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', row.id).eq('recipient_id', row.recipient_id).select('id').maybeSingle();
    if (error || !data) {
      button.disabled = false;
      button.textContent = 'تعذر تحديث حالة القراءة';
      return;
    }
    card.dataset.read = 'true';
    button.remove();
    const count = dashboard.querySelectorAll('.bttApprovalNotice[data-read="false"]').length;
    const unread = dashboard.querySelector('#bttApprovalUnread');
    if (unread) unread.textContent = 'رسائل غير مقروءة: ' + count;
  }

  async function renderMaramNotifications(panel) {
    const dashboard = panel.querySelector('.maramDashboard');
    const welcome = dashboard?.querySelector('.maramWelcome');
    if (!dashboard || !welcome || dashboard.querySelector('#bttApprovalNotifications') || dashboard.dataset.bttNoticeLoading) return;
    const client = dbClient();
    if (!client) return;
    dashboard.dataset.bttNoticeLoading = 'true';
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData?.user) return;
      const { data, error } = await client.from('approval_notifications')
        .select('id,recipient_id,entity_type,event_type,title,body,read_at,created_at')
        .eq('recipient_id', authData.user.id).order('created_at', { ascending: false }).limit(50);
      if (error) {
        const problem = document.createElement('p');
        problem.id = 'bttApprovalNotifications';
        problem.className = 'status error';
        problem.textContent = 'تعذر تحميل رسائل قرارات وليد.';
        welcome.insertAdjacentElement('afterend', problem);
        return;
      }
      if (!data?.length) return;
      const section = document.createElement('section');
      section.id = 'bttApprovalNotifications';
      section.className = 'maramSection';
      const heading = document.createElement('h3');
      heading.textContent = 'رسائل قرارات وليد';
      const unreadCount = data.filter((row) => !row.read_at).length;
      const countLabel = document.createElement('p');
      countLabel.id = 'bttApprovalUnread';
      countLabel.className = 'testNotice';
      countLabel.textContent = 'رسائل غير مقروءة: ' + unreadCount;
      const stack = document.createElement('div');
      stack.className = 'listStack';
      for (const row of data) {
        const card = document.createElement('article');
        card.className = 'hubItem bttApprovalNotice';
        card.dataset.read = row.read_at ? 'true' : 'false';
        const title = document.createElement('b');
        title.textContent = row.title;
        const date = document.createElement('small');
        date.textContent = new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.created_at));
        const body = document.createElement('p');
        body.textContent = row.body;
        card.append(title, date, body);
        if (!row.read_at) {
          const button = document.createElement('button');
          button.className = 'secondary smallBtn';
          button.type = 'button';
          button.textContent = 'تمت القراءة';
          button.addEventListener('click', () => markNotificationRead(client, row, card, button, dashboard));
          card.appendChild(button);
        }
        stack.appendChild(card);
      }
      section.append(heading, countLabel, stack);
      welcome.insertAdjacentElement('afterend', section);
    } catch (error) {
      console.error('Approval notifications failed to load', error);
    } finally {
      delete dashboard.dataset.bttNoticeLoading;
    }
  }

  function updatePage(panel) {
    updateAdminArchives(panel);
    updateMaramArchives(panel);
    updateMaramDecisionBadges(panel);
    renderMaramNotifications(panel);
  }

  const panel = document.getElementById('panelContent');
  if (panel && !window.bttApprovalPanelObserver) {
    window.bttApprovalPanelObserver = new MutationObserver(() => {
      if (window.bttApprovalPanelScheduled) return;
      window.bttApprovalPanelScheduled = true;
      setTimeout(() => {
        window.bttApprovalPanelScheduled = false;
        updatePage(panel);
      }, 0);
    });
    window.bttApprovalPanelObserver.observe(panel, { childList: true, subtree: true });
    updatePage(panel);
  }
})();