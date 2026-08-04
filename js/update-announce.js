/**
 * WisdomLayers Reach - one-time "what changed" announcements
 *
 * Loads on every page (like spotlight-tour.js), shows at most once per
 * contractor per announcement, regardless of which page they land on
 * first. To ship a new announcement: add an entry to UPDATES below with a
 * fresh id, don't edit an old entry's id or its seen flag stops meaning
 * anything (a contractor who already dismissed it would see it again).
 *
 * Two weights, pick per entry based on how big the change actually is
 * (full-screen modals are for things a contractor genuinely needs to stop
 * and read, everything smaller is a banner - see the type comment below):
 *   - 'modal':  full-screen, blocks interaction until dismissed. For a
 *               workflow or policy change contractors could otherwise miss
 *               and act wrong because of it.
 *   - 'banner': dismissible strip at the top of the page content, pushes
 *               content down rather than covering it, never blocks
 *               interaction. For everything smaller, a doc reword, a UI
 *               tweak, a wording fix.
 *
 * Deliberately dumb about dismissal: the only way to close either one is
 * its own dismiss button (a labeled "Got it" for the modal, an X for the
 * banner). No backdrop click, no Escape key, nothing that could dismiss
 * (and thus permanently suppress) it by accident.
 */
const UpdateAnnounce = (function () {
  // Newest first. Only the first one this contractor hasn't seen shows -
  // multiple unseen updates queue for later, they don't stack all at once.
  const UPDATES = [
    {
      id: 'email-scripts-2026-08',
      type: 'modal',
      title: 'Email Scripts got an update',
      body: [
        "The email templates on the Email Scripts and Onboarding pages are now outlines instead of copy-paste scripts, write your own sentences from the structure given, based on what you actually found on each business.",
        "Also fixed: someone flagged that the unsubscribe/reply workflow needed a closer look, so that's been reviewed and corrected across every page.",
      ],
    },
  ];

  function seenKey(updateId, workspaceKey) {
    return 'wl_update_seen_' + updateId + '_' + workspaceKey;
  }

  // Same key resolution every page already does in initSidebarIdentity()
  // (URL param first, then the last-known key cached by leads-cache.js) -
  // duplicated here rather than depending on a page-level WORKSPACE_KEY
  // variable, since playbook.html/onboarding.html never declare one.
  function resolveWorkspaceKey() {
    const params = new URLSearchParams(window.location.search);
    let key = params.get('w');
    if (!key && typeof _readLastWorkspaceKey === 'function') {
      key = _readLastWorkspaceKey();
    }
    return key;
  }

  function injectStyles() {
    if (document.getElementById('update-announce-styles')) return;
    const style = document.createElement('style');
    style.id = 'update-announce-styles';
    style.textContent = `
      .ua-overlay {
        position: fixed; inset: 0; z-index: 410;
        display: flex; align-items: center; justify-content: center; padding: 24px;
        background: rgba(15, 23, 42, 0.45);
        opacity: 0; transition: opacity 0.25s ease-out;
      }
      .ua-overlay.open { opacity: 1; }
      .ua-card {
        background: #ffffff; border-radius: 16px; width: 100%; max-width: 420px;
        padding: 28px 28px 24px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.24);
        opacity: 0; transform: scale(0.96) translateY(8px);
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      }
      .ua-overlay.open .ua-card { opacity: 1; transform: scale(1) translateY(0); }
      .ua-badge {
        display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.06em; color: var(--teal-700);
        background: var(--teal-50); border-radius: 20px; padding: 4px 11px; margin-bottom: 14px;
      }
      .ua-title {
        font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif;
        font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); margin-bottom: 10px;
      }
      .ua-body { font-size: 13.5px; color: var(--gray-600); line-height: 1.65; }
      .ua-body p { margin-bottom: 8px; }
      .ua-body p:last-child { margin-bottom: 0; }
      .ua-actions { margin-top: 20px; display: flex; justify-content: flex-end; }
      .ua-actions button {
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
        font-size: 13.5px; font-weight: 700; color: #ffffff;
        background: var(--teal-600); border: 1px solid var(--teal-600);
        border-radius: 9px; padding: 9px 18px; cursor: pointer;
        transition: background 0.12s, border-color 0.12s;
      }
      .ua-actions button:hover { background: var(--teal-700); border-color: var(--teal-700); }

      /* Banner sits inline at the top of .content and pushes everything
         below it down - deliberately not position:fixed/absolute, an
         overlaying banner would cover the page header on narrow viewports. */
      .ua-banner {
        display: flex; align-items: flex-start; gap: 12px;
        background: var(--teal-50); border: 1px solid var(--teal-500); border-radius: 12px;
        padding: 14px 16px; margin-bottom: 20px;
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      }
      .ua-banner-badge {
        flex-shrink: 0; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--teal-700); background: #ffffff;
        border: 1px solid var(--teal-500); border-radius: 6px; padding: 3px 9px; margin-top: 1px;
      }
      .ua-banner-text { flex: 1; min-width: 0; }
      .ua-banner-title { font-size: 13.5px; font-weight: 700; color: var(--ink); margin-bottom: 2px; }
      .ua-banner-body { font-size: 13px; color: var(--gray-600); line-height: 1.5; }
      .ua-banner-close {
        flex-shrink: 0; background: none; border: none; cursor: pointer;
        color: var(--gray-500); font-size: 18px; line-height: 1; padding: 2px 4px;
        border-radius: 6px; transition: background 0.12s, color 0.12s;
      }
      .ua-banner-close:hover { background: var(--teal-100); color: var(--teal-700); }
    `;
    document.head.appendChild(style);
  }

  function buildModalDom(update) {
    const overlay = document.createElement('div');
    overlay.className = 'ua-overlay';
    overlay.innerHTML = `
      <div class="ua-card">
        <span class="ua-badge">Update</span>
        <h2 class="ua-title"></h2>
        <div class="ua-body"></div>
        <div class="ua-actions"><button type="button">Got it</button></div>
      </div>`;
    overlay.querySelector('.ua-title').textContent = update.title;
    const bodyEl = overlay.querySelector('.ua-body');
    update.body.forEach(paragraph => {
      const p = document.createElement('p');
      p.textContent = paragraph;
      bodyEl.appendChild(p);
    });
    document.body.appendChild(overlay);

    return {
      dismissTarget: overlay,
      show: () => requestAnimationFrame(() => overlay.classList.add('open')),
      hide: (onDone) => {
        overlay.classList.remove('open');
        setTimeout(() => { overlay.remove(); onDone(); }, 250);
      },
      bindDismiss: (fn) => overlay.querySelector('.ua-actions button').addEventListener('click', fn),
    };
  }

  function buildBannerDom(update) {
    // .content is the scrollable page-body column every page already uses
    // (sidebar + topbar sit outside it) - inserting at its top means the
    // banner pushes that page's real content down instead of floating over
    // the sidebar or topbar, which .content's siblings would risk.
    const host = document.querySelector('.content');
    if (!host) return null;

    const banner = document.createElement('div');
    banner.className = 'ua-banner';
    banner.innerHTML = `
      <span class="ua-banner-badge">Update</span>
      <div class="ua-banner-text">
        <div class="ua-banner-title"></div>
        <div class="ua-banner-body"></div>
      </div>
      <button type="button" class="ua-banner-close" aria-label="Dismiss">&times;</button>`;
    banner.querySelector('.ua-banner-title').textContent = update.title;
    banner.querySelector('.ua-banner-body').textContent = update.body.join(' ');
    host.insertBefore(banner, host.firstChild);

    return {
      dismissTarget: banner,
      show: () => {},
      hide: (onDone) => { banner.remove(); onDone(); },
      bindDismiss: (fn) => banner.querySelector('.ua-banner-close').addEventListener('click', fn),
    };
  }

  /**
   * init: call on every page, after leads-cache.js has loaded (and after
   * .content exists in the DOM, for banner-type updates). No-op if there's
   * no resolvable workspace key (identity gate pages handle their own
   * messaging) or if every known update has already been seen.
   */
  function init() {
    const workspaceKey = resolveWorkspaceKey();
    if (!workspaceKey) return;

    let update = null;
    for (const candidate of UPDATES) {
      let seen = false;
      try { seen = !!localStorage.getItem(seenKey(candidate.id, workspaceKey)); } catch (e) {}
      if (!seen) { update = candidate; break; }
    }
    if (!update) return;

    injectStyles();
    const widget = update.type === 'banner' ? buildBannerDom(update) : buildModalDom(update);
    if (!widget) return;

    widget.bindDismiss(() => {
      try { localStorage.setItem(seenKey(update.id, workspaceKey), '1'); } catch (e) {}
      widget.hide(() => {});
    });
    widget.show();
  }

  return { init };
})();
