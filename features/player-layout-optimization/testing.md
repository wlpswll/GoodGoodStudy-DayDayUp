# Testing — 播放器整体布局优化

## 自动测试

- `node --test tests/*.test.js`：23/23 PASS。
- IDE lints：0 error。
- Harness verify：7 PASS / 1 WARN / 0 FAIL / 2 SKIP。

## Web 移动视口验收

- 视口：390 × 844 CSS px，DPR 2。
- U5 视频舞台：626.5px，占视口高度约 74.2%。
- 标题信息条：50.5px；主信息行 22px，状态行 14.5px。
- 控制栏：114px。
- 结果：标题、文件夹和缓存状态保持两行，视频未被中间文字区过度压缩，PASS。

## 小程序

- WXML/WXSS 结构与自动测试 PASS。
- 原生 `<video>` 最终视觉需要微信开发者工具清缓存后完整重编译确认。
