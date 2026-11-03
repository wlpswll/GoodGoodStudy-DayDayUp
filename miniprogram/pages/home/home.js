/* 好好学习 · 天天向上 小程序首页 */
var gamesEngine = require('../../shared/games-engine.js');

Page({
  data: {
    games: gamesEngine.GAMES
  },

  goGushi: function () {
    if (typeof wx !== 'undefined' && typeof wx.navigateTo === 'function') {
      wx.navigateTo({ url: '/pages/gushi/gushi' });
    }
  },

  goEnglish: function () {
    if (typeof wx !== 'undefined' && typeof wx.navigateTo === 'function') {
      wx.navigateTo({ url: '/pages/player/player' });
    }
  },

  onOpenGame: function (event) {
    var ds = (event && event.currentTarget && event.currentTarget.dataset) || {};
    var id = ds.id || 'gomoku';
    if (typeof wx !== 'undefined' && typeof wx.navigateTo === 'function') {
      wx.navigateTo({ url: '/pages/games/games?id=' + encodeURIComponent(id) });
    }
  },

  onJumpMiniApp: function (event) {
    var ds = (event && event.currentTarget && event.currentTarget.dataset) || {};
    var appId = ds.appid;
    var id = ds.id || 'gomoku';
    if (appId && typeof wx !== 'undefined' && typeof wx.navigateToMiniProgram === 'function') {
      wx.navigateToMiniProgram({
        appId: appId,
        fail: function () {
          if (typeof wx.navigateTo === 'function') {
            wx.navigateTo({ url: '/pages/games/games?id=' + encodeURIComponent(id) });
          }
        }
      });
      return;
    }
    if (typeof wx !== 'undefined' && typeof wx.navigateTo === 'function') {
      wx.navigateTo({ url: '/pages/games/games?id=' + encodeURIComponent(id) });
    }
  }
});
