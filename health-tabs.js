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

        ;        dates.onchange = showResult;
        showResult();

        const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
        const points = history.map((row, index) => ({
          index,
          date: row.date,
          time: Date.parse(row.date),
          label: String(row.result).trim(),
          value: Number(row.result)
        })).filter(p => numeric.test(p.label) && Number.isFinite(p.time))
          .sort((a, b) => a.time - b.time);

        if (!points.length) continue;

        const ns = 'http://www.w3.org/2000/svg';
        const graph = document.createElementNS(ns, 'svg');
        graph.setAttribute('viewBox', '0 0 280 132');
        graph.setAttribute('role', 'img');
        graph.setAttribute('aria-label', r.test + ' history, ' + (r.unit || 'reported values'));
        graph.style.cssText =
          'display:block;width:100%;height:auto;margin-top:8px;' +
          'background:#0d1c2d;border-radius:10px;cursor:pointer';
        label.append(graph);

        function draw(tag, attrs, content) {
          const node = document.createElementNS(ns, tag);
          for (const [key, value] of Object.entries(attrs)) {
            node.setAttribute(key, value);
          }
          if (content !== undefined) node.textContent = content;
          graph.append(node);
          return node;
        }

        function write(x, y, text, anchor, color) {
          return draw('text', {
            x, y,
            'text-anchor': anchor,
            fill: color,
            'font-size': 13,
            'font-family': 'system-ui, sans-serif'
          }, text);
        }

        const first = points[0];
        const last = points[points.length - 1];
        const low = Math.min(...points.map(p => p.value));
        const high = Math.max(...points.map(p => p.value));

        for (const p of points) {
          p.x = first.time === last.time ? 140 :
            35 + 210 * (p.time - first.time) / (last.time - first.time);
          p.y = low === high ? 65 :
            88 - 48 * (p.value - low) / (high - low);
        }

        write(12, 18, r.unit || 'Result', 'start', '#b5c8d9');
        draw('line', {
          x1: 18, x2: 262, y1: 101, y2: 101, stroke: '#465e72'
        });

        if (points.length === history.length && first.time !== last.time) {
          draw('polyline', {
            points: points.map(p => `${p.x},${p.y}`).join(' '),
            fill: 'none',
            stroke: '#63d6f5',
            'stroke-width': 3,
            'stroke-linejoin': 'round'
          });
        }

        const dateFormat = new Intl.DateTimeFormat('en-US', {
          month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC'
        });
        if (first.time === last.time) {
          write(140, 122, dateFormat.format(first.time), 'middle', '#c4d5e3');
        } else {
          write(12, 122, dateFormat.format(first.time), 'start', '#c4d5e3');
          write(268, 122, dateFormat.format(last.time), 'end', '#c4d5e3');
        }

        const dots = points.map(p => {
          const dot = draw('circle', {
            cx: p.x, cy: p.y, r: 4.5, fill: '#63d6f5',
            stroke: '#0d1c2d', 'stroke-width': 1.5
          });
          const title = document.createElementNS(ns, 'title');
          title.textContent = `${p.date} · ${p.label} ${r.unit || ''}`;
          dot.append(title);
          return dot;
        });

        // Keep the latest label, then fit earlier labels where they can be read.
        const placed = [];
        for (const p of [...points].reverse()) {
          const fits = placed.every(other =>
            Math.abs(other.x - p.x) > 44 || Math.abs(other.y - p.y) > 18
          );
          if (fits) {
            write(p.x, p.y - 9, p.label, 'middle', '#f2f8ff');
            placed.push(p);
          }
        }

        function highlight() {
          points.forEach((p, i) => {
            const selected = p.index === Number(dates.value);
            dots[i].setAttribute('fill', selected ? '#ffffff' : '#63d6f5');
            dots[i].setAttribute('r', selected ? 6 : 4.5);
          });
        }

        dates.addEventListener('change', highlight);
        highlight();

        graph.addEventListener('click', event => {
          const matrix = graph.getScreenCTM();
          if (!matrix) return;

          event.preventDefault();
          const tap = new DOMPoint(event.clientX, event.clientY)
            .matrixTransform(matrix.inverse());
          const distance = p => Math.hypot(p.x - tap.x, p.y - tap.y);
          const nearest = points.reduce((a, b) =>
            distance(a) <= distance(b) ? a : b
          );

          detail.open = true;
          dates.value = String(nearest.index);
          dates.dispatchEvent(new Event('change'));
        });
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
