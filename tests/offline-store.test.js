const test = require('node:test');
const assert = require('node:assert/strict');
const web = require('../shared/offline-media.js');
const mini = require('../miniprogram/shared/offline-store.js');

function memoryStorage() {
  const data = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem: function (key, value) { data[key] = String(value); }
  };
}

function fakeCaches() {
  const records = {};
  return {
    records: records,
    open: function () {
      return Promise.resolve({
        match: function (url) { return Promise.resolve(records[url] || null); },
        put: function (url, response) { records[url] = response; return Promise.resolve(); },
        delete: function (url) { delete records[url]; return Promise.resolve(true); }
      });
    }
  };
}

test('网页第二次解析到本机 blob 地址，并淘汰超出的旧视频', async function () {
  const storage = memoryStorage();
  const caches = fakeCaches();
  const bodies = {
    'https://cdn.example/a.mp4': 'aaaa',
    'https://cdn.example/b.mp4': 'bbbb',
    'https://cdn.example/c.mp4': 'cccc',
    'https://cdn.example/d.mp4': 'dddd'
  };
  const offline = web.createBrowserOffline({
    storage: storage,
    caches: caches,
    policy: require('../shared/offline-policy.js'),
    createObjectURL: function (blob) { return 'blob:' + blob._text; },
    fetch: function (url) {
      return Promise.resolve({
        ok: true,
        blob: function () { return Promise.resolve({ size: 80, type: 'video/mp4', _text: bodies[url] }); }
      });
    }
  });
  for (const name of ['a', 'b', 'c', 'd']) {
    const url = 'https://cdn.example/' + name + '.mp4';
    await offline.retain(url, { app: 'english', kind: 'video', lastUsed: name.charCodeAt(0) });
  }
  assert.equal(await offline.resolve('https://cdn.example/a.mp4'), 'https://cdn.example/a.mp4');
  assert.equal(await offline.resolve('https://cdn.example/d.mp4'), 'blob:dddd');
  const index = JSON.parse(storage.getItem(web.INDEX_KEY));
  assert.equal(index.some(function (item) { return item.id.indexOf('/a.mp4') >= 0; }), false);
  assert.equal(index.length, 3);
});

function fakeWx() {
  const files = {};
  const storage = {};
  let seq = 0;
  return {
    storage: storage,
    files: files,
    getStorageSync: function (key) { return storage[key] || null; },
    setStorageSync: function (key, value) { storage[key] = value; },
    downloadFile: function (opts) {
      opts.success({ statusCode: 200, tempFilePath: 'tmp-' + (++seq), dataLength: 30 });
    },
    getFileSystemManager: function () {
      return {
        accessSync: function (path) {
          if (!files[path]) throw new Error('missing');
        },
        saveFile: function (opts) {
          const path = 'saved-' + opts.tempFilePath;
          files[path] = true;
          opts.success({ savedFilePath: path });
        },
        getFileInfo: function (opts) { opts.success({ size: 30 }); },
        unlinkSync: function (path) { delete files[path]; }
      };
    }
  };
}

test('小程序保存本地路径，文件丢失后不再命中', async function () {
  const wxApi = fakeWx();
  const store = mini.createMiniOffline({ wx: wxApi });
  const path = await store.retain('poem-1', 'https://cdn.example/p1.m4a', { app: 'gushi', kind: 'audio' });
  assert.equal(store.lookup('poem-1'), path);
  delete wxApi.files[path];
  assert.equal(store.lookup('poem-1'), '');
  assert.equal(wxApi.getStorageSync(mini.INDEX_KEY).length, 0);
});
