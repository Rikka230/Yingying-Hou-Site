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
})();

// Contact: validation & honeypot (remplace par ton back)
// Contact: validation & honeypot (modern status)
(function(){
  const form = document.querySelector('#contactForm');
  if (!form) return;
  const status = document.querySelector('#formStatus');

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();

    // anti-bot
    if (form.company && form.company.value.trim() !== '') {
      status.textContent = 'Merci.'; status.className = 'form-status ok';
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const required = ['name','email','message'];
    const missing = required.some(k => !data[k] || !String(data[k]).trim());

    if (missing){
      status.textContent = 'Veuillez remplir les champs requis.'; 
      status.className = 'form-status err';
      return;
    }

    // TODO: remplacer par un POST réel vers votre backend
    status.textContent = 'Message envoyé (démo).';
    status.className = 'form-status ok';
    form.reset();
  });
})();

