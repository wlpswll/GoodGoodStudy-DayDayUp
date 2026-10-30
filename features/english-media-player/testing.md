# 测试验证 — 英语学习媒体播放器

> 创建时间：2026-10-30
> 输入文档：requirement.md, solution.md, development.md, code-review.md

## 1. 验收结论

**PASS**

## 2. 测试范围

- 本次测试覆盖的功能模块：媒体清单、音视频分组、点播、倍速、断点、搜索、视频最大窗口、小程序适配器。
- 本次测试不覆盖的范围及原因：不在微信开发者工具里安装小程序；不对 mov/mkv 做实机解码，页面只保证能识别并在失败时提示。

## 3. 测试用例清单

| 编号 | 类型 | 对应验收标准 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|------|------|-------------|----------|----------|----------|----------|
| TC-01 | 正向 | AC-01 | 本地 HTTP 打开 english/ | 看列表 | 视频 7、音频 11；P8 Extend 在视频组 | PASS |
| TC-02 | 正向 | AC-02 | 同上 | 点 p9 Letters-1 | 标题一致，音频地址是该文件，开始播放 | PASS |
| TC-03 | 正向 | AC-02 | 正在播音频 | 点下一个 | 进入 p9 Letters-2，仍是音频 5/11 | PASS |
| TC-04 | 正向 | AC-02 | 打开目录 | 点 U1跟读 | 视频元素地址是 U1，画面出现，视频 1/7，上一个禁用 | PASS |
| TC-05 | 正向 | AC-03 AC-08 | 仓库根目录 | node --test | 扩展名识别与磁盘清单一致 | PASS |
| TC-06 | 正向 | AC-04 AC-05 | 播到约 18 秒并选 1.5 倍 | 刷新 | 仍是该课，currentTime 为 18，倍速 1.5，暂停并提示已回到上次位置 | PASS |
| TC-07 | 边界 | AC-06 | 单测 | clampResumeTime(9.4, 10) | 返回 0 | PASS |
| TC-08 | 正向 | AC-05 | 首次无记录的单测 | normalizeRate(undefined) | 返回 1 | PASS |
| TC-09 | 正向 | AC-07 | 单测假 wx | 加载音频并 seek、setRate | 进度字段 version、mediaId、playbackRate 一致 | PASS |
| TC-10 | 正向 | AC-01 | 列表搜索 Letters | 输入 Letters | 只剩 Letters-1 和 Letters-2 | PASS |
| TC-11 | 回归 | AC-04 | 从播放页回列表 | 点回到列表 | 继续播放条显示 U1跟读和已记住的时间 | PASS |
| TC-12 | 正向 | AC-09 | 正在播视频 | 点顶部「全屏」，再点「退出全屏」 | 按钮进入按下状态并请求系统全屏；再点后退出。音频课不显示该按钮 | PASS |
| TC-13 | 正向 | AC-04 | 视频用支持 Range 的本地服务打开 | 跳到 45 秒后刷新 | 仍是该视频，进度为 0:45 | PASS |
| TC-15 | 正向 | AC-04 | U1 播到约 1:45 后改播 U2 | 再点回 U1 | U1 从约 1:48 继续，不是从 0 开始；U2 自己的进度仍在 | PASS |
| TC-14 | 正向 | AC-10 | 打开目录 | 点「一上英语课本跟读视频」，再点一次 | 其下 U1–U6 先消失，再出现 | PASS |

## 4. 回归测试

| 编号 | 已有功能 | 验证方式 | 结果 |
|------|---------|----------|------|
| RT-01 | 原始音视频文件未被改写 | 播放的是原路径，扫描脚本只写 data/media.json | PASS |
| RT-02 | 古诗页 | 本次未改 gushi，仓库里本来也没有这份页面 | PASS |

## 5. 自动化测试

### 5.1 测试代码清单

| 测试文件路径 | 对应用例编号 | 测试类型 | 说明 |
|-------------|-------------|----------|------|
| tests/catalog.test.js | TC-01 TC-05 | 单元 | 分组、编码、搜索 |
| tests/progress.test.js | TC-07 TC-08 | 单元 | 倍速、断点、坏数据 |
| tests/media-list.test.js | TC-05 | 单元 | 清单与磁盘一致 |
| tests/miniprogram-adapter.test.js | TC-09 | 单元 | 小程序会话 |
| tests/smoke.test.js | — | 冒烟 | 测试入口 |

### 5.2 测试执行结果

浏览器：`http://127.0.0.1:8765/english/`。桌面点播音频、视频、倍速、刷新恢复和搜索；390×844 视口下进度条和 1.5× 仍在画面内。

verify 摘要在跑完脚本后补在本文件末尾的执行记录里。

## 6. 验证→发布判定

- 判定结果：AGENT_AUTO_APPROVED。`evidence/eval-report.json` 中 release_allowed 为 true，traceability 为 TRACEABILITY_PASS。
- verify：Summary: 7 PASS / 0 WARN / 0 FAIL / 3 SKIP；Result: PASSED。
- 需求目的明确：是。
- 验证路径：node --test、verify.sh、浏览器点播。
