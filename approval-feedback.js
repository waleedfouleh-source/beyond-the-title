(() => {
  'use strict';

  const approve = window.bttKnowledgeStatus;
  if (typeof approve !== 'function') return;

  let toastTimer;

  function showApprovalToast(message, kind) {
    let toast = document.getElementById('bttApprovalToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'bttApprovalToast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      Object.assign(toast.style, {
        position: 'fixed',
        top: '18px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '10000',
        maxWidth: 'calc(100vw - 32px)',
        padding: '12px 18px',
        borderRadius: '12px',
        boxShadow: '0 8px 28px rgba(0,0,0,.2)',
        color: '#fff',
        fontFamily: 'inherit',
        fontWeight: '700',
        textAlign: 'center',
        transition: 'opacity .2s ease'
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.background = kind === 'error' ? '#a83232' : kind === 'pending' ? '#475569' : '#087f5b';
    toast.style.opacity = '1';
    clearTimeout(toastTimer);
    if (kind !== 'pending') {
      toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 4500);
    }
  }

  function findKnowledgeCard(id) {
    const marker = `bttKnowledgeStatus('${id}'`;
    return [...document.querySelectorAll('#panelContent .hubItem')].find((card) =>
      [...card.querySelectorAll('button')].some((button) =>
        (button.getAttribute('onclick') || '').includes(marker)
      )
    );
  }

  function isApproved(id) {
    const card = findKnowledgeCard(id);
    return Boolean(card && [...card.querySelectorAll('small')].some((label) =>
      label.textContent.includes('معتمدة')
    ));
  }

  function waitForApproval(id, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        if (isApproved(id)) return resolve(true);
        if (Date.now() - startedAt >= timeoutMs) return resolve(false);
        setTimeout(check, 100);
      };
      check();
    });
  }

  window.bttKnowledgeStatus = async function(id, newStatus) {
    if (newStatus !== 'approved') return approve(id, newStatus);

    showApprovalToast('جارٍ حفظ اعتماد توصية مرام…', 'pending');
    let operationError = '';
    const nativeAlert = window.alert;
    window.alert = (message) => {
      operationError = String(message || 'تعذر حفظ الاعتماد.');
    };

    try {
      await approve(id, newStatus);
    } catch (error) {
      operationError = String(error?.message || error || 'تعذر حفظ الاعتماد.');
    } finally {
      window.alert = nativeAlert;
    }

    if (operationError) {
      showApprovalToast('لم يتم اعتماد التوصية: ' + operationError, 'error');
      return;
    }

    if (await waitForApproval(id)) {
      showApprovalToast('تم اعتماد توصية مرام وحفظها بنجاح.', 'success');
      return;
    }

    showApprovalToast('لم يتأكد حفظ الاعتماد. حدّث اللوحة وحاول مرة أخرى.', 'error');
  };

  // Consultant feedback uses a separate status handler from knowledge approvals.
  // Confirm the saved state is visible after the admin dashboard reloads.
  const updateFeedback = window.bttFeedbackStatus;

  function findFeedbackCard(id) {
    const marker = `bttFeedbackStatus('${id}'`;
    return [...document.querySelectorAll('#panelContent .hubItem')].find((card) =>
      [...card.querySelectorAll('button')].some((button) =>
        (button.getAttribute('onclick') || '').includes(marker)
      )
    );
  }

  function feedbackHasStatus(id, wanted) {
    const card = findFeedbackCard(id);
    return Boolean(card && [...card.querySelectorAll('small')].some((label) =>
      label.textContent.split('•').some((part) => part.trim() === wanted)
    ));
  }

  function waitForFeedbackStatus(id, wanted, timeoutMs = 7000) {
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        if (feedbackHasStatus(id, wanted)) return resolve(true);
        if (Date.now() - startedAt >= timeoutMs) return resolve(false);
        setTimeout(check, 120);
      };
      check();
    });
  }

  const feedbackMessages = {
    reviewed: 'تم تسجيل أن التوصية قيد المراجعة.',
    accepted: 'تم اعتماد توصية مرام وحفظها بنجاح.',
    implemented: 'تم تسجيل تنفيذ توصية مرام.',
    rejected: 'تم تسجيل رفض التوصية.'
  };

  window.bttFeedbackStatus = async function(id, newStatus) {
    if (typeof updateFeedback !== 'function') return;
    showApprovalToast(newStatus === 'accepted' ? 'جارٍ حفظ اعتماد توصية مرام…' : 'جارٍ حفظ تحديث التوصية…', 'pending');
    let operationError = '';
    const nativeAlert = window.alert;
    window.alert = (message) => { operationError = String(message || 'تعذر حفظ التغيير.'); };

    try {
      await updateFeedback(id, newStatus);
    } catch (error) {
      operationError = String(error?.message || error || 'تعذر حفظ التغيير.');
    } finally {
      window.alert = nativeAlert;
    }

    if (operationError) {
      showApprovalToast('لم يتم حفظ التغيير: ' + operationError, 'error');
      return;
    }

    if (await waitForFeedbackStatus(id, newStatus)) {
      showApprovalToast(feedbackMessages[newStatus] || 'تم حفظ التغيير بنجاح.', 'success');
      return;
    }

    showApprovalToast('لم يتأكد حفظ التغيير. حدّث لوحة وليد وتحقق من الحالة قبل إعادة المحاولة.', 'error');
  };

  // Keep accepted consultant recommendations out of the active inbox.
  // This presentation layer preserves the existing database workflow and places
  // the original cards in a collapsible archive so Waleed can reopen them.
  function feedbackCardIsAccepted(card) {
    return [...card.querySelectorAll('small')].some((label) =>
      label.textContent.split('•').some((part) => part.trim() === 'accepted')
    );
  }

  function updateRecommendationArchive() {
    const panel = document.getElementById('panelContent');
    if (!panel) return;
    const heading = [...panel.querySelectorAll('h3')].find((item) =>
      item.textContent.trim().startsWith('صندوق مرام')
    );
    const activeList = heading?.nextElementSibling;
    if (!activeList?.classList.contains('listStack')) return;

    let archive = panel.querySelector('#bttFeedbackArchive');
    if (!archive) {
      archive = document.createElement('details');
      archive.id = 'bttFeedbackArchive';
      archive.style.cssText = 'margin:12px 0 22px;padding:12px 14px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc';
      const summary = document.createElement('summary');
      summary.style.cssText = 'cursor:pointer;font-weight:700;color:#334155';
      const description = document.createElement('p');
      description.textContent = 'التوصيات المعتمدة محفوظة هنا، ويمكن فتحها ومراجعتها في أي وقت.';
      description.style.cssText = 'margin:10px 0;color:#64748b;font-size:.92em';
      const archivedList = document.createElement('div');
      archivedList.id = 'bttFeedbackArchiveList';
      archivedList.className = 'listStack';
      archive.append(summary, description, archivedList);
      activeList.insertAdjacentElement('afterend', archive);
    }

    const archivedList = archive.querySelector('#bttFeedbackArchiveList');
    for (const card of [...activeList.querySelectorAll(':scope > .hubItem')]) {
      if (feedbackCardIsAccepted(card)) archivedList.appendChild(card);
    }
    for (const card of [...archivedList.querySelectorAll(':scope > .hubItem')]) {
      if (!feedbackCardIsAccepted(card)) activeList.appendChild(card);
    }

    const count = archivedList.querySelectorAll(':scope > .hubItem').length;
    const label = 'أرشيف التوصيات المعتمدة (' + count + ')';
    const summary = archive.querySelector('summary');
    if (summary.textContent !== label) summary.textContent = label;
  }


  function updateMaramDecisionBadges() {
    const panel = document.getElementById('panelContent');
    if (!panel) return;

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
          if (/مرفوضة/.test(meta)) {
            label = 'لم يتم الاعتماد';
            tone = 'rejected';
          } else if (/تم التنفيذ/.test(meta)) {
            label = 'تم الاعتماد والتنفيذ';
            tone = 'approved';
          } else if (/معتمدة/.test(meta)) {
            label = 'تم الاعتماد';
            tone = 'approved';
          } else if (/تمت المراجعة/.test(meta)) {
            label = 'قيد المراجعة — لم يصدر قرار بعد';
            tone = 'review';
          } else if (/جديدة/.test(meta)) {
            label = 'لم يتم الاعتماد بعد — بانتظار مراجعة وليد';
            tone = 'pending';
          }
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
          badge.style.cssText = 'display:inline-block;margin:6px 8px 6px 0;padding:5px 10px;border-radius:999px;font-size:.82em;font-weight:700;line-height:1.5';
          title.insertAdjacentElement('afterend', badge);
        }

        const colors = {
          approved: 'background:#dcfce7;color:#166534',
          rejected: 'background:#fee2e2;color:#991b1b',
          pending: 'background:#fef3c7;color:#92400e',
          review: 'background:#dbeafe;color:#1e40af'
        };
        badge.textContent = label;
        badge.style.cssText = 'display:inline-block;margin:6px 8px 6px 0;padding:5px 10px;border-radius:999px;font-size:.82em;font-weight:700;line-height:1.5;' + colors[tone];
      }
    }
  }

  const feedbackPanel = document.getElementById('panelContent');
  if (feedbackPanel && !window.bttFeedbackArchiveObserver) {
    window.bttFeedbackArchiveObserver = new MutationObserver(() => {
      if (window.bttFeedbackArchiveScheduled) return;
      window.bttFeedbackArchiveScheduled = true;
      setTimeout(() => {
        window.bttFeedbackArchiveScheduled = false;
        updateRecommendationArchive();
        updateMaramDecisionBadges();
      }, 0);
    });
    window.bttFeedbackArchiveObserver.observe(feedbackPanel, { childList: true, subtree: true });
    updateRecommendationArchive();
    updateMaramDecisionBadges();
  }
})();
