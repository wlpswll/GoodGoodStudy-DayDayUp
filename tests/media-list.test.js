const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../english/js/catalog.js');

const ROOT = path.join(__dirname, '..', 'english');
const SKIP = new Set(['css', 'js', 'data', 'scripts', 'miniprogram']);

function walk(dir, acc) {
  fs.readdirSync(dir).forEach(function (name) {
    if (name.startsWith('.')) return;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (dir === ROOT && SKIP.has(name)) return;
      walk(full, acc);
      return;
    }
    const kind = catalog.kindFromName(name);
    if (!kind) return;
    const relative = path.relative(ROOT, full).split(path.sep).join('/');
    acc.push({ id: relative, kind: kind, ext: catalog.extOf(name) });
  });
}

test('清单和磁盘上的音视频一致，而且类型没有混写', function () {
  const expected = [];
  walk(ROOT, expected);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'media.json'), 'utf8'));
  const actual = payload.items.map(function (item) {
    return { id: item.id, kind: item.kind, ext: item.ext };
  });
  expected.sort(function (a, b) { return a.id.localeCompare(b.id, 'zh'); });
  actual.sort(function (a, b) { return a.id.localeCompare(b.id, 'zh'); });
  assert.deepEqual(actual, expected);
  actual.forEach(function (item) {
    assert.equal(item.kind, catalog.kindFromName(item.id));
  });
  const mixed = payload.items.filter(function (item) {
    return item.folder.indexOf('mp3') >= 0 && item.kind === 'video';
  });
  assert.ok(mixed.some(function (item) { return item.title === 'P8 Extend'; }));
  const audioGroup = catalog.groupCatalog(payload.items).filter(function (group) { return group.kind === 'audio'; })[0];
  audioGroup.folders.forEach(function (folder) {
    folder.items.forEach(function (item) { assert.equal(item.kind, 'audio'); });
  });
});
