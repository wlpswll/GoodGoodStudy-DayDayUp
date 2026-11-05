/* 自定义导航栏尺寸。数值全部来自 wx 的系统信息，不写死机型。
 * 内容区高度按右上角胶囊的位置反推，这样标题栏和胶囊能在同一直线上。 */
var FALLBACK_STATUS = 20;
var FALLBACK_CONTENT = 44;
var FALLBACK_WIDTH = 375;
var FALLBACK_SIDE = 96;

function metrics(wxApi) {
  var api = wxApi || (typeof wx !== 'undefined' ? wx : null);
  var status = FALLBACK_STATUS;
  var width = FALLBACK_WIDTH;

  if (api) {
    try {
      var info = typeof api.getWindowInfo === 'function'
        ? api.getWindowInfo()
        : (typeof api.getSystemInfoSync === 'function' ? api.getSystemInfoSync() : null);
      if (info) {
        status = Number(info.statusBarHeight) || FALLBACK_STATUS;
        width = Number(info.windowWidth) || width;
      }
    } catch (err) { /* 低版本基础库拿不到就走兜底 */ }
  }

  var content = FALLBACK_CONTENT;
  var side = FALLBACK_SIDE;
  if (api && typeof api.getMenuButtonBoundingClientRect === 'function') {
    try {
      var cap = api.getMenuButtonBoundingClientRect();
      if (cap && cap.height > 0 && cap.top >= status && cap.left > 0) {
        var gap = cap.top - status;
        if (gap < 2 || gap > 40) gap = 6;
        content = gap * 2 + cap.height;
        /* 左右占位对称，标题才真正居中；同时保证右侧不压到胶囊 */
        side = Math.max(80, Math.round(width - cap.left));
      }
    } catch (err) { /* 模拟器偶尔返回空对象 */ }
  }

  return {
    statusBarHeight: status,
    contentHeight: content,
    navHeight: status + content,
    sideWidth: side
  };
}

module.exports = {
  metrics: metrics,
  FALLBACK_STATUS: FALLBACK_STATUS,
  FALLBACK_CONTENT: FALLBACK_CONTENT,
  FALLBACK_WIDTH: FALLBACK_WIDTH,
  FALLBACK_SIDE: FALLBACK_SIDE
};
