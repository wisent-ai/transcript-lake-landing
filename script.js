(() => {
  // How long the button reports the outcome before it offers to copy again.
  const COPY_LABEL_RESET_MS = 1800;
  const copyButton = document.querySelector('[data-copy]');
  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      const label = copyButton.querySelector('.copy-label');
      try {
        await navigator.clipboard.writeText(copyButton.dataset.copy);
        if (label) label.textContent = 'Copied';
      } catch {
        if (label) label.textContent = 'Select';
      }
      window.setTimeout(() => { if (label) label.textContent = 'Copy'; }, COPY_LABEL_RESET_MS);
    });
  }

  const menuButton = document.querySelector('.docs-menu-button');
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        document.body.classList.remove('nav-open');
        menuButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const search = document.querySelector('[data-doc-search]');
  if (search) {
    const cards = [...document.querySelectorAll('.doc-card')];
    const groups = [...document.querySelectorAll('.docs-card-group')];
    const empty = document.querySelector('.search-empty');
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase();
      let visibleCount = 0;
      for (const card of cards) {
        const haystack = `${card.dataset.docTitle} ${card.dataset.docSummary}`.toLocaleLowerCase();
        const visible = !query || haystack.includes(query);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      }
      for (const group of groups) {
        group.hidden = !group.querySelector('.doc-card:not([hidden])');
      }
      if (empty) empty.hidden = visibleCount !== 0;
    });
  }
})();
