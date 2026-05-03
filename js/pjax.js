const MAIN_SELECTOR = '#main';
const CACHE_LIMIT = 8;
const PUBLIC_HTML_RE = /\/(index|filmographie|galerie|contact|legal|privacy|404)\.html$/i;
const FILE_RE = /\.(pdf|jpg|jpeg|png|webp|gif|svg|mp4|mov|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx)$/i;
const EXCLUDED_RE = /\/(admin|cv-photo|cv-auto)\.html$/i;

const pageCache = new Map();
let isNavigating = false;
let currentFetchController = null;

function normalizePath(pathname) {
  if (!pathname || pathname === '/index.html') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

function routeKey(input) {
  const url = new URL(input, window.location.origin);
  return normalizePath(url.pathname);
}

function isPublicRoute(input) {
  const url = new URL(input, window.location.origin);
  const path = normalizePath(url.pathname);
  return path === '/' || PUBLIC_HTML_RE.test(url.pathname);
}

function isSameDocumentHash(url) {
  return url.hash && routeKey(url.href) === routeKey(window.location.href);
}

function isEligibleLink(anchor, event) {
  if (!anchor || !anchor.href) return false;
  if (anchor.dataset.noPjax === 'true') return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey || event?.button > 0) return false;
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(anchor.getAttribute('href') || '')) return false;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  if (isSameDocumentHash(url)) return false;
  if (FILE_RE.test(url.pathname)) return false;
  if (EXCLUDED_RE.test(url.pathname)) return false;
  return isPublicRoute(url.href);
}

function ensureProgressBar() {
  let bar = document.querySelector('.pjax-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'pjax-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }
  return bar;
}

function setMetaBySelector(doc, selector, attribute = 'content') {
  const next = doc.querySelector(selector);
  const current = document.querySelector(selector);
  if (!next && current && selector.includes('canonical')) {
    current.remove();
    return;
  }
  if (!next) return;

  if (current) {
    current.setAttribute(attribute, next.getAttribute(attribute) || '');
    return;
  }

  const clone = next.cloneNode(true);
  document.head.appendChild(clone);
}

function updateHead(doc, url) {
  document.title = doc.title || document.title;

  setMetaBySelector(doc, 'meta[name="description"]');
  setMetaBySelector(doc, 'meta[name="twitter:card"]');
  setMetaBySelector(doc, 'meta[name="twitter:title"]');
  setMetaBySelector(doc, 'meta[name="twitter:description"]');
  setMetaBySelector(doc, 'meta[name="twitter:image"]');
  setMetaBySelector(doc, 'meta[property="og:title"]');
  setMetaBySelector(doc, 'meta[property="og:description"]');
  setMetaBySelector(doc, 'meta[property="og:type"]');
  setMetaBySelector(doc, 'meta[property="og:image"]');
  setMetaBySelector(doc, 'link[rel="canonical"]', 'href');

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', new URL(url, window.location.origin).href);
}

function updateBodyClass(doc) {
  const isDark = document.body.classList.contains('dark-mode');
  const nextClasses = Array.from(doc.body.classList).filter((name) => name !== 'dark-mode');
  document.body.className = nextClasses.join(' ');
  if (isDark) document.body.classList.add('dark-mode');
}

