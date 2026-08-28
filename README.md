# 确认协议 / Confirm Protocol / Протокол подтверждения

CLI.Tax 结构化确认协议官方安装包：统一确认、单选、多选与输入交互，返回经过校验的答案、聊天兼容文本和审计记录。

Official CLI.Tax installer for structured confirmation, single-choice, multi-choice, and input interactions with validated answers, chat-compatible rendering, and audit records.

Официальный установщик CLI.Tax для структурированных подтверждений, одиночного и множественного выбора и ввода с проверенными ответами, текстом для чата и аудитом.

```bash
npx cli-confirm-protocol@latest install
```

Source: https://github.com/88208555/confirm-protocol-clitax.git

## 受限调用与自动评价 / Restricted invocation and automatic evaluation / Ограниченный вызов и автооценка

IDE 通过 `invoke` 或 JSON-stdin `broker` 调用。broker 本身只需要 Brain Client HTTPS、受限身份文件和显式传入路径，不需要完整磁盘访问。要保证 IDE 看不到令牌，必须把 broker 作为独立低权限账户或沙箱服务运行并只暴露受限 IPC；同一账户下的 `0600` 不能隔离 IDE 与 broker。服务端在同一次 runtime 请求中事务提交权威评价并返回回执，broker 只验证回执，不发起第二次评价写入。

Use `npx cli-confirm-protocol@latest invoke <operation> '<JSON object>'`, or send JSON stdin to `npx cli-confirm-protocol@latest broker`. The broker itself needs only Brain Client HTTPS, its restricted identity file, and explicitly supplied paths; it does not need full-disk access. To keep the token inaccessible to the IDE, run the broker under a separate least-privilege account or sandbox service and expose only restricted IPC. Mode `0600` does not isolate two processes running as the same account.

IDE вызывает пакет через `invoke` или JSON-stdin `broker`. Самому broker нужны только HTTPS Brain Client, ограниченный файл идентификации и явно переданные пути; полный доступ к диску не нужен. Чтобы IDE не мог прочитать токен, broker должен работать под отдельной малопривилегированной учётной записью или в sandbox-сервисе с ограниченным IPC. Режим `0600` не изолирует процессы одной учётной записи.

The Brain Client server binds the real response and atomically persists the authoritative score and comment within the same runtime request, then returns a committed receipt. The broker verifies `feedbackReceiptId`, `feedbackInvocationId`, and the authoritative digest; it makes no second evaluation write and never creates a score or comment. Not-reported or incomplete validation, P0/P1 findings, blocked, and failed results cannot be positive. Missing credentials or receipts, digest mismatches, invalid responses, and HTTP failures fail explicitly.

The local CLI has no command for manually submitting a score or evaluation comment. Humans cannot choose a skill score or write skill evaluation content. Daily chat is outside the evaluation protocol.
