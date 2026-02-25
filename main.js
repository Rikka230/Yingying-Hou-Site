document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. GESTION DU MENU MOBILE
  // ==========================================
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !isExpanded);
      nav.classList.toggle('is-open');
    });
  }

  // ==========================================
  // 2. MISE À JOUR DE L'ANNÉE DANS LE FOOTER
  // ==========================================
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  // ==========================================
  // 3. FONCTIONNEMENT DU TRI ET FILTRE (FILMOGRAPHIE)
  // ==========================================
  const filterSelect = document.getElementById('filter-category');
  const sortSelect = document.getElementById('sort-by');
  const tbody = document.querySelector('#filmography tbody');

  if (filterSelect && sortSelect && tbody) {
    const rows = Array.from(tbody.querySelectorAll('tr'));

    function updateTable() {
      const filterValue = filterSelect.value.toLowerCase();
      const sortValue = sortSelect.value;

      // Filtrer
      let visibleRows = rows.filter(row => {
        if (filterValue === 'all') return true;
        const category = row.dataset.category ? row.dataset.category.toLowerCase() : '';
        return category.includes(filterValue);
      });

      // Trier
      visibleRows.sort((a, b) => {
        const yearA = parseInt(a.dataset.year) || 0;
        const yearB = parseInt(b.dataset.year) || 0;
        const titleA = a.dataset.title ? a.dataset.title.toLowerCase() : '';
        const titleB = b.dataset.title ? b.dataset.title.toLowerCase() : '';

        switch (sortValue) {
          case 'year-desc': return yearB - yearA; 
          case 'year-asc': return yearA - yearB;  
          case 'title-asc': return titleA.localeCompare(titleB); 
          case 'title-desc': return titleB.localeCompare(titleA); 
          default: return 0;
        }
      });

      // Réafficher
      tbody.innerHTML = '';
      visibleRows.forEach(row => tbody.appendChild(row));
      
      // Il faut ré-attacher les événements de la modale aux nouveaux boutons affichés
      attachModalEvents();
    }

    filterSelect.addEventListener('change', updateTable);
    sortSelect.addEventListener('change', updateTable);
  }

  // ==========================================
  // 4. GESTION DE LA FENÊTRE MODALE
  // ==========================================
  const detailDialog = document.getElementById('detailDialog');
  const closeDialogBtn = document.querySelector('.dialog-close');
  const detailTitle = document.getElementById('detailTitle');
  const detailSynopsis = document.getElementById('detailSynopsis');
  const detailPoster = document.getElementById('detailPoster');
  const detailImdb = document.getElementById('detailImdb');

  function attachModalEvents() {
    if (!detailDialog) return;

    // On cible uniquement les liens qui ont l'attribut data-detail
    const detailLinks = document.querySelectorAll('.link[data-detail]');
    
    detailLinks.forEach(link => {
      // On retire l'ancien écouteur pour éviter les doublons au tri
      const newLink = link.cloneNode(true);
      link.parentNode.replaceChild(newLink, link);
      
      newLink.addEventListener('click', (e) => {
        e.preventDefault(); // Empêche de remonter en haut de la page
        
        // Récupérer la ligne (tr) parente pour avoir le titre
        const tr = newLink.closest('tr');
        const title = tr.dataset.title;
        
        // Lire le JSON dans l'attribut data-detail
        try {
          const data = JSON.parse(newLink.getAttribute('data-detail'));
          
          // Injecter les infos dans la modale
          detailTitle.textContent = title;
          detailSynopsis.textContent = data.synopsis || "Aucun synopsis disponible.";
          
          if (data.affiche && data.affiche !== "") {
            detailPoster.src = data.affiche;
            detailPoster.style.display = 'block';
          } else {
            detailPoster.style.display = 'none';
          }
          
          if (data.imdb && data.imdb !== "") {
            detailImdb.href = data.imdb;
            detailImdb.style.display = 'inline-block';
          } else {
            detailImdb.style.display = 'none';
          }
          
          // Afficher la modale
          detailDialog.showModal();
        } catch (error) {
          console.error("Erreur dans le format JSON du data-detail", error);
        }
      });
    });
  }

  // Fermer la modale au clic sur la croix
  if (closeDialogBtn && detailDialog) {
    closeDialogBtn.addEventListener('click', () => {
      detailDialog.close();
    });

    // Fermer la modale si on clique en dehors du cadre blanc
    detailDialog.addEventListener('click', (e) => {
      const rect = detailDialog.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        detailDialog.close();
      }
    });
  }

  // Initialisation des boutons modale au chargement
  attachModalEvents();

});
