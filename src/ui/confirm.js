let activeBackdrop = null;

export function confirmDialog({
  title = '',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  destructive = false,
} = {}) {
  if (activeBackdrop) {
    activeBackdrop.remove();
    activeBackdrop = null;
  }

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';
    backdrop.setAttribute('role', 'presentation');

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');

    const titleId = 'dialog-title-' + Math.random().toString(36).slice(2, 8);
    const msgId = 'dialog-msg-' + Math.random().toString(36).slice(2, 8);
    if (title) dialog.setAttribute('aria-labelledby', titleId);
    if (message) dialog.setAttribute('aria-describedby', msgId);

    if (title) {
      const h = document.createElement('h3');
      h.className = 'dialog-title';
      h.id = titleId;
      h.textContent = title;
      dialog.appendChild(h);
    }
    if (message) {
      const p = document.createElement('p');
      p.className = 'dialog-message';
      p.id = msgId;
      p.textContent = message;
      dialog.appendChild(p);
    }

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.className = 'dialog-btn';
    btnCancel.textContent = cancelText;

    const btnConfirm = document.createElement('button');
    btnConfirm.type = 'button';
    btnConfirm.className = 'dialog-btn ' + (destructive ? 'destructive' : 'primary');
    btnConfirm.textContent = confirmText;

    actions.appendChild(btnCancel);
    actions.appendChild(btnConfirm);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
    activeBackdrop = backdrop;

    const previouslyFocused = document.activeElement;

    function close(result) {
      backdrop.classList.remove('is-open');
      const finish = () => {
        backdrop.removeEventListener('transitionend', finish);
        backdrop.remove();
        if (activeBackdrop === backdrop) activeBackdrop = null;
        document.removeEventListener('keydown', onKey);
        if (previouslyFocused && previouslyFocused.focus) {
          try { previouslyFocused.focus(); } catch (_) { /* noop */ }
        }
        resolve(result);
      };
      // Fallback if reduced-motion or no transition fires
      const timer = setTimeout(finish, 220);
      backdrop.addEventListener('transitionend', () => {
        clearTimeout(timer);
        finish();
      }, { once: true });
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Tab') {
        const focusables = [btnCancel, btnConfirm];
        const idx = focusables.indexOf(document.activeElement);
        if (idx === -1) {
          focusables[0].focus();
          e.preventDefault();
        } else {
          const next = e.shiftKey
            ? (idx - 1 + focusables.length) % focusables.length
            : (idx + 1) % focusables.length;
          focusables[next].focus();
          e.preventDefault();
        }
      }
    }

    btnCancel.addEventListener('click', () => close(false));
    btnConfirm.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });
    document.addEventListener('keydown', onKey);

    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      btnConfirm.focus();
    });
  });
}
