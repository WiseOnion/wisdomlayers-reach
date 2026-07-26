/**
 * WisdomLayers Reach - shared leads cache
 *
 * Dashboard, History, and Lead Tracker all fetch the exact same workspace-wide
 * dataset via WISDOMLAYERS_API.listLeads(WORKSPACE_KEY) - that call against
 * the Apps Script backend consistently takes 1.5-2s (Apps Script Web Apps are
 * just slow, no way around that server-side). Rather than show a skeleton on
 * every single visit, the last successful fetch is kept in localStorage per
 * workspace and rendered immediately - stale by at most one visit's worth of
 * changes, which is a fine trade for an instant paint. The real fetch still
 * always runs in the background and silently reconciles the render when it
 * lands. Skeletons now only appear on a workspace's first ever visit, when
 * there's nothing cached yet to show.
 */
function _leadsCacheKey() { return 'wl_leads_cache_' + WORKSPACE_KEY; }

function _readLeadsCache() {
  try {
    const raw = localStorage.getItem(_leadsCacheKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function _writeLeadsCache(leads) {
  try { localStorage.setItem(_leadsCacheKey(), JSON.stringify(leads)); }
  catch (e) { /* storage full or unavailable - background refresh still works, just uncached */ }
}
