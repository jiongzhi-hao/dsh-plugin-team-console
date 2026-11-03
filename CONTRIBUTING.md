# 贡献指南

欢迎 issue 与 pull request。本项目是一个 DeepSeek Harness 宿主侧 + 客户端插件，改动会直接影响用户的模型额度与文件，请先读下面的约束。

## 环境

- Node.js ≥ 20（CI 覆盖 20 / 22 / 24）
- 本地开发需要一个可加载插件的 DeepSeek Harness（`peerDependencies` 声明为 `@deepseek-ai/dsh >=0.2.1-rc.2`）

## 本地跑测试

```sh
npm test
```

等价于对本目录五个测试文件逐个执行 `node --test`：

```sh
node --test test/manager.test.mjs test/chat-bridge.test.mjs test/client-status.test.mjs test/naming.test.mjs test/presets-metrics.test.mjs
```

**如果你的环境限制子进程管道**（例如受限沙箱），`node --test` 可能报 `spawn EPERM`。此时直接单文件运行即可，`node:test` 会在进程内执行：

```sh
node test/manager.test.mjs
```

## 硬性约束（请勿违反）

1. **不要提交 `state/`。** 其中包含会话 ID、成员配置、用户任务原文与成员回答。`.gitignore` 已挡掉，CI 也会在检测到该目录时直接失败。
2. **宿主与模型的权限边界不可放宽。** 成员数量上限、模型可用性校验、`tools.guard` 的委派拦截都在宿主侧完成，不依赖提示词。任何绕过方案都不接受。
3. **不要把未验证的能力写成已实现。** 文档与注释里区分「已实现」「已知限制」「未验证」。
4. **改动行为契约时必须同步改测试。** 例如成员命名约定由 `test/naming.test.mjs` 与 `test/presets-metrics.test.mjs` 共同约束。

## 提交

- 一个提交只做一件事；行为变更请在 `CHANGELOG.md` 的 `Unreleased` 下加一条。
- 破坏性变更需要说明影响面与迁移方式（参考 `0.5.0` 里成员命名的写法）。
- PR 请保持 `npm test` 全绿。

## 目录

| 路径 | 作用 |
| --- | --- |
| `lib/index.js` | 宿主入口：原生执行适配、模型校验、工具拦截、认证 API |
| `lib/manager.js` | 团队状态机：分阶段执行、幂等派发、取消、消息归属 |
| `lib/chat-bridge.js` | 模型侧工具 `list_agents` / `team_discuss` |
| `lib/presets.js` | 六套预设模板与成员命名约定 |
| `lib/metrics.js` | 用量与耗时汇总 |
| `lib/client.js` | 右侧群聊面板 |
| `cordis.patch.yml` | 插件注册补丁 |
