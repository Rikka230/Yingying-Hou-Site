const MAIN_SELECTOR = '#main';
const PUBLIC_PAGE_RE = /\/(index|filmographie|galerie|contact|legal|privacy|404)(\.html)?$/i;
const EXCLUDED_PAGE_RE = /\/(admin|cv-photo|cv-auto)(\.html)?$/i;
const ASSET_RE = /\.(pdf|jpg|jpeg|png|webp|gif|svg|mp4|mov|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx)$/i;

const pageCache = new Map();
const CACHE_LIMIT = 14;
let aborter = null;
let navigationToken = 0;
let currentRouteKey = routeKey(window.location.href);

function routeKey(urlLike = window.location.href) {
  const url = new URL(urlLike, window.location.origin);
  let path = url.pathname.replace(/\/index\.html$/i, '/');
  path = path.replace(/\/(filmographie|galerie|contact|legal|privacy|404)\.html$/i, '/$1');
  path = path.replace(/\/+$/g, '');
  return path || '/';
}

function isPublicRoute(urlLike) {
  const url = new URL(urlLike, window.location.origin);
  const key = routeKey(url.href);
  return key === '/' || PUBLIC_PAGE_RE.test(url.pathname) || ['/filmographie', '/galerie', '/contact', '/legal', '/privacy', '/404'].includes(key);
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
  if (EXCLUDED_PAGE_RE.test(url.pathname) || ASSET_RE.test(url.pathname)) return false;
  return isPublicRoute(url.href);
}

function rememberScroll() {
  try {
    history.replaceState({ ...(history.state || {}), scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);
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
    headers: { Accept: 'text/html,application/xhtml+xml', 'X-Requested-With': 'PJAX' },
    signal
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) throw new Error('Réponse non HTML');
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
  const dark = document.body.classList.contains('dark-mode') || document.documentElement.classList.contains('theme-dark');
  const nextClasses = Array.from(doc.body.classList).filter((name) => name !== 'dark-mode');
  document.body.className = nextClasses.join(' ');
  if (dark) document.body.classList.add('dark-mode');
}

function closeTransientUi() {
  document.querySelectorAll('dialog[open]').forEach((dialog) => {
    try { dialog.close(); } catch (_) { dialog.removeAttribute('open'); }
  });
  document.querySelectorAll('.lightbox[aria-hidden="false"], .photo-viewer[aria-hidden="false"], .photo-viewer-fixed[aria-hidden="false"], .video-lightbox[aria-hidden="false"]').forEach((node) => {
    node.setAttribute('aria-hidden', 'true');
  });
  document.body.style.overflow = '';
  window.YingNav?.closeMenu?.();
}

function scrollAfter(url, state, pop) {
  const next = new URL(url, window.location.origin);
  if (next.hash) {
    const target = document.getElementById(decodeURIComponent(next.hash.slice(1)));
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function swapMain(nextMain, url, state, pop, beforeReplace) {
  const current = document.querySelector(MAIN_SELECTOR);
  if (!current) throw new Error('Main courant introuvable');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('is-pjax-navigating');
  if (!reduced) {
    current.classList.add('pjax-leave');
    await wait(120);
  }

  beforeReplace?.();
  current.replaceWith(nextMain);
  scrollAfter(url, state, pop);

  if (!reduced) {
    nextMain.classList.add('pjax-enter');
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    nextMain.classList.add('pjax-enter-active');
    await wait(220);
    nextMain.classList.remove('pjax-enter', 'pjax-enter-active');
  }

  document.documentElement.classList.remove('is-pjax-navigating');
}

async function navigate(url, { push = true, state = null, pop = false } = {}) {
  const nextUrl = new URL(url, window.location.origin);
  if (!isPublicRoute(nextUrl.href)) return false;

  const nextKey = routeKey(nextUrl.href);
  if (!pop && nextKey === currentRouteKey && !nextUrl.hash) {
    window.YingNav?.updateActiveNav?.(nextUrl.pathname);
    window.YingNav?.closeMenu?.();
    return true;
  }

  const token = ++navigationToken;
  if (!pop) rememberScroll();
  closeTransientUi();
  aborter?.abort();
  aborter = new AbortController();

  try {
    window.YingApp?.teardown?.();
    const html = await fetchHtml(nextUrl.href, aborter.signal);
    if (token !== navigationToken) return false;

    const { doc, main } = parsePage(html);
    updateHead(doc, nextUrl.href);
    await swapMain(main, nextUrl.href, state, pop, () => updateBodyClass(doc));
    if (token !== navigationToken) return false;

    if (push) history.pushState({ scrollX: 0, scrollY: 0 }, doc.title || '', nextUrl.href);
    currentRouteKey = nextKey;

    window.YingNav?.init?.();
    window.YingNav?.updateActiveNav?.(nextUrl.pathname);
    window.YingApp?.init?.({ pjax: true });
    document.dispatchEvent(new CustomEvent('ying:pagechange', { detail: { url: nextUrl.href } }));
    warmLinks();
    return true;
  } catch (error) {
    if (error.name !== 'AbortError' && token === navigationToken) {
      console.error('PJAX navigation failed:', error);
      window.location.assign(nextUrl.href);
    }
    return false;
  } finally {
    if (token === navigationToken) {
      document.documentElement.classList.remove('is-pjax-navigating');
      document.querySelector(MAIN_SELECTOR)?.removeAttribute('aria-busy');
      aborter = null;
    }
  }
}

function interceptClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest('a');
  if (!eligibleLink(anchor, event)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  navigate(anchor.href);
}

function prefetch(anchor) {
  if (!eligibleLink(anchor)) return;
  if (routeKey(anchor.href) === currentRouteKey) return;
  if (pageCache.has(routeKey(anchor.href))) return;
  fetchHtml(anchor.href).catch(() => {});
}

function warmLinks() {
  const run = () => document.querySelectorAll('a').forEach((anchor) => prefetch(anchor));
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1400 });
  else setTimeout(run, 400);
}

if (!history.state) history.replaceState({ scrollX: window.scrollX, scrollY: window.scrollY }, '', window.location.href);

document.addEventListener('click', interceptClick, true);
document.addEventListener('pointerover', (event) => prefetch(event.target instanceof Element ? event.target.closest('a') : null), { passive: true });
document.addEventListener('focusin', (event) => prefetch(event.target instanceof Element ? event.target.closest('a') : null));
window.addEventListener('popstate', (event) => navigate(window.location.href, { push: false, state: event.state, pop: true }));
window.addEventListener('beforeunload', rememberScroll);
window.addEventListener('load', warmLinks, { once: true });

window.YingPJAX = { navigate, prefetch, warmLinks, routeKey, cache: pageCache };
