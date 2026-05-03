const NAV_VERSION = 'pjax-v28';

const icons = {
  sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
};

const NAV_HTML = `
  <header class="site-header" role="banner" data-ying-shell="public-nav-${NAV_VERSION}">
    <div class="wrap site-header-inner">
      <a class="brand" href="/" aria-label="Accueil Yingying HOU">Yingying <strong>HOU</strong></a>
      <nav id="nav" class="site-nav" role="navigation" aria-label="Navigation principale">
        <ul>
          <li><a href="/" data-nav="home">Accueil</a></li>
          <li><a href="/filmographie.html" data-nav="filmography">Filmographie</a></li>
          <li><a href="/galerie.html" data-nav="gallery">Galerie</a></li>
          <li><a href="/contact.html" data-nav="contact">Contact / Booking</a></li>
        </ul>
      </nav>
      <div class="header-right">
        <button id="theme-toggle-btn" class="theme-toggle-modern" aria-label="Changer le thème" type="button"></button>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
      </div>
    </div>
  </header>
  <div class="nav-yellow-glow" aria-hidden="true"></div>
`;

let eventsBound = false;
let shellReady = false;

function getRoot() {
  let root = document.getElementById('public-nav-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'public-nav-root';
    root.className = 'public-nav-root';
    const skip = document.querySelector('.skip');
    const main = document.getElementById('main');
    if (skip && skip.nextSibling) skip.parentNode.insertBefore(root, skip.nextSibling);
    else if (main) main.parentNode.insertBefore(root, main);
    else document.body.insertBefore(root, document.body.firstChild);
  }
  return root;
}

function removeLegacyHeaders(root) {
  document.querySelectorAll('body > header.site-header').forEach((header) => {
    if (!root.contains(header)) header.remove();
  });
}

function ensureHeader({ force = false } = {}) {
  const root = getRoot();
  removeLegacyHeaders(root);
  const header = root.querySelector('.site-header');
  const needsBuild = force || !header || header.dataset.yingShell !== `public-nav-${NAV_VERSION}`;
  if (needsBuild) root.innerHTML = NAV_HTML;
  root.classList.add('is-mounted');
  shellReady = true;
  applyStoredTheme();
  updateActiveNav();
  return root.querySelector('.site-header');
}

function isDarkMode() {
  return localStorage.getItem('theme') === 'dark' || document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('theme-dark-preload');
}

function setThemeIcon() {
  const button = document.getElementById('theme-toggle-btn');
  if (!button) return;
  button.innerHTML = isDarkMode() ? icons.sun : icons.moon;
}

function applyStoredTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  document.documentElement.classList.remove('theme-dark-preload');
  setThemeIcon();
}

function cleanPath(value) {
  return (value || '/')
    .replace(/\/index\.html$/i, '/')
    .replace(/\/+$/, '') || '/';
}

function updateActiveNav() {
  const path = cleanPath(window.location.pathname);
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const href = cleanPath(new URL(link.getAttribute('href'), window.location.origin).pathname);
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
  if (eventsBound) return;
  eventsBound = true;

  document.addEventListener('click', (event) => {
    const themeButton = event.target.closest('#theme-toggle-btn');
    if (themeButton) {
      event.preventDefault();
      const nextIsDark = !document.body.classList.contains('dark-mode');
      document.body.classList.toggle('dark-mode', nextIsDark);
      localStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
      setThemeIcon();
      return;
    }

    const navToggle = event.target.closest('.nav-toggle');
    if (navToggle) {
      event.preventDefault();
      const nav = document.getElementById(navToggle.getAttribute('aria-controls') || 'nav');
      const isOpen = nav?.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
      return;
    }

    if (event.target.closest('.site-nav a, .brand')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  document.addEventListener('ying:pagechange', () => {
    ensureHeader();
    updateActiveNav();
    closeMenu();
  });
}

function init() {
  ensureHeader();
  bindEvents();
  document.documentElement.classList.add('ying-shell-ready');
}

window.YingNav = { init, ensureHeader, applyStoredTheme, setThemeIcon, updateActiveNav, closeMenu };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
