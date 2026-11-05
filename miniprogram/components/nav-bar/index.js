var navMetrics = require('../../shared/nav-metrics.js');

Component({
  properties: {
    title: { type: String, value: '' },
    /* 首页本身不需要「回首页」入口，左侧留空保持标题居中 */
    showHome: { type: Boolean, value: true },
    homeLabel: { type: String, value: '首页' },
    bg: { type: String, value: '#f3ead7' }
  },

  data: {
    statusBarHeight: navMetrics.FALLBACK_STATUS,
    contentHeight: navMetrics.FALLBACK_CONTENT,
    navHeight: navMetrics.FALLBACK_STATUS + navMetrics.FALLBACK_CONTENT,
    sideWidth: navMetrics.FALLBACK_SIDE
  },

  lifetimes: {
    attached: function () {
      this.setData(navMetrics.metrics());
    }
  },

  methods: {
    onHome: function () {
      if (typeof wx === 'undefined') return;
      var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      if (pages && pages.length > 1 && typeof wx.navigateBack === 'function') {
        wx.navigateBack({ delta: 1 });
      } else if (typeof wx.reLaunch === 'function') {
        wx.reLaunch({ url: '/pages/home/home' });
      }
    }
  }
});
