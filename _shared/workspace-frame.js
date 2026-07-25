/**
 * WisdomLayers Reach - private workspace frame
 *
 * The backend already scopes each contractor's data to them alone, but
 * nothing on the page said so. This gives every contractor a persistent
 * visual cue - a border around the app plus a small badge - so it's obvious
 * at a glance that their workspace is siloed from teammates, not just true
 * behind the scenes. Called once identity resolves successfully on any page.
 */
function applyWorkspaceFrame(name) {
  const style = document.createElement('style');
  style.textContent = `
    .workspace-frame-border {
      position: fixed; inset: 0; z-index: 350; pointer-events: none;
      border: 3px solid var(--teal-600, #0d9488);
    }
    .workspace-frame-badge {
      position: fixed; top: 14px; right: 16px; z-index: 350;
      font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
      padding: 5px 11px; border-radius: 20px;
      background: var(--teal-50, #f0fdfa); color: var(--teal-700, #0f766e);
      border: 1px solid var(--teal-100, #ccfbf1);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }
  `;
  document.head.appendChild(style);

  const border = document.createElement('div');
  border.className = 'workspace-frame-border';
  document.body.appendChild(border);

  const badge = document.createElement('div');
  badge.className = 'workspace-frame-badge';
  badge.textContent = `${name}'s Workspace, Private`;
  document.body.appendChild(badge);
}
