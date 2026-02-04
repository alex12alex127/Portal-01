(function () {
  function toastEl() {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }
  function modalEl() {
    var el = document.getElementById('modal-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'modal-overlay';
      el.className = 'modal-overlay';
      el.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h3 id="modal-title" class="modal__title"></h3><p class="modal__text"></p><div class="modal__actions"><button type="button" class="btn btn--secondary modal-cancel">Annulla</button><button type="button" class="btn modal-confirm">Conferma</button></div></div>';
      document.body.appendChild(el);
    }
    return el;
  }
  window.showToast = function (msg, type) {
    var el = toastEl();
    el.textContent = msg;
    el.className = 'toast toast--' + (type === 'ok' ? 'ok' : 'error');
    el.style.display = 'block';
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.style.display = 'none';
      el.textContent = '';
      el.className = '';
    }, 4000);
  };
  window.showModal = function (opts) {
    var overlay = modalEl();
    var title = (opts && opts.title) || 'Conferma';
    var text = (opts && opts.text) || '';
    var onConfirm = (opts && opts.onConfirm) || function () {};
    var onCancel = (opts && opts.onCancel) || function () {};
    overlay.querySelector('.modal__title').textContent = title;
    overlay.querySelector('.modal__text').textContent = text;
    overlay.classList.add('modal-overlay--open');
    function close() {
      overlay.classList.remove('modal-overlay--open');
      overlay.querySelector('.modal-confirm').onclick = null;
      overlay.querySelector('.modal-cancel').onclick = null;
      overlay.onclick = null;
    }
    overlay.querySelector('.modal-confirm').onclick = function () {
      close();
      onConfirm();
    };
    overlay.querySelector('.modal-cancel').onclick = function () {
      close();
      onCancel();
    };
    overlay.onclick = function (e) {
      if (e.target === overlay) { close(); onCancel(); }
    };
  };
  window.promptModal = function (opts, callback) {
    var overlay = modalEl();
    var title = (opts && opts.title) || 'Inserisci';
    var text = (opts && opts.text) || '';
    var placeholder = (opts && opts.placeholder) || '';
    overlay.querySelector('.modal__title').textContent = title;
    var wrap = overlay.querySelector('.modal__text');
    wrap.textContent = text;
    var input = document.createElement('input');
    input.type = opts.type || 'text';
    input.placeholder = placeholder;
    input.className = 'modal__input';
    wrap.appendChild(input);
    var actions = overlay.querySelector('.modal__actions');
    actions.innerHTML = '<button type="button" class="btn btn--secondary modal-cancel">Annulla</button><button type="button" class="btn modal-confirm">OK</button>';
    overlay.classList.add('modal-overlay--open');
    input.focus();
    function close() {
      overlay.classList.remove('modal-overlay--open');
      if (input.parentNode) input.parentNode.removeChild(input);
      actions.innerHTML = '<button type="button" class="btn btn--secondary modal-cancel">Annulla</button><button type="button" class="btn modal-confirm">Conferma</button>';
    }
    actions.querySelector('.modal-confirm').onclick = function () {
      var val = input.value;
      close();
      if (callback) callback(val);
    };
    actions.querySelector('.modal-cancel').onclick = close;
    overlay.onclick = function (e) {
      if (e.target === overlay) { close(); if (callback) callback(null); }
    };
  };
})();
