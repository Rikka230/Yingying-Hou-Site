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

const icons = {
  sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
  moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
};

let commonReady = false;
let lastKeyHandler = null;
let galleryTimer = null;

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

function setThemeIcon() {
  const button = document.getElementById('theme-toggle-btn');
  if (!button) return;
  button.innerHTML = document.body.classList.contains('dark-mode') ? icons.sun : icons.moon;
}

function applyStoredTheme() {
  document.body.classList.toggle('dark-mode', localStorage.getItem('theme') === 'dark');
  document.documentElement.classList.remove('theme-dark-preload');
  setThemeIcon();
}

function updateActiveNav() {
  const path = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const href = new URL(link.getAttribute('href'), window.location.origin).pathname.replace(/\/index\.html$/, '/') || '/';
    const active = href === path || (path === '/' && href === '/');
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function initCommon() {
  applyStoredTheme();
  updateActiveNav();
  document.querySelectorAll('#year').forEach((year) => { year.textContent = new Date().getFullYear(); });

  if (commonReady) return;
  commonReady = true;

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

    const navLink = event.target.closest('.site-nav a');
    if (navLink) {
      document.getElementById('nav')?.classList.remove('open');
      document.querySelector('.nav-toggle')?.setAttribute('aria-expanded', 'false');
    }
  });
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
        if (cvDoc.exists() && cvDoc.data().publicUrl) {
          const link = document.getElementById('link-dl-cv');
          if (link) link.href = cvDoc.data().publicUrl;
        }
        const zcardDoc = await getDoc(doc(db, 'site_data', 'zcard_project'));
        if (zcardDoc.exists() && zcardDoc.data().publicUrl) {
          const link = document.getElementById('link-dl-zcard');
          if (link) link.href = zcardDoc.data().publicUrl;
        }
      } catch (error) {
        console.error('Erreur Press Kit :', error);
      }
      if (typeof modal.showModal === 'function') modal.showModal();
    };
  });
}

async function initHome() {
  initPresskit();
  initHomeRoles();
  initHomeVideos();
}

async function initHomeRoles() {
  const list = document.getElementById('home-roles-list');
  const prev = document.getElementById('btn-prev-roles');
  const next = document.getElementById('btn-next-roles');
  if (!list || !prev || !next) return;

  let currentPage = 0;
  const perPage = 7;

  function render(roles) {
    const start = currentPage * perPage;
    const pageRoles = roles.slice(start, start + perPage);
    list.innerHTML = '';

    if (!pageRoles.length) {
      list.innerHTML = '<li class="loading-line">Aucun rôle disponible.</li>';
    } else {
      pageRoles.forEach((role) => {
        const li = document.createElement('li');
        const year = role.annee ? ` ${role.annee}` : '';
        li.innerHTML = `<span class="role-heart">♥</span> ${role.titre || 'Rôle'} — <b>${role.projet || 'Projet'}</b> <span class="role-meta">(${normalizeCategory(role.type)}${year})</span>`;
        list.appendChild(li);
      });
    }

    prev.disabled = currentPage === 0;
    next.disabled = start + perPage >= roles.length;
  }

  try {
    const roles = sortRolesForDisplay(await getRoles());
    render(roles);
    prev.onclick = () => { if (currentPage > 0) { currentPage -= 1; render(roles); } };
    next.onclick = () => { if ((currentPage + 1) * perPage < roles.length) { currentPage += 1; render(roles); } };
  } catch (error) {
    console.error('Erreur rôles accueil :', error);
    list.innerHTML = '<li class="loading-line error-line">Erreur de chargement.</li>';
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
      const div = document.createElement('div');
      div.className = 'yt-item';
      div.innerHTML = `<iframe src="${data.url}" title="${data.titre || 'Vidéo'}" loading="lazy" allowfullscreen></iframe>`;
      slider.appendChild(div);
    });

    const scrollAmount = () => (slider.querySelector('.yt-item')?.offsetWidth || 320) + 16;
    if (next) next.onclick = () => slider.scrollBy({ left: scrollAmount(), behavior: 'smooth' });
    if (prev) prev.onclick = () => slider.scrollBy({ left: -scrollAmount(), behavior: 'smooth' });
  } catch (error) {
    console.error('Erreur vidéos :', error);
    slider.innerHTML = '<p class="loading-line error-line">Erreur de chargement.</p>';
  }
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
      const category = filter.value;
      if (category !== 'all' && normalizeCategory(role.type) !== normalizeCategory(category)) return false;
      if (!term) return true;
      return [role.projet, role.titre, role.realisateur, role.annee, role.type]
        .some((value) => normalizeText(value).includes(term));
    });

    rows.sort((a, b) => {
      const mode = sort.value;
      if (mode === 'custom') return sortRolesForDisplay([a, b])[0] === a ? -1 : 1;
      if (mode === 'year-desc') return (Number(b.annee) || 0) - (Number(a.annee) || 0);
      if (mode === 'year-asc') return (Number(a.annee) || 0) - (Number(b.annee) || 0);
      if (mode === 'title-asc') return (a.projet || '').localeCompare(b.projet || '', 'fr', { sensitivity: 'base' });
      if (mode === 'title-desc') return (b.projet || '').localeCompare(a.projet || '', 'fr', { sensitivity: 'base' });
      return 0;
    });

    if (!rows.length) {
      table.innerHTML = '<tr><td colspan="6" class="table-empty">Aucun résultat trouvé.</td></tr>';
      return;
    }

    table.innerHTML = rows.map((role) => {
      const link = role.lien ? `<a class="btn table-link" href="${role.lien}" target="_blank" rel="noopener">Voir</a>` : '<span class="muted">-</span>';
      return `<tr>
        <td data-label="Année">${role.annee || ''}</td>
        <td data-label="Projet / Titre"><strong>${role.projet || ''}</strong></td>
        <td data-label="Rôle">${role.titre || ''}</td>
        <td data-label="Réalisateur">${role.realisateur || '-'}</td>
        <td data-label="Catégorie"><span class="category-pill">${normalizeCategory(role.type)}</span></td>
        <td data-label="Lien">${link}</td>
      </tr>`;
    }).join('');
  }

  try {
    roles = sortRolesForDisplay(await getRoles());
    render();
    filter.onchange = render;
    sort.onchange = render;
    search.oninput = render;
  } catch (error) {
    console.error('Erreur filmographie :', error);
    table.innerHTML = '<tr><td colspan="6" class="table-empty error-line">Erreur de chargement.</td></tr>';
  }
}

