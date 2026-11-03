# 团队群聊 · Team Console

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-28%20passing-brightgreen.svg)](./test)

**给 DeepSeek Harness 用的固定名单智能体团队控制台**：最多 4 名成员，每人绑定一个明确的模型，按阶段串并行执行，全程在右侧面板的群聊里可见，并且可以被主聊天直接派发。

不是「随便开一堆子智能体」，而是**由宿主状态机托管的固定团队** —— 人数、模型、可写范围与委派权限都由宿主校验，不依赖提示词。

---

## 这是什么

多数多智能体工具由模型自己决定何时开子智能体，于是有了三个典型问题：人数失控、模型被悄悄换成便宜的那个、以及「任务看起来完成了但其实没跑」。

这个插件把这三件事从模型手里拿走：

| 风险 | 这里的做法 |
| --- | --- |
| 人数失控 | 成员上限由宿主校验，模型**没有**创建或修改成员的工具 |
| 模型被替换 | 每次执行通过 `subagents.startActivation` 的 `agentOptions.provider/model` 传入，不依赖主会话理解提示词，也不动全局默认模型 |
| 自行扩员绕过流程 | 宿主 `tools.guard` 拦截固定团队主会话的 `spawn_teammate`、`subagent*`、`workflow`、唤醒成员与调度工具，嵌套调用同样检查 |

与此同时，它解决了一个纯并行工具的老问题：**阶段**。同阶段并行，后续阶段拿到前面已完成成员的真实结果，而不是让四个人同时对着同一份任务各说各话。

---

## 功能特性

- **固定名单**：1–4 名成员，ID 稳定，配置保存在本机宿主侧，不依赖浏览器 localStorage。
- **明确模型**：每人一个 `provider/model`，保存时由宿主验证可用性。
- **阶段执行**：同一阶段并行，后续阶段接收前序已完成成员的结果；单一任务超时默认 15 分钟，模板可配置 1–60 分钟。
- **群聊面板**：按任务 ID、成员 ID 与事件序号归属消息，只展示 assistant 文本，过滤运行环境、时间、工具结果与思考过程。
- **完整停止**：取消成员执行、关联后台工作与所有未启动阶段；只有资源释放完成才报告停止完成，失败时保留「停止中」允许重试。
- **幂等派发**：重复请求不会创建第二次执行；同一团队同时只允许一个任务。
- **重启安全**：结果保留，未完成任务标记为「已中断」，不会自动恢复并消耗额度。
- **主聊天桥接**：主助手的 `list_agents` 只返回配置的成员；`team_discuss` 派发任务并等待真实结果。
- **用量观测**：任务结束输出墙钟时间、已上报用量的成员数、总 Token 与工具调用次数。

---

## 安装

需要先在本地具备一个可加载插件的 DeepSeek Harness。

### 方式一：本机 `link:` 引用（已验证）

在你的 DSH profile 中把本包指向本地目录。首次升级后**必须完整退出并重启 Harness** —— 单独刷新页面只会重载前端，宿主侧代码不会生效。

### 方式二：从 npm 安装

```sh
npm install @jiongzhi-hao/dsh-plugin-team-console
```

> 该包名已按公开发布配置（`publishConfig.access: public`）。若 npm 上尚无此包，请改用方式一。

插件通过 `cordis.patch.yml` 注册 `ui-team-console` 这一行，并在 `package.json` 的 `dsh` 字段声明宿主补丁与客户端入口。

---

## 快速开始

1. 打开右侧面板，点击 `+`，选择「团队群聊」。
2. 套用一套预设模板，或手工配置 1–4 名成员：模型、负责部分、允许修改的文件范围。
3. 点击「保存团队」。宿主会验证供应商与模型是否可用。
4. 在群聊下方填写任务，点击「开始任务」。
5. 需要中止时点「停止全部」。

也可以在**主聊天**里直接说「你们讨论一下」。主助手会调用 `team_discuss` 派发，并等待成员的真实返回；`list_agents` 只返回固定成员，不含历史子会话。

> 注意：Harness 原生主会话顶部显示的「N 个智能体」是**累计子会话记录数**，也包含历史任务。它不等于当前活跃人数。面板里的固定成员与任务状态才是当前团队数据。

---

## 六套预设模板

| 模板 | 人数 | 超时 | 成员（按阶段） |
| --- | --- | --- | --- |
| 单人基线 | 1 | 5 分 | 独立执行之大娃 `[1]` |
| 精简执行与复核（推荐） | 2 | 10 分 | 方案负责人之大娃 `[1]` · 独立复核之二娃 `[2]` |
| 调研与证据对照 | 3 | 15 分 | 主线查证之大娃 `[1]` · 反例与边界查证之二娃 `[1]` · 决策归并之三娃 `[2]` |
| 产品设计评审 | 4 | 15 分 | 用户与流程设计之大娃 `[1]` · 数据与实现约束之二娃 `[1]` · 独立评审之三娃 `[2]` · 方案定稿之四娃 `[3]` |
| 实现—验证—交付 | 3 | 20 分 | 实现负责人之大娃 `[1]` · 验证负责人之二娃 `[2]` · 交付负责人之三娃 `[3]` |
| 故障定位与验证 | 3 | 10 分 | 日志与复现之大娃 `[1]` · 代码与假设核验之二娃 `[1]` · 诊断裁决之三娃 `[2]` |

