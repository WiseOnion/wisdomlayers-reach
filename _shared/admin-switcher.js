/**
 * WisdomLayers Reach - owner-only workspace switcher
 *
 * Contractors only ever hold their own ?w= key and never see the others.
 * The owner instead holds a separate secret (?admin=...) that unlocks a
 * small floating switcher, layered on top of whatever page/workspace is
 * currently open, to jump between workspaces without a dedicated page to
 * visit or bookmark. Works on any page that includes this script.
 *
 * ADMIN_KEY is a shared secret, not real auth - anyone who has the URL can
 * use it. It only needs to keep the workspace names out of pages contractors
 * load, not withstand a determined attacker.
 */
const ADMIN_KEY = 'wl-owner-2b7f';

const WORKSPACES = [
  { key: '59vz9a0ukwcy4wkhrkftkxjm', name: 'Delight' },
  { key: 'amiu0f2hkhgfhnpczfycpuqm', name: 'Festus' },
  { key: 'x3hbq1vng5d3hl05oly4bk9q', name: 'Shelton' },
];

function initAdminSwitcher() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') !== ADMIN_KEY) return;

  const style = document.createElement('style');
  style.textContent = `
    .admin-switcher {
      position: fixed; bottom: 18px; right: 18px; z-index: 500;
      background: #0f172a; color: #fff; border-radius: 12px;
      padding: 10px 12px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.35);
      font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap; max-width: 280px;
    }
    .admin-switcher-label {
      font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
      color: #94a3b8; width: 100%;
    }
    .admin-switcher a {
      font-size: 12.5px; font-weight: 600; text-decoration: none;
      color: #fff; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
      border-radius: 7px; padding: 6px 10px; transition: background 0.12s;
    }
    .admin-switcher a:hover { background: rgba(255,255,255,0.18); }
    .admin-switcher a.current { background: #0d9488; border-color: #0d9488; }
  `;
  document.head.appendChild(style);

  const currentKey = params.get('w');
  const page = window.location.pathname.split('/').pop() || 'index.html';

  const bar = document.createElement('div');
  bar.className = 'admin-switcher';
  bar.innerHTML = `<div class="admin-switcher-label">Viewing as (owner only)</div>` +
    WORKSPACES.map(w =>
      `<a href="${page}?w=${w.key}&admin=${ADMIN_KEY}" class="${w.key === currentKey ? 'current' : ''}">${w.name}</a>`
    ).join('');
  document.body.appendChild(bar);
}

document.addEventListener('DOMContentLoaded', initAdminSwitcher);
