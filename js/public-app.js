import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_Yvi_u5WixeTxuuEORgwFtxksAm7OUY4",
  authDomain: "kukyying-f1c95.firebaseapp.com",
  projectId: "kukyying-f1c95",
  storageBucket: "kukyying-f1c95.firebasestorage.app",
  messagingSenderId: "681899915263",
  appId: "1:681899915263:web:4d64dcf4a9c57748ead9ca",
  measurementId: "G-7F34MBVKPN"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

let pageController = null;
let keyHandler = null;
let activeVideoSource = null;

function signal() { return pageController?.signal; }

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .trim();
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
    'doublage': 'Doublage',
    'voix off': 'Voix off',
    'voice off': 'Voix off',
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
  const n = Number(role?.ordre);
  return Number.isFinite(n) && n > 0 ? n : 10000 + fallbackIndex;
}

function sortRolesForDisplay(roles) {
  return [...roles].sort((a, b) => {
    const orderA = getRoleOrderValue(a);
    const orderB = getRoleOrderValue(b);
    if (orderA !== orderB) return orderA - orderB;
    const yearDiff = (Number(b.annee) || 0) - (Number(a.annee) || 0);
    if (yearDiff !== 0) return yearDiff;
    return (a.projet || '').localeCompare(b.projet || '', 'fr', { sensitivity: 'base' });
  });
}

async function getRoles() {
  const snapshot = await getDocs(collection(db, 'role'));
  const roles = [];
  snapshot.forEach((item) => roles.push({ id: item.id, ...item.data(), type: normalizeCategory(item.data().type) }));
  return roles;
}

function initCommon() {
  window.YingNav?.init?.();
  document.querySelectorAll('#year').forEach((year) => { year.textContent = new Date().getFullYear(); });
}

function teardown() {
  pageController?.abort?.();
  pageController = new AbortController();
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = null;
  document.body.style.overflow = '';
  closeVideoLightbox({ keepFrame: false });
}

function initPresskit() {
  const modal = document.getElementById('presskitModal');
  if (!modal) return;
  const close = document.getElementById('btn-close-presskit');
  if (close) close.addEventListener('click', () => modal.close(), { signal: signal() });

  document.querySelectorAll('.js-presskit').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const cvDoc = await getDoc(doc(db, 'site_data', 'cv_project'));
        if (cvDoc.exists() && cvDoc.data().publicUrl) document.getElementById('link-dl-cv')?.setAttribute('href', cvDoc.data().publicUrl);
        const zcardDoc = await getDoc(doc(db, 'site_data', 'zcard_project'));
        if (zcardDoc.exists() && zcardDoc.data().publicUrl) document.getElementById('link-dl-zcard')?.setAttribute('href', zcardDoc.data().publicUrl);
      } catch (error) {
        console.warn('Press kit indisponible :', error);
      }
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    }, { signal: signal() });
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

  let currentPage = 0;
  const perPage = 7;

  const render = (roles) => {
    const start = currentPage * perPage;
    const pageRoles = roles.slice(start, start + perPage);
    list.innerHTML = pageRoles.length ? pageRoles.map((role) => {
      const year = role.annee ? ` ${role.annee}` : '';
      return `<li><span class="role-heart">♥</span> ${role.titre || 'Rôle'} — <b>${role.projet || 'Projet'}</b> <span class="role-meta">(${normalizeCategory(role.type)}${year})</span></li>`;
    }).join('') : '<li class="loading-line">Aucun rôle disponible.</li>';
    prev.disabled = currentPage === 0;
    next.disabled = start + perPage >= roles.length;
  };

  try {
    const roles = sortRolesForDisplay(await getRoles());
    render(roles);
    prev.addEventListener('click', () => { if (currentPage > 0) { currentPage -= 1; render(roles); } }, { signal: signal() });
    next.addEventListener('click', () => { if ((currentPage + 1) * perPage < roles.length) { currentPage += 1; render(roles); } }, { signal: signal() });
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
    return rawUrl || '';
  }
}