### 成员命名约定

套用模板时，成员名统一由 **职责 ＋ `之` ＋ 序号** 派生：

```
用户与流程设计之大娃
数据与实现约束之二娃
独立评审之三娃
方案定稿之四娃
```

超过 4 人继续使用 `五娃`、`六娃`…… 第 11 位起回落为 `N娃`。命名规则由 `lib/presets.js` 的 `memberName(title, index)` 统一实现，`test/naming.test.mjs` 逐条校验。

**套用模板会按职责重写名称，但保留成员 ID、所选模型与执行阶段。** 这样职责与名称始终一致，同时不影响历史任务记录。

---

## 执行与安全约束

- 人数上限、模型校验、委派拦截**全部在宿主侧**完成；模型无法创建或修改成员。
- 每次执行使用独立子会话以隔离上下文，但**不增加固定成员**；完成后释放运行资源，历史仍保留。
- 文件范围目前是**任务约定，不是文件锁**。重叠写入仍需靠不同阶段或不同文件范围来安排。
- `tools.guard` 是工具调用层约束，**不是针对任意 shell 脚本的操作系统隔离**。
- 接口 `/api/team-console-v2` 通过 Harness 的 `connection.fetch` 注册，由宿主校验 owner 身份；没有裸露的写接口。

---

## 数据与隐私

所有运行状态都在本机 `state/` 目录下：

| 文件 | 内容 |
| --- | --- |
| `state/teams.json` | 成员配置与最近 30 次任务记录，原子写入（临时文件 + rename） |
| `state/plugin.log` | 插件启动与接口错误日志 |

**`state/` 已被 `.gitignore` 排除，且 CI 会在检测到该目录被提交时直接失败。** 其中包含会话 ID、成员配置、用户任务原文与成员回答，不应进入任何版本库或公开渠道。

---

## 目录结构

| 路径 | 作用 |
| --- | --- |
| `lib/index.js` | 宿主入口：原生执行适配、模型验证、工具拦截、历史任务清理、认证 API |
| `lib/manager.js` | 团队状态机：分阶段执行、幂等派发、取消、消息归属 |
| `lib/chat-bridge.js` | 模型侧工具 `list_agents` / `team_discuss` |
| `lib/presets.js` | 六套预设模板与成员命名约定 |
| `lib/metrics.js` | 用量与耗时汇总 |
| `lib/client.js` | 右侧群聊、成员配置、任务记录与停止控制 |
| `cordis.patch.yml` | 插件注册补丁 |

---

## 开发与测试

```sh
npm test
```

覆盖：人数与模型校验、配置版本、重复请求幂等、阶段执行、启动途中停止、失败与资源清理、事件归属、跨会话隔离、重启与持久化失败、六套模板的命名与模型保留、用量去重与缓存 Token 不重复计入。当前 **28 项全部通过**，CI 覆盖 Node 20 / 22 / 24。

如果你的环境限制子进程管道（受限沙箱），`node --test` 可能报 `spawn EPERM`；直接单文件运行即可：`node test/manager.test.mjs`。

细节见 [CONTRIBUTING.md](./CONTRIBUTING.md)，变更记录见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 已知限制

- 依赖 `@deepseek-ai/dsh >= 0.2.1-rc.2` 的宿主 API（`subagents.startActivation`、`tools.guard`、`connection.fetch`）。宿主 API 变动会导致插件失效。
- 文件范围是约定而非强制锁，重叠写入需要靠阶段编排规避。
- 只有 assistant 文本进入群聊记录；工具结果与思考过程不进面板（这是刻意取舍）。
- 面板暂无截图与演示 GIF，欢迎 PR。

---

## English

A host-owned fixed-roster agent team console plugin for **DeepSeek Harness**.

Unlike prompt-driven multi-agent setups, team size, per-member models and delegation permissions are enforced **on the host side**, not by prompts. Up to 4 members each bind an explicit `provider/model`; members run **in stages** (parallel within a stage, later stages receive earlier results), all visible in a side-panel group chat. The main chat can dispatch the team through `list_agents` / `team_discuss` and wait for real results.

Six built-in presets cover single-agent baseline, lean review, research comparison, product design review, implement–verify–deliver, and incident diagnosis. Applying a preset regenerates member names from their responsibilities (`职责之大娃`, `…之二娃`, …) while preserving member IDs, models and stages.

Local state lives in `state/` (git-ignored, never commit it). MIT licensed.

```sh
npm test
```

---

## License

[MIT](./LICENSE) © 2026 jiongzhi-hao
