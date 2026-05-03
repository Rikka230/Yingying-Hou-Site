(() => {
  const VERSION = 'v26';
  const NAV_HTML = `
    <header class="site-header public-site-header" role="banner" data-public-nav-version="${VERSION}">
      <div class="wrap site-header-inner public-nav-inner">
        <a class="brand public-nav-brand" href="/" aria-label="Accueil Yingying HOU">Yingying <strong>HOU</strong></a>
        <nav id="nav" class="site-nav public-main-nav" role="navigation" aria-label="Navigation principale">
          <ul>
            <li><a href="/" data-nav="home">Accueil</a></li>
            <li><a href="/filmographie.html" data-nav="filmography">Filmographie</a></li>
            <li><a href="/galerie.html" data-nav="gallery">Galerie</a></li>
            <li><a href="/contact.html" data-nav="contact">Contact / Booking</a></li>
          </ul>
        </nav>
        <div class="header-right public-nav-actions">
          <button id="theme-toggle-btn" class="theme-toggle-modern" aria-label="Changer le thème" type="button"></button>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
        </div>
      </div>
    </header>
    <div class="public-nav-ambient" aria-hidden="true"></div>
  `;

  const icons = {
    sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
  };

  function ensureRoot() {
    let root = document.getElementById('public-nav-root');
    if (!root) {
      const legacyHeader = document.querySelector('.site-header');
      root = document.createElement('div');
      root.id = 'public-nav-root';
      root.dataset.navShell = VERSION;

      if (legacyHeader) {
        legacyHeader.replaceWith(root);
      } else {
        const main = document.getElementById('main') || document.body.firstElementChild;
        document.body.insertBefore(root, main || null);
      }
    }
    return root;
  }

  function mount() {
    const root = ensureRoot();
    const currentHeader = root.querySelector('.public-site-header');
    if (!currentHeader || currentHeader.dataset.publicNavVersion !== VERSION) {
      root.innerHTML = NAV_HTML;
      root.dataset.navShell = VERSION;
    }
    applyStoredTheme();
    updateActive();
    return root.querySelector('.public-site-header');
  }

  function cleanPath(value) {
    const url = new URL(value || '/', window.location.origin);
    return (url.pathname || '/')
      .replace(/\/index\.html$/i, '/')
      .replace(/\/+$/, '') || '/';
  }

  function updateActive() {
    const path = cleanPath(window.location.href);
    document.querySelectorAll('#public-nav-root .site-nav a').forEach((link) => {
      const href = cleanPath(link.href);
      const active = href === path;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function syncRootThemeClass() {
    const isDark = document.body.classList.contains('dark-mode');
    document.documentElement.classList.toggle('theme-dark-active', isDark);
    document.documentElement.classList.toggle('theme-dark-preload', false);
  }

  function setThemeIcon() {
    const button = document.getElementById('theme-toggle-btn');
    if (!button) return;
    button.innerHTML = document.body.classList.contains('dark-mode') ? icons.sun : icons.moon;
  }

  function applyStoredTheme() {
    document.body.classList.toggle('dark-mode', localStorage.getItem('theme') === 'dark');
    syncRootThemeClass();
    setThemeIcon();
  }

  function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    syncRootThemeClass();
    setThemeIcon();
  }

  function closeMobileNav() {
    document.getElementById('nav')?.classList.remove('open');
    document.querySelector('#public-nav-root .nav-toggle')?.setAttribute('aria-expanded', 'false');
  }

  if (!window.__yingPublicNavBound) {
    window.__yingPublicNavBound = true;

    document.addEventListener('click', (event) => {
      const themeButton = event.target.closest('#theme-toggle-btn');
      if (themeButton) {
        event.preventDefault();
        toggleTheme();
        return;
      }

      const navToggle = event.target.closest('#public-nav-root .nav-toggle');
      if (navToggle) {
        const nav = document.getElementById(navToggle.getAttribute('aria-controls') || 'nav');
        const isOpen = nav?.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
        return;
      }

      const navLink = event.target.closest('#public-nav-root .site-nav a');
      if (navLink) closeMobileNav();
    });

    window.addEventListener('popstate', () => requestAnimationFrame(updateActive));
  }

  window.YingPublicNav = {
    VERSION,
    mount,
    updateActive,
    applyStoredTheme,
    setThemeIcon,
    closeMobileNav,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
