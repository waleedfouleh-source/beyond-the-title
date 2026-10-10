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
})();
