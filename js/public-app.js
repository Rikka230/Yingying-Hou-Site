import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD_Yvi_u5WixeTxuuEORgwFtxksAm7OUY4',
  authDomain: 'kukyying-f1c95.firebaseapp.com',
  projectId: 'kukyying-f1c95',
  storageBucket: 'kukyying-f1c95.firebasestorage.app',
  messagingSenderId: '681899915263',
  appId: '1:681899915263:web:4d64dcf4a9c57748ead9ca',
  measurementId: 'G-7F34MBVKPN'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
let pageController = null;
let scrollController = null;
const galleryStore = { photos: null, fetchPromise: null, preloaded: new Set() };

function signal() {
  return pageController?.signal;
}

function listen(target, type, handler, options = {}) {
  target?.addEventListener(type, handler, { ...options, signal: signal() });
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function normalizeCategory(value) {
  const raw = String(value || '').trim();
  const key = normalizeText(raw).replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ');
  const map = {
    'long metrage': 'Long métrage',
    'long metr': 'Long métrage',
    'court metrage': 'Court métrage',
    'court metr': 'Court métrage',
    'serie tv': 'Série TV',
    'publicite': 'Publicité',
    'pub': 'Publicité',
    'doublage voix off': 'Doublage / Voix off',
    'doublage voix': 'Doublage / Voix off',
    'doublage': 'Doublage',
    'voix off': 'Voix off',
    'voice over': 'Voix off',
    'voiceover': 'Voix off',
    'documentaire': 'Documentaire',
    'docu': 'Documentaire',
    'theatre': 'Théâtre',
    'realisation': 'Réalisation'
  };
  return map[key] || raw || 'Projet';
}

function getRoleOrderValue(role, fallbackIndex = 0) {
  const value = Number(role?.ordre);
  return Number.isFinite(value) && value > 0 ? value : 10000 + fallbackIndex;
}

function sortRolesForDisplay(roles) {
  return [...roles].sort((a, b) => {
    const custom = getRoleOrderValue(a) - getRoleOrderValue(b);
    if (custom !== 0) return custom;
    const years = (Number(b.annee) || 0) - (Number(a.annee) || 0);
    if (years !== 0) return years;
    return (a.projet || '').localeCompare(b.projet || '', 'fr', { sensitivity: 'base' });
  });
}

async function getRoles() {
  const snapshot = await getDocs(collection(db, 'role'));
  const roles = [];
  snapshot.forEach((item) => roles.push({ id: item.id, ...item.data(), type: normalizeCategory(item.data().type) }));
  return sortRolesForDisplay(roles);
}

function initCommon() {
  window.YingNav?.init?.();
  document.querySelectorAll('#year').forEach((node) => { node.textContent = new Date().getFullYear(); });
}

function teardown() {
  pageController?.abort?.();
  pageController = null;
  scrollController?.abort?.();
  scrollController = null;
  document.body.style.overflow = '';
  document.querySelectorAll('.video-lightbox[aria-hidden="false"], .lightbox[aria-hidden="false"]').forEach((node) => {
    node.setAttribute('aria-hidden', 'true');
  });
}

async function initPresskit() {
  const modal = document.getElementById('presskitModal');
  if (!modal) return;
  const close = document.getElementById('btn-close-presskit');
  listen(close, 'click', () => modal.close());

  document.querySelectorAll('.js-presskit').forEach((button) => {
    listen(button, 'click', async () => {
      try {
        const cvLink = document.getElementById('link-dl-cv');
        const zcardLink = document.getElementById('link-dl-zcard');
        const [cvDoc, zcardDoc] = await Promise.all([
          getDoc(doc(db, 'site_data', 'cv_project')),
          getDoc(doc(db, 'site_data', 'zcard_project'))
        ]);
        if (cvLink && cvDoc.exists() && cvDoc.data().publicUrl) cvLink.href = cvDoc.data().publicUrl;
        if (zcardLink && zcardDoc.exists() && zcardDoc.data().publicUrl) zcardLink.href = zcardDoc.data().publicUrl;
      } catch (error) {
        console.warn('Press kit non disponible :', error);
      }
      if (typeof modal.showModal === 'function') modal.showModal();
    });
  });
}

async function initHome() {
  initPresskit();
  await Promise.allSettled([initHomeRoles(), initHomeVideos()]);
}

async function initHomeRoles() {
  const list = document.getElementById('home-roles-list');
  const prev = document.getElementById('btn-prev-roles');
  const next = document.getElementById('btn-next-roles');
  if (!list || !prev || !next) return;

  const state = { page: 0, perPage: 7, roles: [] };

  function render() {
    const start = state.page * state.perPage;
    const pageRoles = state.roles.slice(start, start + state.perPage);
    list.innerHTML = pageRoles.length ? pageRoles.map((role) => {
      const year = role.annee ? ` ${escapeHtml(role.annee)}` : '';
      return `<li><span class="role-heart">♥</span> ${escapeHtml(role.titre || 'Rôle')} — <b>${escapeHtml(role.projet || 'Projet')}</b> <span class="role-meta">(${escapeHtml(normalizeCategory(role.type))}${year})</span></li>`;
    }).join('') : '<li class="loading-line">Aucun rôle disponible.</li>';
    prev.disabled = state.page === 0;
    next.disabled = start + state.perPage >= state.roles.length;
  }

  try {
    state.roles = await getRoles();
    render();
    listen(prev, 'click', () => { if (state.page > 0) { state.page -= 1; render(); } });
    listen(next, 'click', () => { if ((state.page + 1) * state.perPage < state.roles.length) { state.page += 1; render(); } });
  } catch (error) {
    console.warn('Rôles accueil indisponibles :', error);
    list.innerHTML = '<li class="loading-line error-line">Erreur de chargement.</li>';
  }
}

function buildPlayerUrl(rawUrl, autoplay = false) {
  try {
    const url = new URL(rawUrl, window.location.origin);
    const host = url.hostname.replace(/^www\./, '');
    if (host.includes('youtube') || host.includes('youtu.be')) {
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('playsinline', '1');
      url.searchParams.set('rel', '0');
      if (autoplay) url.searchParams.set('autoplay', '1');
    }
    if (host.includes('vimeo')) {
      url.searchParams.set('api', '1');
      url.searchParams.set('playsinline', '1');
      if (autoplay) url.searchParams.set('autoplay', '1');
    }
    return url.toString();
  } catch (_) {
    return rawUrl;
  }
}

async function initHomeVideos() {
  const slider = document.getElementById('ytSlider');
  const prev = document.getElementById('yt-prev');
  const next = document.getElementById('yt-next');
  if (!slider) return;

  try {
    const q = query(collection(db, 'videos'), orderBy('ordre', 'asc'));
    const snapshot = await getDocs(q);
    slider.innerHTML = '';
    if (snapshot.empty) {
      slider.innerHTML = '<p class="loading-line">Prochainement : de nouvelles vidéos.</p>';
      return;
    }

    snapshot.forEach((item) => {
      const data = item.data();
      const src = buildPlayerUrl(data.url || '', false);
      const title = escapeHtml(data.titre || 'Vidéo');
      const card = document.createElement('div');
      card.className = 'yt-item';
      card.innerHTML = `
        <iframe src="${src}" title="${title}" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
        <button class="media-expand" type="button" data-video-src="${src}" data-video-title="${title}">Agrandir</button>`;
      slider.appendChild(card);
    });

    const scrollAmount = () => (slider.querySelector('.yt-item')?.offsetWidth || 320) + 16;
    listen(next, 'click', () => slider.scrollBy({ left: scrollAmount(), behavior: 'smooth' }));
    listen(prev, 'click', () => slider.scrollBy({ left: -scrollAmount(), behavior: 'smooth' }));
    initVideoLightbox();
  } catch (error) {
    console.warn('Vidéos indisponibles :', error);
    slider.innerHTML = '<p class="loading-line error-line">Erreur de chargement.</p>';
  }
}

function pauseMiniPlayers() {
  document.querySelectorAll('.yt-item iframe').forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      iframe.contentWindow?.postMessage('{"method":"pause"}', '*');
    } catch (_) {}
  });
}

