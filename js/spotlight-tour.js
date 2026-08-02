/**
 * WisdomLayers Reach - cross-page spotlight tour
 *
 * A first-visit walkthrough that spans multiple real pages (Dashboard,
 * History, Lead Tracker, Email Scripts), spotlighting real elements on
 * each rather than a mock. Progress is a single global step index, saved
 * to sessionStorage (not localStorage - a tour someone abandons quietly
 * expires with the browser session rather than resuming days later).
 *
 * Every page that participates calls SpotlightTour.registerPage(pageId,
 * localSteps) once, passing only the steps that live on that page. Steps
 * across all pages are addressed by a global index in the order pages are
 * visited; a step's `href` is what crosses pages - clicking Next on it
 * navigates there, and the destination page's registerPage() call resumes
 * from the saved global index automatically.
 */
const SpotlightTour = (function () {
  const ACTIVE_KEY = 'wl_tour_active';
  const GLOBAL_INDEX_KEY = 'wl_tour_global_index';

  // Injected once per page rather than requiring every page to also link a
  // shared stylesheet - one <script src> is the only integration point.
  function injectStyles() {
    if (document.getElementById('spotlight-tour-styles')) return;
    const style = document.createElement('style');
    style.id = 'spotlight-tour-styles';
    style.textContent = `
      /* pointer-events: auto on the overlay itself (not none) is what makes
         this an actual modal - every click on the page during the tour is
         swallowed here unless it lands on the card. The "hole" is a purely
         visual cutout (box-shadow ring), not a real DOM clip, so without
         this the highlighted element - and everything else on the page,
         including the sidebar nav - would stay fully clickable underneath
         the tour, letting someone claim a lead or navigate away mid-tour. */
      .spotlight-overlay { position: fixed; inset: 0; z-index: 450; pointer-events: auto; cursor: default; }
      .spotlight-hole {
        position: fixed; border-radius: 10px;
        box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.6);
        transition: left 0.35s cubic-bezier(0.65, 0, 0.35, 1), top 0.35s cubic-bezier(0.65, 0, 0.35, 1),
                    width 0.35s cubic-bezier(0.65, 0, 0.35, 1), height 0.35s cubic-bezier(0.65, 0, 0.35, 1);
        pointer-events: none;
      }
      .spotlight-card {
        position: fixed; z-index: 451; pointer-events: auto;
        background: #ffffff; border-radius: 14px; width: 300px;
        padding: 18px 20px; box-shadow: 0 16px 40px rgba(15, 23, 42, 0.28);
        opacity: 0; transform: translateY(6px);
        transition: opacity 0.25s ease-out, transform 0.25s ease-out,
                    left 0.35s cubic-bezier(0.65, 0, 0.35, 1), top 0.35s cubic-bezier(0.65, 0, 0.35, 1);
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      }
      .spotlight-card.visible { opacity: 1; transform: translateY(0); }
      .spotlight-step-label {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
        color: #0d9488; margin-bottom: 6px;
      }
      .spotlight-title { font-family: 'Poppins', ui-sans-serif, system-ui, sans-serif; font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
      .spotlight-body { font-size: 12.5px; color: #4b5563; line-height: 1.55; margin-bottom: 16px; }
      .spotlight-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .spotlight-overlay .tour-skip {
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 12px; color: #9ca3af;
        background: none; border: none; cursor: pointer; text-decoration: underline;
      }
      .spotlight-overlay .tour-skip:hover { color: #4b5563; }
      .spotlight-overlay .tour-btns { display: flex; gap: 8px; }
      .spotlight-overlay .tour-btn {
        font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; font-size: 12.5px; font-weight: 700;
        border-radius: 8px; padding: 7px 14px; cursor: pointer; border: 1px solid transparent;
      }
      .spotlight-overlay .tour-btn.next { background: #0d9488; color: #fff; }
      .spotlight-overlay .tour-btn.next:hover { background: #0f766e; }
      .spotlight-overlay .tour-btn.back { background: #fff; color: #4b5563; border-color: #e5e7eb; }
      .spotlight-overlay .tour-btn.back:hover { background: #f9fafb; }
      .spotlight-overlay .tour-btn:disabled { opacity: 0.4; cursor: default; }
    `;
    document.head.appendChild(style);
  }

  let localSteps = [];
  let localOffset = 0; // this page's first step = globalIndex localOffset
  let globalIndex = 0;
  let overlayEl, holeEl, cardEl, labelEl, titleEl, bodyEl, backBtn, nextBtn, skipBtn;
  let resizeHandler = null;
  let totalStepCount = 1;
  let pageWorkspaceKey = null; // set at registerPage() time so Skip/end() always know it, not just the final step

  function isActive() {
    try { return sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) { return false; }
  }
  function setActive(v) {
    try { v ? sessionStorage.setItem(ACTIVE_KEY, '1') : sessionStorage.removeItem(ACTIVE_KEY); } catch (e) {}
  }
  function saveGlobalIndex(i) {
    try { sessionStorage.setItem(GLOBAL_INDEX_KEY, String(i)); } catch (e) {}
  }
  function readGlobalIndex() {
    try { return parseInt(sessionStorage.getItem(GLOBAL_INDEX_KEY) || '0', 10) || 0; } catch (e) { return 0; }
  }

  function buildDom() {
    injectStyles();
    // Guard against a leftover overlay from a prior buildDom() call on this
    // same page (e.g. registerPage() invoked twice) - without this, each
    // call appends another full-screen overlay on top of the last instead
    // of replacing it, stacking up dead click-blockers and duplicate cards.
    document.querySelectorAll('.spotlight-overlay').forEach(el => el.remove());
    overlayEl = document.createElement('div');
    overlayEl.className = 'spotlight-overlay';
    overlayEl.innerHTML = `
      <div class="spotlight-hole"></div>
      <div class="spotlight-card">
        <div class="spotlight-step-label"></div>
        <div class="spotlight-title"></div>
        <div class="spotlight-body"></div>
        <div class="spotlight-actions">
          <button class="tour-skip">Skip tour</button>
          <div class="tour-btns">
            <button class="tour-btn back">Back</button>
            <button class="tour-btn next">Next</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlayEl);
    holeEl = overlayEl.querySelector('.spotlight-hole');
    cardEl = overlayEl.querySelector('.spotlight-card');
    labelEl = overlayEl.querySelector('.spotlight-step-label');
    titleEl = overlayEl.querySelector('.spotlight-title');
    bodyEl = overlayEl.querySelector('.spotlight-body');
    backBtn = overlayEl.querySelector('.tour-btn.back');
    nextBtn = overlayEl.querySelector('.tour-btn.next');
    skipBtn = overlayEl.querySelector('.tour-skip');

    backBtn.addEventListener('click', () => {
      const localIdx = globalIndex - localOffset;
      if (localIdx <= 0) return; // Back never crosses pages - just disabled at each page's first step
      globalIndex--;
      saveGlobalIndex(globalIndex);
      render();
    });
    nextBtn.addEventListener('click', handleNext);
    skipBtn.addEventListener('click', () => end(pageWorkspaceKey));
  }

  function currentStep() {
    return localSteps[globalIndex - localOffset];
  }

  function handleNext() {
    const step = currentStep();
    if (!step) { end(pageWorkspaceKey); return; }
    const isLastOfAll = globalIndex >= totalStepCount - 1;
    if (isLastOfAll) { end(pageWorkspaceKey); return; }
    if (step.href) {
      saveGlobalIndex(globalIndex + 1);
      window.location.href = step.href;
      return;
    }
    globalIndex++;
    saveGlobalIndex(globalIndex);
    render();
  }

  function position(step) {
    const target = document.querySelector(step.selector);
    if (!target) return false;
    const r = target.getBoundingClientRect();
    const pad = 8;
    holeEl.style.left = (r.left - pad) + 'px';
    holeEl.style.top = (r.top - pad) + 'px';
    holeEl.style.width = (r.width + pad * 2) + 'px';
    holeEl.style.height = (r.height + pad * 2) + 'px';

    const cardW = 300;
    const spaceBelow = window.innerHeight - r.bottom;
    const below = spaceBelow > 160;
    const top = below ? r.bottom + pad + 8 : r.top - pad - 8;
    const left = Math.min(Math.max(r.left, 16), window.innerWidth - cardW - 16);
    cardEl.style.left = left + 'px';
    cardEl.style.top = top + 'px';
    cardEl.style.transform = below
      ? (cardEl.classList.contains('visible') ? 'translateY(0)' : 'translateY(6px)')
      : (cardEl.classList.contains('visible') ? 'translateY(-100%)' : 'translateY(calc(-100% + 6px))');
    return true;
  }

  let retries = 0;
  function render() {
    const step = currentStep();
    if (!step) { end(); return; }
    if (!position(step)) {
      // Target isn't in the DOM yet (e.g. an async list still loading) -
      // retry briefly rather than skipping the step. Give up after ~1.5s
      // so a genuinely missing element (a selector typo, a workspace with
      // no data) can't hang the tour forever.
      if (retries++ < 10) { setTimeout(render, 150); return; }
      retries = 0;
      handleNext();
      return;
    }
    retries = 0;
    labelEl.textContent = `Step ${globalIndex + 1} of ${totalStepCount}`;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    backBtn.disabled = (globalIndex - localOffset) === 0;
    nextBtn.textContent = globalIndex >= totalStepCount - 1 ? 'Done' : 'Next';
    cardEl.classList.add('visible');
  }

  function reposition() {
    if (overlayEl) position(currentStep());
  }

  function end(workspaceKey) {
    setActive(false);
    try {
      sessionStorage.removeItem(GLOBAL_INDEX_KEY);
      if (workspaceKey) localStorage.setItem('wl_onboarding_done_' + workspaceKey, '1');
    } catch (e) {}
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('scroll', resizeHandler, true);
      resizeHandler = null;
    }
  }

  /**
   * registerPage: called on every participating page, every load.
   * - steps: this page's own steps (in order), each optionally carrying
   *   `href` (crosses to another page on Next).
   * - offset: how many steps precede this page in the full site-wide
   *   sequence - the page itself is the source of truth for its position
   *   in the tour, since only the page author knows where it sits.
   * - total: total step count across the whole tour, for "Step X of N".
   * - workspaceKey: this page's workspace, so ending the tour from here
   *   (Skip, or reaching the true last step) always writes the completion
   *   flag - not just when the very last step happens to be on this page.
   * Returns true if the tour is actually running and resumed/started on
   * this page, false if there's nothing to do here.
   */
  function registerPage(steps, offset, total, workspaceKey) {
    localSteps = steps;
    localOffset = offset;
    totalStepCount = total;
    pageWorkspaceKey = workspaceKey || null;

    if (!isActive()) return false;
    const saved = readGlobalIndex();
    if (saved < offset || saved >= offset + steps.length) return false; // tour is elsewhere

    globalIndex = saved;
    buildDom();
    resizeHandler = reposition;
    window.addEventListener('resize', resizeHandler);
    // capture:true so this also catches scrolling inside an inner panel
    // (e.g. a long lead list), not just the window scrolling - otherwise
    // the spotlight hole stays pinned to the target's old position while
    // the element itself scrolls out from under it.
    window.addEventListener('scroll', resizeHandler, true);
    render();
    return true;
  }

  /** startHere: begin a brand-new tour, from this page's first step. */
  function startHere(steps, offset, total, workspaceKey) {
    setActive(true);
    saveGlobalIndex(offset);
    return registerPage(steps, offset, total, workspaceKey);
  }

  /**
   * abandon: clears any in-progress tour state without requiring a
   * workspace key. Call this when a page can't resolve a valid ?w= identity
   * at all - otherwise a tour interrupted by a broken/missing link stays
   * "active" in sessionStorage and tries to resume mid-tour the next time
   * this tab loads a page with a valid identity again, on whatever step it
   * was last stuck on rather than restarting cleanly.
   */
  function abandon() {
    if (isActive()) end();
  }

  return { registerPage, startHere, end, abandon, isActive };
})();
