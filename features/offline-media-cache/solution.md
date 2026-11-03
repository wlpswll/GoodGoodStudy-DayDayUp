# 方案 — 播过的媒体离线再播

## 改动文件

- `shared/offline-policy.js`：纯淘汰策略，复制进 `miniprogram/shared/`
- `shared/offline-media.js`：网页 Cache Storage 读写
- `miniprogram/shared/offline-store.js`：小程序下载与本地文件
- `english/sw.js`、`gushi/sw.js`：页面壳网络优先、失败时用缓存
- `english/js/app.js`、`gushi/js/app.js`、两个小程序播放页：播放前查缓存，播放成功后留下
- `english/scripts/build-catalog.py`：同步策略文件
- `tests/offline-policy.test.js`、`tests/offline-store.test.js`

## 关键取舍

- 播放器自己的分段请求不拦截。另一次完整下载写入缓存，避免把 206 片段当成整文件。
- 当前这次播放仍用原地址。本机地址从下一次打开开始使用，避免换地址导致重头播放。
- 视频只留最近 3 课，总容量 120MB。音频在剩余空间里按最久未用淘汰。

## 验证计划

- `node --test tests/offline-policy.test.js tests/offline-store.test.js`
- `node --test tests/*.test.js`
- 浏览器打开英语页，确认播放脚本加载且离线模块可调用。

## 回退策略

去掉播放页对离线模块的调用，媒体地址恢复为原来的网络地址。

## 不可裁剪风险

小程序保存文件可能因配额失败。失败时只放弃缓存，不中断当前播放。
