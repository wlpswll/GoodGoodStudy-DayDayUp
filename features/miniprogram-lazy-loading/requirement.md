# L0 Intent Snapshot — 启用小程序按需注入

> 创建时间：2026-11-04
> 需求级别：L0（Micro Flow）

## 1. 用户原始诉求

> 上传又报“开启按需加载”错啦。

## 2. 本次做什么

- 目标：按微信官方文档要求启用小程序组件按需注入，使代码质量扫描通过。
- 影响范围：小程序启动与编译配置及其自动化断言。
- 预期改动文件/模块：`miniprogram/app.json`、`miniprogram/project.config.json`、`tests/miniprogram-adapter.test.js`。

## 3. 本次不做什么

- 不新增 API / 路由 / 数据库结构 / 权限模型 / 生产配置，除非本需求升级为 L1/L2。
- 不扩大到用户未要求的相邻优化。

## 4. 风险分类

| 检查项 | 结论 | 说明 |
|--------|------|------|
| `classify-change-risk.sh` | L0_SAFE | 未命中 API、权限、路由或生产配置 |
| Agent 语义复核 | 低风险 | 仅恢复 `app.json` 的 `lazyCodeLoading: "requiredComponents"`；当前基础库为 3.7.10，高于官方最低的 2.20.1 |
| 推荐流程 | L0_SAFE | 可通过撤回单一 JSON 字段恢复 |

## 5. 验收条件

| 编号 | 验收条件 | 验证方式 |
|------|----------|----------|
| AC-01 | `app.json` 启用 `lazyCodeLoading: "requiredComponents"` | Node 测试读取 JSON 断言 |
| AC-02 | 按需注入下不走 ES6→ES5 转译，避免产生缺失的 `@babel/runtime` helper | Node 测试读取项目配置 |
| AC-03 | 既有播放器结构仍保持“渲染后绑定 video context”，不引入 `cover-view` | 既有 Node 测试 |
| AC-02 | 改动未超出第 2 章声明范围 | git diff 检查 |

## 6. 轻量验证计划

- 自动验证：`node --test tests/miniprogram-adapter.test.js`、`node --test tests/*.test.js`。
- 手工验证：微信开发者工具重新编译后上传，确认代码质量扫描不再报“开启按需加载”。
- 预期 evidence：测试通过输出与小程序代码质量扫描结果。

## 7. 自治执行判定

| 判定项 | 结论 | 说明 |
|--------|------|------|
| 需求目的明确 | 是 | 官方扫描项与修正字段唯一明确 |
| 修改范围可控 | 是 | 只改第 2 章列出的两处 |
| 影响范围可控 | 是 | 不涉及 API / 路由 / 数据 / 权限 / 生产配置 / 发布脚本 / 跨仓 |
| 验证路径明确 | 是 | 有 JSON 断言、完整 Node 测试与开发者工具上传复测 |
| 回滚方式明确 | 是 | 删除 `lazyCodeLoading` 字段并恢复断言即可 |
| 风险分类 safe/low-risk | 是 | `classify-change-risk.sh` 为 L0_SAFE，语义复核无 high-risk |

> AGENT_AUTO_APPROVED：以上全部为“是”，可进入最小实现与自动验证。用户未授权本次提交、推送或合入；这些外部写操作不执行。

## 8. 自治确认门禁

> 进入实现前，Agent 必须向用户展示本 Intent Snapshot、风险分类、预计改动范围和验证方式。若第 7 章全部为“是”，记录 `AGENT_AUTO_APPROVED` 并直接 Execute；否则等待用户确认。
> MR/CR 自动创建仅在项目上下文或用户策略已授权时允许；实际生产发布和主线合入始终需要用户确认。

## 9. 对下游 Agent 的交接说明

- 给 Developer：只按第 2 章范围做最小实现；发现越界立即升级。
- 给 Reviewer / EvalLite：重点核对 AC、diff 范围、verify 摘要和 high-risk 命中情况。

## 10. L0 简要记录说明

本文件是 L0 的最小 SOP 记录，替代完整 P1 需求分析与对抗分析；仍保留用户原话、范围、风险、验收和确认证据，以满足 H 系列与后续审计。