async function initHomeVideos() {
  const slider = document.getElementById('ytSlider');
  const prev = document.getElementById('yt-prev');
  const next = document.getElementById('yt-next');
  if (!slider) return;

  try {
    const snapshot = await getDocs(query(collection(db, 'videos'), orderBy('ordre', 'asc')));
    slider.innerHTML = '';
    if (snapshot.empty) {
      slider.innerHTML = '<p class="loading-line">Prochainement : de nouvelles vidéos.</p>';
      return;
    }

    snapshot.forEach((item) => {
      const data = item.data();
      const safeUrl = buildPlayerUrl(data.url || '', false);
      const div = document.createElement('div');
      div.className = 'yt-item';
      div.innerHTML = `
        <iframe src="${safeUrl}" title="${data.titre || 'Vidéo'}" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
        <button class="media-expand" type="button" aria-label="Agrandir la vidéo" data-video-src="${safeUrl}" data-video-title="${data.titre || 'Vidéo'}">Agrandir</button>
      `;
      slider.appendChild(div);
    });

    const amount = () => (slider.querySelector('.yt-item')?.offsetWidth || 320) + 16;
    prev?.addEventListener('click', () => slider.scrollBy({ left: -amount(), behavior: 'smooth' }), { signal: signal() });
    next?.addEventListener('click', () => slider.scrollBy({ left: amount(), behavior: 'smooth' }), { signal: signal() });
    initVideoLightbox();
  } catch (error) {
    console.warn('Vidéos indisponibles :', error);
    slider.innerHTML = '<p class="loading-line error-line">Erreur de chargement.</p>';
  }
}

function pauseEmbeddedVideos() {
  document.querySelectorAll('.yt-item iframe').forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
      iframe.contentWindow?.postMessage(JSON.stringify({ method: 'pause' }), '*');
    } catch (_) {}
  });
}

function ensureVideoLightbox() {
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
      <div class="video-lightbox-panel" role="document">
        <button class="video-lightbox-close" type="button" data-video-close aria-label="Fermer">✕</button>
        <div class="video-lightbox-loader"><span></span><strong>Chargement</strong></div>
        <iframe id="videoLightboxFrame" title="Vidéo agrandie" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>
      </div>
    `;
    document.body.appendChild(modal);
  }
  return modal;
}

function closeVideoLightbox({ keepFrame = false } = {}) {
  const modal = document.getElementById('videoLightbox');
  const frame = document.getElementById('videoLightboxFrame');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('is-ready', 'is-loading');
  document.body.classList.remove('video-modal-open');
  document.body.style.overflow = '';
  if (!keepFrame && frame) frame.src = 'about:blank';
  activeVideoSource?.classList.remove('is-expanded-source');
  activeVideoSource = null;
}

function initVideoLightbox() {
  const modal = ensureVideoLightbox();
  const frame = modal.querySelector('#videoLightboxFrame');
  modal.querySelectorAll('[data-video-close]').forEach((button) => button.addEventListener('click', () => closeVideoLightbox(), { signal: signal() }));

  document.querySelectorAll('.media-expand').forEach((button) => {
    button.addEventListener('click', () => {
      const src = button.dataset.videoSrc;
      if (!src || !frame) return;
      pauseEmbeddedVideos();
      activeVideoSource?.classList.remove('is-expanded-source');
      activeVideoSource = button.closest('.yt-item');
      activeVideoSource?.classList.add('is-expanded-source');
      modal.classList.remove('is-ready');
      modal.classList.add('is-loading');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('video-modal-open');
      document.body.style.overflow = 'hidden';
      frame.removeAttribute('src');
      frame.onload = () => {
        window.setTimeout(() => {
          modal.classList.remove('is-loading');
          modal.classList.add('is-ready');
        }, 120);
      };
      frame.src = buildPlayerUrl(src, true);
    }, { signal: signal() });
  });
}

async function initFilmography() {
  const table = document.querySelector('#filmography tbody');
  const filter = document.getElementById('filter-category');
  const sort = document.getElementById('sort-by');
  const search = document.getElementById('search-film');
  if (!table || !filter || !sort || !search) return;

  let roles = [];
  const render = () => {
    const term = normalizeText(search.value);
    let rows = roles.filter((role) => {
      if (filter.value !== 'all' && normalizeCategory(role.type) !== normalizeCategory(filter.value)) return false;
      if (!term) return true;
      return [role.projet, role.titre, role.realisateur, role.annee, role.type].some((value) => normalizeText(value).includes(term));
    });

    rows.sort((a, b) => {
      const mode = sort.value;
      if (mode === 'custom') return getRoleOrderValue(a) - getRoleOrderValue(b);
      if (mode === 'year-desc') return (Number(b.annee) || 0) - (Number(a.annee) || 0);
      if (mode === 'year-asc') return (Number(a.annee) || 0) - (Number(b.annee) || 0);
      if (mode === 'title-asc') return (a.projet || '').localeCompare(b.projet || '', 'fr', { sensitivity: 'base' });
      if (mode === 'title-desc') return (b.projet || '').localeCompare(a.projet || '', 'fr', { sensitivity: 'base' });
      return 0;
    });

    table.innerHTML = rows.length ? rows.map((role) => {
      const link = role.lien ? `<a class="btn table-link" href="${role.lien}" target="_blank" rel="noopener">Voir</a>` : '<span class="muted">-</span>';
      return `<tr>
        <td data-label="Année">${role.annee || ''}</td>
        <td data-label="Projet / Titre"><strong>${role.projet || ''}</strong></td>
        <td data-label="Rôle">${role.titre || ''}</td>
        <td data-label="Réalisateur">${role.realisateur || '-'}</td>
        <td data-label="Catégorie"><span class="category-pill">${normalizeCategory(role.type)}</span></td>
        <td data-label="Lien">${link}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6" class="table-empty">Aucun résultat trouvé.</td></tr>';
  };

  try {
    roles = sortRolesForDisplay(await getRoles());
    render();
    filter.addEventListener('change', render, { signal: signal() });
    sort.addEventListener('change', render, { signal: signal() });
    search.addEventListener('input', render, { signal: signal() });
  } catch (error) {
    console.warn('Filmographie indisponible :', error);
    table.innerHTML = '<tr><td colspan="6" class="table-empty error-line">Erreur de chargement.</td></tr>';
  }
}

