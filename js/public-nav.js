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
  const clean = (pathname || '/').replace(/\/index\.html$/i, '/').replace(/\/+$/g, '');
  return clean || '/';
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
    else document.body.insertBefore(root, document.body.firstChild);
  }
  return root;
}

function renderShell() {
  const root = ensureRoot();
  if (root.dataset.rendered === 'v29') return root;

  root.className = 'public-nav-root';
  root.dataset.rendered = 'v29';
  root.innerHTML = `
    <div class="public-topbar-glow" aria-hidden="true"></div>
    <header class="site-header public-topbar" role="banner" data-public-shell="true">
      <div class="public-topbar-inner">
        <a class="brand public-brand" href="/" aria-label="Accueil Yingying HOU">Yingying <strong>HOU</strong></a>
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

function updateActiveNav() {
  const path = normalizedPath();
  document.querySelectorAll('.public-nav a, .site-nav a').forEach((link) => {
    const href = normalizedPath(new URL(link.getAttribute('href'), window.location.origin).pathname);
    const active = href === path;
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

  document.addEventListener('ying:pagechange', () => {
    renderShell();
    applyStoredTheme();
    updateActiveNav();
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
  normalizedPath
};

document.addEventListener('DOMContentLoaded', init);
