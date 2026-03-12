// ==========================================
// 1. UTILITAIRES & MENU MOBILE
// ==========================================
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
});

(function(){
  const btn = $('.nav-toggle');
  const nav = $('#nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();

// ==========================================
// 2. FILMOGRAPHIE (Filtres, Tri & Modale)
// ==========================================
(function(){
  const table = document.querySelector('#filmography');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const filterSel = document.querySelector('#filter-category');
  const sortSel = document.querySelector('#sort-by');
  const rows = Array.from(tbody.querySelectorAll('tr'));

  function apply(){
    const cat = filterSel ? filterSel.value.toLowerCase() : 'all';
    const sort = sortSel ? sortSel.value : 'year-desc';

    rows.sort((a,b) => {
      const yearA = parseInt(a.dataset.year) || 0;
      const yearB = parseInt(b.dataset.year) || 0;
      const titleA = (a.dataset.title || '').toLowerCase();
      const titleB = (b.dataset.title || '').toLowerCase();

      if (sort === 'year-desc') return yearB - yearA;
      if (sort === 'year-asc') return yearA - yearB;
      if (sort === 'title-asc') return titleA.localeCompare(titleB);
      if (sort === 'title-desc') return titleB.localeCompare(titleA);
      return 0;
    });

    rows.forEach(r => {
      const rowCat = (r.dataset.category || '').toLowerCase();
      r.style.display = (cat === 'all' || rowCat.includes(cat)) ? '' : 'none';
      tbody.appendChild(r);
    });
  }

  filterSel?.addEventListener('change', apply);
  sortSel?.addEventListener('change', apply);
  apply();

  // Modale détails
  const dialog = document.querySelector('#detailDialog');
  const closeBtn = dialog?.querySelector('.dialog-close');
  const poster = dialog?.querySelector('#detailPoster');
  const syn = dialog?.querySelector('#detailSynopsis');
  const title = dialog?.querySelector('#detailTitle');
  const imdb = dialog?.querySelector('#detailImdb');

  tbody.addEventListener('click', (e)=>{
    const a = e.target.closest('a[data-detail]');
    if (!a) return;
    e.preventDefault();
    const tr = a.closest('tr');
    
    try {
      const detail = JSON.parse(a.dataset.detail || '{}');
      if(title) title.textContent = tr.dataset.title || '';
      if(syn) syn.textContent = detail.synopsis || '';
      
      if(poster) {
        if(detail.affiche) {
          poster.src = detail.affiche;
          poster.style.display = 'block';
        } else {
          poster.style.display = 'none';
        }
      }
      
      if(imdb) {
        if(detail.imdb) {
          imdb.href = detail.imdb;
          imdb.style.display = 'inline-block';
        } else {
          imdb.style.display = 'none';
        }
      }
      dialog?.showModal();
    } catch (err) { console.error("Erreur JSON", err); }
  });

  closeBtn?.addEventListener('click', ()=> dialog?.close());
  dialog?.addEventListener('click', (e)=> { 
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) dialog.close();
  });
})();

// ==========================================
// 3. GALERIE (Lightbox / Zoom)
// ==========================================
(function(){
  const gallery = $('#gallery');
  const lb = $('#lightbox');
  if (!gallery || !lb) return;

  const img = $('#lb-image', lb);
  const caption = $('#lb-caption', lb);
  const btnPrev = $('.lb-prev', lb);
  const btnNext = $('.lb-next', lb);
  const btnClose = $('.lb-close', lb);
  const items = $$('#gallery a');
  let index = 0;

  function open(i){
    index = (i+items.length)%items.length;
    const a = items[index];
    img.src = a.getAttribute('href');
    caption.textContent = a.dataset.caption || '';
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function close(){ lb.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
  function next(){ open(index+1) }
  function prev(){ open(index-1) }

  gallery.addEventListener('click', (e)=>{
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    open(items.indexOf(a));
  });
  btnClose.addEventListener('click', close);
  btnNext.addEventListener('click', next);
  btnPrev.addEventListener('click', prev);

  document.addEventListener('keydown', (e)=>{
    if (lb.getAttribute('aria-hidden') === 'true') return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  lb.addEventListener('click', (e)=>{ if (e.target === lb) close(); });
})();

// ==========================================
// 4. ONGLETS INTELLIGENTS (Rôles & Récompenses)
// ==========================================
(function(){
  function setupTabs(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const paginationContainer = container.querySelector('.role-pagination');
    const tabBtns = container.querySelectorAll('.role-tab-btn');
    const pages = container.querySelectorAll('.role-page');
    
    if (!tabBtns.length || !pages.length || !paginationContainer) return;

    let activePagesCount = 0;

    pages.forEach((page, index) => {
      const itemsCount = page.querySelectorAll('li').length;
      const btn = tabBtns[index];
      
      if (itemsCount === 0 && btn) {
        btn.style.display = 'none'; 
      } else if (itemsCount > 0) {
        activePagesCount++;
      }
    });

    if (activePagesCount <= 1) {
      paginationContainer.style.display = 'none';
    }

    tabBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        if(pages[index]) {
          pages[index].classList.add('active');
        }
      });
    });
  }

  setupTabs('.bento-roles');
  setupTabs('.bento-awards');
})();

// ==========================================
// 5. SLIDER YOUTUBE (Rotation + Flèches)
// ==========================================
(function(){
  const slider = document.getElementById('ytSlider');
  if (!slider) return;
  
  const prevBtn = document.querySelector('.prev-btn');
  const nextBtn = document.querySelector('.next-btn');
  let autoScrollInterval;
  let isVideoPlayingOrInteracted = false; 

  function getItemWidth() {
    const item = slider.querySelector('.yt-item');
    return item ? item.offsetWidth + 16 : 0; 
  }

  function scrollToNext() {
    const itemWidth = getItemWidth();
    const maxScroll = slider.scrollWidth - slider.clientWidth;
    if (slider.scrollLeft >= maxScroll - 10) {
       slider.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
       slider.scrollTo({ left: slider.scrollLeft + itemWidth, behavior: 'smooth' });
    }
  }

  function scrollToPrev() {
    const itemWidth = getItemWidth();
    if (slider.scrollLeft <= 0) {
       slider.scrollTo({ left: slider.scrollWidth, behavior: 'smooth' });
    } else {
       slider.scrollTo({ left: slider.scrollLeft - itemWidth, behavior: 'smooth' });
    }
  }

  function startAutoScroll() {
    if (isVideoPlayingOrInteracted) return;
    autoScrollInterval = setInterval(() => {
      if (!isVideoPlayingOrInteracted) scrollToNext();
    }, 3500);
  }

  function stopAutoScroll() { clearInterval(autoScrollInterval); }

  function handleManualNav(direction) {
    isVideoPlayingOrInteracted = true; 
    stopAutoScroll();
    if (direction === 'next') scrollToNext();
    else scrollToPrev();
  }

  if (nextBtn) nextBtn.addEventListener('click', () => handleManualNav('next'));
  if (prevBtn) prevBtn.addEventListener('click', () => handleManualNav('prev'));

  window.addEventListener('blur', () => {
    if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
      isVideoPlayingOrInteracted = true;
      stopAutoScroll();
    }
  });

  slider.addEventListener('mouseenter', stopAutoScroll);
  slider.addEventListener('mouseleave', () => { if (!isVideoPlayingOrInteracted) startAutoScroll(); });
  slider.addEventListener('touchstart', stopAutoScroll, {passive: true});
  slider.addEventListener('touchend', () => { if (!isVideoPlayingOrInteracted) startAutoScroll(); });

  startAutoScroll();
})();

// ==========================================
// 6. FORMULAIRE CONTACT
// ==========================================
(function () {
  const form = document.querySelector('#contactForm');
  if (!form) return;

  const status = document.querySelector('#formStatus');
  const submitBtn = form.querySelector('button[type="submit"]');
  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');

  form.addEventListener('submit', (e) => {
    if (form.company && form.company.value.trim() !== '') {
      e.preventDefault();
      if (status) { status.textContent = 'Merci.'; status.className = 'form-status ok'; }
      return;
    }

    const name = form.name?.value.trim();
    const email = form.email?.value.trim();
    const message = form.message?.value.trim();
    const errors = [];
    if (!name) errors.push('Nom');
    if (!email || !isEmail(email)) errors.push('Email');
    if (!message) errors.push('Message');

    if (errors.length) {
      e.preventDefault(); 
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
    submitBtn?.setAttribute('disabled', 'disabled'); 
  });
})();

// ==========================================
// 7. LIBELLÉS MOBILE FILMOGRAPHIE
// ==========================================
(function(){
  const table = document.querySelector('#filmography');
  if (!table) return;
  const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tbody tr'));
  rows.forEach(tr => {
    Array.from(tr.children).forEach((td, i) => {
      td.setAttribute('data-label', headers[i] || '');
    });
  });
})();

// ==========================================
// GESTION DES INDICATEURS DE SCROLL (PC & Mobile)
// ==========================================
(function(){
  const hints = document.querySelectorAll('.scroll-hint, .scroll-hint-mobile');
  if (!hints.length) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    hints.forEach(hint => {
      if (hint.classList.contains('scroll-hint-mobile')) {
        if (scrollY > 50) hint.classList.add('hidden');
        else hint.classList.remove('hidden');
      } 
      else {
        const distanceToBottom = document.documentElement.scrollHeight - (scrollY + window.innerHeight);
        if (distanceToBottom < 150) hint.classList.add('hidden');
        else hint.classList.remove('hidden');
      }
    });
  }, { passive: true });
})();

