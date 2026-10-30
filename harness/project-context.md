# 项目上下文

> 本文件由 P0 项目初始化阶段生成，是治理工程认识被治理项目的核心入口。
> 本文件会跟随版本管理，禁止记录个人工作空间绝对路径、临时目录、私有机器路径；本地路径解析由 registry / `.impl-cache.yaml` / `HARNESS_TARGET_ROOT` 负责。
> Agent 默认先读取第 0 章快照，再按阶段读取相关章节，避免每阶段通读全文。

## 0. 技术栈快照（Agent 快速参考）

| 属性 | 值 |
| --- | --- |
| **主技术栈** | 静态 HTML / CSS / 原生 JavaScript（无框架、无打包器） |
| **包管理器/构建工具** | 无包管理器；目录扫描用 Python 3 生成 `english/data/media.json` |
| **Lint 工具** | 无（静态页；逻辑由 `node --test` 覆盖） |
| **测试框架** | Node.js 内置 `node:test` |
| **版本管理策略** | 本地 Git；保护分支 `main` / `master` / `release`；需求在 `feature/<id>` |
| **编码规范** | 浏览器脚本使用 IIFE，可同时 `module.exports` 供 Node 测试；不引入运行时依赖 |
| **治理拓扑** | 单项目 |
| **上下文读取策略** | 第 0 章常读；P1/P2 读 1~5/8/11；P4/P5 读 4/8/9；P6 读 8/9/10/11；P7 读 6/10/11 |
| **P0 用户补全状态** | 低风险项已按现有目录推断；托管与线上发布仍为 unknown，不阻塞 L1 静态页 |

## 1. 基本信息

- **项目名称：** GoodGoodStudy-DayDayUp（本地学习媒体站）
- **技术栈：** 静态页面。参考仓库中的 `gushi/`（古诗 70 首）是同一产品家族的纯前端页面：封面、播放页、侧滑目录。
- **包管理器：** 无
- **UI 框架：** 无
- **路由方式：** 页面内视图切换（封面/列表与播放页），不使用服务端路由

## 2. 仓库信息与治理拓扑

| Target ID | 仓库 | Git 地址 | 仓库内路径/相对 target root | 技术栈 | 用途 | SOP 产物归属 |
| --- | --- | --- | --- | --- | --- | --- |
| study-site | goodgoodstudy-daydayup | unknown | `.` | static-html | 古诗与英语学习静态页 | same-root |

### 2.1 P0 用户补全清单（源码无法可靠扫描）

| 信息项 | 当前值 | 来源 | 是否阻塞 | 说明 |
| --- | --- | --- | --- | --- |
| 代码托管平台 / MR 流程 | unknown | unknown | L2/跨仓阻塞 | 参考实现位于 GitHub `wlpswll/GoodGoodStudy-DayDayUp` 的 `gushi/`；本工作区目前只有 `english/` 媒体，未确认远端 |
| CI/CD 入口 | 无 CI | detected | 不阻塞 | 本地 `verify.sh` + 浏览器手工点播 |
| 部署平台 / 环境 | 静态文件托管 / 本地 HTTP 服务 | detected | 不阻塞 | 页面通过相对路径读取媒体，需 HTTP 打开，不能依赖 `file://` 的 fetch |
| 发布与回滚入口 | 替换静态目录；回滚即恢复上一版页面与 `data/media.json` | detected | L1 不阻塞 | 无独立发布系统 |
| 多仓 / 子模块拓扑 | 单仓 | detected | 不阻塞 | 无子模块 |
| 权限与人工确认边界 | 无登录、无生产写接口 | detected | 不阻塞 | 播放进度只写在本机存储 |

### 2.2 治理根与参与仓库

| 字段 | 值 |
| --- | --- |
| 治理根类型 | same-repo |
| SOP 产物根 | `features/<feature-id>/` |
| 主要代码 target | 仓库根，业务页面在 `english/` |
| 外部参与仓库 | 无 |
| checkout 解析方式 | 用户显式 `--repo` |

## 3. 核心目录结构

```
english/
├── index.html
├── css/style.css
├── js/                 # 播放页、目录分组、进度、平台存储
├── data/media.json     # 由脚本扫描媒体目录生成
├── scripts/            # 目录扫描
├── miniprogram/        # 小程序侧播放适配，复用同一进度契约
└── 一上英语课本跟读*/   # 原始音视频，按扩展名分入音频或视频
harness/                # 治理上下文
features/               # 需求包
tests/                  # node:test
```

