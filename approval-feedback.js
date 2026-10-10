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
})();
