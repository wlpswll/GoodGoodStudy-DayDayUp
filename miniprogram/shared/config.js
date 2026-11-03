/* 小程序端配置：默认使用已部署在 Cloudflare Pages 上的 HTTPS 媒体资源，
 * 无需启动本地服务，在微信开发者工具模拟器与手机真机上均可直接加载音视频与配图。
 */
var SERVER_ORIGIN = 'https://goodgoodstudy-daydayup.pages.dev';

module.exports = {
  SERVER_ORIGIN: SERVER_ORIGIN,
  GUSHI_BASE_URL: SERVER_ORIGIN + '/gushi',
  ENGLISH_BASE_URL: SERVER_ORIGIN + '/english'
};
