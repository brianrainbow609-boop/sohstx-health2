(() => {
  function setup() {
    const tab = name => document.querySelector('.tab[data-tab="' + name + '"]');
    const view = name => document.getElementById('view-' + name);
    if (!tab('analysis') || !view('charts') || !view('analysis')) return;

    const analysis = view('analysis');
    analysis.classList.remove('view');
    analysis.style.display = 'block';
    view('charts').append(analysis);

    const old = tab('analysis');
    const labs = tab('labs') || old.cloneNode(false);
    old.replaceWith(labs);
    labs.dataset.tab = 'labs';
    labs.textContent = 'Labs';
    tab('charts').textContent = 'Charts & Analysis';

    const panel = view('labs') || document.createElement('section');
    panel.id = 'view-labs';
    panel.classList.add('view');
    if (!panel.isConnected) view('charts').after(panel);

    const summary = document.createElement('section');
    summary.className = 'panel';
    panel.prepend(summary);

    function add(parent, tag, text) {
      const node = document.createElement(tag);
      node.textContent = text;
      parent.append(node);
      return node;
    }

    function status(row) {
      const ref = String(row.reference_range || '').trim();
      const number = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/;
      if (!number.test(String(row.result).trim())) return 'See report';

      const value = Number(row.result);
      const range = ref.match(/^(-?[\d.]+)\s*[-–]\s*(-?[\d.]+)$/);
      if (range) return value < +range[1] ? 'Below range' :
        value > +range[2] ? 'Above range' : 'In range';

      const limit = ref.match(/^(<=|>=|<|>|≤|≥)\s*(-?[\d.]+)$/);
      if (!limit) return ref ? 'See report' : 'No range listed';

      const [, op, n] = limit;
      if (op.startsWith('<') || op === '≤') {
        return (op === '<' ? value >= +n : value > +n) ? 'Above range' : 'In range';
      }
      return (op === '>' ? value <= +n : value < +n) ? 'Below range' : 'In range';
    }

    function render() {
      summary.replaceChildren();
      add(summary, 'h2', 'Lab results');

      let rows;
      try {
        rows = JSON.parse(localStorage.getItem('sohstx-lab-history-v1-personal') || '[]');
        if (!Array.isArray(rows)) throw Error();
      } catch {
        add(summary, 'p', 'Saved labs could not be read.');
        return;
      }
      if (!rows.length) {
        add(summary, 'p', 'Use Import Data to load your master CSV.');
        return;
      }

      const groups = new Map();
      for (const r of rows.slice().sort((a,b) => b.date.localeCompare(a.date))) {
        const key = JSON.stringify([
          r.test.trim().toLowerCase(),
          (r.unit || '').trim().toLowerCase()
        ]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }

      const outside = group => ['Above range','Below range'].includes(status(group[0]));
      const ordered = [...groups.values()].sort((a,b) =>
        Number(outside(b)) - Number(outside(a)) || a[0].test.localeCompare(b[0].test));

      add(summary, 'p', rows.length + ' results. ' + ordered.filter(outside).length +
        ' of ' + ordered.length + ' test and unit groups have a latest result outside the listed range.');

      const search = add(summary, 'input', '');
      search.type = 'search';
      search.placeholder = 'Find a test, e.g. A1C';
      search.setAttribute('aria-label', 'Find a lab test');

      const filter = add(summary, 'select', '');
      filter.setAttribute('aria-label', 'Filter lab tests');
      for (const title of ['All tests', 'Latest outside range', 'Multiple dates']) {
        add(filter, 'option', title).value = title;
      }

      const count = add(summary, 'p', '');
      count.setAttribute('role', 'status');
      const cards = [];

      function applyFilters() {
        const query = search.value.trim().toLowerCase();
        let shown = 0;
        for (const {detail, history} of cards) {
          const matches = history[0].test.toLowerCase().includes(query)
            && (filter.value !== 'Latest outside range' || outside(history))
            && (filter.value !== 'Multiple dates' ||
                history.some(p => p.date !== history[0].date));
          detail.hidden = !matches;
          if (matches) shown++;
        }
        count.textContent = shown
          ? shown + ' tests shown'
          : 'No matching tests. Try another name or filter.';
      }

      search.oninput = filter.onchange = applyFilters;

            const gallery = add(summary, 'div', '');
      gallery.style.cssText = [
        'display:grid',
        'grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))',
        'gap:12px',
        'align-items:start'
      ].join(';');

      for (const history of ordered) {
        const r = history[0];
        const detail = add(gallery, 'details', '');
        detail.style.cssText = [
          'min-width:0',
          'padding:14px',
          'background:#14283b',
          'border:1px solid #40546a',
          'border-radius:14px'
        ].join(';');

        const label = add(detail, 'summary', r.test + ' · ' + r.result + ' ' +
          (r.unit || '') + ' · ' + status(r));
        label.style.cursor = 'pointer';
        cards.push({detail, history});

        const dates = add(detail, 'select', '');
        dates.setAttribute('aria-label', 'Choose a result for ' + r.test);
        history.forEach((p, i) => {
          add(dates, 'option', p.date + ' · ' + p.result + ' ' + (p.unit || '')).value = i;
        });

        const info = add(detail, 'p', '');
        info.setAttribute('aria-live', 'polite');

        function showResult() {
          const p = history[Number(dates.value)];
          const previous = history.find(item => item.date < p.date);
          const parts = [
            p.date, p.date_basis, p.result + ' ' + (p.unit || ''), status(p),
            p.reference_range ? 'Report range: ' + p.reference_range : '', p.source
          ];

          const numeric = value =>
            /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(value).trim());

          if (previous && numeric(p.result) && numeric(previous.result)) {
            const delta = Number(p.result) - Number(previous.result);
            const amount = Number(Math.abs(delta).toPrecision(10));
            const unit = (p.unit || '').trim();
            parts.push(delta === 0
              ? 'Same value as ' + previous.date
              : (delta > 0 ? 'Up ' : 'Down ') + amount + ' ' +
                (unit === '%' ? 'percentage points' : unit) + ' since ' + previous.date);
          }

          info.textContent = parts.filter(Boolean).join(' · ');
        }

        dates.onchange = showResult;
        showResult();
      }

      applyFilters();
    }

    labs.onclick = () => {
      setTab('labs');
      document.getElementById('pageTitle').textContent = 'Lab results';
      render();
    };

    new MutationObserver(() => {
      if (view('charts').classList.contains('active'))
        document.getElementById('pageTitle').textContent = 'Charts & Analysis';
    }).observe(view('charts'), {attributes:true, attributeFilter:['class']});

    new MutationObserver(() => {
      if (panel.classList.contains('active')) render();
    }).observe(document.getElementById('notice'), {childList:true, subtree:true});
  }

  if (document.readyState === 'complete') setup();
  else window.addEventListener('load', setup, {once:true});
})();
