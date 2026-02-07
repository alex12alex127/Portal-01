/**
 * Portal-01 Real-Time Polling System
 * Polls /api/v1/counts every 15s and updates all badges + shows toast on new items.
 */
(function () {
  var BASE = window.APP_BASE || '';
  var POLL_INTERVAL = 15000; // 15 seconds
  var pollTimer = null;
  var lastCounts = { notifiche: -1, avvisi: -1, messaggi: -1 };
  var isFirstPoll = true;
  var isPageVisible = true;

  // ========== BADGE SELECTORS ==========
  // Sidebar badges
  function getSidebarComunicazioniBadge() {
    // The Comunicazioni link badge (notifiche + avvisi combined)
    var links = document.querySelectorAll('.sidebar__link');
    for (var i = 0; i < links.length; i++) {
      if (links[i].textContent.indexOf('Comunicazioni') !== -1) {
        return links[i].querySelector('.notification-badge');
      }
    }
    return null;
  }

  function getSidebarMessaggiBadge() {
    var links = document.querySelectorAll('.sidebar__link');
    for (var i = 0; i < links.length; i++) {
      if (links[i].textContent.indexOf('Messaggi') !== -1) {
        return links[i].querySelector('.notification-badge');
      }
    }
    return null;
  }

  function getSidebarComunicazioniLink() {
    var links = document.querySelectorAll('.sidebar__link');
    for (var i = 0; i < links.length; i++) {
      if (links[i].textContent.indexOf('Comunicazioni') !== -1) return links[i];
    }
    return null;
  }

  function getSidebarMessaggiLink() {
    var links = document.querySelectorAll('.sidebar__link');
    for (var i = 0; i < links.length; i++) {
      if (links[i].textContent.indexOf('Messaggi') !== -1) return links[i];
    }
    return null;
  }

  // Bottom nav badges
  function getBottomNavBadge(label) {
    var items = document.querySelectorAll('.bottom-nav__item');
    for (var i = 0; i < items.length; i++) {
      var span = items[i].querySelector('span:not(.bottom-nav__badge)');
      if (span && span.textContent.trim().indexOf(label) !== -1) {
        return { item: items[i], badge: items[i].querySelector('.bottom-nav__badge') };
      }
    }
    return { item: null, badge: null };
  }

  // ========== UPDATE BADGE HELPER ==========
  function updateBadge(existingBadge, parentEl, count, className) {
    if (count > 0) {
      if (existingBadge) {
        existingBadge.textContent = count;
        existingBadge.style.display = '';
      } else if (parentEl) {
        var b = document.createElement('span');
        b.className = className || 'notification-badge';
        b.style.display = 'inline-block';
        b.textContent = count;
        parentEl.appendChild(b);
      }
    } else {
      if (existingBadge) {
        existingBadge.style.display = 'none';
      }
    }
  }

  // ========== TOAST SYSTEM ==========
  var toastContainer = null;

  function getToastContainer() {
    if (toastContainer) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.id = 'rt-toasts';
    toastContainer.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;display:flex;flex-direction:column;gap:.5rem;pointer-events:none;max-width:340px;width:100%';
    document.body.appendChild(toastContainer);
    return toastContainer;
  }

  function showRealtimeToast(message, icon, color) {
    var container = getToastContainer();
    var toast = document.createElement('div');
    toast.className = 'rt-toast';
    toast.style.cssText = 'pointer-events:auto;display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;border-radius:var(--radius-lg,12px);background:var(--glass,rgba(255,255,255,.85));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--glass-border,rgba(255,255,255,.18));box-shadow:0 8px 32px rgba(0,0,0,.12);font-size:.82rem;color:var(--text,#1e293b);animation:rtToastIn .35s ease both;cursor:pointer;transition:opacity .3s,transform .3s';

    var iconEl = document.createElement('div');
    iconEl.style.cssText = 'width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;background:' + (color || 'var(--primary,#3b82f6)') + ';color:#fff';
    iconEl.textContent = icon || '!';

    var textEl = document.createElement('div');
    textEl.style.cssText = 'flex:1;min-width:0;font-weight:500;line-height:1.3';
    textEl.textContent = message;

    toast.appendChild(iconEl);
    toast.appendChild(textEl);
    container.appendChild(toast);

    toast.addEventListener('click', function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    });

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 5000);
  }

  // ========== POLL FUNCTION ==========
  function poll() {
    fetch(BASE + '/api/v1/counts', {
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    })
      .then(function (r) {
        if (r.status === 401) { stopPolling(); return null; }
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.success) return;

        var comTot = data.notifiche + data.avvisi;

        // --- Update sidebar badges ---
        // Comunicazioni (notifiche + avvisi)
        var comLink = getSidebarComunicazioniLink();
        var comBadge = getSidebarComunicazioniBadge();
        updateBadge(comBadge, comLink, comTot, 'notification-badge');

        // Messaggi
        var msgLink = getSidebarMessaggiLink();
        var msgBadge = getSidebarMessaggiBadge();
        updateBadge(msgBadge, msgLink, data.messaggi, 'notification-badge');

        // --- Update bottom nav badges ---
        var bnMsg = getBottomNavBadge('Messaggi');
        updateBadge(bnMsg.badge, bnMsg.item, data.messaggi, 'bottom-nav__badge');

        var bnNot = getBottomNavBadge('Notifiche');
        updateBadge(bnNot.badge, bnNot.item, comTot, 'bottom-nav__badge');

        // --- Update page title with total count ---
        var totalUnread = comTot + data.messaggi;
        var baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
        document.title = totalUnread > 0 ? '(' + totalUnread + ') ' + baseTitle : baseTitle;

        // --- Show toasts for NEW items (not on first poll) ---
        if (!isFirstPoll) {
          if (data.notifiche > lastCounts.notifiche && lastCounts.notifiche >= 0) {
            var diff = data.notifiche - lastCounts.notifiche;
            showRealtimeToast(
              diff + ' nuov' + (diff === 1 ? 'a notifica' : 'e notifiche'),
              '\uD83D\uDD14',
              'linear-gradient(135deg, #3b82f6, #6366f1)'
            );
          }
          if (data.messaggi > lastCounts.messaggi && lastCounts.messaggi >= 0) {
            var diffM = data.messaggi - lastCounts.messaggi;
            showRealtimeToast(
              diffM + ' nuov' + (diffM === 1 ? 'o messaggio' : 'i messaggi'),
              '\uD83D\uDCAC',
              'linear-gradient(135deg, #06b6d4, #3b82f6)'
            );
          }
          if (data.avvisi > lastCounts.avvisi && lastCounts.avvisi >= 0) {
            var diffA = data.avvisi - lastCounts.avvisi;
            showRealtimeToast(
              diffA + ' nuov' + (diffA === 1 ? 'o avviso' : 'i avvisi'),
              '\uD83D\uDCE2',
              'linear-gradient(135deg, #f59e0b, #ef4444)'
            );
          }
        }

        lastCounts.notifiche = data.notifiche;
        lastCounts.avvisi = data.avvisi;
        lastCounts.messaggi = data.messaggi;
        isFirstPoll = false;
      })
      .catch(function () {
        // Silently ignore network errors
      });
  }

  // ========== VISIBILITY API ==========
  function onVisibilityChange() {
    if (document.hidden) {
      isPageVisible = false;
    } else {
      isPageVisible = true;
      poll(); // Immediate poll when tab becomes visible
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  // ========== START / STOP ==========
  function startPolling() {
    poll(); // Immediate first poll
    pollTimer = setInterval(function () {
      if (isPageVisible) poll();
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ========== INJECT ANIMATION CSS ==========
  var style = document.createElement('style');
  style.textContent = '@keyframes rtToastIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}';
  document.head.appendChild(style);

  // ========== INIT ==========
  // Only start if user is logged in (check if sidebar exists = authenticated page)
  if (document.getElementById('sidebar')) {
    // Small delay to not compete with initial page load
    setTimeout(startPolling, 2000);
  }

  // Expose for manual use
  window.portalRealtime = { poll: poll, start: startPolling, stop: stopPolling };
})();
