async function renderLibrary() {
  const cards = document.querySelector('#cards');
  const response = await fetch('/games/catalog.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Catalog unavailable');
  const games = await response.json();
  const template = document.createElement('template');
  template.innerHTML = '<article><div class="cover"><img alt=""><span></span></div><div class="copy"><h3></h3><p></p><div class="actions"><a class="primary">▶ &nbsp;Play</a><a class="secondary">Install</a></div></div></article>';
  for (const game of games) {
    const card = template.content.cloneNode(true);
    card.querySelector('img').src = '/games/art/' + game.art + '.webp';
    card.querySelector('.cover span').textContent = game.genre;
    card.querySelector('h3').textContent = game.title;
    card.querySelector('p').textContent = game.description;
    for (const link of card.querySelectorAll('a')) {
      const install = link.classList.contains('secondary');
      link.href = install ? (game.installUrl || '/' + game.dir + '/install.html') : '/' + game.dir + '/';
      link.setAttribute('aria-label', (install ? 'Install ' : 'Play ') + game.title);
    }
    cards.append(card);
  }
  document.querySelector('#count').textContent = games.length + ' games';
}
renderLibrary().catch(() => document.querySelector('#cards').textContent = 'The game library could not load. Refresh to try again.');
document.querySelector('a[href="#install"]').addEventListener('click', () => document.querySelector('#install').open = true);
