(() => {
  // The button reports the outcome until the reader moves away from it, then
  // offers to copy again. A refused copy names the browser's reason.
  const copyButton = document.querySelector('[data-copy]');
  if (copyButton) {
    const label = copyButton.querySelector('.copy-label');
    const offerCopy = () => { if (label) label.textContent = 'Copy'; };
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(copyButton.dataset.copy);
        copyButton.removeAttribute('title');
        if (label) label.textContent = 'Copied';
      } catch (error) {
        copyButton.title = `The browser refused to copy (${error.message}); select the command to copy it.`;
        if (label) label.textContent = 'Select';
      }
    });
    copyButton.addEventListener('pointerleave', offerCopy);
    copyButton.addEventListener('blur', offerCopy);
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
      for (const card of cards) {
        const haystack = `${card.dataset.docTitle} ${card.dataset.docSummary}`.toLocaleLowerCase();
        card.hidden = Boolean(query) && !haystack.includes(query);
      }
      for (const group of groups) {
        group.hidden = !group.querySelector('.doc-card:not([hidden])');
      }
      if (empty) empty.hidden = cards.some(card => !card.hidden);
    });
  }
})();
