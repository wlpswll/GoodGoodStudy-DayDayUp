# Harness 治理目录

本目录由 Harness Engineering 治理工程管理，集中存放项目身份和治理相关文件。

## 目录结构

```
harness/
├── project-context.md              ← 项目自述（技术栈+编码约束+环境+发布+依赖）
├── TASK_BOARD.md                   ← 任务看板（跨会话记忆）
├── verification_baseline.json      ← 验证基线（只升不降）
├── AI-CHANGELOG.md                 ← AI 变更日志
└── README.md                       ← 本文件
```

## 说明

- 本目录下的文件由治理工程的 Agent 和脚本创建/维护
- `project-context.md` 是所有 Agent 认识本项目的入口
- `TASK_BOARD.md` 是所有 Agent 的跨会话记忆
- 需求包（features/）位于项目根目录，与代码同仓版本管理
- 如需脱离治理，删除本目录即可，不影响项目源码
