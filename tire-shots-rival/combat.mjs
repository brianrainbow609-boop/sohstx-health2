const stats = ['strength', 'speed', 'accuracy'];
const defaults = { points: 0, wins: 0, round: 1, strength: 1, speed: 1, accuracy: 1 };

function findFighter(value, roster) {
  const id = value === 0 ? 'hector' : value === 1 ? 'erasmo' : value;
  return roster.some((fighter) => fighter.id === id) ? id : undefined;
}

export function restoreProgress(saved, roster) {
  const progress = { ...defaults };
  for (const [key, minimum] of Object.entries(defaults)) {
    const value = saved?.[key];
    if (Number.isSafeInteger(value) && value >= minimum) progress[key] = value;
  }
  progress.me = findFighter(saved?.me, roster) ?? roster[0].id;
  const enemy = findFighter(saved?.enemy, roster);
  progress.enemy = enemy && enemy !== progress.me
    ? enemy : roster.find(({ id }) => id !== progress.me).id;
  return progress;
}

export function newFight() {
  return { health: 100, opponentHealth: 100, readyAt: 0, result: null };
}

export function cooldown(speed) {
  return Math.max(120, 700 - speed * 55);
}

export function resolvePunch(progress, fight, now, roll = Math.random) {
  if (fight.result || now < fight.readyAt) return null;
  fight.readyAt = now + cooldown(progress.speed);
  const damage = roll() < Math.min(0.98, 0.58 + progress.accuracy * 0.05)
    ? Math.min(fight.opponentHealth, 5 + progress.strength * 2 + Math.floor(roll() * 5)) : 0;
  fight.opponentHealth -= damage;
  if (damage) progress.points += 2;
  if (!fight.opponentHealth) {
    fight.result = 'win';
    progress.points += 15;
    progress.wins++;
    return { damage, counter: 0 };
  }

  const counter = roll() < 0.6 ? Math.min(fight.health, 3 + Math.floor(roll() * 7)) : 0;
  fight.health -= counter;
  if (!fight.health) fight.result = 'loss';
  return { damage, counter };
}

export function upgrade(progress, stat) {
  if (!stats.includes(stat)) return false;
  const cost = progress[stat] * 5;
  if (progress.points < cost) return false;
  progress.points -= cost;
  progress[stat]++;
  return true;
}