## 4. 模块清单

| 模块名称 | 路由路径 | 职责说明 |
| --- | --- | --- |
| english-player | `english/index.html` | 英语跟读媒体列表、音视频播放、断点与倍速 |
| media-catalog | `english/js/catalog.js` | 按扩展名区分音视频，再按所在目录分组 |
| progress-store | `english/js/progress.js` | 上次媒体、进度、倍速的读写与恢复 |
| platform | `english/js/platform.js` | localStorage 与微信存储的适配 |
| miniprogram-adapter | `english/miniprogram/player-adapter.js` | 小程序 InnerAudio / VideoContext 适配同一会话接口 |

## 5. 开发流程

```
扫描 english/ 下媒体 → 生成 data/media.json → 静态页 fetch 列表
改纯逻辑后运行 node --test
改页面后用本地 HTTP 服务在浏览器里点播、拖动、刷新验证断点
```

## 6. 分支命名规范

- 需求：`feature/<描述>`
- 修复：`bugfix/<描述>`
- 文档：`docs/<描述>`
- 杂项：`chore/<描述>`
- 保护分支：`main`、`master`、`release`

## 7. 环境信息

- 本地开发方式：在仓库根执行 `python3 -m http.server`，浏览器打开 `/english/`
- 测试环境地址：无独立环境
- 预发布环境地址：无
- 正式环境地址：未部署

## 8. 编码约束

- 架构边界：目录分组、进度换算放在无 DOM 模块；页面脚本只负责绑定控件。音视频不要按文件夹名混排，以扩展名判定类型。
- API 调用方式：仅 `fetch` 本地 `data/media.json` 与媒体文件；无后端接口。
- 命名规范：进度存储键固定为 `english-player-progress-v1`；媒体 `id` 使用相对路径，保证重新扫描后仍能对上。
- 代码组织约束：样式沿用古诗页的纸色、侧滑目录和底部控制条，长标题用通栏列表而不是三列格子。
- 类型约束：无 TypeScript。进度对象字段为 `version`、`mediaId`、`kind`、`currentTime`、`playbackRate`、`updatedAt`。
- 其他项目特有约束：子资源保留 `sharecode` 透传；默认倍速为 1；常见音视频扩展名白名单集中在 `catalog.js`，扫描脚本与其保持一致。

## 9. 验证命令

- lint：关闭（无 lint 工具链）
- type-check：无
- build：`python3 english/scripts/build-catalog.py`
- test：`node --test tests/*.test.js`

| Target ID | root | stack | lint | build | test | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| study-site | `.` | static-html | 关闭 | `python3 english/scripts/build-catalog.py` | `node --test tests/*.test.js` | 目录生成后抽查分组；页面另做浏览器点播 |

## 10. 发布流程

### 测试环境

- 部署方式：本地静态服务
- 部署命令/脚本：`python3 -m http.server`
- CI/CD 地址：无
- 访问地址：`/english/`

### 正式环境

- 部署方式：将 `english/` 作为静态目录发布（与 `gushi/` 相同形态）
- 部署命令/脚本：未接入统一平台
- CI/CD 地址：无
- 访问地址：unknown

### 部署前置条件

- 测试环境部署前置：已生成 `english/data/media.json`
- 正式环境部署前置：同一静态目录可被 HTTP 访问

### 发布与回滚

- 发布入口：覆盖静态文件
- 发布确认人/规则：页面作者确认点播与断点
- 回滚入口：恢复上一版 `english/` 页面文件与 `data/media.json`；媒体原文件不改
- 回滚前置条件：保留上一版静态文件
- 无传统发布流程时的交付定义：本地 HTTP 可打开页面，列表按音视频分开，刷新后回到上次媒体和时间

## 11. 依赖项目

| 依赖 ID | 类型 | Git/服务地址 | 仓库内路径/逻辑路径 | 负责人/来源 | 治理方式 | 验证命令 |
| --- | --- | --- | --- | --- | --- | --- |
| gushi-reference | 同产品参考页 | https://github.com/wlpswll/GoodGoodStudy-DayDayUp | `gushi/` | 公开参考实现 | 只读参考，不修改 | 无 |

治理方式：`same-root`。本需求只在当前仓库新增英语播放页，不回写古诗页。
