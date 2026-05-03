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

let keyHandler = null;
let scrollController = null;
let roleState = null;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
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
  document.querySelectorAll('#year').forEach((item) => { item.textContent = new Date().getFullYear(); });
}

function teardown() {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = null;
  scrollController?.abort?.();
  scrollController = null;
  document.body.style.overflow = '';
  document.querySelectorAll('.video-lightbox[aria-hidden="false"]').forEach((modal) => modal.setAttribute('aria-hidden', 'true'));
}

async function initPresskit() {
  const modal = document.getElementById('presskitModal');
  if (!modal) return;
  const close = document.getElementById('btn-close-presskit');
  if (close) close.onclick = () => modal.close();

  document.querySelectorAll('.js-presskit').forEach((button) => {
    button.onclick = async () => {
      try {
        const cvDoc = await getDoc(doc(db, 'site_data', 'cv_project'));
        const cvLink = document.getElementById('link-dl-cv');
        if (cvLink && cvDoc.exists() && cvDoc.data().publicUrl) cvLink.href = cvDoc.data().publicUrl;
        const zcardDoc = await getDoc(doc(db, 'site_data', 'zcard_project'));
        const zcardLink = document.getElementById('link-dl-zcard');
        if (zcardLink && zcardDoc.exists() && zcardDoc.data().publicUrl) zcardLink.href = zcardDoc.data().publicUrl;
      } catch (error) {
        console.warn('Press kit non disponible :', error);
      }
      if (typeof modal.showModal === 'function') modal.showModal();
    };
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

  roleState = { page: 0, perPage: 7, roles: [] };

  function render() {
    const start = roleState.page * roleState.perPage;
    const pageRoles = roleState.roles.slice(start, start + roleState.perPage);
    list.innerHTML = pageRoles.length ? pageRoles.map((role) => {
      const year = role.annee ? ` ${escapeHtml(role.annee)}` : '';
      return `<li><span class="role-heart">♥</span> ${escapeHtml(role.titre || 'Rôle')} — <b>${escapeHtml(role.projet || 'Projet')}</b> <span class="role-meta">(${escapeHtml(normalizeCategory(role.type))}${year})</span></li>`;
    }).join('') : '<li class="loading-line">Aucun rôle disponible.</li>';

    prev.disabled = roleState.page === 0;
    next.disabled = start + roleState.perPage >= roleState.roles.length;
  }

  try {
    roleState.roles = await getRoles();
    render();
    prev.onclick = () => { if (roleState.page > 0) { roleState.page -= 1; render(); } };
    next.onclick = () => { if ((roleState.page + 1) * roleState.perPage < roleState.roles.length) { roleState.page += 1; render(); } };
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
        <button class="media-expand" type="button" data-video-src="${src}" data-video-title="${title}">Agrandir</button>
      `;
      slider.appendChild(card);
    });

    const scrollAmount = () => (slider.querySelector('.yt-item')?.offsetWidth || 320) + 16;
    if (next) next.onclick = () => slider.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    if (prev) prev.onclick = () => slider.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
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
      </div>
    `;
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

  modal.querySelectorAll('[data-video-close]').forEach((button) => { button.onclick = close; });
  document.querySelectorAll('.media-expand').forEach((button) => {
    button.onclick = () => {
      const src = button.dataset.videoSrc;
      if (!src || !frame) return;
      pauseMiniPlayers();
      modal.classList.remove('is-ready');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const autoplaySrc = buildPlayerUrl(src, true);
      frame.onload = () => window.setTimeout(() => modal.classList.add('is-ready'), 140);
      frame.src = autoplaySrc;
    };
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
    filter.onchange = render;
    sort.onchange = render;
    search.oninput = render;
  } catch (error) {
    console.warn('Filmographie indisponible :', error);
    table.innerHTML = '<tr><td colspan="6" class="table-empty error-line">Erreur de chargement.</td></tr>';
  }
}

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = url;
  });
}

async function initGallery() {
  const grid = document.getElementById('gallery');
  const lightbox = document.getElementById('lightbox');
  const figure = lightbox?.querySelector('.lb-figure');
  if (!grid || !lightbox || !figure) return;

  if (keyHandler) document.removeEventListener('keydown', keyHandler);

  let allPhotos = [];
  let shownPhotos = [];
  let current = 0;
  let sliding = false;
  let renderToken = 0;

  figure.innerHTML = `
    <div class="lb-viewport" aria-live="polite"></div>
    <figcaption id="lb-caption"></figcaption>
  `;
  const viewport = figure.querySelector('.lb-viewport');
  const caption = figure.querySelector('#lb-caption');

  function getPhotoUrl(photo) {
    return photo?.url || photo?.imageUrl || photo?.src || photo?.photoUrl || photo?.fullUrl || '';
  }

  function photoAt(index) {
    if (!shownPhotos.length) return null;
    return shownPhotos[(index + shownPhotos.length) % shownPhotos.length];
  }

  function setCaption(photo) {
    if (caption) caption.textContent = photo?.caption || '';
  }

  function makeImage(photo, className = 'lb-photo lb-current') {
    const img = document.createElement('img');
    img.className = className;
    img.alt = photo?.caption || 'Photo de Yingying HOU';
    img.draggable = false;
    img.decoding = 'async';
    img.src = getPhotoUrl(photo);
    return img;
  }

  function preloadNeighbors(index) {
    [index - 1, index, index + 1].forEach((i) => {
      const photo = photoAt(i);
      const url = getPhotoUrl(photo);
      if (url) preloadImage(url);
    });
  }

  function renderCurrent(index) {
    if (!shownPhotos.length || !viewport) return;
    current = (index + shownPhotos.length) % shownPhotos.length;
    const active = photoAt(current);
    viewport.innerHTML = '';
    viewport.appendChild(makeImage(active, 'lb-photo lb-current'));
    setCaption(active);
    preloadNeighbors(current);
  }

  function open(index) {
    if (!shownPhotos.length) return;
    renderCurrent(index);
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    sliding = false;
    viewport?.classList.remove('slide-next', 'slide-prev', 'is-sliding');
  }

  async function go(delta) {
    if (sliding || !shownPhotos.length || !viewport) return;
    const target = (current + delta + shownPhotos.length) % shownPhotos.length;
    const activePhoto = photoAt(current);
    const targetPhoto = photoAt(target);
    const targetUrl = getPhotoUrl(targetPhoto);
    if (!targetUrl) return;

    sliding = true;
    await preloadImage(targetUrl);

    viewport.classList.remove('slide-next', 'slide-prev', 'is-sliding');
    viewport.innerHTML = '';
    const currentImg = makeImage(activePhoto, 'lb-photo lb-current');
    const incomingImg = makeImage(targetPhoto, 'lb-photo lb-incoming');
    viewport.append(currentImg, incomingImg);
    setCaption(targetPhoto);

    const directionClass = delta > 0 ? 'slide-next' : 'slide-prev';
    viewport.classList.add(directionClass);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => viewport.classList.add('is-sliding'));
    });

    const finish = () => {
      viewport.removeEventListener('transitionend', finish);
      current = target;
      renderCurrent(current);
      viewport.classList.remove(directionClass, 'is-sliding');
      sliding = false;
    };

    viewport.addEventListener('transitionend', finish, { once: true });
    setTimeout(() => { if (sliding) finish(); }, 680);
  }

  async function loadAndRender(category = 'Tout') {
    const token = ++renderToken;
    grid.classList.remove('is-ready');
    grid.classList.add('is-loading');
    grid.innerHTML = `<div class="gallery-loader" role="status" aria-live="polite"><span class="gallery-spinner" aria-hidden="true"></span><strong>Chargement de la galerie</strong><em>Préparation des images…</em></div>`;

    shownPhotos = category === 'Tout' ? allPhotos : allPhotos.filter((photo) => photo.categorie === category);
    await Promise.race([
      Promise.allSettled(shownPhotos.map((photo) => preloadImage(getPhotoUrl(photo)))),
      new Promise((resolve) => setTimeout(resolve, 5200))
    ]);
    if (token !== renderToken) return;

    if (!shownPhotos.length) {
      grid.innerHTML = '<p class="loading-line">Aucune photo dans cette catégorie.</p>';
    } else {
      grid.innerHTML = shownPhotos.map((photo, index) => {
        const url = getPhotoUrl(photo);
        return `<a href="${escapeHtml(url)}" class="gallery-item" data-index="${index}" style="--stagger:${Math.min(index, 20) * 45}ms">
          <img src="${escapeHtml(url)}" alt="${escapeHtml(photo.caption || 'Photo de Yingying HOU')}" loading="eager" decoding="async" />
          <div class="item-overlay"><span>Agrandir</span></div>
        </a>`;
      }).join('');
    }

    grid.classList.remove('is-loading');
    requestAnimationFrame(() => grid.classList.add('is-ready'));
  }

  grid.onclick = (event) => {
    const item = event.target.closest('.gallery-item');
    if (!item) return;
    event.preventDefault();
    const index = Number(item.dataset.index) || 0;
    open(index);
  };

  lightbox.querySelector('.lb-close')?.addEventListener('click', close);
  lightbox.querySelector('.lb-next')?.addEventListener('click', () => go(1));
  lightbox.querySelector('.lb-prev')?.addEventListener('click', () => go(-1));
  lightbox.onclick = (event) => { if (event.target === lightbox) close(); };

  keyHandler = (event) => {
    if (lightbox.getAttribute('aria-hidden') === 'true') return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') go(1);
    if (event.key === 'ArrowLeft') go(-1);
  };
  document.addEventListener('keydown', keyHandler);

  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach((item) => item.classList.add('outline'));
      button.classList.remove('outline');
      loadAndRender(button.dataset.filter || 'Tout');
    };
  });

  try {
    grid.classList.add('is-loading');
    grid.innerHTML = `<div class="gallery-loader" role="status" aria-live="polite"><span class="gallery-spinner" aria-hidden="true"></span><strong>Chargement de la galerie</strong><em>Récupération des photos…</em></div>`;
    const q = query(collection(db, 'galerie'), orderBy('ordre', 'asc'));
    const snapshot = await getDocs(q);
    allPhotos = [];
    snapshot.forEach((item) => allPhotos.push(item.data()));
    await loadAndRender('Tout');
  } catch (error) {
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

  form.onsubmit = (event) => {
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
  };
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

async function initPage() {
  initCommon();
  initScrollHints();
  document.body.style.overflow = '';
  const page = document.getElementById('main')?.dataset.page;
  try {
    if (page === 'home') await initHome();
    else if (page === 'filmography') await initFilmography();
    else if (page === 'gallery') await initGallery();
    else if (page === 'contact') initContact();
  } catch (error) {
    console.warn('Initialisation page interrompue sans bloquer PJAX :', error);
  } finally {
    window.YingNav?.updateActiveNav?.();
  }
}

window.YingApp = { init: initPage, teardown, db, normalizeCategory, updateActiveNav: () => window.YingNav?.updateActiveNav?.(), ensureUnifiedHeader: () => window.YingNav?.init?.() };

document.addEventListener('DOMContentLoaded', () => initPage());
