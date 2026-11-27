import { cooldown, newFight, resolvePunch, restoreProgress, upgrade } from './combat.mjs?v=20261127a';

import { drawMotion, frameCount, motionFrame, motions } from './motion.mjs?v=20261127a';

const storageKey = 'tireShotsRival';
const version = '20261127a';
const get = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const statControls = new Map();
const atlases = new Map();
const sheets = new Map();
const assets = new URL('./roster/', import.meta.url);
const sides = [get('myface'), get('theirface')];
let roster, fighters, columns, cell, progress, fight, lastExchange, autoTimer;
let isAuto = false;
let previewStart = null;
let storageError = false;

function save() {
  try {
    SohStxStorage.write(localStorage, storageKey, progress);
  } catch {
    if (!storageError) {
      document.querySelector('main small').textContent = 'Progress is available for this session.';
      storageError = true;
    }
  }
}

function urlFor(path) {
  return new URL(path + '?v=' + version, assets);
}

function motionPath(id) {
  return urlFor('motion/' + encodeURIComponent(id) + '.png');
}

function loadMotion(id) {
  if (sheets.has(id)) return;
  const image = new Image();
  sheets.set(id, image);
  image.src = motionPath(id);
  image.decode().then(() => {
    if (progress?.me === id && get('motion-panel').open && !reducedMotion.matches) {
      restartPreview();
    }
  }, () => sheets.delete(id));
}

function restartPreview() {
  previewStart = performance.now();
}

function setMotionFighters() {
  loadMotion(progress.me);
  loadMotion(progress.enemy);
  get('motion-download').href = motionPath(progress.me);
  get('motion-download').download = progress.me + '-motions.png';
  get('motion-fighter').textContent = fighters.get(progress.me).label;
  previewStart = reducedMotion.matches ? null : performance.now();
}

function draw(canvas, fighter, frame, side, { x = 0, y = 0, rotation = 0 } = {}) {
  const sheet = atlases.get(fighter.atlas);
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!sheet?.naturalWidth) return;
  const index = fighter.start + frame;
  const size = canvas.height;
  const flip = side === null ? false : Boolean(side) !== fighter.facesLeft;
  context.save();
  context.imageSmoothingEnabled = false;
  context.translate(canvas.width / 2 + x, canvas.height - 2 + y);
  context.rotate(rotation);
  context.scale(flip ? -1 : 1, 1);
  context.drawImage(sheet, index % columns * cell, Math.floor(index / columns) * cell,
    cell, cell, -size / 2, -size, size, size);
  context.restore();
}

function createPortraits() {
  const list = get('roster');
  for (const fighter of roster) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.dataset.fighter = fighter.id;
    const portrait = document.createElement('canvas');
    portrait.width = portrait.height = 64;
    portrait.setAttribute('aria-hidden', 'true');
    card.append(portrait, fighter.label);
    card.addEventListener('click', () => {
      if (progress.me === fighter.id) return;
      const former = progress.me;
      progress.me = fighter.id;
      if (progress.enemy === fighter.id) progress.enemy = former;
      matchup();
    });
    list.append(card);
    draw(portrait, fighter, fighter.portrait, null);
  }
}

function filterRoster() {
  const query = get('search').value.trim().toLowerCase();
  let matches = 0;
  for (const card of get('roster').children) {
    const { label, type, category } = fighters.get(card.dataset.fighter);
    card.hidden = ![label, type, category].some((value) => value.toLowerCase().includes(query));
    if (!card.hidden) matches++;
  }
  get('empty').hidden = matches !== 0;
}

function setMatchup() {
  for (const card of get('roster').children) {
    card.setAttribute('aria-pressed', String(card.dataset.fighter === progress.me));
  }
  get('enemy').replaceChildren(...roster.filter(({ id }) => id !== progress.me)
    .map(({ label, id }) => new Option(label, id)));
  get('enemy').value = progress.enemy;
  get('mine').textContent = fighters.get(progress.me).label;
  get('theirs').textContent = fighters.get(progress.enemy).label;
  setMotionFighters();
}

function createStats() {
  for (const stat of ['strength', 'speed', 'accuracy']) {
    const panel = document.createElement('div');
    panel.className = 'stat';
    const label = document.createElement('div');
    const button = document.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (!upgrade(progress, stat)) return;
      renderStatus();
      save();
    });
    panel.append(label, button);
    get('stats').append(panel);
    statControls.set(stat, { label, button });
  }
}

