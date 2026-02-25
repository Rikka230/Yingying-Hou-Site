document.addEventListener('DOMContentLoaded', () => {
  // 1. GESTION DU MENU MOBILE
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !isExpanded);
      nav.classList.toggle('is-open');
    });
  }

  // 2. MISE À JOUR DE L'ANNÉE DANS LE FOOTER
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // 3. FONCTIONNEMENT DU TRI ET FILTRE (FILMOGRAPHIE)
  const filterSelect = document.getElementById('filter-category');
  const sortSelect = document.getElementById('sort-by');
  const tbody = document.querySelector('#filmography tbody');

  if (filterSelect && sortSelect && tbody) {
    // On sauvegarde toutes les lignes du tableau au chargement
    const rows = Array.from(tbody.querySelectorAll('tr'));

    function updateTable() {
      const filterValue = filterSelect.value.toLowerCase();
      const sortValue = sortSelect.value;

      // ÉTAPE A : Filtrer
      let visibleRows = rows.filter(row => {
        if (filterValue === 'all') return true;
        // On compare avec l'attribut data-category de ta balise <tr>
        const category = row.dataset.category ? row.dataset.category.toLowerCase() : '';
        return category.includes(filterValue);
      });

      // ÉTAPE B : Trier
      visibleRows.sort((a, b) => {
        const yearA = parseInt(a.dataset.year) || 0;
        const yearB = parseInt(b.dataset.year) || 0;
        const titleA = a.dataset.title ? a.dataset.title.toLowerCase() : '';
        const titleB = b.dataset.title ? b.dataset.title.toLowerCase() : '';

        switch (sortValue) {
          case 'year-desc': return yearB - yearA; // Du plus récent au plus ancien
          case 'year-asc': return yearA - yearB;  // Du plus ancien au plus récent
          case 'title-asc': return titleA.localeCompare(titleB); // A vers Z
          case 'title-desc': return titleB.localeCompare(titleA); // Z vers A
          default: return 0;
        }
      });

      // ÉTAPE C : Réafficher dans le tableau
      tbody.innerHTML = '';
      visibleRows.forEach(row => tbody.appendChild(row));
    }

    // On écoute les changements sur tes menus déroulants
    filterSelect.addEventListener('change', updateTable);
    sortSelect.addEventListener('change', updateTable);
  }
});