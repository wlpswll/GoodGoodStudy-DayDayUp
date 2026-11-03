# .web-inspection/hooks/

四类项目特定钩子（**默认全部禁用**），按需启用。

| 钩子 | 触发时机 | 典型用途 |
| --- | --- | --- |
| `before-inspect.sh` | 巡检准备前 | 启动 mock server / 准备测试数据 |
| `login.sh` | `login.method=hook` 时 | SSO / 扫码 / 用户名密码 |
| `custom-verify.sh` | 每个用例验证后 | 业务语义验证（如"总额非零"） |
| `after-inspect.sh` | 巡检结束 | 回收资源 / 上传报告 |

## 推荐启用方式（无需会写 shell）

直接对 Agent 说出你的意图，例如：

| 你想做的事 | 跟 Agent 说 |
| --- | --- |
| 改登录方式 | "我想改成扫码登录" / "用账号密码登录" |
| 巡检前先准备数据 | "巡检前帮我跑 `npm run mock`" |
| 业务规则验证 | "确认订单详情页的'总额'非零才算 PASS" |
| 报告归档 | "巡检后把报告上传到我的 OSS bucket" |

Agent 会套用对应模板生成 `*.sh` 并自动 `chmod +x`，提交前可让你 review 内容。

## 进阶：手动启用

```bash
bash <skill-root>/scripts/enable-hook.sh "$(pwd)" --list

bash <skill-root>/scripts/enable-hook.sh "$(pwd)" before-inspect

cp <skill-root>/templates/hooks/login.sh.example ./hooks/login.sh
chmod +x ./hooks/login.sh
```

启用后编辑实现 → `git add` 提交。skill 仅在文件**存在且可执行**时调用。

完整契约（环境变量、退出码、调试技巧）见 `<skill-root>/docs/hooks-guide.md`。