async function initGallery() {
  const grid = document.getElementById('gallery');
  const lightbox = document.getElementById('lightbox');
  const lbImage = document.getElementById('lb-image');
  const lbCaption = document.getElementById('lb-caption');
  if (!grid || !lightbox || !lbImage || !lbCaption) return;

  document.body.style.overflow = '';
  if (lastKeyHandler) document.removeEventListener('keydown', lastKeyHandler);
  clearTimeout(galleryTimer);

  let allPhotos = [];
  let shownPhotos = [];
  let current = 0;

  const close = () => {
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  const open = (index) => {
    if (!shownPhotos.length) return;
    current = (index + shownPhotos.length) % shownPhotos.length;
    lbImage.src = shownPhotos[current].url;
    lbImage.alt = shownPhotos[current].caption || 'Photo de Yingying HOU';
    lbCaption.textContent = shownPhotos[current].caption || '';
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  function render(category = 'Tout') {
    grid.style.opacity = '0';
    galleryTimer = setTimeout(() => {
      shownPhotos = category === 'Tout' ? allPhotos : allPhotos.filter((photo) => photo.categorie === category);
      if (!shownPhotos.length) {
        grid.innerHTML = '<p class="loading-line">Aucune photo dans cette catégorie.</p>';
      } else {
        grid.innerHTML = shownPhotos.map((photo, index) => `
          <a href="${photo.url}" class="gallery-item" data-index="${index}">
            <img src="${photo.url}" alt="${photo.caption || 'Photo de Yingying HOU'}" loading="lazy" />
            <div class="item-overlay"><span>Agrandir</span></div>
          </a>`).join('');
      }
      grid.style.opacity = '1';
    }, 160);
  }

  grid.onclick = (event) => {
    const item = event.target.closest('.gallery-item');
    if (!item) return;
    event.preventDefault();
    open(Number(item.dataset.index) || 0);
  };

  lightbox.querySelector('.lb-close').onclick = close;
  lightbox.querySelector('.lb-next').onclick = () => open(current + 1);
  lightbox.querySelector('.lb-prev').onclick = () => open(current - 1);
  lightbox.onclick = (event) => { if (event.target === lightbox) close(); };
  lastKeyHandler = (event) => {
    if (lightbox.getAttribute('aria-hidden') === 'true') return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowRight') open(current + 1);
    if (event.key === 'ArrowLeft') open(current - 1);
  };
  document.addEventListener('keydown', lastKeyHandler);

  document.querySelectorAll('.filter-btn').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach((item) => item.classList.add('outline'));
      button.classList.remove('outline');
      render(button.dataset.filter || 'Tout');
    };
  });

  try {
    const q = query(collection(db, 'galerie'), orderBy('ordre', 'asc'));
    const snapshot = await getDocs(q);
    allPhotos = [];
    snapshot.forEach((item) => allPhotos.push(item.data()));
    render('Tout');
  } catch (error) {
    console.error('Erreur galerie :', error);
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
      if (status) {
        status.textContent = 'Champs à compléter : ' + errors.join(', ') + '.';
        status.className = 'form-status err';
      }
      return;
    }

    if (status) {
      status.textContent = 'Envoi en cours…';
      status.className = 'form-status';
    }
    submit?.setAttribute('disabled', 'disabled');
  };
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
}

async function initPage() {
  initCommon();
  initScrollHints();
  document.body.style.overflow = '';

  const page = document.getElementById('main')?.dataset.page;
  if (page === 'home') await initHome();
  if (page === 'filmography') await initFilmography();
  if (page === 'gallery') await initGallery();
  if (page === 'contact') initContact();
}

window.YingApp = { init: initPage, db, normalizeCategory };

document.addEventListener('DOMContentLoaded', () => {
  initPage();
});