// ==========================================
// TRANSITIONS DE PAGE FLUIDES
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const liensInternes = document.querySelectorAll('a[href$=".html"], a[href="/"]');
  
  liensInternes.forEach(lien => {
    lien.addEventListener('click', function(e) {
      if (
        this.target === '_blank' || 
        e.ctrlKey || 
        e.metaKey || 
        this.href.includes('.pdf') ||
        this.href.includes('#')
      ) return;
      
      if (this.hostname === window.location.hostname) {
        e.preventDefault(); 
        const destination = this.href;
        
        document.body.classList.add('page-exit');
        
        setTimeout(() => {
          window.location.href = destination;
        }, 350);
      }
    });
  });
});

// ==========================================
// DARK MODE - VERSION MODERNE & CORRIGÉE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  
  if (themeToggleBtn) {
    const currentTheme = localStorage.getItem('theme');
    
    if (currentTheme === 'dark') {
      document.body.classList.add('dark-mode');
    }

    const updateIcon = () => {
      if (document.body.classList.contains('dark-mode')) {
        themeToggleBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
      } else {
        themeToggleBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      }
    };

    updateIcon(); 

    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
      updateIcon();
    });
  }
});

// ==========================================
// MODALE PRESS KIT & FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_Yvi_u5WixeTxuuEORgwFtxksAm7OUY4",
  authDomain: "kukyying-f1c95.firebaseapp.com",
  projectId: "kukyying-f1c95",
  storageBucket: "kukyying-f1c95.firebasestorage.app",
  messagingSenderId: "681899915263",
  appId: "1:681899915263:web:4d64dcf4a9c57748ead9ca"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const modal = document.getElementById('presskitModal');
const btnOpenPresskit = document.getElementById('btn-open-presskit');
const btnClosePresskit = document.getElementById('btn-close-presskit');

if (btnOpenPresskit && modal) {
  btnOpenPresskit.addEventListener('click', async () => {
      modal.showModal();
      
      try {
          const cvDoc = await getDoc(doc(db, "site_data", "cv_project"));
          if (cvDoc.exists() && cvDoc.data().publicUrl) {
              document.getElementById('link-dl-cv').href = cvDoc.data().publicUrl;
          }
          
          const zcardDoc = await getDoc(doc(db, "site_data", "zcard_project"));
          if (zcardDoc.exists() && zcardDoc.data().publicUrl) {
              document.getElementById('link-dl-zcard').href = zcardDoc.data().publicUrl;
          }
      } catch(e) { console.error("Erreur récupération liens Press Kit:", e); }
  });
}

if (btnClosePresskit && modal) {
  btnClosePresskit.addEventListener('click', () => modal.close());
}
