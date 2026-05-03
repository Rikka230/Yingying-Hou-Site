const SHELL_VERSION = 'v30';

const NAV_ITEMS = [
  { href: '/', key: 'home', label: 'Accueil' },
  { href: '/filmographie.html', key: 'filmography', label: 'Filmographie' },
  { href: '/galerie.html', key: 'gallery', label: 'Galerie' },
  { href: '/contact.html', key: 'contact', label: 'Contact / Booking' }
];

const ICONS = {
  sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
};

let navBound = false;

function normalizedPath(pathname = window.location.pathname) {
  const clean = (pathname || '/')
    .replace(/\/index\.html$/i, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/g, '');
  return clean || '/';
}

function keyForPath(pathname = window.location.pathname) {
  const path = normalizedPath(pathname);
  if (path === '/') return 'home';
  if (path === '/filmographie.html') return 'filmography';
  if (path === '/galerie.html') return 'gallery';
  if (path === '/contact.html') return 'contact';
  return '';
}

function ensureRoot() {
  let root = document.getElementById('public-nav-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'public-nav-root';
    root.className = 'public-nav-root';
    root.dataset.shell = 'public';
    const skip = document.querySelector('.skip');
    const main = document.getElementById('main');
    if (skip && skip.parentNode) skip.insertAdjacentElement('afterend', root);
    else if (main && main.parentNode) main.parentNode.insertBefore(root, main);
    else document.body.prepend(root);
  }
  return root;
}

function renderShell() {
  const root = ensureRoot();
  if (root.dataset.rendered === SHELL_VERSION) return root;

  root.className = 'public-nav-root';
  root.dataset.shell = 'public';
  root.dataset.rendered = SHELL_VERSION;
  root.innerHTML = `
    <div class="public-topbar-glow" aria-hidden="true"></div>
    <header class="site-header public-topbar" role="banner" data-public-shell="true">
      <div class="public-topbar-inner">
        <a class="brand public-brand" href="/" aria-label="Accueil Yingying HOU"><span>Yingying</span><strong>HOU</strong></a>
        <nav id="nav" class="site-nav public-nav" role="navigation" aria-label="Navigation principale">
          <ul>
            ${NAV_ITEMS.map((item) => `<li><a href="${item.href}" data-nav="${item.key}">${item.label}</a></li>`).join('')}
          </ul>
        </nav>
        <div class="header-right public-actions">
          <button id="theme-toggle-btn" class="theme-toggle-modern" aria-label="Changer le thème" type="button"></button>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
        </div>
      </div>
    </header>
  `;
  return root;
}

function applyStoredTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  document.documentElement.classList.toggle('theme-dark-preload', isDark);
  document.documentElement.classList.toggle('theme-dark', isDark);
  setThemeIcon();
}

function setThemeIcon() {
  const button = document.getElementById('theme-toggle-btn');
  if (!button) return;
  const isDark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('theme-dark');
  button.innerHTML = isDark ? ICONS.sun : ICONS.moon;
}

function updateActiveNav(pathname = window.location.pathname) {
  const activeKey = keyForPath(pathname);
  document.querySelectorAll('.public-nav a, .site-nav a').forEach((link) => {
    const key = link.dataset.nav || keyForPath(new URL(link.href, window.location.origin).pathname);
    const active = key && key === activeKey;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function closeMenu() {
  document.getElementById('nav')?.classList.remove('open');
  document.querySelector('.nav-toggle')?.setAttribute('aria-expanded', 'false');
}

function bindEvents() {
  if (navBound) return;
  navBound = true;

  document.addEventListener('click', (event) => {
    const themeButton = event.target.closest('#theme-toggle-btn');
    if (themeButton) {
      const nextDark = !document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', nextDark ? 'dark' : 'light');
      applyStoredTheme();
      return;
    }

    const menuButton = event.target.closest('.nav-toggle');
    if (menuButton) {
      const nav = document.getElementById(menuButton.getAttribute('aria-controls') || 'nav');
      const nextState = !nav?.classList.contains('open');
      nav?.classList.toggle('open', nextState);
      menuButton.setAttribute('aria-expanded', String(nextState));
      return;
    }

    if (event.target.closest('.public-nav a, .site-nav a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  document.addEventListener('ying:pagechange', (event) => {
    renderShell();
    applyStoredTheme();
    updateActiveNav(event.detail?.pathname || window.location.pathname);
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
  ensureHeader: renderShell,
  renderShell,
  applyStoredTheme,
  setThemeIcon,
  updateActiveNav,
  closeMenu,
  normalizedPath,
  keyForPath
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
