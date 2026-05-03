const mainSelector = '#main';
let isLoading = false;

function isEligibleLink(anchor, event) {
  if (!anchor || !anchor.href) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return false;
  if (url.hash && url.pathname === window.location.pathname) return false;
  if (/\.(pdf|jpg|jpeg|png|webp|gif|mp4|zip)$/i.test(url.pathname)) return false;
  if (url.pathname.includes('admin.html') || url.pathname.includes('cv-photo.html') || url.pathname.includes('cv-auto.html')) return false;
  return url.pathname === '/' || url.pathname.endsWith('.html');
}

function updateHead(doc) {
  document.title = doc.title || document.title;

  const nextDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content');
  let currentDescription = document.querySelector('meta[name="description"]');
  if (nextDescription) {
    if (!currentDescription) {
      currentDescription = document.createElement('meta');
      currentDescription.setAttribute('name', 'description');
      document.head.appendChild(currentDescription);
    }
    currentDescription.setAttribute('content', nextDescription);
  }

  ['og:title', 'og:description', 'og:url', 'og:image'].forEach((property) => {
    const next = doc.querySelector(`meta[property="${property}"]`)?.getAttribute('content');
    const current = document.querySelector(`meta[property="${property}"]`);
    if (next && current) current.setAttribute('content', next);
  });
}

function updateBodyClass(doc) {
  const dark = document.body.classList.contains('dark-mode');
  document.body.className = doc.body.className || '';
  if (dark) document.body.classList.add('dark-mode');
}

async function navigate(url, push = true) {
  if (isLoading) return;
  isLoading = true;
  document.documentElement.classList.add('is-pjax-loading');

  try {
    const response = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nextMain = doc.querySelector(mainSelector);
    const currentMain = document.querySelector(mainSelector);
    if (!nextMain || !currentMain) throw new Error('Contenu principal introuvable');

    updateHead(doc);
    updateBodyClass(doc);
    currentMain.replaceWith(nextMain);
    if (push) history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'auto' });
    await window.YingApp?.init?.();
  } catch (error) {
    console.warn('Navigation PJAX interrompue, fallback classique :', error);
    window.location.href = url;
  } finally {
    document.documentElement.classList.remove('is-pjax-loading');
    isLoading = false;
  }
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a');
  if (!isEligibleLink(anchor, event)) return;
  event.preventDefault();
  navigate(anchor.href);
});

window.addEventListener('popstate', () => navigate(window.location.href, false));