function renderStatus() {
  get('hp').value = fight.health;
  get('ehp').value = fight.opponentHealth;
  get('score').textContent = `Round ${progress.round} · Wins ${progress.wins} | Losses ${progress.losses} | Rival Lv ${fight.opponent.level} · Points ${progress.points}`;
  get('punch').disabled = Boolean(fight.result);
  get('next').disabled = !fight.result;
  for (const [stat, { label, button }] of statControls) {
    const level = progress[stat];
    const name = stat === 'strength' ? 'Power' : stat[0].toUpperCase() + stat.slice(1);
    label.textContent = `${name} Lv ${level}`;
    button.textContent = `Upgrade · ${level * 5} pts`;
    button.setAttribute('aria-label', `Upgrade ${name} for ${level * 5} points`);
    button.disabled = progress.points < level * 5;
  }
}

function setAuto(enabled) {
  clearTimeout(autoTimer);
  isAuto = enabled;
  get('auto').textContent = enabled ? 'Auto: On' : 'Auto: Off';
  get('auto').setAttribute('aria-pressed', String(enabled));
  if (enabled) queuePunch();
}

function queuePunch() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    punch();
    if (isAuto) queuePunch();
  }, Math.max(16, Math.ceil(fight.readyAt - performance.now())));
}

function resetFight(message) {
  setAuto(false);
  fight = newFight(progress);
  lastExchange = null;
  get('message').textContent = message;
  renderStatus();
  save();
}

function matchup() {
  setMatchup();
  resetFight('Matchup ready.');
}

function nextRound() {
  if (!fight.result) return;
  progress.round++;
  resetFight('New round.');
}

function punch() {
  if (document.hidden) return;
  const at = performance.now();
  const shot = resolvePunch(progress, fight, at);
  if (!shot) return;
  lastExchange = { ...shot, at, duration: Math.min(550, cooldown(progress.speed)) };
  const lines = [shot.damage ? `Hit for ${shot.damage}. +2 points.` : 'Your punch missed.'];
  if (shot.counter) lines.push(`Countered for ${shot.counter}.`);
  if (fight.result === 'win') lines.push('Knockout! +15 bonus points.');
  if (fight.result === 'loss') lines.push('You were knocked out.');
  if (fight.result) setAuto(false);
  get('message').textContent = lines.join(' ');
  renderStatus();
  save();
}

function poseFor(fighter, side, time) {
  const idle = fighter.clips.idle;
  if (reducedMotion.matches) return [fighter.portrait, {}];
  const direction = side ? -1 : 1;
  const elapsed = lastExchange ? time - lastExchange.at : Infinity;
  const down = side ? fight.opponentHealth === 0 : fight.health === 0;
  const reaction = side ? lastExchange?.damage : lastExchange?.counter;
  const impactDelay = side ? 60 : 140;
  if (down && elapsed >= impactDelay) {
    const sheet = sheets.get(fighter.id);
    if (sheet?.complete && sheet.naturalWidth) {
      return ['die', motionFrame('die', elapsed - impactDelay)];
    }
    return [fighter.portrait, { y: 22, x: -direction * 25, rotation: -direction * 0.7 }];
  }
  const didAttack = !side || lastExchange?.counter;
  const attackTime = elapsed - (side ? 80 : 0);
  if (didAttack && attackTime >= 0 && attackTime < lastExchange?.duration) {
    const phase = attackTime / lastExchange.duration;
    const sheet = sheets.get(fighter.id);
    if (sheet?.complete && sheet.naturalWidth) {
      return ['punch', Math.min(frameCount - 1, Math.floor(phase * frameCount))];
    }
    const clip = fighter.clips.attack;
    const frame = clip ? clip[0] + Math.floor(phase * clip[1]) : fighter.portrait;
    const lunge = Math.sin(Math.PI * phase);
    return [frame, {
      x: direction * lunge * (clip ? 8 : 18),
      rotation: clip ? 0 : direction * lunge * 0.11,
    }];
  }
  const recoilTime = elapsed - impactDelay;
  const x = reaction && recoilTime >= 0 && recoilTime < 155
    ? -direction * 10 * (1 - recoilTime / 155) : 0;
  const sheet = sheets.get(fighter.id);
  if (sheet?.complete && sheet.naturalWidth) return ['idle', motionFrame('idle', time), x];
  const frame = idle ? idle[0] + Math.floor(time * fighter.fps / 1000) % idle[1] : fighter.portrait;
  return [frame, { x, y: idle ? 0 : -Math.round(2 * (1 + Math.sin(time / 300 + side))) }];
}

