import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root));
const games = JSON.parse(read('games/catalog.json'));
for (const game of games) {
  const page = read(game.dir + '/index.html').toString();
  assert.match(page, /name=["']viewport["']/i, game.title);
  assert.ok(page.includes('/games/shared/controls.css'), game.title + ' focus style');
  for (const path of [game.dir + '/install.html', 'games/art/' + game.art + '.webp']) {
    assert.ok(fs.statSync(fileURLToPath(new URL(path, root))).size, path);
  }
}
const bobertPage = read('Robert/index.html').toString();
assert.ok(bobertPage.includes('<title>That Time I Got Reincarnated as Bobert</title>'));
assert.ok(bobertPage.includes('<em>Bobert</em>'));
assert.ok(bobertPage.includes("legacyKey='sohstx.robert.shift.v1'"), 'preserve old Robert save migration');
assert.doesNotMatch(bobertPage, /robertLines/, 'use Bobert naming for dialogue identifiers');
const dir = 'tire-shots-rival/sprites/';
const manifest = JSON.parse(read(dir + 'manifest.json'));
assert.deepEqual(manifest.characters, ['Hector', 'Erasmo']);
const frames = new Map(manifest.frames.map(frame => [frame.file, frame.dimensions]));
const expected = [];
for (const name of manifest.characters) {
  for (const [action, count] of Object.entries({ idle: 4, walk: 8, attack: 6 })) {
    assert.equal(manifest.frames_per_character[action], count);
    for (let i = 0; i < count; i++) {
      const file = name.toLowerCase() + '-' + action + '-' + String(i).padStart(2, '0') + '.png';
      expected.push(file);
      const png = read(dir + file);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', file);
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], frames.get(file), file);
      assert.ok([4, 6].includes(png[25]) || png.includes(Buffer.from('tRNS')), file + ' transparency');
    }
  }
}
assert.deepEqual(manifest.frames.map(f => f.file).sort(), expected.sort());
const rivalRoster = JSON.parse(read('tire-shots-rival/roster/index.json'));
assert.equal(rivalRoster.fighters.length, 43, 'Tire Shop Rivals roster size');
const fighterIds = new Set();
const atlasIds = new Set();
for (const fighter of rivalRoster.fighters) {
  assert.ok(fighter.id && !fighterIds.has(fighter.id), 'unique fighter id: ' + fighter.id);
  fighterIds.add(fighter.id);
  assert.ok(Number.isInteger(fighter.atlas) && fighter.atlas >= 0, fighter.name + ' atlas index');
  assert.ok(Number.isInteger(fighter.start) && fighter.start >= 0, fighter.name + ' frame start');
  assert.ok(Number.isInteger(fighter.frames) && fighter.frames > 0, fighter.name + ' frame count');
  atlasIds.add(fighter.atlas);
  const motion = read('tire-shots-rival/roster/motion/' + fighter.id + '.png');
  assert.equal(motion.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', fighter.name + ' motion sheet');
}
for (const atlas of atlasIds) {
  const file = 'tire-shots-rival/roster/fighters-' + atlas + '.webp';
  assert.ok(read(file).subarray(8, 12).toString() === 'WEBP', 'fighter atlas ' + atlas);
}
const motionConfig = rivalRoster.motionSheets;
assert.equal(motionConfig.columns, 8);
assert.equal(motionConfig.rows.length, 7);
console.log(rivalRoster.fighters.length + ' fighters, ' + fighterIds.size + ' unique IDs, ' + atlasIds.size + ' atlases and all motion sheets passed.');
console.log(games.length + ' game entry points and ' + expected.length + ' labeled sprite frames passed.');

const index = JSON.parse(read('development/sprite-index.json'));
for (const atlas of index.atlases) {
  assert.equal(read(atlas.file).subarray(8, 12).toString(), 'WEBP', atlas.file);
}
for (const record of index.embedded) {
  const page = read(record.project + '/index.html').toString();
  assert.ok(page.includes('data:image/'), record.project);
  if (record.names) {
    const assets = JSON.parse(page.match(/const assets=(\{[^\n]*?\}),images=/)?.[1] || '{}');
    for (const key of Object.keys(record.names)) assert.ok(assets[key]?.startsWith('data:image/'), key);
  }
}


const poolHall = games.find(game => game.title === "Hector's Pool Hall");
const rivals = games.find(game => game.title === 'Tire Shop Rivals');
assert.ok(poolHall && rivals, 'Pool Hall and Rivals catalog entries exist');
assert.equal(poolHall.art, 'hectors-pool-hall', 'Pool Hall must use its own dedicated artwork');
assert.notEqual(poolHall.art, rivals.art, 'Pool Hall artwork must not duplicate Rivals');
const poolArt = read('games/art/' + poolHall.art + '.webp');
assert.equal(poolArt.subarray(8, 12).toString(), 'WEBP', 'Pool Hall card artwork is a valid WebP');
assert.ok(poolArt.length > 10000, 'Pool Hall artwork is a full-size original image, not a placeholder');
assert.ok(poolHall.dir === 'games/hectors-pool-hall', 'Pool Hall has a canonical root-relative game directory');
assert.equal(poolHall.installUrl, '/games/hectors-pool-hall/install', 'Pool Hall uses the canonical extensionless install URL');
const hubScript = read('games/hub.js').toString();
assert.match(hubScript, /cache: 'no-store'/, 'Game Hub always refreshes its catalog');
assert.match(hubScript, /game\.installUrl \|\|/, 'Game Hub prefers an explicit install URL when provided');
const poolInstall = read(poolHall.dir + '/install.html').toString();
assert.match(poolInstall, /<title>Install Hector's Pool Hall<\/title>/, 'Pool Hall install page has its own title');
assert.match(poolInstall, /rel="manifest" href="manifest\.webmanifest"/, 'Pool Hall install page links its local manifest');
console.log('Pool Hall card artwork is unique and its install page/manifest routes are present.');
