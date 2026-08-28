---
name: confirm-protocol
description: '把技能需要的用户确认转换为统一 interaction 协议，并返回结构化答案、聊天兼容文本、低风险记忆状态、批次和审计记录；用于确认、单选、多选或输入交互，不用于普通聊天，也不代替客户端 UI。Convert skill-required confirmation into one interaction protocol with structured answers, chat-compatible text, low-risk memory state, batches, and audit records; use for confirm, choice, multi-choice, or input interactions, not ordinary chat or as a replacement for client UI. Преобразует требуемое навыком подтверждение в единый interaction-протокол со структурированными ответами, текстом для чата, низкорисковой памятью, пакетами и аудитом; применяется к подтверждению, выбору, множественному выбору и вводу, но не к обычному чату и не вместо UI клиента.'
---

# 确认协议 / Confirm Protocol / Протокол подтверждения

Package version: v7.0.29

Endpoint: https://cli.tax/Cf8Pr7Tm2Q

Request schema: `confirm-protocol.skill.request/1.0`

Confirm Protocol 是技能链的统一确认交互层。它只定义协议并验证答案，不替代业务技能，也不把“等待用户”伪装成成功。

中文：只有业务技能确实需要确认、单选、多选或文本输入时才调用。高风险请求必须逐项等待真人决定，永远不能记忆、批量或默认放行；没有原生界面时返回编号聊天内容，不伪称已经弹窗。

English: Call this skill only when another skill genuinely needs confirmation, one choice, multiple choices, or typed input. High-risk requests always wait for an explicit human decision and can never be remembered, batched, or default-approved. Without a native UI, return the numbered chat rendering and never claim a dialog appeared.

Русский: Навык вызывается только когда другому навыку действительно нужны подтверждение, одиночный или множественный выбор либо текстовый ввод. Запрос высокого риска всегда ждёт явного решения человека и никогда не запоминается, не объединяется в пакет и не одобряется по умолчанию. Без нативного UI возвращается нумерованный текст для чата; нельзя утверждать, что окно уже показано.

## 强制流程 / Required sequence / Обязательная последовательность

1. 调用 `capabilities`，读取全部 `operationSchemas` 与真实能力状态。
2. 业务技能构造 `confirm.interaction/1.0`，调用 `interaction-request`。
3. 客户端优先用 IDE 原生 UI；没有适配器时必须显示返回的 `chatFallback`。
4. 用户作答后调用 `interaction-answer`，得到不可歧义的 `callbackRequest` 和审计记录。
5. 只有 `risk=low + rememberable=true` 才能调用 `memory-set`。高风险永远不可记忆、不可批量、不可默认超时放行。

## 操作 / Operations / Операции

- `capabilities` / `help`：能力、JSON Schema 与实现边界。
- `interaction-request`：验证并返回 interaction 与聊天降级文本。
- `interaction-answer`：验证答案，生成 callback 请求和审计记录。
- `chat-render`：把同一 interaction 渲染为编号聊天文本。
- `memory-set` / `memory-list` / `memory-clear`：调用方持有的低风险记忆状态。
- `batch-request`：每批最多三个低风险确认；高风险始终独立。
- `audit-query`：查询调用方提供的审计记录。

## 风险规则 / Risk rules / Правила риска

- `risk=high` 必须带非空风险说明、`default=null`、`rememberable=false`、`timeoutAction=wait`。
- `confirm` / `choice` 只能返回一个合法 option id；`multi` 返回去重后的 id 数组；`input` 返回非空文本。
- interaction、option、callback、memory 与 audit 对象严格拒绝未声明字段和类型错配；超时必须为 `null` 或大于等于 1 的整数，默认值必须匹配交互类型与已有选项。
- callback 的 operation 和原 payload 由请求方声明；答案只能追加到副本，不能篡改原 interaction。
- 记忆与审计状态由已认证客户端或平台持久化。调用方传回的每条状态都必须重新验证；纯运行时是无状态协议层，不宣称已经写入数据库。

## 实现状态 / Implementation status / Состояние реализации

| 能力 | 状态 | 边界 |
|---|---|---|
| interaction 请求/回答闭环 | 已实现 | 返回统一 callbackRequest 与 auditEntry |
| C 档聊天渲染 | 已实现 | 同一协议生成编号文本 |
| 低风险记忆/批量/审计 | 已实现（调用方持有） | 运行时返回更新后的状态，不伪造平台持久化 |
| IDE 原生适配器 | 需本地通知器 / local notifier required / нужен локальный уведомитель | 由具体 IDE 插件渲染 |
| OS 原生 Confirm Notifier | 需本地通知器 / local notifier required / нужен локальный уведомитель | 当前不宣称已弹出系统窗口 |
| 疲劳检测/移动端转发 | 规划中 | 不进入首版通过证据 |

## 受限调用与自动评价闭环

- IDE / 智能体必须通过本包 `invoke` 或 JSON-stdin `broker` 调用，不得直接拼装技能 HTTP 请求，也不得读取 BrainClient token。
- broker 从 `CLITAX_BRAIN_CLIENT_TOKEN_FILE` 读取身份；macOS/Linux 文件必须为当前 broker 账户所有且权限 `0600`，Windows 文件必须位于受限 `%LOCALAPPDATA%\CLI.Tax\broker` 目录。
- broker 只需要 Brain Client HTTPS、受限身份文件和调用方显式传入的路径，本身不需要完整磁盘访问。若要保证 IDE 无法读取身份文件，必须把 broker 放进独立低权限系统账户或沙箱服务，并只暴露受限 IPC；broker 与 IDE 同账户运行时，`0600` 不能隔离二者，禁止声称令牌已隔离。
- broker 只用 `Authorization: BrainClient …` 发起一次 runtime 请求。HTTP 成功后必须保留响应顶层原始 `feedbackReceiptId`、`feedbackInvocationId` 和 `feedbackEvaluation.digest`，不得生成、猜测、复用或跨调用转移。
- Brain Client 服务端必须严格绑定请求/响应的 `requestId` 和 `schemaVersion`，再根据真实状态、验证结果、服务端耗时与 findings 生成并持久化权威评分、评语和摘要。broker 不得生成分数或评语。
- 同一次 runtime 请求在服务端事务内生成并持久化评价，再返回 `feedbackReceiptId`、`feedbackInvocationId` 和权威摘要；broker 只验证已提交回执，不发起第二次评价写入。`not-reported`、验证不完整、P0/P1 findings、`blocked` 或 `failed` 都不得生成好评。
- 缺少凭证或 ID、身份不匹配、摘要不匹配、响应非法以及任何 HTTP 失败都必须显式失败，不得静默、不重试成重复评价。
- 本地 CLI 不提供手工评分或评语提交命令，人类不得选择技能分数或填写技能评价；日常聊天不属于评价协议。

调用示例：`npx cli-confirm-protocol@latest invoke <operation> '<JSON对象>'`。IDE 集成可向 `npx cli-confirm-protocol@latest broker` 的 stdin 发送 `{"operation":"capabilities","input":{}}`。
