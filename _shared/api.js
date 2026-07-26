/**
 * WisdomLayers Reach - client API helper
 *
 * Talks to the Apps Script Web App backing the Lead Tracker. There is no
 * Google login involved anywhere in this flow - each workspace page passes
 * its own WORKSPACE_KEY with every write, and that key is the only thing
 * that identifies which contractor is calling. Treat it like a password:
 * never log it, never send it anywhere but WEB_APP_URL below.
 *
 * WEB_APP_URL must point at the deployed Apps Script Web App (Deploy > New
 * deployment > Web app > Execute as Me > Anyone). Redeploys via "New
 * version" keep this same URL; a fresh "New deployment" would not.
 */

const WISDOMLAYERS_API = (function () {
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyqEaS2GWH8d2YPHTuuZ14UcP3eLCKwN2ZH9fsFaaSbD20rIzebX-EUKf5R5BKadpwGEQ/exec';

  // Apps Script Web Apps can't set a real HTTP status code, so `res.ok` is
  // never a reliable failure signal here - every response is HTTP 200,
  // success or not.
  //
  // Two different kinds of `error` come back in the body, and they need
  // different handling:
  //  - Request-level errors ("Invalid workspace key", "Unknown action",
  //    "Invalid request body") mean the call itself was malformed or
  //    unauthorized - the response body is JUST `{ error }`, nothing else.
  //    These should always throw; no caller expects to handle them inline.
  //  - Action-level soft-fails ("Already claimed", "Lead not found", "You
  //    can only remove leads you added yourself") are normal, expected
  //    outcomes of a specific action - e.g. two contractors racing to claim
  //    the same lead. The response is still the action's regular shape
  //    (`{ lead: null, error }`, `{ ok: false, error }`), and existing
  //    callers already branch on that shape to show a specific, better
  //    message inline rather than a generic failure toast. Throwing here
  //    would break that UX, so these are left for each call site to check.
  // _checkRequestError() only catches the first kind - a body that is
  // error-only carries no other keys because the request never reached the
  // per-action handler at all.
  function _checkRequestError(data) {
    if (data && data.error && Object.keys(data).length === 1) throw new Error(data.error);
    return data;
  }

  // The workspace key->name map lives in exactly one place - WORKSPACE_KEYS
  // in sheets/Code.gs - and every page asks for its own name here instead
  // of carrying a hardcoded copy of the whole map. Scoped to just the
  // caller's key: the endpoint never hands back the full map, since the
  // key is meant to work like a bearer token and an endpoint that returns
  // every contractor's name for any key (or none) would make it trivial to
  // enumerate valid keys. A wrong or guessed key learns nothing back.
  async function getWorkspaceName(workspaceKey) {
    if (!workspaceKey) return null;
    const res = await fetch(`${WEB_APP_URL}?action=workspaces&key=${encodeURIComponent(workspaceKey)}`);
    if (!res.ok) throw new Error('Could not verify your workspace link.');
    const data = await res.json();
    if (data.error) return null; // invalid key - not a request failure, just "no such workspace"
    return data.name || null;
  }

  async function listLeads(workspaceKey) {
    const qs = workspaceKey ? `&key=${encodeURIComponent(workspaceKey)}` : '';
    const res = await fetch(`${WEB_APP_URL}?action=list${qs}`);
    if (!res.ok) throw new Error('Could not load the claim board.');
    const data = _checkRequestError(await res.json());
    return data.leads || [];
  }

  async function _post(payload) {
    const res = await fetch(WEB_APP_URL, {
      method: 'POST',
      // text/plain avoids a CORS preflight that Apps Script Web Apps
      // cannot reliably answer - the server still JSON.parses the body.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Request failed.');
    return _checkRequestError(await res.json());
  }

  function claimNextLead(workspaceKey) { return _post({ action: 'claim', key: workspaceKey }); }
  function claimSpecificLead(workspaceKey, leadId) { return _post({ action: 'claimSpecific', key: workspaceKey, leadId }); }
  function setStatus(workspaceKey, leadId, status, note) { return _post({ action: 'setStatus', key: workspaceKey, leadId, status, note }); }
  function addNote(workspaceKey, leadId, text) { return _post({ action: 'addNote', key: workspaceKey, leadId, text }); }
  function getNotes(workspaceKey, leadId) { return _post({ action: 'getNotes', key: workspaceKey, leadId }); }
  function submitOutreach(workspaceKey, leadId, emailText, screenshotBase64, screenshotMimeType) {
    return _post({ action: 'submitOutreach', key: workspaceKey, leadId, emailText, screenshotBase64, screenshotMimeType });
  }
  function flagLead(workspaceKey, leadId, reason) { return _post({ action: 'flagLead', key: workspaceKey, leadId, reason }); }
  function addLead(workspaceKey, lead) { return _post({ action: 'addLead', key: workspaceKey, lead }); }
  function removeLead(workspaceKey, leadId) { return _post({ action: 'removeLead', key: workspaceKey, leadId }); }

  return { getWorkspaceName, listLeads, claimNextLead, claimSpecificLead, setStatus, addNote, getNotes, submitOutreach, flagLead, addLead, removeLead };
})();