function initVideoLightbox() {
  let modal = document.getElementById('videoLightbox');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'videoLightbox';
    modal.className = 'video-lightbox';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="video-lightbox-backdrop" data-video-close></div>
      <div class="video-lightbox-panel">
        <button class="video-lightbox-close" type="button" data-video-close aria-label="Fermer">✕</button>
        <div class="video-lightbox-loader"><span></span><strong>Chargement de la vidéo</strong></div>
        <iframe id="videoLightboxFrame" title="Vidéo agrandie" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
      </div>`;
    document.body.appendChild(modal);
  }

  const frame = modal.querySelector('#videoLightboxFrame');
  const close = () => {
    modal.classList.remove('is-ready');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (frame) {
      frame.removeAttribute('src');
      frame.onload = null;
    }
  };

  modal.querySelectorAll('[data-video-close]').forEach((button) => listen(button, 'click', close));
  document.querySelectorAll('.media-expand').forEach((button) => {
    listen(button, 'click', () => {
      const src = button.dataset.videoSrc;
      if (!src || !frame) return;
      pauseMiniPlayers();
      modal.classList.remove('is-ready');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      frame.onload = () => window.setTimeout(() => modal.classList.add('is-ready'), 120);
      frame.src = buildPlayerUrl(src, true);
    });
  });
}

async function initFilmography() {
  const table = document.querySelector('#filmography tbody');
  const filter = document.getElementById('filter-category');
  const sort = document.getElementById('sort-by');
  const search = document.getElementById('search-film');
  if (!table || !filter || !sort || !search) return;

  let roles = [];
  function render() {
    const term = normalizeText(search.value);
    let rows = roles.filter((role) => {
      if (filter.value !== 'all' && normalizeCategory(role.type) !== normalizeCategory(filter.value)) return false;
      if (!term) return true;
      return [role.projet, role.titre, role.realisateur, role.annee, role.type].some((value) => normalizeText(value).includes(term));
    });

    rows = [...rows].sort((a, b) => {
      if (sort.value === 'custom') return sortRolesForDisplay([a, b])[0] === a ? -1 : 1;
      if (sort.value === 'year-desc') return (Number(b.annee) || 0) - (Number(a.annee) || 0);
      if (sort.value === 'year-asc') return (Number(a.annee) || 0) - (Number(b.annee) || 0);
      if (sort.value === 'title-asc') return (a.projet || '').localeCompare(b.projet || '', 'fr', { sensitivity: 'base' });
      if (sort.value === 'title-desc') return (b.projet || '').localeCompare(a.projet || '', 'fr', { sensitivity: 'base' });
      return 0;
    });

    table.innerHTML = rows.length ? rows.map((role) => {
      const link = role.lien ? `<a class="btn table-link" href="${escapeHtml(role.lien)}" target="_blank" rel="noopener">Voir</a>` : '<span class="muted">-</span>';
      return `<tr>
        <td data-label="Année">${escapeHtml(role.annee || '')}</td>
        <td data-label="Projet / Titre"><strong>${escapeHtml(role.projet || '')}</strong></td>
        <td data-label="Rôle">${escapeHtml(role.titre || '')}</td>
        <td data-label="Réalisateur">${escapeHtml(role.realisateur || '-')}</td>
        <td data-label="Catégorie"><span class="category-pill">${escapeHtml(normalizeCategory(role.type))}</span></td>
        <td data-label="Lien">${link}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="table-empty">Aucun résultat trouvé.</td></tr>';
  }

  try {
    roles = await getRoles();
    render();
    listen(filter, 'change', render);
    listen(sort, 'change', render);
    listen(search, 'input', render);
  } catch (error) {
    console.warn('Filmographie indisponible :', error);
    table.innerHTML = '<tr><td colspan="6" class="table-empty error-line">Erreur de chargement.</td></tr>';
  }
}

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

