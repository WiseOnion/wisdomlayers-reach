/**
 * WisdomLayers Reach - shared leads cache
 *
 * Dashboard, History, and Lead Tracker all fetch the exact same workspace-wide
 * dataset via WISDOMLAYERS_API.listLeads(WORKSPACE_KEY) - that call against
 * the Apps Script backend consistently takes 1.5-2s (Apps Script Web Apps are
 * just slow, no way around that server-side). The last successful fetch is
 * kept in localStorage per workspace and rendered immediately, so nothing
 * ever paints a skeleton once there's something cached to show.
 *
 * On top of that instant paint, a freshness window (LEADS_CACHE_FRESH_MS)
 * skips the network call entirely when the cache is still young - clicking
 * Dashboard -> Tracker -> back to Dashboard a few seconds later shouldn't
 * cost three real round-trips to a backend that takes 1.5-2s each, when
 * nothing could plausibly have changed in that time. Once the window
 * expires, the normal cache-first-then-revalidate flow resumes: paint
 * instantly from cache, refetch in the background, reconcile silently.
 * Any call that passes forceRefresh=true (every write path - claiming a
 * lead, changing status, submitting outreach, etc.) always skips this
 * window, since a user action that just changed the data is exactly the
 * moment a stale read would be wrong.
 */
const LEADS_CACHE_FRESH_MS = 45000;

function _leadsCacheKey() { return 'wl_leads_cache_' + WORKSPACE_KEY; }
function _leadsCacheTimeKey() { return 'wl_leads_cache_time_' + WORKSPACE_KEY; }

function _readLeadsCache() {
  try {
    const raw = localStorage.getItem(_leadsCacheKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function _writeLeadsCache(leads) {
  try {
    localStorage.setItem(_leadsCacheKey(), JSON.stringify(leads));
    localStorage.setItem(_leadsCacheTimeKey(), String(Date.now()));
  } catch (e) { /* storage full or unavailable - background refresh still works, just uncached */ }
}

function _isLeadsCacheFresh() {
  try {
    const t = Number(localStorage.getItem(_leadsCacheTimeKey()));
    return t > 0 && (Date.now() - t) < LEADS_CACHE_FRESH_MS;
  } catch (e) { return false; }
}
