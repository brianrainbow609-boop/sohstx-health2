
'use strict';

/* SohStx Health — Quick Log v0.2 */

(() => {
  const STORE = 'sohstx-quicklog-presets-v02';

  const defaults = [
    { id:'breakfast', kind:'meal', name:'Usual breakfast',
      emoji:'🍳', cal:0, protein:0, carbs:0, fat:0 },
    { id:'dinner', kind:'meal', name:'Usual dinner',
      emoji:'🍽️', cal:0, protein:0, carbs:0, fat:0 },
    { id:'cod', kind:'extra', name:'Piece of cod',
      emoji:'🐟', cal:0, protein:0, carbs:0, fat:0 },
    { id:'rice', kind:'extra', name:'Rice serving',
      emoji:'🍚', cal:0, protein:0, carbs:0, fat:0 },
    { id:'shake', kind:'extra', name:'Protein shake',
      emoji:'🥤', cal:0, protein:0, carbs:0, fat:0 },
    { id:'snack', kind:'extra', name:'Favorite snack',
      emoji:'🍓', cal:0, protein:0, carbs:0, fat:0 }
  ];

  let presets;
  try {
    presets = JSON.parse(localStorage.getItem(STORE)) || defaults;
  } catch {
    presets = defaults;
  }
  if (!Array.isArray(presets)) presets = defaults;

  let meal = 'dinner';
  let extras = {};

  const el = (tag, props = {}, children = []) => {
    const x = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'text') x.textContent = v;
      else if (k === 'className') x.className = v;
      else x.setAttribute(k, v);
    });
    children.forEach(c => x.append(c));
    return x;
  };

  const save = () =>
    localStorage.setItem(STORE, JSON.stringify(presets));

  const fmt = n =>
    Number(n || 0).toFixed(1).replace(/\.0$/, '');

  const panel = el('section', {
    className:'panel',
    id:'quickLogPanel'
  });
  panel.style.cssText = 'margin:20px 0';

  const heading = el('div', { className:'sectionhead' }, [
    el('div', {}, [
      el('span', {
        className:'eyebrow',
        text:'QUICK LOG'
      }),
      el('h2', { text:'Meals & extras' })
    ])
  ]);

  const info = el('p', {
    text:'Choose a saved meal, add optional extras, then log it.'
  });

  const meals = el('div');
  const additions = el('div');
  const summary = el('div');
  const actions = el('div');

  const btn = (label, fn) => {
    const b = el('button', {
      type:'button',
      text:label
    });
    b.addEventListener('click', fn);
    return b;
  };

  const numeric = (p, key) => Number(p?.[key] || 0);

  function total() {
    const selected = [
      presets.find(p => p.id === meal),
      ...Object.entries(extras).flatMap(([id, n]) =>
        Array.from(
          { length:n },
          () => presets.find(p => p.id === id)
        )
      )
    ].filter(Boolean);

    return Object.fromEntries(
      ['cal','protein','carbs','fat'].map(k => [
        k,
        selected.reduce((s, p) => s + numeric(p, k), 0)
      ])
    );
  }

  function editPreset(p) {
    const name = prompt('Preset name', p.name);
    if (name === null) return;
    if (!name.trim()) return alert('Name required');

    const updated = { ...p, name:name.trim() };

    for (const [key, label] of [
      ['cal','Calories (kcal)'],
      ['protein','Protein (g)'],
      ['carbs','Carbs (g)'],
      ['fat','Fat (g)']
    ]) {
      const v = prompt(label, String(p[key] || 0));
      if (v === null) return;

      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        return alert('Enter a nonnegative number');
      }
      updated[key] = n;
    }

    presets = presets.map(x =>
      x.id === p.id ? updated : x
    );
    save();
    render();
  }

  function render() {
    meals.replaceChildren();
    additions.replaceChildren();
    actions.replaceChildren();

    meals.append(el('h3', { text:'Saved meals' }));

    for (const p of presets.filter(p => p.kind === 'meal')) {
      const r = el('div');
      r.style.cssText =
        'display:flex;align-items:center;gap:8px;' +
        'flex-wrap:wrap;margin:8px 0';

      const choose = btn(
        `${p.emoji} ${p.name}${meal === p.id ? ' ✓' : ''}`,
        () => {
          meal = p.id;
          extras = {};
          render();
        }
      );
      choose.style.cssText = 'flex:1;min-width:140px';

      r.append(
        choose,
        btn('Edit', () => editPreset(p))
      );
      meals.append(r);
    }

    additions.append(
      el('h3', { text:'Add extras (optional)' })
    );

    for (const p of presets.filter(p => p.kind === 'extra')) {
      const r = el('div');
      r.style.cssText =
        'display:flex;align-items:center;gap:8px;' +
        'flex-wrap:wrap;margin:8px 0';

      const title = el('span', {
        text:`${p.emoji} ${p.name}`
      });
      title.style.cssText = 'flex:1;min-width:110px';

      const minus = btn('−', () => {
        extras[p.id] = Math.max(0, (extras[p.id] || 0) - 1);
        render();
      });

      const plus = btn('+', () => {
        extras[p.id] = (extras[p.id] || 0) + 1;
        render();
      });

      r.append(
        title,
        minus,
        el('strong', { text:String(extras[p.id] || 0) }),
        plus,
        btn('Edit', () => editPreset(p))
      );

      additions.append(r);
    }

    const t = total();

    summary.textContent =
      `Total: ${fmt(t.cal)} kcal · ` +
      `${fmt(t.protein)}g protein · ` +
      `${fmt(t.carbs)}g carbs · ` +
      `${fmt(t.fat)}g fat`;

    summary.style.cssText =
      'padding:14px 0;font-weight:600';

    const log = btn('✓ Log meal now', async () => {
      if (typeof db === 'undefined' || !db) {
        return alert('Health database is not ready');
      }

      const base = presets.find(p => p.id === meal);
      if (!base) return;

      const selected = [
        { name:base.name, qty:1 },
        ...Object.entries(extras)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => ({
            name:presets.find(p => p.id === id)?.name || id,
            qty:n
          }))
      ];

      const t = total();
      const date = new Date().toISOString();

      const raw = {
        date,
        eventType:'meal',
        msgType:'QUICK_LOG',
        text:selected.map(p =>
          p.qty === 1 ? p.name : `${p.name} ×${p.qty}`
        ).join(' + '),
        details:
          `${fmt(t.cal)} kcal; ` +
          `${fmt(t.protein)}g protein; ` +
          `${fmt(t.carbs)}g carbs; ` +
          `${fmt(t.fat)}g fat`,
        foodCal:String(t.cal),
        foodProtein:String(t.protein),
        foodG:String(t.carbs),
        foodFat:String(t.fat),
        bgl:'',
        quickLogItems:JSON.stringify(selected),
        estimated:'false'
      };

      try {
        await transaction('readwrite', s => s.put({
          id:'quicklog:' + crypto.randomUUID(),
          source:'quicklog',
          date,
          raw
        }));

        extras = {};
        await refresh();
        render();
        notice('Meal logged locally.');
      } catch (e) {
        alert('Could not save meal: ' + e.message);
      }
    });

    log.className = 'primary';
    actions.append(log);

    const add = btn('+ New food or meal preset', () => {
      const name = prompt('Name of food or meal');
      if (!name?.trim()) return;

      const kind = confirm(
        'Make this a complete one-tap meal?\n' +
        'OK = meal, Cancel = extra'
      ) ? 'meal' : 'extra';

      const p = {
        id:'custom:' + crypto.randomUUID(),
        kind,
        name:name.trim(),
        emoji:kind === 'meal' ? '🍽️' : '🥣',
        cal:0,
        protein:0,
        carbs:0,
        fat:0
      };

      presets.push(p);
      save();
      editPreset(p);
      render();
    });

    actions.append(add);

    actions.append(el('p', {
      className:'subtle',
      text:
        'Nutrition starts at zero until you edit each preset. ' +
        'Use your food labels for accurate values. ' +
        'Presets are stored on this device.'
    }));
  }

  panel.append(
    heading,
    info,
    meals,
    additions,
    summary,
    actions
  );

  const anchor = document.querySelector('.twocol');

  if (anchor) {
    anchor.before(panel);
  } else {
    document.querySelector('main')?.append(panel);
  }

  render();
})();
    
