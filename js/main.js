// Utilitaires
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

// Année dynamique
document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
});

// Menu mobile
(function(){
  const btn = $('.nav-toggle');
  const nav = $('#nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();

// Filmographie: tri & filtre + dialog + recherche
(function(){
  const table = document.querySelector('#filmography');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const filterSel = document.querySelector('#filter-category');
  const sortSel = document.querySelector('#sort-by');
  const searchInput = document.querySelector('#search'); // Au cas où tu ajoutes une barre de recherche
  
  // On capture toutes les lignes existantes
  const rows = Array.from(tbody.querySelectorAll('tr'));

  function apply(){
    const cat = filterSel ? filterSel.value.toLowerCase() : 'all';
    const q = (searchInput?.value || '').trim().toLowerCase();
    const sort = sortSel ? sortSel.value : 'year-desc';

    // 1. On trie le tableau des lignes
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

    // 2. On applique les filtres et on réinjecte proprement dans le DOM
    rows.forEach(r => {
      const rowCat = (r.dataset.category || '').toLowerCase();
      const txt = r.textContent.toLowerCase();

      const okCat = (cat === 'all' || rowCat.includes(cat));
      const okSearch = (!q || txt.includes(q));

      // On cache ou on affiche selon le filtre
      r.style.display = (okCat && okSearch) ? '' : 'none';
      
      // On replace la ligne dans le tableau (cela modifie l'ordre d'affichage)
      tbody.appendChild(r);
    });
  }

  filterSel?.addEventListener('change', apply);
  sortSel?.addEventListener('change', apply);
  searchInput?.addEventListener('input', apply);
  
  // On lance le tri une première fois au chargement
  apply();

  // --- Dialog détails (Modale) ---
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
          poster.alt = 'Affiche — ' + (title?.textContent || '');
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
    } catch (err) {
      console.error("Format JSON invalide dans data-detail", err);
    }
  });

  closeBtn?.addEventListener('click', ()=> dialog?.close());
  dialog?.addEventListener('click', (e)=> { 
    // Ferme la modale si on clique à l'extérieur
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) dialog.close();
  });
})();

// Galerie: lightbox avec clavier + swipe
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
    img.alt = $('img', a).alt || 'Image';
    caption.textContent = a.dataset.caption || '';
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  }
  function close(){
    lb.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
  }
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

  let startX=0;
  lb.addEventListener('pointerdown', e=> startX = e.clientX);
  lb.addEventListener('pointerup', e=>{
    if (!startX) return;
    const dx = e.clientX - startX;
    if (dx > 40) prev();
    else if (dx < -40) next();
    startX = 0;
  });

  // Fermer en cliquant sur l'arrière-plan sombre
  lb.addEventListener('click', (e)=>{
    if (e.target === lb) close();
  });

})();

// Validation légère du formulaire Contact
(function () {
  const form = document.querySelector('#contactForm');
  if (!form) return;

  const status = document.querySelector('#formStatus');
  const submitBtn = form.querySelector('button[type="submit"]');
  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');

  form.addEventListener('submit', (e) => {
    // Honeypot anti-bot : si rempli, on annule en silence
    if (form.company && form.company.value.trim() !== '') {
      e.preventDefault();
      if (status) {
        status.textContent = 'Merci.';
        status.className = 'form-status ok';
      }
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
      // focus premier champ invalide
      (!name ? form.name : !email ? form.email : form.message)?.focus();
      return;
    }

    // OK : on laisse soumettre normalement
    if (status) {
      status.textContent = 'Envoi en cours…';
      status.className = 'form-status';
    }
    submitBtn?.setAttribute('disabled', 'disabled'); 
  });
})();

// Libellés pour l’affichage mobile de la filmographie (data-label)
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
// SLIDER YOUTUBE AUTOMATIQUE
// ==========================================
(function(){
  const slider = document.getElementById('ytSlider');
  if (!slider) return;
  
  let autoScrollInterval;

  // Fonction d'autoscroll fluide (1 pixel à la fois)
  function startAutoScroll() {
    autoScrollInterval = setInterval(() => {
      slider.scrollLeft += 1;
      
      // Si on arrive tout au bout, on revient au début
      if (slider.scrollLeft >= (slider.scrollWidth - slider.clientWidth - 1)) {
         slider.scrollLeft = 0;
      }
    }, 30); // Vitesse : plus le chiffre est bas, plus c'est rapide
  }

  function stopAutoScroll() {
    clearInterval(autoScrollInterval);
  }

  // On lance le slider au démarrage
  startAutoScroll();

  // On met en pause quand on survole pour pouvoir cliquer sur Play
  slider.addEventListener('mouseenter', stopAutoScroll);
  slider.addEventListener('mouseleave', startAutoScroll);
  
  // Pause aussi quand on touche sur mobile
  slider.addEventListener('touchstart', stopAutoScroll);
  slider.addEventListener('touchend', startAutoScroll);
})();
