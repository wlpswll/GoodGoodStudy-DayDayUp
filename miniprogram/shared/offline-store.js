/* 小程序端媒体缓存。下载完整文件后保存到本地，下次直接播放本地路径。 */
var policy = require('./offline-policy.js');

var INDEX_KEY = 'ggs-offline-index-v1';

function createMiniOffline(options) {
  var opts = options || {};
  var wxApi = opts.wx;
  var rules = opts.policy || policy;

  function readIndex() {
    try {
      var parsed = wxApi.getStorageSync(INDEX_KEY);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeIndex(entries) {
    wxApi.setStorageSync(INDEX_KEY, entries);
  }

  function fs() {
    return wxApi.getFileSystemManager();
  }

  function fileReady(path) {
    if (!path) return false;
    try {
      fs().accessSync(path);
      return true;
    } catch (err) {
      return false;
    }
  }

  function removeFile(path) {
    if (!path) return;
    try { fs().unlinkSync(path); } catch (err) { /* 文件可能已经不在 */ }
  }

  function applyPlan(incoming) {
    var decision = rules.plan(readIndex(), incoming);
    decision.evict.forEach(function (entry) { removeFile(entry.path); });
    writeIndex(decision.keep);
    return incoming.path;
  }

  return {
    lookup: function (id) {
      var hit = readIndex().filter(function (entry) { return entry.id === id; })[0];
      if (!hit) return '';
      if (fileReady(hit.path)) {
        hit.lastUsed = Date.now();
        applyPlan(hit);
        return hit.path;
      }
      writeIndex(readIndex().filter(function (entry) { return entry.id !== id; }));
      return '';
    },
    /* 文件还在但真机解码不了时，把这条缓存彻底清掉，改走网络地址。 */
    forget: function (id) {
      if (!id) return false;
      var entries = readIndex();
      var hit = entries.filter(function (entry) { return entry.id === id; })[0];
      if (!hit) return false;
      removeFile(hit.path);
      writeIndex(entries.filter(function (entry) { return entry.id !== id; }));
      return true;
    },
    retain: function (id, url, meta) {
      if (!id || !url || !wxApi || typeof wxApi.downloadFile !== 'function') return Promise.resolve('');
      var existing = readIndex().filter(function (entry) { return entry.id === id; })[0];
      if (existing && fileReady(existing.path)) {
        existing.lastUsed = Date.now();
        applyPlan(existing);
        return Promise.resolve(existing.path);
      }
      return new Promise(function (resolve) {
        wxApi.downloadFile({
          url: url,
          success: function (res) {
            if (!res || res.statusCode !== 200 || !res.tempFilePath) {
              resolve('');
              return;
            }
            fs().saveFile({
              tempFilePath: res.tempFilePath,
              success: function (saved) {
                var path = saved && saved.savedFilePath;
                if (!path) {
                  resolve('');
                  return;
                }
                var finish = function (bytes) {
                  resolve(applyPlan({
                    id: id,
                    app: meta && meta.app || '',
                    kind: meta && meta.kind || 'audio',
                    path: path,
                    bytes: Number(bytes) || Number(res.dataLength) || 0,
                    lastUsed: Date.now(),
                    url: url
                  }));
                };
                if (typeof fs().getFileInfo !== 'function') {
                  finish(res.dataLength);
                  return;
                }
                fs().getFileInfo({
                  filePath: path,
                  success: function (info) { finish(info && info.size); },
                  fail: function () { finish(res.dataLength); }
                });
              },
              fail: function () { resolve(''); }
            });
          },
          fail: function () { resolve(''); }
        });
      });
    }
  };
}

module.exports = {
  INDEX_KEY: INDEX_KEY,
  createMiniOffline: createMiniOffline
};
