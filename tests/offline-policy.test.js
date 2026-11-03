const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../shared/offline-policy.js');

function entry(id, kind, bytes, lastUsed) {
  return { id: id, app: 'english', kind: kind, bytes: bytes, lastUsed: lastUsed, url: id };
}

test('视频超过 3 条时淘汰最久未播放的一条', function () {
  const existing = [
    entry('v1', 'video', 100, 1),
    entry('v2', 'video', 100, 2),
    entry('v3', 'video', 100, 3)
  ];
  const decision = policy.plan(existing, entry('v4', 'video', 100, 4));
  assert.deepEqual(decision.evict.map(function (item) { return item.id; }), ['v1']);
  assert.deepEqual(decision.keep.map(function (item) { return item.id; }).sort(), ['v2', 'v3', 'v4']);
});

test('容量不够时先淘汰旧音频，名额内的视频继续留下', function () {
  const limits = { videoCount: 3, totalBytes: 250 };
  const existing = [
    entry('a1', 'audio', 100, 1),
    entry('a2', 'audio', 100, 2),
    entry('v1', 'video', 100, 3)
  ];
  const decision = policy.plan(existing, entry('a3', 'audio', 100, 4), limits);
  assert.deepEqual(decision.evict.map(function (item) { return item.id; }), ['a1', 'a2']);
  assert.equal(decision.keep.some(function (item) { return item.id === 'v1'; }), true);
  assert.equal(policy.bytesOf(decision.keep) <= 250, true);
});

test('同一首再次播放只更新原来的记录', function () {
  const existing = [entry('a1', 'audio', 40, 1), entry('a2', 'audio', 40, 2)];
  const decision = policy.plan(existing, entry('a1', 'audio', 50, 9), { videoCount: 3, totalBytes: 1000 });
  assert.equal(decision.evict.length, 0);
  assert.equal(decision.keep.filter(function (item) { return item.id === 'a1'; }).length, 1);
  assert.equal(decision.keep.filter(function (item) { return item.id === 'a1'; })[0].bytes, 50);
});
