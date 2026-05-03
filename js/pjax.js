const MAIN_SELECTOR = '#main';
const PUBLIC_ROUTES = new Set(['/', '/filmographie.html', '/galerie.html', '/contact.html', '/legal.html', '/privacy.html', '/404.html']);
const EXCLUDED_RE = /\/(admin|cv-photo|cv-auto)\.html$/i;
const ASSET_RE = /\.(pdf|jpg|jpeg|png|webp|gif|svg|mp4|mov|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx)$/i;
const pageCache = new Map();
const CACHE_LIMIT = 12;
let navigating = false;
let aborter = null;

function normalizePath(pathname = '/') {
  const clean = String(pathname || '/')
    .replace(/\/index\.html$/i, '/')
    .replace(/\/+/g, '/')
    .replace(/\/$/g, '');
  return clean || '/';
}

function routeKey(urlLike) {
  const url = new URL(urlLike, window.location.origin);
  return normalizePath(url.pathname);
}

function isPublicRoute(urlLike) {
  const url = new URL(urlLike, window.location.origin);
  return PUBLIC_ROUTES.has(normalizePath(url.pathname));
}

function eligibleLink(anchor, event) {
  if (!anchor || !anchor.href) return false;
  if (anchor.dataset.noPjax === 'true') return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey || event?.button > 0) return false;

  const rawHref = anchor.getAttribute('href') || '';
  if (!rawHref || rawHref === '#') return false;
  if (/^(mailto:|tel:|sms:|javascript:)/i.test(rawHref)) return false;

  const url = new URL(anchor.href, window.location.origin);
  if (url.origin !== window.location.origin) return false;
  if (ASSET_RE.test(url.pathname)) return false;
  if (EXCLUDED_RE.test(url.pathname)) return false;
  return isPublicRoute(url.href);
}

function sameRoute(urlLike) {
  return routeKey(urlLike) === routeKey(window.location.href);
}

function rememberScroll() {
  const current = history.state || {};
  try {
    history.replaceState({ ...current, scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);
  } catch (_) {}
}

function saveCache(url, html) {
  const key = routeKey(url);
  if (pageCache.has(key)) pageCache.delete(key);
  pageCache.set(key, html);
  while (pageCache.size > CACHE_LIMIT) pageCache.delete(pageCache.keys().next().value);
}

async function fetchHtml(url, signal) {
  const key = routeKey(url);
  if (pageCache.has(key)) return pageCache.get(key);

  const response = await fetch(url, {
    headers: { 'Accept': 'text/html,application/xhtml+xml', 'X-Requested-With': 'PJAX' },
    signal
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (type && !type.includes('text/html')) throw new Error('Réponse non HTML');
  const html = await response.text();
  saveCache(url, html);
  return html;
}

function parsePage(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector(MAIN_SELECTOR);
  if (!main) throw new Error('Main introuvable');
  return { doc, main };
}

function syncMeta(doc, selector, attr = 'content') {
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
  ].forEach((selector) => syncMeta(doc, selector));
  syncMeta(doc, 'link[rel="canonical"]', 'href');
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', new URL(url, window.location.origin).href);
}

function updateBodyClass(doc) {
  const dark = document.body.classList.contains('dark-mode');
  const classes = Array.from(doc.body.classList).filter((name) => name !== 'dark-mode');
  document.body.className = classes.join(' ');
  if (dark) document.body.classList.add('dark-mode');
}

function closeTransientUi() {
  document.querySelectorAll('dialog[open]').forEach((dialog) => {
    try { dialog.close(); } catch (_) { dialog.removeAttribute('open'); }
  });
  document.querySelectorAll('.lightbox[aria-hidden="false"], .video-lightbox[aria-hidden="false"]').forEach((node) => node.setAttribute('aria-hidden', 'true'));
  document.body.style.overflow = '';
  window.YingNav?.closeMenu?.();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForImages(root, timeout = 900) {
  const images = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
  if (!images.length) return Promise.resolve();
  const waits = images.slice(0, 10).map((img) => new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  }));
  return Promise.race([Promise.allSettled(waits), wait(timeout)]);
}

function restoreScroll(url, state, pop) {
  const nextUrl = new URL(url, window.location.origin);
  if (nextUrl.hash) {
    const target = document.getElementById(decodeURIComponent(nextUrl.hash.slice(1)));
    if (target) {
      target.scrollIntoView({ block: 'start' });
      return;
    }
  }
  if (pop && state && Number.isFinite(state.scrollY)) {
    window.scrollTo({ left: state.scrollX || 0, top: state.scrollY || 0, behavior: 'auto' });
  } else {
    window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }
}

async function swapMain(nextMain, nextUrl, state, pop) {
  const current = document.querySelector(MAIN_SELECTOR);
  if (!current) throw new Error('Main courant introuvable');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    current.replaceWith(nextMain);
    restoreScroll(nextUrl, state, pop);
    return;
  }

  document.documentElement.classList.add('is-pjax-navigating');
  current.classList.add('pjax-leave');
  await wait(160);

  current.replaceWith(nextMain);
  restoreScroll(nextUrl, state, pop);
  nextMain.classList.add('pjax-enter');
  await waitForImages(nextMain);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  nextMain.classList.add('pjax-enter-active');
  await wait(240);
  nextMain.classList.remove('pjax-enter', 'pjax-enter-active');
  document.documentElement.classList.remove('is-pjax-navigating');
}

