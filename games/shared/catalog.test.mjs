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
