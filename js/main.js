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

  const tbody = table.tBodies[0];
  const filterSel = document.querySelector('#filter-category');
  const sortSel = document.querySelector('#sort-by');
  const searchInput = document.querySelector('#search');
  const rows = Array.from(tbody.rows);

  function apply(){
    const cat = filterSel ? filterSel.value : 'all';
    const q = (searchInput?.value || '').trim().toLowerCase();

    let visible = rows.filter(r => {
      const okCat = (cat === 'all' || r.dataset.category === cat);
      if (!okCat) return false;
      if (!q) return true;
      const txt = r.textContent.toLowerCase();
      return txt.includes(q);
    });

    // Sort
    const sort = sortSel ? sortSel.value : 'year-desc';
    visible.sort((a,b)=>{
      if (sort === 'year-desc') return (+b.dataset.year) - (+a.dataset.year);
      if (sort === 'year-asc') return (+a.dataset.year) - (+b.dataset.year);
      if (sort === 'title-asc') return a.dataset.title.localeCompare(b.dataset.title);
      if (sort === 'title-desc') return b.dataset.title.localeCompare(a.dataset.title);
      return 0;
    });

    // Render
    tbody.innerHTML = '';
    visible.forEach(r => tbody.appendChild(r));
  }

  filterSel?.addEventListener('change', apply);
  sortSel?.addEventListener('change', apply);
  searchInput?.addEventListener('input', apply);
  apply();

  // Dialog détails
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
    const detail = JSON.parse(a.dataset.detail || '{}');
    title.textContent = tr.cells[1].textContent;
    syn.textContent = detail.synopsis || '';
    poster.src = detail.affiche || '';
    poster.alt = 'Affiche — ' + title.textContent;
    imdb.href = detail.imdb || '#';
    dialog.showModal();
  });
  closeBtn?.addEventListener('click', ()=> dialog.close());
  dialog?.addEventListener('click', (e)=> { if (e.target === dialog) dialog.close(); });
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

  // ... (dans l'IIFE Galerie existante)
  // Fermer en cliquant sur l'arrière-plan sombre
  lb.addEventListener('click', (e)=>{
    // si on clique sur la zone noire (ni l'image ni les boutons)
    if (e.target === lb) close();
  });

})();

// Validation légère du formulaire Contact :
// - bloque uniquement si champs manquants / email invalide
// - sinon, laisse le navigateur POSTer (Netlify, FormSubmit, etc.)
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
    const subject = form.subject?.value.trim(); // facultatif

    const errors = [];
    if (!name) errors.push('Nom');
    if (!email || !isEmail(email)) errors.push('Email');
    if (!message) errors.push('Message');

    if (errors.length) {
      e.preventDefault(); // on bloque uniquement en cas d’erreur
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
    submitBtn?.setAttribute('disabled', 'disabled'); // anti double-clic
  });
})();





// Ajoute les "data-label" (libellés) aux cellules de la filmographie pour l'affichage mobile
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

// Libellés pour l’affichage mobile de la filmographie
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

<script>
document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("table");
  const rows = table.querySelectorAll("tbody tr");

  // FILTRAGE par catégorie
  const filterSelect = document.querySelector("#filterCategory");
  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      const value = filterSelect.value;
      rows.forEach(row => {
        if (value === "all" || row.dataset.category === value) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  }

  // TRI par année
  const sortButton = document.querySelector("#sortYear");
  if (sortButton) {
    sortButton.addEventListener("click", () => {
      const tbody = table.querySelector("tbody");
      const sorted = [...rows].sort((a, b) => b.dataset.year - a.dataset.year);
      tbody.innerHTML = "";
      sorted.forEach(r => tbody.appendChild(r));
    });
  }
});
</script>
