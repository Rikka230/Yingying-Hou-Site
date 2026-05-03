const MAIN_SELECTOR = '#main';
const CACHE_LIMIT = 10;
const PUBLIC_HTML_RE = /\/(index|filmographie|galerie|contact|legal|privacy|404)\.html$/i;
const EXCLUDED_RE = /\/(admin|cv-photo|cv-auto)\.html$/i;
const FILE_RE = /\.(pdf|jpg|jpeg|png|webp|gif|svg|mp4|mov|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx)$/i;

const pageCache = new Map();
let navigating = false;
let controller = null;
let prefetchTimer = null;

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

function sameDocumentHash(url) {
  return url.hash && routeKey(url.href) === routeKey(window.location.href);
}

function eligible(anchor, event = {}) {
  if (!anchor || !anchor.href) return false;
  if (anchor.dataset.noPjax === 'true') return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return false;
  const raw = anchor.getAttribute('href') || '';
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(raw)) return false;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  if (sameDocumentHash(url)) return false;
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

function setHeadFrom(doc, selector, attr = 'content') {
  const next = doc.querySelector(selector);
  const current = document.querySelector(selector);
  if (!next) return;
  if (current) current.setAttribute(attr, next.getAttribute(attr) || '');
  else document.head.appendChild(next.cloneNode(true));
}

function updateHead(doc, url) {
  document.title = doc.title || document.title;
  [
    'meta[name="description"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:type"]',
    'meta[property="og:image"]'
  ].forEach((selector) => setHeadFrom(doc, selector));
  setHeadFrom(doc, 'link[rel="canonical"]', 'href');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', new URL(url, window.location.origin).href);
}

function updateBodyClass(doc) {
  const keepDark = document.body.classList.contains('dark-mode');
  const nextClasses = Array.from(doc.body.classList).filter((name) => name !== 'dark-mode');
  document.body.className = nextClasses.join(' ');
  if (keepDark) document.body.classList.add('dark-mode');
}

function rememberScroll() {
  const state = history.state || {};
  history.replaceState({ ...state, scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);
}

function store(url, html) {
  const key = routeKey(url);
  if (pageCache.has(key)) pageCache.delete(key);
  pageCache.set(key, html);
  while (pageCache.size > CACHE_LIMIT) pageCache.delete(pageCache.keys().next().value);
}

async function fetchPage(url, signal) {
  const key = routeKey(url);
  if (pageCache.has(key)) return pageCache.get(key);
  const response = await fetch(url, {
    headers: { 'Accept': 'text/html,application/xhtml+xml', 'X-Requested-With': 'fetch' },
    signal
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) throw new Error('Réponse non HTML');
  const html = await response.text();
  store(url, html);
  return html;
}

function parse(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nextMain = doc.querySelector(MAIN_SELECTOR);
  if (!nextMain) throw new Error('main introuvable');
  return { doc, nextMain };
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function closeTransientUi() {
  document.querySelectorAll('dialog[open]').forEach((dialog) => {
    try { dialog.close(); } catch (_) { dialog.removeAttribute('open'); }
  });
  document.querySelectorAll('#lightbox[aria-hidden="false"], #videoLightbox[aria-hidden="false"]').forEach((node) => node.setAttribute('aria-hidden', 'true'));
  document.body.style.overflow = '';
  window.YingNav?.closeMenu?.();
}

async function swapMain(nextMain, beforeSwap) {
  const currentMain = document.querySelector(MAIN_SELECTOR);
  if (!currentMain) throw new Error('main actuel introuvable');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    beforeSwap?.();
    currentMain.replaceWith(nextMain);
    return;
  }

  currentMain.classList.add('is-pjax-leaving');
  await wait(170);
  beforeSwap?.();
  currentMain.replaceWith(nextMain);
  nextMain.classList.add('is-pjax-entering');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  nextMain.classList.remove('is-pjax-entering');
}

function restoreScroll(url, state, isPop) {
  const target = new URL(url, window.location.origin);
  if (target.hash) {
    const el = document.getElementById(decodeURIComponent(target.hash.slice(1)));
    if (el) { el.scrollIntoView({ block: 'start' }); return; }
  }
  if (isPop && state && Number.isFinite(state.scrollY)) {
    window.scrollTo({ left: state.scrollX || 0, top: state.scrollY || 0, behavior: 'auto' });
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

async function navigate(url, { push = true, state = null, isPop = false } = {}) {
  const nextUrl = new URL(url, window.location.origin);
  if (routeKey(nextUrl.href) === routeKey(window.location.href) && !nextUrl.hash) return;
  if (navigating) return;

  navigating = true;
  rememberScroll();
  closeTransientUi();
  controller?.abort?.();
  controller = new AbortController();

  const bar = ensureProgressBar();
  const main = document.querySelector(MAIN_SELECTOR);
  document.documentElement.classList.add('is-pjax-navigating');
  bar.classList.add('is-active');
  main?.setAttribute('aria-busy', 'true');

  try {
    document.dispatchEvent(new CustomEvent('ying:beforepagechange', { detail: { url: nextUrl.href } }));
    window.YingApp?.teardown?.();
    const html = await fetchPage(nextUrl.href, controller.signal);
    const { doc, nextMain } = parse(html);

    updateHead(doc, nextUrl.href);
    updateBodyClass(doc);
    await swapMain(nextMain, () => {
      if (!isPop && !nextUrl.hash) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    if (push) history.pushState({ scrollX: 0, scrollY: 0 }, doc.title || '', nextUrl.href);
    restoreScroll(nextUrl.href, state, isPop);

    window.YingNav?.init?.();
    try { await window.YingApp?.init?.({ pjax: true, url: nextUrl.href }); }
    catch (initError) { console.warn('Init page PJAX :', initError); }
    window.YingNav?.updateActiveNav?.();
    document.dispatchEvent(new CustomEvent('ying:pagechange', { detail: { url: nextUrl.href } }));
    warmLinks();
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.warn('PJAX fallback :', error);
    window.location.href = nextUrl.href;
  } finally {
    document.querySelector(MAIN_SELECTOR)?.removeAttribute('aria-busy');
    document.documentElement.classList.remove('is-pjax-navigating');
    bar.classList.remove('is-active');
    navigating = false;
    controller = null;
  }
}

function prefetch(anchor) {
  if (!eligible(anchor)) return;
  const url = new URL(anchor.href, window.location.origin);
  if (routeKey(url.href) === routeKey(window.location.href)) return;
  if (pageCache.has(routeKey(url.href))) return;
  fetchPage(url.href).catch(() => {});
}

function warmLinks() {
  const run = () => document.querySelectorAll('a[href]').forEach((a) => prefetch(a));
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1200 });
  else setTimeout(run, 240);
}

if (!history.state) history.replaceState({ scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);
ensureProgressBar();

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[href]');
  if (!eligible(anchor, event)) return;
  event.preventDefault();
  navigate(anchor.href);
}, true);

document.addEventListener('pointerover', (event) => {
  const anchor = event.target.closest('a[href]');
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(() => prefetch(anchor), 90);
}, { passive: true });

document.addEventListener('focusin', (event) => prefetch(event.target.closest('a[href]')));
window.addEventListener('popstate', (event) => navigate(window.location.href, { push: false, state: event.state, isPop: true }));
window.addEventListener('beforeunload', rememberScroll);
window.addEventListener('load', warmLinks, { once: true });
document.addEventListener('ying:warm-links', warmLinks);

window.YingPJAX = { navigate, prefetch, warmLinks, cache: pageCache };