async function initGallery() {
  const grid = document.getElementById('gallery');
  const lightbox = document.getElementById('lightbox');
  if (!grid || !lightbox) return;

  let allPhotos = [];
  let shownPhotos = [];
  let current = 0;
  let renderId = 0;
  let sliding = false;

  setupLightboxDom(lightbox);
  const stage = lightbox.querySelector('.lb-slider-stage');
  const currentSlide = lightbox.querySelector('.lb-slide-current');
  const incomingSlide = lightbox.querySelector('.lb-slide-incoming');
  const currentImg = currentSlide.querySelector('img');
  const incomingImg = incomingSlide.querySelector('img');
  const caption = lightbox.querySelector('#lb-caption');

  const preload = (url) => new Promise((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  });

  const preloadAround = (index) => {
    if (!shownPhotos.length) return;
    [-1, 1].forEach((offset) => {
      const photo = shownPhotos[(index + offset + shownPhotos.length) % shownPhotos.length];
      if (photo?.url) { const img = new Image(); img.src = photo.url; }
    });
  };

  const setCurrent = (index) => {
    current = (index + shownPhotos.length) % shownPhotos.length;
    const photo = shownPhotos[current];
    currentImg.src = photo.url;
    currentImg.alt = photo.caption || 'Photo de Yingying HOU';
    caption.textContent = photo.caption || '';
    preloadAround(current);
  };

  const open = (index) => {
    if (!shownPhotos.length) return;
    setCurrent(index);
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    stage.classList.remove('is-next', 'is-prev');
    incomingImg.removeAttribute('src');
    sliding = false;
  };

  const go = async (direction) => {
    if (sliding || !shownPhotos.length) return;
    sliding = true;
    const nextIndex = (current + direction + shownPhotos.length) % shownPhotos.length;
    const photo = shownPhotos[nextIndex];
    await preload(photo.url);
    incomingImg.src = photo.url;
    incomingImg.alt = photo.caption || 'Photo de Yingying HOU';
    stage.classList.remove('is-next', 'is-prev', 'is-resetting');
    stage.dataset.dir = direction > 0 ? 'next' : 'prev';
    void stage.offsetWidth;
    stage.classList.add(direction > 0 ? 'is-next' : 'is-prev');

    window.setTimeout(() => {
      stage.classList.add('is-resetting');
      setCurrent(nextIndex);
      stage.classList.remove('is-next', 'is-prev');
      incomingImg.removeAttribute('src');
      incomingImg.alt = '';
      void stage.offsetWidth;
      stage.classList.remove('is-resetting');
      sliding = false;
    }, 460);
  };

  const render = async (category = 'Tout') => {
    const token = ++renderId;
    grid.classList.remove('is-ready');
    grid.classList.add('is-loading');
    grid.innerHTML = '<div class="gallery-loader" role="status"><span class="gallery-spinner" aria-hidden="true"></span><strong>Chargement de la galerie</strong><em>Préparation des images…</em></div>';
    shownPhotos = category === 'Tout' ? allPhotos : allPhotos.filter((photo) => photo.categorie === category);
    await Promise.race([
      Promise.allSettled(shownPhotos.map((photo) => preload(photo.url))),
      new Promise((resolve) => setTimeout(resolve, 4500))
    ]);
    if (token !== renderId) return;
    grid.innerHTML = shownPhotos.length ? shownPhotos.map((photo, index) => `
      <a href="${photo.url}" class="gallery-item" data-index="${index}" style="--stagger:${Math.min(index, 18) * 50}ms">
        <img src="${photo.url}" alt="${photo.caption || 'Photo de Yingying HOU'}" loading="eager" decoding="async">
        <span class="item-overlay"><span>Agrandir</span></span>
      </a>`).join('') : '<p class="loading-line">Aucune photo dans cette catégorie.</p>';
    grid.classList.remove('is-loading');
    requestAnimationFrame(() => grid.classList.add('is-ready'));
  };

  grid.addEventListener('click', (event) => {
    const item = event.target.closest('.gallery-item');
    if (!item) return;
    event.preventDefault();
    open(Number(item.dataset.index) || 0);
  }, { signal: signal() });
  lightbox.querySelector('.lb-close')?.addEventListener('click', close, { signal: signal() });
  lightbox.querySelector('.lb-next')?.addEventListener('click', () => go(1), { signal: signal() });
  lightbox.querySelector('.lb-prev')?.addEventListener('click', () => go(-1), { signal: signal() });
  lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close(); }, { signal: signal() });
  keyHandler = (event) => {
    if (lightbox.getAttribute('aria-hidden') === 'true') return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') go(1);
    if (event.key === 'ArrowLeft') go(-1);
  };
  document.addEventListener('keydown', keyHandler);

  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((item) => item.classList.add('outline'));
      button.classList.remove('outline');
      render(button.dataset.filter || 'Tout');
    }, { signal: signal() });
  });

  try {
    grid.classList.add('is-loading');
    grid.innerHTML = '<div class="gallery-loader" role="status"><span class="gallery-spinner" aria-hidden="true"></span><strong>Chargement de la galerie</strong><em>Récupération des photos…</em></div>';
    const snapshot = await getDocs(query(collection(db, 'galerie'), orderBy('ordre', 'asc')));
    allPhotos = [];
    snapshot.forEach((item) => allPhotos.push(item.data()));
    await render('Tout');
  } catch (error) {
    console.warn('Galerie indisponible :', error);
    grid.classList.remove('is-loading');
    grid.innerHTML = '<p class="loading-line error-line">Erreur de chargement.</p>';
  }
}

