const NAV_VERSION = 'v32';

const NAV_ITEMS = [
  { href: '/', key: '/', label: 'Accueil' },
  { href: '/filmographie.html', key: '/filmographie', label: 'Filmographie' },
  { href: '/galerie.html', key: '/galerie', label: 'Galerie' },
  { href: '/contact.html', key: '/contact', label: 'Contact / Booking' }
];

const ICONS = {
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
};

let eventsBound = false;

function routeKey(pathname = window.location.pathname) {
  let path = String(pathname || '/').split('?')[0].split('#')[0];
  path = path.replace(/\/index\.html$/i, '/');
  path = path.replace(/\/(filmographie|galerie|contact|legal|privacy|404)\.html$/i, '/$1');
  path = path.replace(/\/+$/g, '');
  return path || '/';
}

function ensureRoot() {
  let root = document.getElementById('public-nav-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'public-nav-root';
    root.className = 'public-nav-root';
    const skip = document.querySelector('.skip');
    const main = document.getElementById('main');
    if (skip?.nextSibling) skip.parentNode.insertBefore(root, skip.nextSibling);
    else if (main) document.body.insertBefore(root, main);
    else document.body.prepend(root);
  }
  return root;
}

function renderShell() {
  const root = ensureRoot();
  root.className = 'public-nav-root';
  if (root.dataset.version === NAV_VERSION && root.querySelector('.public-topbar')) return root;

  root.dataset.version = NAV_VERSION;
  root.innerHTML = `
    <div class="public-topbar-glow" aria-hidden="true"></div>
    <header class="site-header public-topbar" role="banner" data-public-shell="true">
      <div class="public-topbar-inner">
        <a class="public-brand" href="/" data-nav="/" aria-label="Accueil Yingying HOU">Yingying HOU</a>
        <nav id="nav" class="public-nav" role="navigation" aria-label="Navigation principale">
          <ul>
            ${NAV_ITEMS.map((item) => `<li><a href="${item.href}" data-nav="${item.key}">${item.label}</a></li>`).join('')}
          </ul>
        </nav>
        <div class="public-actions">
          <button id="theme-toggle-btn" class="theme-toggle-modern" aria-label="Changer le thème" type="button"></button>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
        </div>
      </div>
    </header>`;
  return root;
}

function applyStoredTheme() {
  const dark = localStorage.getItem('theme') === 'dark';
  document.documentElement.classList.toggle('theme-dark', dark);
  document.documentElement.classList.toggle('theme-dark-preload', dark);
  document.body.classList.toggle('dark-mode', dark);
  setThemeIcon();
}

function setThemeIcon() {
  const button = document.getElementById('theme-toggle-btn');
  if (!button) return;
  const dark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('theme-dark');
  button.innerHTML = dark ? ICONS.sun : ICONS.moon;
}

function updateActiveNav(pathname = window.location.pathname) {
  const current = routeKey(pathname);
  document.querySelectorAll('[data-nav]').forEach((item) => {
    const key = item.dataset.nav || routeKey(new URL(item.href, window.location.origin).pathname);
    const active = key === current;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

function closeMenu() {
  const nav = document.getElementById('nav');
  const toggle = document.querySelector('.nav-toggle');
  nav?.classList.remove('open');
  toggle?.setAttribute('aria-expanded', 'false');
}

function bindEvents() {
  if (eventsBound) return;
  eventsBound = true;

  document.addEventListener('click', (event) => {
    const theme = event.target.closest('#theme-toggle-btn');
    if (theme) {
      event.preventDefault();
      const dark = !document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      applyStoredTheme();
      return;
    }

    const toggle = event.target.closest('.nav-toggle');
    if (toggle) {
      event.preventDefault();
      const nav = document.getElementById(toggle.getAttribute('aria-controls') || 'nav');
      const open = !nav?.classList.contains('open');
      nav?.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      return;
    }

    if (event.target.closest('.public-nav a, .public-brand')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  document.addEventListener('ying:pagechange', (event) => {
    renderShell();
    applyStoredTheme();
    const url = event.detail?.url ? new URL(event.detail.url, window.location.origin) : window.location;
    updateActiveNav(url.pathname);
    closeMenu();
  });
}

function init() {
  renderShell();
  applyStoredTheme();
  updateActiveNav();
  bindEvents();
}

window.YingNav = {
  init,
  renderShell,
  ensureHeader: renderShell,
  applyStoredTheme,
  setThemeIcon,
  updateActiveNav,
  closeMenu,
  routeKey
};

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
