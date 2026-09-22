---
name: confirm-protocol
description: '把技能需要的用户确认转换为统一 interaction 协议，并返回结构化答案、聊天兼容文本、低风险记忆状态、批次和审计记录；用于确认、单选、多选或输入交互，不用于普通聊天，也不代替客户端 UI。Convert skill-required confirmation into one interaction protocol with structured answers, chat-compatible text, low-risk memory state, batches, and audit records; use for confirm, choice, multi-choice, or input interactions, not ordinary chat or as a replacement for client UI. Преобразует требуемое навыком подтверждение в единый interaction-протокол со структурированными ответами, текстом для чата, низкорисковой памятью, пакетами и аудитом; применяется к подтверждению, выбору, множественному выбору и вводу, но не к обычному чату и не вместо UI клиента.'
---

# 确认协议 / Confirm Protocol / Протокол подтверждения

Package version: v7.0.42

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
- broker 默认读取账号共享凭据文件；显式 `CLITAX_BRAIN_CLIENT_TOKEN_FILE` 使用绝对路径覆盖；macOS/Linux 文件必须为当前 broker 账户所有且权限 `0600`，Windows 文件必须位于受限 `%LOCALAPPDATA%\CLI.Tax\broker` 目录。
- broker 只需要 Brain Client HTTPS、受限身份文件和调用方显式传入的路径，本身不需要完整磁盘访问。若要保证 IDE 无法读取身份文件，必须把 broker 放进独立低权限系统账户或沙箱服务，并只暴露受限 IPC；broker 与 IDE 同账户运行时，`0600` 不能隔离二者，禁止声称令牌已隔离。
- broker 只用 `Authorization: BrainClient …` 发起一次 runtime 请求。HTTP 成功后必须保留响应顶层原始 `feedbackReceiptId`、`feedbackInvocationId` 和 `feedbackEvaluation.digest`，不得生成、猜测、复用或跨调用转移。
- Brain Client 服务端必须严格绑定请求/响应的 `requestId` 和 `schemaVersion`，再根据真实状态、验证结果、服务端耗时与 findings 生成并持久化权威评分、评语和摘要。broker 不得生成分数或评语。
- 同一次 runtime 请求在服务端事务内生成并持久化评价，再返回 `feedbackReceiptId`、`feedbackInvocationId` 和权威摘要；broker 只验证已提交回执，不发起第二次评价写入。`not-reported`、验证不完整、P0/P1 findings、`blocked` 或 `failed` 都不得生成好评。
- 缺少凭证或 ID、身份不匹配、摘要不匹配、响应非法以及任何 HTTP 失败都必须显式失败，不得静默、不重试成重复评价。
- 本地 CLI 不提供手工评分或评语提交命令，人类不得选择技能分数或填写技能评价；日常聊天不属于评价协议。

调用示例：`npx cli-confirm-protocol@latest invoke <operation> '<JSON对象>'`。IDE 集成可向 `npx cli-confirm-protocol@latest broker` 的 stdin 发送 `{"operation":"capabilities","input":{}}`。

## 网络中断与原回执恢复

仅在 TLS 握手前确定尚未发送 HTTP 请求时，broker 才允许最多 3 次连接尝试，并受总超时约束。请求发出后发生断线或响应中断，只用 GET 查询原 requestId 的服务端回执，禁止重发 POST；未取得有效回执时保留不确定状态，不得假定成功或继续依赖步骤。

`npx cli-confirm-protocol@latest recover <operation> <requestId>` 可重新查询原调用，不会重做操作或重复计费。链恢复不会跳过人工确认，也不会自动重跑结果不确定的本地命令。代理连接需 Node.js 22.21+ 或 24.5+；不支持的运行时会明确报错。

## 执行完整性共同规则

