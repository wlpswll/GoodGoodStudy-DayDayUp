/* 存储适配。网页用 localStorage；小程序页面传入或检测到 wx 时用同步存储。 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EnglishPlatform = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createStorage(env) {
    var scope = env || {};
    var wxApi = scope.wx;
    if (!wxApi && typeof wx !== 'undefined') wxApi = wx;
    if (wxApi && typeof wxApi.getStorageSync === 'function' && typeof wxApi.setStorageSync === 'function') {
      return {
        kind: 'wx',
        get: function (key) {
          try {
            var value = wxApi.getStorageSync(key);
            if (value == null || value === '') return null;
            return typeof value === 'string' ? JSON.parse(value) : value;
          } catch (err) {
            return null;
          }
        },
        set: function (key, value) {
          wxApi.setStorageSync(key, JSON.stringify(value));
        }
      };
    }

    var local = scope.localStorage;
    if (!local && typeof localStorage !== 'undefined') local = localStorage;
    return {
      kind: 'local',
      get: function (key) {
        if (!local) return null;
        try {
          var raw = local.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch (err) {
          return null;
        }
      },
      set: function (key, value) {
        if (!local) return;
        local.setItem(key, JSON.stringify(value));
      }
    };
  }

  return { createStorage: createStorage };
});
