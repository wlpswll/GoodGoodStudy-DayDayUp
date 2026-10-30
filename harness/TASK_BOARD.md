# 项目任务看板

> 本文件是所有 Agent 的跨会话记忆入口。Agent 接到任务时先读取本文件了解项目全局上下文。
> 由 `start-feature.sh` / `finalize-feature.sh` / `sync-changelog.sh` / `track-merge.sh` 自动维护；PM Orchestrator 仅在中间阶段手动修订「当前阶段」「阻塞项」。

## 任务生命周期 3 态机（task-lifecycle-and-incremental T-011 引入）

```
进行中 ──finalize-feature──▶ 待发布 ──sync-changelog --merge-commit──▶ 已完成
                                       或 track-merge.sh（自动批量推进）
```

| 段落 | 触发脚本 | 含义 |
|------|---------|------|
| 进行中 | `start-feature.sh` 自动登记 | P0~P5 / P6 / P7 流程中 |
| 待发布 | `finalize-feature.sh` 自动迁移 | 已 finalize；MR/CR 可已创建或待创建；finalize 产物已 commit/push 到特性分支后特性分支冻结，等待主线合入。详见 `playbooks/p6-p7.md` Step 11 |
| 已完成 | `sync-changelog --merge-commit` 或 `track-merge.sh` | 已合入主线（master/main）|

## "当前阶段"列允许值（仅「进行中」段使用）

| 阶段值 | 含义 |
|--------|------|
| P0 已就绪 / P1 / P2 / P3-A / P4-A / P5-A / P3-B / P4-B / P5-B / P6 / P7 | 治理流程阶段 |
| 🔄 回退中 | 阶段回退（评审/测试不通过）|

## 进行中的任务

| 任务 ID | 需求标题 | 级别 | 当前阶段 | 创建日期 | 阻塞项 |
|---------|---------|------|---------|---------|--------|
| T-012 | english-media-player: 英语学习媒体播放器 | L1 | P0 已就绪 | 2026-10-30 | 无 |

## 待发布的任务

| 任务 ID | 需求标题 | 级别 | 提 MR 日期 | MR URL | 阻塞项 |
|---------|---------|------|-----------|--------|--------|

## 已完成的任务

| 任务 ID | 需求标题 | 级别 | 完成日期 | 交付结论 |
|---------|---------|------|---------|---------|

## 已取消/暂停的任务

| 任务 ID | 需求标题 | 原因 | 日期 |
|---------|---------|------|------|
