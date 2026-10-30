const test = require('node:test');
const assert = require('node:assert/strict');
const progress = require('../english/js/progress.js');
const platform = require('../english/js/platform.js');

function memoryStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    get: function (key) { return data[key] ? JSON.parse(data[key]) : null; },
    set: function (key, value) { data[key] = JSON.stringify(value); },
    raw: data
  };
}

test('默认倍速是 1，非法倍速回到 1', function () {
  assert.equal(progress.DEFAULT_RATE, 1);
  assert.equal(progress.normalizeRate(undefined), 1);
  assert.equal(progress.normalizeRate(0.85), 1);
  assert.equal(progress.normalizeRate(1.25), 1.25);
  assert.equal(progress.formatRate(1), '1×');
});

test('进度可以写回并在清单里找到上次的媒体', function () {
  const storage = memoryStorage();
  const media = { id: '视频/U1跟读.mp4', kind: 'video', title: 'U1跟读' };
  const snapshot = progress.createSnapshot(media, 12.4, 1.5, 100);
  assert.equal(progress.writeProgress(storage, snapshot), true);
  const read = progress.readProgress(storage);
  assert.equal(read.mediaId, media.id);
  assert.equal(read.currentTime, 12.4);
  assert.equal(read.playbackRate, 1.5);
  const resume = progress.resolveResume(read, [media, { id: 'other', kind: 'audio' }]);
  assert.equal(resume.media, media);
  assert.equal(resume.missing, false);
});

test('切换到另一课后仍保留上一课的播放位置', function () {
  const storage = memoryStorage();
  const u1 = { id: '视频/U1跟读.mp4', kind: 'video' };
  const u2 = { id: '视频/U2跟读.mp4', kind: 'video' };
  assert.equal(progress.writeProgress(storage, progress.createSnapshot(u1, 80, 1, 1)), true);
  assert.equal(progress.writeProgress(storage, progress.createSnapshot(u2, 10, 1.5, 2)), true);
  const read = progress.readProgress(storage);
  assert.equal(read.mediaId, u2.id);
  assert.equal(read.currentTime, 10);
  assert.equal(progress.timeFor(read, u1.id), 80);
  assert.equal(progress.timeFor(read, u2.id), 10);
  assert.equal(progress.timeFor(read, '没有这课'), 0);
});

test('旧的单课记录仍能读出那一课的时间', function () {
  const storage = memoryStorage();
  storage.set(progress.PROGRESS_KEY, {
    version: 1,
    mediaId: '视频/U1跟读.mp4',
    kind: 'video',
    currentTime: 33,
    playbackRate: 1,
    updatedAt: 1
  });
  const read = progress.readProgress(storage);
  assert.equal(progress.timeFor(read, '视频/U1跟读.mp4'), 33);
  assert.equal(read.currentTime, 33);
});

test('清单里已经没有的媒体不会被错误恢复', function () {
  const resume = progress.resolveResume({
    version: 1,
    mediaId: 'missing.mp3',
    kind: 'audio',
    currentTime: 4,
    playbackRate: 2,
    updatedAt: 1
  }, []);
  assert.equal(resume.media, null);
  assert.equal(resume.missing, true);
  assert.equal(resume.playbackRate, 2);
});

test('快结束时下次从 0 开始，中间位置保持不动', function () {
  assert.equal(progress.clampResumeTime(9.4, 10), 0);
  assert.equal(progress.clampResumeTime(3.2, 10), 3.2);
  assert.equal(progress.clampResumeTime(-2, 10), 0);
  assert.equal(progress.formatClock(65), '1:05');
});

test('坏数据和空存储不会被当成有效进度', function () {
  assert.equal(progress.readProgress({ get: function () { return { version: 2, mediaId: 'a' }; } }), null);
  assert.equal(progress.readProgress({ get: function () { throw new Error('boom'); } }), null);
  assert.equal(progress.readProgress(null), null);
});

test('检测到 wx 时走小程序存储，否则走 localStorage', function () {
  const wxStore = {};
  const wxStorage = platform.createStorage({
    wx: {
      getStorageSync: function (key) { return wxStore[key] || ''; },
      setStorageSync: function (key, value) { wxStore[key] = value; }
    }
  });
  wxStorage.set('english-player-progress-v1', { version: 1, mediaId: 'a.mp3' });
  assert.equal(wxStorage.kind, 'wx');
  assert.equal(wxStorage.get('english-player-progress-v1').mediaId, 'a.mp3');

  const localStore = {};
  const local = platform.createStorage({
    localStorage: {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(localStore, key) ? localStore[key] : null; },
      setItem: function (key, value) { localStore[key] = value; }
    }
  });
  local.set('k', { ok: 1 });
  assert.equal(local.kind, 'local');
  assert.deepEqual(local.get('k'), { ok: 1 });
});