async function safeInitPage(nextUrl) {
  try {
    window.YingNav?.init?.();
    window.YingNav?.updateActiveNav?.(new URL(nextUrl, window.location.origin).pathname);
  } catch (error) {
    console.warn('Navigation shell non bloquante :', error);
  }

  try {
    await window.YingApp?.init?.({ pjax: true });
  } catch (error) {
    console.warn('Initialisation page non bloquante :', error);
  }

  try {
    window.YingNav?.updateActiveNav?.(new URL(nextUrl, window.location.origin).pathname);
    document.dispatchEvent(new CustomEvent('ying:pagechange', { detail: { url: new URL(nextUrl, window.location.origin).href, pathname: new URL(nextUrl, window.location.origin).pathname } }));
  } catch (error) {
    console.warn('Événement pagechange non bloquant :', error);
  }
}

async function navigate(url, { push = true, state = null, pop = false } = {}) {
  const nextUrl = new URL(url, window.location.origin);
  if (!isPublicRoute(nextUrl.href)) {
    window.location.href = nextUrl.href;
    return;
  }

  if (sameRoute(nextUrl.href) && !nextUrl.hash) {
    window.YingNav?.updateActiveNav?.(nextUrl.pathname);
    window.YingNav?.closeMenu?.();
    return;
  }

  if (navigating) return;
  navigating = true;
  rememberScroll();
  closeTransientUi();
  aborter?.abort();
  aborter = new AbortController();

  let swapped = false;
  try {
    document.querySelector(MAIN_SELECTOR)?.setAttribute('aria-busy', 'true');
    try { window.YingApp?.teardown?.(); } catch (error) { console.warn('Teardown non bloquant :', error); }

    const html = await fetchHtml(nextUrl.href, aborter.signal);
    const { doc, main } = parsePage(html);
    updateHead(doc, nextUrl.href);
    updateBodyClass(doc);
    await swapMain(main, nextUrl.href, state, pop);
    swapped = true;

    if (push) history.pushState({ scrollX: 0, scrollY: 0 }, doc.title || '', nextUrl.href);
    await safeInitPage(nextUrl.href);
    warmLinks();
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.warn('PJAX fallback:', error);
    if (!swapped) window.location.href = nextUrl.href;
  } finally {
    document.querySelector(MAIN_SELECTOR)?.removeAttribute('aria-busy');
    document.documentElement.classList.remove('is-pjax-navigating');
    navigating = false;
    aborter = null;
  }
}

function prefetch(anchor) {
  if (!eligibleLink(anchor)) return;
  const url = new URL(anchor.href, window.location.origin);
  if (sameRoute(url.href)) return;
  if (pageCache.has(routeKey(url.href))) return;
  fetchHtml(url.href).catch(() => {});
}

function warmLinks() {
  const run = () => document.querySelectorAll('a').forEach((anchor) => prefetch(anchor));
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1400 });
  else setTimeout(run, 450);
}

if (!history.state) history.replaceState({ scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);

function onDocumentClick(event) {
  const anchor = event.target.closest('a');
  if (!eligibleLink(anchor, event)) return;
  event.preventDefault();
  event.stopPropagation();
  navigate(anchor.href);
}

document.addEventListener('click', onDocumentClick, true);
document.addEventListener('pointerover', (event) => prefetch(event.target.closest('a')), { passive: true, capture: true });
document.addEventListener('focusin', (event) => prefetch(event.target.closest('a')), true);
window.addEventListener('popstate', (event) => navigate(window.location.href, { push: false, state: event.state, pop: true }));
window.addEventListener('beforeunload', rememberScroll);
window.addEventListener('load', warmLinks, { once: true });

window.YingPJAX = { navigate, prefetch, warmLinks, cache: pageCache, eligibleLink, routeKey };
