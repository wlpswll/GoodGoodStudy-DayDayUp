# Playwright 导出目录（编译产物）

由 `scripts/export-playwright.sh` 从 SOP 的 ```ui-cases 生成。

- **不要手改** `tests/*.spec.ts`；改用例请改 `.web-inspection/sop/`，再重新导出。
- 安装：`npm install && npx playwright install chromium`
- 默认登录：`global-setup.ts` 先尝试一键确认或环境变量凭据；失败会输出 `WI_PW_LOGIN_FAILED`，由 Agent 回退 CDP
- 凭据环境变量：默认 `WI_LOGIN_USERNAME` / `WI_LOGIN_PASSWORD` / `WI_LOGIN_CODE`，可在 `login.credentials` 改变量名
- 已有 Chrome 登录态（可选）：`bash <skill>/scripts/capture-auth-state.sh <project-root>` → `.auth/storage-state.json`
- 运行：`npm test` 或 `WI_BASE_URL=... npm test`
- CDP 是登录失败后的回退或用户显式选择，见 skill 文档 `docs/playwright-dual-track.md`
