# 测试验证 — 播过的古诗和英语媒体可离线再播

> 创建时间：2026-11-03
> 输入文档：requirement.md, solution.md, gate-review.md, development.md, code-review.md

## 1. 验收结论

<!-- 只能是以下三者之一 -->
**{PASS / CONDITIONAL_PASS / FAIL}**

> L0 Micro：若 EvalLite 已 PASS，可在本文件记录“由 EvalLite 替代完整 P6”，并引用 development.md 中的 EvalLite 摘要；命中 high-risk 或 EvalLite FAIL 时不得跳过完整 P6。
> L1 Standard：本文件优先作为 Eval evidence，至少记录 AC 覆盖、自动验证命令、verify Summary/Result、`evidence/traceability_report.txt` 与 `evidence/eval-report.json` 结论；不默认展开 L2 长复盘。

## 2. 测试范围

- 本次测试覆盖的功能模块：
- 本次测试不覆盖的范围及原因：

## 3. 测试用例清单

| 编号 | 类型 | 对应验收标准 | 前置条件 | 操作步骤 | 预期结果 | 实际结果 |
|------|------|-------------|----------|----------|----------|----------|
| TC-01 | 正向 | AC-01 | | | | PASS / FAIL |
| TC-02 | 反向 | AC-01 | | | | PASS / FAIL |

## 4. 回归测试

| 编号 | 已有功能 | 验证方式 | 结果 |
|------|---------|----------|------|
| RT-01 | | | PASS / FAIL |

## 5. 自动化测试

### 5.1 测试代码清单

| 测试文件路径 | 对应用例编号 | 测试类型 | 说明 |
|-------------|-------------|----------|------|

### 5.2 测试执行结果

```
（粘贴测试输出摘要：通过数/失败数/总数）
```

### 5.3 完整验证报告（verify.sh）

```
（粘贴 verification_report.txt 的 Summary + Result 行）
```

详细违规项（若有 WARN/FAIL）：

| 检查项 | 结果 | 说明 |
|--------|------|------|

### 5.4 Eval / Traceability（L1/L2）

```
（粘贴 evidence/traceability_report.txt Result + evidence/eval-report.json 的 status / release_allowed）
```

## 6. 手工验证指引

### 前置条件

### 操作步骤

### 预期结果

## 7. 未通过项与风险

| 编号 | 用例 | 失败原因 | 影响范围 | 建议 |
|------|------|----------|----------|------|

## 8. 上线前建议
