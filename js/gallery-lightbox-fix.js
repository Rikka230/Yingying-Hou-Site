const STYLE_ID = 'gallery-lightbox-fix-style';
let currentIndex = 0;
let isMoving = false;
let viewer = null;
let stage = null;
let caption = null;
let activeItems = [];
const preloaded = new Set();

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .photo-viewer-fixed{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;opacity:0;pointer-events:none;background:transparent;transition:opacity .22s ease;overflow:hidden}
    .photo-viewer-fixed[aria-hidden="false"]{opacity:1;pointer-events:auto}
    .photo-viewer-fixed__backdrop{position:absolute;inset:0;background:rgba(255,255,255,.985);backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    body.dark-mode .photo-viewer-fixed__backdrop,html.theme-dark .photo-viewer-fixed__backdrop{background:rgba(10,12,16,.975)}
    .photo-viewer-fixed__stage{position:relative;z-index:2;width:min(1180px,90vw);height:min(780px,74vh);overflow:visible;pointer-events:none;contain:layout style}
    .photo-viewer-fixed__card{position:absolute;inset:0;margin:0;display:flex;align-items:center;justify-content:center;padding:clamp(14px,1.8vw,26px);opacity:1;transform:translate3d(0,0,0);transition:transform .54s cubic-bezier(.22,1,.36,1),opacity .54s ease;will-change:transform,opacity}
    .photo-viewer-fixed__card img{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;border-radius:24px;border:8px solid #fff;background:#fff;box-shadow:none;user-select:none;-webkit-user-drag:none;pointer-events:auto}
    .photo-viewer-fixed__card.is-entering-right{transform:translate3d(112%,0,0);opacity:.98}
    .photo-viewer-fixed__card.is-entering-left{transform:translate3d(-112%,0,0);opacity:.98}
    .photo-viewer-fixed__card.is-current{transform:translate3d(0,0,0);opacity:1}
    .photo-viewer-fixed__card.is-exiting-left{transform:translate3d(-112%,0,0);opacity:.72}
    .photo-viewer-fixed__card.is-exiting-right{transform:translate3d(112%,0,0);opacity:.72}
    .photo-viewer-fixed__caption{position:fixed;z-index:3;left:50%;bottom:clamp(18px,3vh,36px);transform:translateX(-50%);width:min(720px,78vw);margin:0;color:var(--text);font-weight:800;text-align:center;min-height:22px}
    .photo-viewer-fixed__close,.photo-viewer-fixed__nav{position:fixed;z-index:100002;display:inline-grid;place-items:center;width:46px;height:46px;min-width:46px;padding:0;border-radius:999px;border:1px solid rgba(17,19,24,.12);background:#fff;color:#111318;box-shadow:0 14px 38px rgba(17,19,24,.14);font:inherit;font-size:24px;font-weight:800;line-height:1;cursor:pointer;transform:none;animation:none;transition:background .18s ease,color .18s ease,border-color .18s ease}
    .photo-viewer-fixed__close{top:88px;right:clamp(18px,4vw,42px);font-size:18px}
    .photo-viewer-fixed__prev{left:clamp(18px,4vw,42px);top:50%;transform:translateY(-50%)}
    .photo-viewer-fixed__next{right:clamp(18px,4vw,42px);top:50%;transform:translateY(-50%)}
    .photo-viewer-fixed__close:hover,.photo-viewer-fixed__nav:hover{background:var(--yellow);color:#111318}
    .photo-viewer-fixed__prev:hover,.photo-viewer-fixed__next:hover{transform:translateY(-50%)}
    @media(max-width:760px){.photo-viewer-fixed__stage{width:100vw;height:72vh}.photo-viewer-fixed__card{padding:10px}.photo-viewer-fixed__card img{border-width:4px;border-radius:16px}.photo-viewer-fixed__close{top:82px;right:14px}.photo-viewer-fixed__prev{left:12px}.photo-viewer-fixed__next{right:12px}.photo-viewer-fixed__caption{bottom:14px;font-size:13px}}
    @media(prefers-reduced-motion:reduce){.photo-viewer-fixed,.photo-viewer-fixed__card,.photo-viewer-fixed__nav,.photo-viewer-fixed__close{transition:none!important;animation:none!important}}
  `;
  document.head.appendChild(style);
}

function preload(url) {
  if (!url || preloaded.has(url)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { preloaded.add(url); resolve(true); };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function getItems() {
  return Array.from(document.querySelectorAll('#gallery .gallery-item')).map((item) => {
    const img = item.querySelector('img');
    return { url: item.getAttribute('href') || img?.src || '', caption: img?.alt || '' };
  }).filter((item) => item.url);
}

function safeIndex(index) {
  if (!activeItems.length) return 0;
  return (index + activeItems.length) % activeItems.length;
}

function createCard(item, stateClass = 'is-current') {
  const figure = document.createElement('figure');
  figure.className = `photo-viewer-fixed__card ${stateClass}`.trim();
  const img = document.createElement('img');
  img.src = item?.url || '';
  img.alt = item?.caption || 'Photo de Yingying HOU';
  img.draggable = false;
  figure.appendChild(img);
  return figure;
}

function prime(index) {
  [index - 1, index, index + 1].forEach((i) => preload(activeItems[safeIndex(i)]?.url));
}

function ensureViewer() {
  ensureStyle();
  if (viewer?.isConnected) return viewer;
  viewer = document.createElement('div');
  viewer.className = 'photo-viewer-fixed';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-hidden', 'true');
  viewer.innerHTML = `
    <div class="photo-viewer-fixed__backdrop" data-gallery-fix-close></div>
    <button class="photo-viewer-fixed__close" type="button" data-gallery-fix-close aria-label="Fermer">✕</button>
    <button class="photo-viewer-fixed__nav photo-viewer-fixed__prev" type="button" aria-label="Photo précédente">‹</button>
    <div class="photo-viewer-fixed__stage" role="document" aria-live="polite"></div>
    <button class="photo-viewer-fixed__nav photo-viewer-fixed__next" type="button" aria-label="Photo suivante">›</button>
    <p class="photo-viewer-fixed__caption"></p>`;
  document.body.appendChild(viewer);
  stage = viewer.querySelector('.photo-viewer-fixed__stage');
  caption = viewer.querySelector('.photo-viewer-fixed__caption');
  viewer.querySelector('.photo-viewer-fixed__prev')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); go(-1); });
  viewer.querySelector('.photo-viewer-fixed__next')?.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); go(1); });
  viewer.addEventListener('click', (event) => { if (event.target.matches('[data-gallery-fix-close]')) closeViewer(); });
  return viewer;
}

async function openViewer(index) {
  activeItems = getItems();
  if (!activeItems.length) return;
  currentIndex = safeIndex(index);
  ensureViewer();
  await preload(activeItems[currentIndex]?.url);
  stage.innerHTML = '';
  stage.appendChild(createCard(activeItems[currentIndex], 'is-current'));
  caption.textContent = activeItems[currentIndex]?.caption || '';
  prime(currentIndex);
  isMoving = false;
  viewer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeViewer() {
  isMoving = false;
  if (viewer) viewer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (stage) stage.innerHTML = '';
}

async function go(delta) {
  if (isMoving || !activeItems.length || viewer?.getAttribute('aria-hidden') === 'true') return;
  isMoving = true;
  const targetIndex = safeIndex(currentIndex + delta);
  await preload(activeItems[targetIndex]?.url);
  if (!viewer || viewer.getAttribute('aria-hidden') === 'true') { isMoving = false; return; }
  const outgoing = stage.querySelector('.photo-viewer-fixed__card.is-current') || createCard(activeItems[currentIndex], 'is-current');
  if (!outgoing.isConnected) stage.appendChild(outgoing);
  const incoming = createCard(activeItems[targetIndex], delta > 0 ? 'is-entering-right' : 'is-entering-left');
  stage.appendChild(incoming);
  caption.textContent = activeItems[targetIndex]?.caption || '';
  prime(targetIndex);
  incoming.offsetHeight;
  requestAnimationFrame(() => {
    outgoing.classList.add(delta > 0 ? 'is-exiting-left' : 'is-exiting-right');
    incoming.classList.remove('is-entering-right', 'is-entering-left');
    incoming.classList.add('is-current');
  });
  let finished = false;
  const finish = () => {
    if (finished || !viewer || viewer.getAttribute('aria-hidden') === 'true') return;
    finished = true;
    currentIndex = targetIndex;
    stage.innerHTML = '';
    stage.appendChild(createCard(activeItems[currentIndex], 'is-current'));
    caption.textContent = activeItems[currentIndex]?.caption || '';
    prime(currentIndex);
    isMoving = false;
  };
  incoming.addEventListener('transitionend', finish, { once: true });
  window.setTimeout(finish, 700);
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const item = target?.closest('#gallery .gallery-item');
  if (!item) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  const items = Array.from(document.querySelectorAll('#gallery .gallery-item'));
  openViewer(Math.max(0, items.indexOf(item)));
}, true);

document.addEventListener('keydown', (event) => {
  if (!viewer || viewer.getAttribute('aria-hidden') === 'true') return;
  if (event.key === 'Escape') closeViewer();
  if (event.key === 'ArrowLeft') go(-1);
  if (event.key === 'ArrowRight') go(1);
});

document.addEventListener('ying:pagechange', () => {
  if (!document.querySelector('#gallery')) closeViewer();
});