function animate(time) {
  for (const [side, id] of [progress.me, progress.enemy].entries()) {
    const fighter = fighters.get(id);
    const [frame, motion, recoil] = poseFor(fighter, side, time);
    if (typeof frame === 'string') {
      drawMotion(sides[side], sheets.get(id), frame, motion, Boolean(side), recoil);
    } else {
      draw(sides[side], fighter, frame, side, motion);
    }
  }
  if (get('motion-panel').open) {
    const canvas = get('motion-preview');
    const fighter = fighters.get(progress.me);
    const sheet = sheets.get(fighter.id);
    const action = get('motion-action').value;
    const frame = motionFrame(action, previewStart === null ? 0 : time - previewStart);
    if (sheet?.complete && sheet.naturalWidth) {
      drawMotion(canvas, sheet, action, frame);
    } else {
      draw(canvas, fighter, fighter.portrait, null);
    }
  }
  requestAnimationFrame(animate);
}

function bindControls() {
  for (const id of ['auto', 'reset', 'search', 'enemy']) get(id).disabled = false;
  get('search').addEventListener('input', filterRoster);
  get('enemy').addEventListener('change', (event) => {
    progress.enemy = event.target.value;
    matchup();
  });
  const motionSelect = get('motion-action');
  motionSelect.replaceChildren(...Object.keys(motions).map((action) =>
    new Option(action[0].toUpperCase() + action.slice(1), action)));
  motionSelect.value = 'walk';
  motionSelect.addEventListener('change', restartPreview);
  get('motion-replay').addEventListener('click', restartPreview);
  if (location.hash === '#motion-panel') get('motion-panel').open = true;
  get('motion-panel').addEventListener('toggle', () => {
    if (get('motion-panel').open && !reducedMotion.matches) restartPreview();
  });
  reducedMotion.addEventListener('change', () => {
    previewStart = reducedMotion.matches ? null : performance.now();
  });
  get('punch').addEventListener('click', punch);
  get('next').addEventListener('click', nextRound);
  get('auto').addEventListener('click', () => {
    if (!isAuto && fight.result) nextRound();
    setAuto(!isAuto);
  });
  get('reset').addEventListener('click', () => {
    if (!confirm('Reset your wins, losses, points, and upgrades?')) return;
    progress = restoreProgress(null, roster);
    get('search').value = '';
    filterRoster();
    setMatchup();
    resetFight('Progress reset.');
  });
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat || event.defaultPrevented
      || event.target.closest?.('button, input, select, textarea, a, [contenteditable]')) return;
    event.preventDefault();
    punch();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && isAuto) setAuto(false);
  });
}

async function start() {
  get('retry').hidden = true;
  get('message').textContent = 'Loading fighters…';
  try {
    const response = await fetch(urlFor('index.json'));
    if (!response.ok) throw new Error(`Roster returned ${response.status}`);
    const data = await response.json();
    ({ columns, cell } = data);
    roster = data.fighters;
    fighters = new Map(roster.map((entry) => [entry.id, entry]));
    const ids = [...new Set(roster.map((fighter) => fighter.atlas))];
    await Promise.all(ids.map(async (id) => {
      const image = new Image();
      image.src = urlFor(`fighters-${id}.webp`);
      await image.decode();
      atlases.set(id, image);
    }));
  } catch (error) {
    console.error(error);
    get('message').textContent = 'The fighter roster could not load.';
    get('retry').hidden = false;
    return;
  }
  let saved;
  try {
    saved = SohStxStorage.read(localStorage, storageKey);
  } catch { /* Unavailable or malformed storage is handled during save. */ }
  progress = restoreProgress(saved, roster);
  createPortraits();
  createStats();
  setMatchup();
  bindControls();
  resetFight('Ready to rumble.');
  requestAnimationFrame(animate);
}

get('retry').addEventListener('click', start);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
start();