1. 工程目标、已接受范围和验收项必须持久化；新增需求先路由与合并，不能覆盖原目标。子任务有明确服务目标的理由，执行仅用本链已匹配技能。每次恢复读取 task-resume，核对剩余项、pending请求和continuationNotifications。
2. 默认由主代理完成工作，禁止为了省事创建子代理、把简单查找/改名/少量修改/单条命令/例行检查/汇总交接给多智能体，禁止为达到门槛拆分或夸大任务。启用Aimlock或Swarm模式不是创建授权，管理/运维/安全/协调是主代理职责，不额外创建常驻智能体。只有业务确需独立且实质性的交付、主代理同时有可推进的独立工作、预期收益严格高于上下文传递/协调/验收成本时才派单；复用已有合适负责人，用户禁止委派时不得创建。每次创建前记录业务理由、交付物、验收项、主代理工作、成本收益、精确路径和原负责人；只创建当前需要的最少数量，不预建空闲角色，不递归扩编或重复扫描。规模门槛200行/3文件/跨模块仅为必要条件，不能单独证明值得委派。主代理负责整合和完整验收，不把半成品当完成；预算抱怨不是停止指令。
3. 自报、回复送达和动作完成不等于工程交付验证。reported始终待验收；Swarm接受工程任务时复用Validator校验签名、有效期、计划/产物/任务绑定。无证据、伪造runner或失败检查不得成为绿色完成。
4. 原任务交接前保存检查点并释放旧锁；同级任务冲突则用peer意图拆分路径，不得伪装成交接或委派。回程与peer-ready都只发持久通知，宿主消费后重新核验基线、快照与写入权限。历史恢复结果不是新授权。技能不能自行唤醒未接入的IDE。
5. 心跳停止仅允许自动回收尚未开工的assigned任务；claimed/running进入执行结果待核对状态，禁止盲目重复执行。已回传、已验收、失败和取消任务不会被自动重派。服务器停滞回收同时保存会员通知，对话界面定期读取展示。
6. 读取预算、截止和续时确认仅在云端沙箱已开启且本任务实际使用 sandbox 时生效。纯本地或权威响应确认的非沙箱执行，在已授权目标和范围内自动持续，不因旧预算过期、文件数或token额度暂停，也不生成扩展或续时确认；宿主可保留budget-read审计。远端状态未知时只读查询原调用，不推定关闭，不要求扩预算；纯本地无需查询云端。仅实际沙箱内预计长任务在预算初始化后、深读前提出一次精确自动续时策略，真实授权后才自动续时；时间、文件数、token和写入权限分别计量，额度/次数耗尽、撤销和完成保留明确停止规则。读取预算不是付费充值，续时由宿主在读取时触发。
7. 云端沙箱开关按调用会员读取；关闭时仅允许当前受审官方源码摘要在受控worker中直接执行，并记录executionIsolation。预算上下文取同一任务成功runtime响应顶层executionContext，包含cloudSandboxEnabled与executionIsolation；仅true且sandbox启用预算，不用模型自报、调用方参数或旧截图代替真实执行状态。纯本地显式使用{executionIsolation:"local"}；已有预算通过budget-context绑定或更新实际环境，保留原用量、期限和授权。未知或修改过的源码明确要求sandbox，不伪造隔离结果；worker直接执行不是OS沙箱。
8. 使用技能前检查官方发布版本并自动升级可管理的安装副本与客户端；配置失败或升级失败停止并报告。通过configure的JSON标准输入导入一次账号凭据，后续项目/分支/任务共享；密钥不进入源码、URL或命令参数。显式环境覆盖必须是绝对路径。网页复制在点击时获取当前凭据，页面仅展示无密钥地址；已撤销密钥没有权限自动获取新密钥，需已认证网页重新同步一次。

English: keep simple work with the main agent. Delegate only substantial independent business deliverables when benefits exceed coordination costs; use the fewest needed agents, never create idle management agents. Enabling Aimlock does not authorize delegation. Finish all authorized work; a cost complaint is not a stop request. Preserve the original goal; verify execution evidence; resume from durable checkpoints; never replay uncertain side effects. Read budgets and bounded renewal approvals apply only when cloud sandboxing is enabled and actually used for this task. Local or confirmed non-sandbox work continues within its authorized scope without budget prompts; unknown remote state requires a read-only query, never an assumed opt-out or an extension request. Reuse account credentials and check managed skill updates before use; revoked credentials require an authenticated refresh.

Русский: сохраняйте исходную цель, проверяйте доказательства выполнения и возобновляйте работу из сохранённой точки. Не повторяйте операции с неизвестным результатом. Бюджет чтения и ограниченное разрешение на продление действуют только при включённой облачной песочнице, фактически используемой этой задачей. Локальная работа и подтверждённое выполнение без песочницы продолжаются в разрешённых пределах без запросов бюджета; неизвестное удалённое состояние требует запроса только для чтения, а не предположения об отключении или запроса расширения. Ключи учётной записи используются повторно, обновления навыков проверяются перед вызовом.

## 账号共享凭据与自动更新

在已登录的能力市场复制安装入口，将内容粘贴给 IDE。页面只展示原地址，剪贴板会携带当前账号凭据。IDE 将四字段凭据 JSON 经标准输入交给 `npx cli-aimlock@latest configure`；不要放到命令参数、项目文件或日志中。一次配置供同一操作系统账号的所有项目、分支和任务使用，八个技能共享同一文件。

默认位置：macOS 为 `~/Library/Application Support/CLI.Tax/broker/credential.json`，Linux 为 `~/.local/share/CLI.Tax/broker/credential.json`，Windows 为 `%LOCALAPPDATA%\CLI.Tax\broker\credential.json`。显式 `CLITAX_BRAIN_CLIENT_TOKEN_FILE` 仍按绝对路径覆盖默认位置；迁移旧 IDE 配置时移除其过时覆盖，再使用账号共享文件。macOS/Linux 校验当前账号所有权和0600权限；Windows校验仅当前账号与SYSTEM可访问的ACL。

每次新技能调用先查询官方发布版本，精确版本下载并校验身份后自动使用；更新已托管的当前项目与账号技能目录，失败恢复旧目录，禁止覆盖 Git 跟踪源码或未托管内容。升级返回 `upgrade.reloadRequired` 和说明路径时，IDE 应读取更新后的 SKILL.md、核对本任务合同再继续。install/check同样自动更新，不需要每次人工发升级指令。查询不确定调用的原回执不升级、不重发操作。

升级不会清除账号凭据；各调用重新读取共享文件，因此重新同步一次密钥后所有任务使用新值。已撤销或失效的密钥不能为自己取得新权限，必须从已认证网页重新同步一次。两个不同操作系统账号不共享私密文件。

English: configure once using JSON stdin; all tasks under the same OS account reuse the credential. Each new invocation checks and updates the official package and managed documentation. Reload updated instructions when indicated. Revoked keys require a fresh authenticated copy.

Русский: настройте ключ один раз через JSON stdin для всех задач пользователя ОС. Перед новым вызовом пакет и управляемые инструкции обновляются автоматически. Отозванный ключ требует повторной синхронизации с авторизованной страницы.
