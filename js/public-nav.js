const icons = {
  sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
};

const PUBLIC_HEADER_HTML = `
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
`;

let bound = false;

function ensureHeader() {
  let header = document.querySelector('.site-header');
  const skip = document.querySelector('.skip');
  if (!header) {
    header = document.createElement('header');
    header.className = 'site-header';
    header.setAttribute('role', 'banner');
    if (skip?.nextSibling) skip.parentNode.insertBefore(header, skip.nextSibling);
    else document.body.insertBefore(header, document.body.firstChild);
  }
  header.innerHTML = PUBLIC_HEADER_HTML;
  header.dataset.yingShell = 'public';
  header.setAttribute('role', 'banner');
  setThemeIcon();
  updateActiveNav();
  return header;
}

function setThemeIcon() {
  const button = document.getElementById('theme-toggle-btn');
  if (!button) return;
  const isDark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('theme-dark-preload');
  button.innerHTML = isDark ? icons.sun : icons.moon;
}

function applyStoredTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  document.documentElement.classList.toggle('theme-dark-preload', isDark && !document.body.classList.contains('dark-mode'));
  document.documentElement.classList.remove('theme-dark-preload');
  setThemeIcon();
}

function cleanPath(value) {
  return (value || '/')
    .replace(/\/index\.html$/, '/')
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
  if (bound) return;
  bound = true;
  document.addEventListener('click', (event) => {
    const themeButton = event.target.closest('#theme-toggle-btn');
    if (themeButton) {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
      setThemeIcon();
      return;
    }

    const navToggle = event.target.closest('.nav-toggle');
    if (navToggle) {
      const nav = document.getElementById(navToggle.getAttribute('aria-controls') || 'nav');
      const isOpen = nav?.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
      return;
    }

    if (event.target.closest('.site-nav a')) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  document.addEventListener('ying:pagechange', () => {
    ensureHeader();
    updateActiveNav();
  });
}

function init() {
  ensureHeader();
  applyStoredTheme();
  updateActiveNav();
  bindEvents();
}

window.YingNav = { init, ensureHeader, applyStoredTheme, setThemeIcon, updateActiveNav, closeMenu };

document.addEventListener('DOMContentLoaded', init);