function setupLightboxDom(lightbox) {
  const figure = lightbox.querySelector('.lb-figure');
  const oldImg = lightbox.querySelector('#lb-image');
  const caption = lightbox.querySelector('#lb-caption');
  if (!figure || figure.querySelector('.lb-slider-stage')) return;
  const stage = document.createElement('div');
  stage.className = 'lb-slider-stage is-resetting';
  stage.innerHTML = `
    <div class="lb-slide lb-slide-current"><img class="lb-photo-frame" alt=""></div>
    <div class="lb-slide lb-slide-incoming"><img class="lb-photo-frame" alt=""></div>
  `;
  if (oldImg) oldImg.remove();
  figure.insertBefore(stage, caption || null);
  requestAnimationFrame(() => stage.classList.remove('is-resetting'));
}

function initContact() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  const status = document.getElementById('formStatus');
  const submit = form.querySelector('button[type="submit"]');
  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

  form.addEventListener('submit', (event) => {
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
  }, { signal: signal() });
}

function initScrollHints() {
  const hints = document.querySelectorAll('.scroll-hint, .scroll-hint-mobile');
  if (!hints.length) return;
  const update = () => {
    hints.forEach((hint) => {
      const hidden = hint.classList.contains('scroll-hint-mobile')
        ? window.scrollY > 50
        : document.documentElement.scrollHeight - (window.scrollY + window.innerHeight) < 150;
      hint.classList.toggle('hidden', hidden);
    });
  };
  update();
  window.addEventListener('scroll', update, { passive: true, signal: signal() });
  window.addEventListener('resize', update, { passive: true, signal: signal() });
}

async function initPage() {
  teardown();
  initCommon();
  initScrollHints();
  document.body.style.overflow = '';
  const page = document.getElementById('main')?.dataset.page;
  if (page === 'home') await initHome();
  else if (page === 'filmography') await initFilmography();
  else if (page === 'gallery') await initGallery();
  else if (page === 'contact') initContact();
  document.dispatchEvent(new CustomEvent('ying:warm-links'));
}

window.YingApp = { init: initPage, teardown, db, normalizeCategory };

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage, { once: true });
else initPage();
