# Plan — 播放器整体布局优化

## 改动文件

- `miniprogram/pages/player/player.wxml`：标题信息重组为主信息行与状态行。
- `miniprogram/pages/player/player.wxss`：压缩顶部栏、标题区和播放控制器。
- `english/index.html`：采用与小程序一致的信息分组，保留现有 DOM ID。
- `english/css/style.css`：同步紧凑布局及短屏适配。
- `tests/miniprogram-adapter.test.js`：校验紧凑布局结构存在。

## 关键取舍

- 保留现有纸墨视觉、按钮顺序和触控尺寸，只减少重复留白。
- 标题保持单行省略；文件夹和状态提示在第二行并排，避免纵向堆叠。
- 不改播放器 JavaScript、媒体比例和缓存行为。

## 验证与回退

- 运行 `node --test tests/*.test.js`。
- 用移动视口检查 U5 视频页的标题区高度和视频可用高度。
- 回退时恢复上述 HTML/WXML/CSS/WXSS 文件。

## 不可裁剪风险

- DOM ID 必须保持不变，否则 Web 播放器事件绑定会失效。
- 小程序标题区高度变化后，视频尺寸计算必须仍能读取 `.now` 与 `.controls` 的真实高度。