function closeTransientUi() {
  document.querySelectorAll('dialog[open]').forEach((dialog) => {
    try { dialog.close(); } catch (_) { dialog.removeAttribute('open'); }
  });
  document.querySelectorAll('[aria-hidden="false"]').forEach((node) => {
    if (node.id === 'lightbox') node.setAttribute('aria-hidden', 'true');
  });
  document.getElementById('nav')?.classList.remove('open');
  document.querySelector('.nav-toggle')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

function rememberScroll() {
  const state = history.state || {};
  history.replaceState({ ...state, scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);
}

function storeInCache(url, html) {
  const key = routeKey(url);
  if (pageCache.has(key)) pageCache.delete(key);
  pageCache.set(key, html);
  while (pageCache.size > CACHE_LIMIT) pageCache.delete(pageCache.keys().next().value);
}

async function fetchPage(url, { signal } = {}) {
  const key = routeKey(url);
  if (pageCache.has(key)) return pageCache.get(key);

  const response = await fetch(url, {
    headers: {
      'X-Requested-With': 'fetch',
      'Accept': 'text/html,application/xhtml+xml'
    },
    signal
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) throw new Error('Réponse non HTML');

  const html = await response.text();
  storeInCache(url, html);
  return html;
}

function parsePage(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nextMain = doc.querySelector(MAIN_SELECTOR);
  if (!nextMain) throw new Error('Contenu principal introuvable');
  return { doc, nextMain };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transitionTo(nextMain) {
  const currentMain = document.querySelector(MAIN_SELECTOR);
  if (!currentMain) throw new Error('Contenu principal actuel introuvable');

  currentMain.classList.add('is-pjax-leaving');
  await wait(130);
  currentMain.replaceWith(nextMain);
  nextMain.classList.add('is-pjax-entering');
  requestAnimationFrame(() => {
    nextMain.classList.remove('is-pjax-entering');
  });
}

function scrollAfterNavigation(url, state, isPop) {
  const targetUrl = new URL(url, window.location.origin);

  if (targetUrl.hash) {
    const target = document.getElementById(decodeURIComponent(targetUrl.hash.slice(1)));
    if (target) {
      target.scrollIntoView({ block: 'start' });
      return;
    }
  }

  if (isPop && state && Number.isFinite(state.scrollY)) {
    window.scrollTo({ left: state.scrollX || 0, top: state.scrollY || 0, behavior: 'auto' });
    return;
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

function focusMain() {
  const main = document.querySelector(MAIN_SELECTOR);
  if (!main) return;
  main.setAttribute('tabindex', '-1');
  main.focus({ preventScroll: true });
}

async function navigate(url, options = {}) {
  const { push = true, state = null, isPop = false } = options;
  const nextUrl = new URL(url, window.location.origin);

  if (isNavigating || routeKey(nextUrl.href) === routeKey(window.location.href) && !nextUrl.hash) return;

  isNavigating = true;
  rememberScroll();
  closeTransientUi();
  currentFetchController?.abort?.();
  currentFetchController = new AbortController();

  const progress = ensureProgressBar();
  document.documentElement.classList.add('is-pjax-navigating');
  progress.classList.add('is-active');
  document.querySelector(MAIN_SELECTOR)?.setAttribute('aria-busy', 'true');

  try {
    window.YingApp?.teardown?.();
    const html = await fetchPage(nextUrl.href, { signal: currentFetchController.signal });
    const { doc, nextMain } = parsePage(html);

    updateHead(doc, nextUrl.href);
    updateBodyClass(doc);
    await transitionTo(nextMain);

    if (push) {
      history.pushState({ scrollX: 0, scrollY: 0 }, doc.title || '', nextUrl.href);
    }

    scrollAfterNavigation(nextUrl.href, state, isPop);
    focusMain();
    await window.YingApp?.init?.({ pjax: true, url: nextUrl.href });
    document.dispatchEvent(new CustomEvent('ying:pagechange', { detail: { url: nextUrl.href } }));
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.warn('Navigation PJAX interrompue, fallback classique :', error);
    window.location.href = nextUrl.href;
  } finally {
    document.querySelector(MAIN_SELECTOR)?.removeAttribute('aria-busy');
    document.documentElement.classList.remove('is-pjax-navigating');
    progress.classList.remove('is-active');
    isNavigating = false;
    currentFetchController = null;
  }
}

function prefetch(anchor) {
  if (!isEligibleLink(anchor, {})) return;
  const url = new URL(anchor.href, window.location.origin);
  if (routeKey(url.href) === routeKey(window.location.href)) return;
  if (pageCache.has(routeKey(url.href))) return;
  fetchPage(url.href).catch(() => {});
}

if (!history.state) {
  history.replaceState({ scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);
}

ensureProgressBar();

let prefetchTimer = null;
document.addEventListener('pointerover', (event) => {
  const anchor = event.target.closest('a');
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(() => prefetch(anchor), 90);
}, { passive: true });

document.addEventListener('focusin', (event) => {
  const anchor = event.target.closest('a');
  prefetch(anchor);
});

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a');
  if (!isEligibleLink(anchor, event)) return;
  event.preventDefault();
  navigate(anchor.href);
});

window.addEventListener('popstate', (event) => {
  navigate(window.location.href, { push: false, state: event.state, isPop: true });
});

window.addEventListener('beforeunload', rememberScroll);

window.YingPJAX = { navigate, prefetch, cache: pageCache };