async function loadGalleryPhotos(currentSignal) {
  if (galleryStore.photos) return galleryStore.photos;
  if (!galleryStore.fetchPromise) {
    galleryStore.fetchPromise = (async () => {
      const q = query(collection(db, 'galerie'), orderBy('ordre', 'asc'));
      const snapshot = await getDocs(q);
      const photos = [];
      snapshot.forEach((item) => {
        const data = item.data();
        if (data?.url) photos.push(data);
      });
      galleryStore.photos = photos;
      return photos;
    })().catch((error) => {
      galleryStore.fetchPromise = null;
      throw error;
    });
  }
  const photos = await galleryStore.fetchPromise;
  if (currentSignal?.aborted) return galleryStore.photos || photos;
  return photos;
}

function preloadGalleryImage(url) {
  if (!url) return Promise.resolve(false);
  if (galleryStore.preloaded.has(url)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => { galleryStore.preloaded.add(url); resolve(true); };
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

async function initGallery() {
  const grid = document.getElementById('gallery');
  const lightbox = document.getElementById('lightbox');
  const currentSignal = signal();
  if (!grid || !lightbox || currentSignal?.aborted) return;

  let allPhotos = [];
  let shownPhotos = [];
  let currentIndex = 0;
  let moving = false;
  let transitionId = 0;
  let renderToken = 0;

  const isAlive = () => !currentSignal?.aborted && grid.isConnected && lightbox.isConnected;

  lightbox.className = 'lightbox ying-lightbox';
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.innerHTML = `
    <div class="lb-backdrop" data-lb-close></div>
    <button class="lb-close" type="button" data-lb-close aria-label="Fermer">✕</button>
    <button class="lb-nav lb-prev" type="button" aria-label="Photo précédente">‹</button>
    <div class="lb-shell" role="document">
      <div class="lb-viewport" aria-live="polite"><div class="lb-rail"></div></div>
      <p class="lb-caption" id="lb-caption"></p>
    </div>
    <button class="lb-nav lb-next" type="button" aria-label="Photo suivante">›</button>`;

  const rail = lightbox.querySelector('.lb-rail');
  const caption = lightbox.querySelector('.lb-caption');
  const prev = lightbox.querySelector('.lb-prev');
  const next = lightbox.querySelector('.lb-next');

  function safeIndex(index) {
    if (!shownPhotos.length) return 0;
    return (index + shownPhotos.length) % shownPhotos.length;
  }

  function photoAt(index) {
    return shownPhotos[safeIndex(index)];
  }

  function slideMarkup(photo, label) {
    if (!photo) return '<div class="lb-slide"></div>';
    return `<div class="lb-slide" aria-label="${escapeHtml(label)}"><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || 'Photo de Yingying HOU')}" draggable="false"></div>`;
  }

  function setCaption(photo) {
    caption.textContent = photo?.caption || '';
  }

  function prime(index) {
    [index - 1, index, index + 1].forEach((i) => preloadGalleryImage(photoAt(i)?.url));
  }

  function renderRail(index, withTransition = false) {
    if (!shownPhotos.length) return;
    currentIndex = safeIndex(index);
    rail.classList.remove('is-animated');
    rail.style.transition = 'none';
    rail.style.transform = 'translate3d(-100%,0,0)';
    rail.innerHTML = [
      slideMarkup(photoAt(currentIndex - 1), 'Photo précédente'),
      slideMarkup(photoAt(currentIndex), 'Photo actuelle'),
      slideMarkup(photoAt(currentIndex + 1), 'Photo suivante')
    ].join('');
    setCaption(photoAt(currentIndex));
    prime(currentIndex);
    // Force le navigateur à poser le rail au centre avant toute animation.
    rail.offsetHeight;
    if (withTransition) {
      rail.style.transition = '';
      rail.classList.add('is-animated');
    }
  }

  function open(index) {
    if (!shownPhotos.length || !isAlive()) return;
    transitionId += 1;
    moving = false;
    renderRail(index, false);
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    transitionId += 1;
    moving = false;
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (rail) rail.innerHTML = '';
  }

  async function go(delta) {
    if (moving || !shownPhotos.length || lightbox.getAttribute('aria-hidden') === 'true') return;
    moving = true;
    const id = ++transitionId;
    const targetIndex = safeIndex(currentIndex + delta);
    await preloadGalleryImage(photoAt(targetIndex)?.url);
    if (id !== transitionId || !isAlive()) return;

    renderRail(currentIndex, false);
    requestAnimationFrame(() => {
      if (id !== transitionId || !isAlive()) return;
      rail.style.transition = '';
      rail.classList.add('is-animated');
      rail.style.transform = delta > 0 ? 'translate3d(-200%,0,0)' : 'translate3d(0,0,0)';
    });

    let finished = false;
    let timer = null;
    const finish = () => {
      if (finished || id !== transitionId || !isAlive()) return;
      finished = true;
      if (timer) clearTimeout(timer);
      renderRail(targetIndex, false);
      moving = false;
    };

    const onEnd = (event) => {
      if (event.target === rail) finish();
    };
    rail.addEventListener('transitionend', onEnd, { once: true, signal: currentSignal });
    timer = setTimeout(finish, 620);
  }

  async function renderGrid(category = 'Tout') {
    const token = ++renderToken;
    if (!isAlive()) return;
    grid.classList.remove('is-ready');
    grid.classList.add('is-loading');

    shownPhotos = category === 'Tout' ? allPhotos : allPhotos.filter((photo) => photo.categorie === category);

    const hasWarmCache = shownPhotos.length && shownPhotos.every((photo) => galleryStore.preloaded.has(photo.url));
    if (!hasWarmCache) {
      grid.innerHTML = `<div class="gallery-loader" role="status" aria-live="polite"><span class="gallery-spinner" aria-hidden="true"></span><strong>Chargement de la galerie</strong><em>Préparation des images…</em></div>`;
      await Promise.race([
        Promise.allSettled(shownPhotos.map((photo) => preloadGalleryImage(photo.url))),
        new Promise((resolve) => setTimeout(resolve, 4500))
      ]);
    }

    if (token !== renderToken || !isAlive()) return;

    if (!shownPhotos.length) {
      grid.innerHTML = '<p class="loading-line">Aucune photo dans cette catégorie.</p>';
    } else {
      grid.innerHTML = shownPhotos.map((photo, index) => `
        <a href="${escapeHtml(photo.url)}" class="gallery-item" data-index="${index}" style="--stagger:${Math.min(index, 18) * 38}ms">
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || 'Photo de Yingying HOU')}" loading="eager" decoding="async" />
          <div class="item-overlay"><span>Agrandir</span></div>
        </a>`).join('');
    }

    grid.classList.remove('is-loading');
    requestAnimationFrame(() => { if (isAlive()) grid.classList.add('is-ready'); });
  }

  listen(grid, 'click', (event) => {
    const item = event.target.closest('.gallery-item');
    if (!item) return;
    event.preventDefault();
    open(Number(item.dataset.index) || 0);
  });
  listen(lightbox, 'click', (event) => {
    if (event.target.closest('[data-lb-close]')) close();
  });
  listen(prev, 'click', (event) => { event.preventDefault(); event.stopPropagation(); go(-1); });
  listen(next, 'click', (event) => { event.preventDefault(); event.stopPropagation(); go(1); });
  listen(document, 'keydown', (event) => {
    if (lightbox.getAttribute('aria-hidden') === 'true') return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  });

  document.querySelectorAll('.filter-btn').forEach((button) => {
    listen(button, 'click', () => {
      document.querySelectorAll('.filter-btn').forEach((item) => item.classList.add('outline'));
      button.classList.remove('outline');
      renderGrid(button.dataset.filter || 'Tout');
    });
  });

  try {
    grid.classList.add('is-loading');
    if (!galleryStore.photos) {
      grid.innerHTML = `<div class="gallery-loader" role="status" aria-live="polite"><span class="gallery-spinner" aria-hidden="true"></span><strong>Chargement de la galerie</strong><em>Récupération des photos…</em></div>`;
    }
    allPhotos = await loadGalleryPhotos(currentSignal);
    if (!isAlive()) return;
    await renderGrid('Tout');
  } catch (error) {
    if (currentSignal?.aborted || !isAlive()) return;
    console.warn('Galerie indisponible :', error);
    grid.classList.remove('is-loading');
    grid.innerHTML = '<p class="loading-line error-line">Erreur de chargement.</p>';
  }
}

function initContact() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const status = document.getElementById('formStatus');
  const submit = form.querySelector('button[type="submit"]');
  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

  listen(form, 'submit', (event) => {
    if (form.company && form.company.value.trim() !== '') {
      event.preventDefault();
      if (status) { status.textContent = 'Merci.'; status.className = 'form-status ok'; }
      return;
    }
    const errors = [];
    if (!form.name?.value.trim()) errors.push('Nom');
    if (!isEmail(form.email?.value.trim())) errors.push('Email');
    if (!form.message?.value.trim()) errors.push('Message');
    if (errors.length) {
      event.preventDefault();
      if (status) { status.textContent = 'Champs à compléter : ' + errors.join(', ') + '.'; status.className = 'form-status err'; }
      return;
    }
    if (status) { status.textContent = 'Envoi en cours…'; status.className = 'form-status'; }
    submit?.setAttribute('disabled', 'disabled');
  });
}

function initScrollHints() {
  scrollController?.abort?.();
  const hints = document.querySelectorAll('.scroll-hint, .scroll-hint-mobile');
  if (!hints.length) return;
  scrollController = new AbortController();
  const update = () => {
    hints.forEach((hint) => {
      const hidden = hint.classList.contains('scroll-hint-mobile')
        ? window.scrollY > 50
        : document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < 160;
      hint.classList.toggle('hidden', hidden);
    });
  };
  update();
  window.addEventListener('scroll', update, { passive: true, signal: scrollController.signal });
  window.addEventListener('resize', update, { passive: true, signal: scrollController.signal });
}

function initPage() {
  teardown();
  pageController = new AbortController();
  initCommon();
  initScrollHints();
  document.body.style.overflow = '';
  const page = document.getElementById('main')?.dataset.page;
  if (page === 'home') void initHome();
  else if (page === 'filmography') void initFilmography();
  else if (page === 'gallery') void initGallery();
  else if (page === 'contact') initContact();
}

window.YingApp = {
  init: initPage,
  teardown,
  db,
  normalizeCategory,
  updateActiveNav: () => window.YingNav?.updateActiveNav?.(),
  ensureUnifiedHeader: () => window.YingNav?.init?.()
};

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  initPage();
}
document.addEventListener('DOMContentLoaded', boot, { once: true });
if (document.readyState !== 'loading') boot();
