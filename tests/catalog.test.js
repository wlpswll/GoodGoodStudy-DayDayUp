const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../english/js/catalog.js');

test('按扩展名区分音视频，大小写不敏感', function () {
  assert.equal(catalog.kindFromName('U4 Story.MP3'), 'audio');
  assert.equal(catalog.kindFromName('lesson.m4a'), 'audio');
  assert.equal(catalog.kindFromName('a.wav'), 'audio');
  assert.equal(catalog.kindFromName('a.aac'), 'audio');
  assert.equal(catalog.kindFromName('a.ogg'), 'audio');
  assert.equal(catalog.kindFromName('a.flac'), 'audio');
  assert.equal(catalog.kindFromName('P8 Extend.mp4'), 'video');
  assert.equal(catalog.kindFromName('clip.webm'), 'video');
  assert.equal(catalog.kindFromName('clip.mov'), 'video');
  assert.equal(catalog.kindFromName('clip.mkv'), 'video');
  assert.equal(catalog.kindFromName('.DS_Store'), null);
  assert.equal(catalog.kindFromName('notes.txt'), null);
});

test('音频目录里的视频不会和音频分在一组', function () {
  const groups = catalog.groupCatalog([
    { id: 'mp3/p3.mp3', title: 'p3', kind: 'audio', ext: 'mp3', folder: '一上英语课本跟读mp3' },
    { id: 'mp3/P8 Extend.mp4', title: 'P8 Extend', kind: 'video', ext: 'mp4', folder: '一上英语课本跟读mp3' },
    { id: 'video/U2.mp4', title: 'U2跟读', kind: 'video', ext: 'mp4', folder: '一上英语课本跟读视频' },
    { id: 'video/U10.mp4', title: 'U10跟读', kind: 'video', ext: 'mp4', folder: '一上英语课本跟读视频' },
    { id: 'video/U1.mp4', title: 'U1跟读', kind: 'video', ext: 'mp4', folder: '一上英语课本跟读视频' }
  ]);
  assert.deepEqual(groups.map(function (group) { return group.kind; }), ['video', 'audio']);
  const videoFolder = groups[0].folders.filter(function (folder) {
    return folder.name === '一上英语课本跟读视频';
  })[0];
  assert.deepEqual(videoFolder.items.map(function (item) { return item.title; }), ['U1跟读', 'U2跟读', 'U10跟读']);
  const stray = groups[0].folders.filter(function (folder) {
    return folder.name === '一上英语课本跟读mp3';
  })[0];
  assert.equal(stray.items[0].title, 'P8 Extend');
  assert.equal(groups[1].folders[0].items.length, 1);
  assert.equal(groups[1].folders[0].items[0].kind, 'audio');
});

test('地址按路径分段编码，保留目录斜杠', function () {
  const src = catalog.resolveSrc({
    src: '一上英语课本跟读mp3/p19 A Listen. Then point and say.mp3'
  }, 'https://cdn.example/media');
  assert.equal(
    src,
    'https://cdn.example/media/' +
      encodeURIComponent('一上英语课本跟读mp3') + '/' +
      encodeURIComponent('p19 A Listen. Then point and say.mp3')
  );
});

test('搜索能匹配课名和文件夹', function () {
  const item = { title: 'U1跟读', folder: '一上英语课本跟读视频', ext: 'mp4', kind: 'video' };
  assert.equal(catalog.matchesQuery(item, 'u1'), true);
  assert.equal(catalog.matchesQuery(item, '视频'), true);
  assert.equal(catalog.matchesQuery(item, '不存在'), false);
});
