const REQUEST_SCHEMA = "confirm-protocol.skill.request/1.0";
const RESPONSE_SCHEMA = "confirm-protocol.skill.response/1.0";
const INTERACTION_SCHEMA = "confirm.interaction/1.0";
const MEMORY_SCHEMA = "confirm.memory-entry/1.0";
const AUDIT_SCHEMA = "confirm.audit-entry/1.0";
const COMPILER_VERSION = "v7.0.31";
const OPERATIONS = ["capabilities", "help", "interaction-request", "interaction-answer",
  "chat-render", "memory-set", "memory-list", "memory-clear", "batch-request", "audit-query"];
const INTERACTION_TYPES = new Set(["confirm", "choice", "multi", "input"]);
const TIMEOUT_ACTIONS = new Set(["wait", "default", "cancel"]);
const RISK_LEVELS = new Set(["low", "high"]);
const CHAT_LOCALES = new Set(["zh-CN", "en-US", "ru-RU"]);
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const stringSchema = (extra = {}) => ({ type: "string", ...extra });
const arraySchema = (items, extra = {}) => ({ type: "array", items, ...extra });
const objectSchema = (properties, required = [], extra = {}) => (
  { type: "object", properties, required, additionalProperties: false, ...extra }
);
const optionSchema = objectSchema({
  id: stringSchema({ minLength: 1 }), label: stringSchema({ minLength: 1 }),
  hint: stringSchema(),
}, ["id", "label"]);
const answerSchema = { type: ["string", "array"], minLength: 1, minItems: 1,
  items: stringSchema({ minLength: 1 }) };
const callbackSchema = objectSchema({
  operation: stringSchema({ minLength: 1 }), payload: objectSchema({}, [], { additionalProperties: true }),
}, ["operation", "payload"]);
const interactionSchema = objectSchema({
  schemaVersion: { const: INTERACTION_SCHEMA }, requestId: stringSchema({ minLength: 1 }),
  type: { enum: [...INTERACTION_TYPES] }, question: stringSchema({ minLength: 1 }),
  options: arraySchema(optionSchema), default: { type: ["string", "array", "null"], items: stringSchema() },
  timeout: { type: ["integer", "null"], minimum: 1 },
  timeoutAction: { enum: [...TIMEOUT_ACTIONS] }, risk: { enum: [...RISK_LEVELS] },
  riskDescription: stringSchema(), rememberable: { type: "boolean" },
  memoryKey: stringSchema(), callback: callbackSchema,
}, ["schemaVersion", "requestId", "type", "question", "options", "default", "timeout",
  "timeoutAction", "risk", "riskDescription", "rememberable", "memoryKey", "callback"]);
const memorySchema = objectSchema({
  schemaVersion: { const: MEMORY_SCHEMA }, memoryKey: stringSchema({ minLength: 1 }),
  answer: answerSchema, storedAt: stringSchema({ format: "date-time" }),
  actorId: stringSchema({ minLength: 1 }),
}, ["schemaVersion", "memoryKey", "answer", "storedAt", "actorId"]);
const auditSchema = objectSchema({
  schemaVersion: { const: AUDIT_SCHEMA }, auditId: stringSchema({ minLength: 1 }),
  requestId: stringSchema({ minLength: 1 }), actorId: stringSchema({ minLength: 1 }),
  question: stringSchema({ minLength: 1 }), answer: answerSchema,
  remembered: { type: "boolean" }, risk: { enum: [...RISK_LEVELS] },
  answeredAt: stringSchema({ format: "date-time" }),
}, ["schemaVersion", "auditId", "requestId", "actorId", "question", "answer",
  "remembered", "risk", "answeredAt"]);
const nextSchema = objectSchema({ operation: { type: ["string", "null"] }, instruction: stringSchema() },
  ["operation", "instruction"]);
const responseSchema = (properties, required) => objectSchema({
  schemaVersion: { const: RESPONSE_SCHEMA }, requestId: stringSchema(),
  status: { enum: ["succeeded", "blocked", "failed"] }, ...properties,
}, ["schemaVersion", "requestId", "status", ...required]);
const operationSchema = (input, required, output, outputRequired) => ({
  input: objectSchema(input, required), output: responseSchema(output, outputRequired),
});
const SCHEMAS = Object.freeze({
  capabilities: operationSchema({}, [], { capabilities: objectSchema({}, [], { additionalProperties: true }),
    operationSchemas: objectSchema({}, [], { additionalProperties: true }), skill: objectSchema({}, [], { additionalProperties: true }), nextStep: nextSchema },
  ["capabilities", "operationSchemas", "skill", "nextStep"]),
  help: operationSchema({}, [], { help: objectSchema({}, [], { additionalProperties: true }),
    operationSchemas: objectSchema({}, [], { additionalProperties: true }), nextStep: nextSchema },
  ["help", "operationSchemas", "nextStep"]),
  "interaction-request": operationSchema({ interaction: interactionSchema }, ["interaction"],
    { interaction: interactionSchema, chatFallback: stringSchema(), nextStep: nextSchema },
    ["interaction", "chatFallback", "nextStep"]),
  "interaction-answer": operationSchema({ interaction: interactionSchema,
    answer: answerSchema, actorId: stringSchema({ minLength: 1 }),
    answeredAt: stringSchema({ format: "date-time" }), remembered: { type: "boolean" },
    auditId: stringSchema({ minLength: 1 }) },
  ["interaction", "answer", "actorId", "answeredAt", "remembered", "auditId"],
  { callbackRequest: callbackSchema, auditEntry: auditSchema, nextStep: nextSchema },
  ["callbackRequest", "auditEntry", "nextStep"]),
  "chat-render": operationSchema({ interaction: interactionSchema,
    locale: { enum: [...CHAT_LOCALES] } }, ["interaction"],
    { text: stringSchema() }, ["text"]),
  "memory-set": operationSchema({ interaction: interactionSchema, answer: answerSchema,
    actorId: stringSchema({ minLength: 1 }), storedAt: stringSchema({ format: "date-time" }), entries: arraySchema(memorySchema) },
  ["interaction", "answer", "actorId", "storedAt", "entries"],
  { entries: arraySchema(memorySchema), entry: memorySchema }, ["entries", "entry"]),
  "memory-list": operationSchema({ entries: arraySchema(memorySchema) }, ["entries"],
    { entries: arraySchema(memorySchema) }, ["entries"]),
  "memory-clear": operationSchema({ entries: arraySchema(memorySchema), memoryKey: stringSchema({ minLength: 1 }) },
  ["entries", "memoryKey"], { entries: arraySchema(memorySchema), removed: { type: "integer" } },
  ["entries", "removed"]),
  "batch-request": operationSchema({ interactions: arraySchema(interactionSchema, { minItems: 1 }) },
  ["interactions"], { batches: arraySchema(objectSchema({}, [], { additionalProperties: true })),
    nextStep: nextSchema }, ["batches", "nextStep"]),
  "audit-query": operationSchema({ entries: arraySchema(auditSchema), requestId: stringSchema(),
    actorId: stringSchema() }, ["entries"], { entries: arraySchema(auditSchema) }, ["entries"]),
});

function text(value) { return String(value ?? "").trim(); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function finding(ruleId, entityRef, message) { return { severity: "P0", ruleId, entityRef, message, evidence: {} }; }
function ok(requestId, payload) { return { schemaVersion: RESPONSE_SCHEMA, requestId, status: "succeeded", ...payload }; }
function blocked(requestId, findings) {
  return { schemaVersion: RESPONSE_SCHEMA, requestId, status: "blocked",
    validation: { valid: false, guarantee: "blocked", findings } };
}
function validateExactObject(value, allowedKeys, requiredKeys, entityRef) {
  if (!isObject(value)) return [finding("OBJECT_REQUIRED", entityRef, "value must be an object")];
  const findings = [];
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) findings.push(finding("ADDITIONAL_PROPERTY", `${entityRef}.${key}`, "property is not allowed"));
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(value, key)) findings.push(finding("REQUIRED_PROPERTY", `${entityRef}.${key}`, "property is required"));
  }
  return findings;
}
function validateAnswerValue(value, entityRef) {
  if (typeof value === "string" && value.trim()) return [];
  if (!Array.isArray(value) || value.length === 0
    || value.some((item) => typeof item !== "string" || !item.trim())) {
    return [finding("ANSWER_TYPE", entityRef, "answer must be a non-empty string or non-empty array of strings")];
  }
  return [];
}
function validateDateTime(value, entityRef) {
  return typeof value === "string" && DATE_TIME_PATTERN.test(value) && Number.isFinite(Date.parse(value))
    ? [] : [finding("DATE_TIME", entityRef, "value must be a valid date-time string")];
}
function validateOption(option, index) {
  const ref = `input.interaction.options[${index}]`;
  const findings = validateExactObject(option, ["id", "label", "hint"], ["id", "label"], ref);
  if (!isObject(option)) return findings;
  if (typeof option.id !== "string" || !option.id.trim()) findings.push(finding("OPTION_ID", `${ref}.id`, "id must be a non-empty string"));
  if (typeof option.label !== "string" || !option.label.trim()) findings.push(finding("OPTION_LABEL", `${ref}.label`, "label must be a non-empty string"));
  if (option.hint !== undefined && typeof option.hint !== "string") findings.push(finding("OPTION_HINT", `${ref}.hint`, "hint must be a string"));
  return findings;
}
function validateCallback(callback) {
  const findings = validateExactObject(callback, ["operation", "payload"], ["operation", "payload"], "input.interaction.callback");
  if (!isObject(callback)) return findings;
  if (typeof callback.operation !== "string" || !callback.operation.trim()) findings.push(finding("CALLBACK_OPERATION", "input.interaction.callback.operation", "operation must be a non-empty string"));
  if (!isObject(callback.payload)) findings.push(finding("CALLBACK_PAYLOAD", "input.interaction.callback.payload", "payload must be an object"));
  return findings;
}
function validateInteraction(value) {
  const keys = ["schemaVersion", "requestId", "type", "question", "options", "default", "timeout",
    "timeoutAction", "risk", "riskDescription", "rememberable", "memoryKey", "callback"];
  const findings = validateExactObject(value, keys, keys, "input.interaction");
  if (!isObject(value)) return findings;
  if (value.schemaVersion !== INTERACTION_SCHEMA) findings.push(finding("INTERACTION_SCHEMA", "input.interaction.schemaVersion", `Expected ${INTERACTION_SCHEMA}`));
  if (typeof value.requestId !== "string" || !value.requestId.trim()) findings.push(finding("INTERACTION_REQUEST_ID", "input.interaction.requestId", "requestId must be a non-empty string"));
  if (!INTERACTION_TYPES.has(value.type)) findings.push(finding("INTERACTION_TYPE", "input.interaction.type", "type is not supported"));
  if (typeof value.question !== "string" || !value.question.trim()) findings.push(finding("INTERACTION_QUESTION", "input.interaction.question", "question must be a non-empty string"));
  if (!Array.isArray(value.options)) findings.push(finding("INTERACTION_OPTIONS", "input.interaction.options", "options must be an array"));
  if (!TIMEOUT_ACTIONS.has(value.timeoutAction) || !RISK_LEVELS.has(value.risk)) findings.push(finding("INTERACTION_POLICY", "input.interaction", "timeoutAction and risk must be valid"));
  if (value.timeout !== null && (!Number.isInteger(value.timeout) || value.timeout < 1)) findings.push(finding("INTERACTION_TIMEOUT", "input.interaction.timeout", "timeout must be null or an integer >= 1"));
  if (typeof value.riskDescription !== "string" || typeof value.rememberable !== "boolean" || typeof value.memoryKey !== "string") findings.push(finding("INTERACTION_FIELD_TYPES", "input.interaction", "riskDescription and memoryKey must be strings; rememberable must be boolean"));
  findings.push(...validateCallback(value.callback));
  const options = Array.isArray(value.options) ? value.options : [];
  findings.push(...options.flatMap(validateOption));
  const optionIds = options.map((option) => typeof option?.id === "string" ? option.id.trim() : "");
  if (new Set(optionIds).size !== optionIds.length || optionIds.some((id) => !id)) findings.push(finding("INTERACTION_OPTION_IDS", "input.interaction.options", "option ids must be unique and non-empty"));
  if (value.type !== "input" && options.length < 2) findings.push(finding("INTERACTION_OPTION_COUNT", "input.interaction.options", "confirm, choice, and multi require at least two options"));
  if (value.type === "input" && options.length !== 0) findings.push(finding("INPUT_OPTIONS", "input.interaction.options", "input interactions must not declare options"));
  const defaultValues = Array.isArray(value.default) ? value.default : [value.default];
  const defaultTypeValid = value.type === "multi" ? Array.isArray(value.default) || value.default === null
    : typeof value.default === "string" || value.default === null;
  const defaultMatchesOptions = value.type === "input"
    || defaultValues.every((item) => item === null || (typeof item === "string" && optionIds.includes(item)));
  if (!defaultTypeValid || !defaultMatchesOptions) findings.push(finding("INTERACTION_DEFAULT", "input.interaction.default", "default must match the interaction type and declared options"));
  if (value.timeoutAction === "default" && value.default === null) findings.push(finding("TIMEOUT_DEFAULT", "input.interaction.default", "timeoutAction=default requires a declared default"));
  if (value.risk === "high" && (!text(value.riskDescription) || value.rememberable !== false
    || value.timeoutAction !== "wait" || value.default !== null)) findings.push(finding("HIGH_RISK_POLICY", "input.interaction", "high risk requires a description, default=null, rememberable=false, and timeoutAction=wait"));
  if (value.rememberable === true && (typeof value.memoryKey !== "string" || !value.memoryKey.trim())) findings.push(finding("MEMORY_KEY", "input.interaction.memoryKey", "rememberable interactions require a memoryKey"));
  return findings;
}
function validateMemoryEntry(entry, entityRef) {
  const keys = ["schemaVersion", "memoryKey", "answer", "storedAt", "actorId"];
  const findings = validateExactObject(entry, keys, keys, entityRef);
  if (!isObject(entry)) return findings;
  if (entry.schemaVersion !== MEMORY_SCHEMA) findings.push(finding("MEMORY_SCHEMA", `${entityRef}.schemaVersion`, `Expected ${MEMORY_SCHEMA}`));
  if (typeof entry.memoryKey !== "string" || !entry.memoryKey.trim()) findings.push(finding("MEMORY_ENTRY_KEY", `${entityRef}.memoryKey`, "memoryKey must be a non-empty string"));
  if (typeof entry.actorId !== "string" || !entry.actorId.trim()) findings.push(finding("MEMORY_ENTRY_ACTOR", `${entityRef}.actorId`, "actorId must be a non-empty string"));
  findings.push(...validateAnswerValue(entry.answer, `${entityRef}.answer`));
  findings.push(...validateDateTime(entry.storedAt, `${entityRef}.storedAt`));
  return findings;
}
function validateAuditEntry(entry, entityRef) {
  const keys = ["schemaVersion", "auditId", "requestId", "actorId", "question", "answer",
    "remembered", "risk", "answeredAt"];
  const findings = validateExactObject(entry, keys, keys, entityRef);
  if (!isObject(entry)) return findings;
  if (entry.schemaVersion !== AUDIT_SCHEMA) findings.push(finding("AUDIT_SCHEMA", `${entityRef}.schemaVersion`, `Expected ${AUDIT_SCHEMA}`));
  for (const key of ["auditId", "requestId", "actorId", "question"]) {
    if (typeof entry[key] !== "string" || !entry[key].trim()) findings.push(finding("AUDIT_TEXT", `${entityRef}.${key}`, `${key} must be a non-empty string`));
  }
  if (typeof entry.remembered !== "boolean" || !RISK_LEVELS.has(entry.risk)) findings.push(finding("AUDIT_POLICY", entityRef, "remembered and risk must be valid"));
  findings.push(...validateAnswerValue(entry.answer, `${entityRef}.answer`));
  findings.push(...validateDateTime(entry.answeredAt, `${entityRef}.answeredAt`));
  return findings;
}
function validateEntryArray(entries, kind, entityRef) {
  if (!Array.isArray(entries)) return [finding("ENTRIES_ARRAY", entityRef, "entries must be an array")];
  const validate = kind === "memory" ? validateMemoryEntry : validateAuditEntry;
  return entries.flatMap((entry, index) => validate(entry, `${entityRef}[${index}]`));
}
const INPUT_RULES = Object.freeze({
  capabilities: [[], []], help: [[], []],
  "interaction-request": [["interaction"], ["interaction"]],
  "interaction-answer": [["interaction", "answer", "actorId", "answeredAt", "remembered", "auditId"],
    ["interaction", "answer", "actorId", "answeredAt", "remembered", "auditId"]],
  "chat-render": [["interaction", "locale"], ["interaction"]],
  "memory-set": [["interaction", "answer", "actorId", "storedAt", "entries"],
    ["interaction", "answer", "actorId", "storedAt", "entries"]],
  "memory-list": [["entries"], ["entries"]],
  "memory-clear": [["entries", "memoryKey"], ["entries", "memoryKey"]],
  "batch-request": [["interactions"], ["interactions"]],
  "audit-query": [["entries", "requestId", "actorId"], ["entries"]],
});
function validateOperationInput(operation, input) {
  const [allowed, required] = INPUT_RULES[operation];
  const findings = validateExactObject(input, allowed, required, "input");
  if (!isObject(input)) return findings;
  if (["interaction-request", "interaction-answer", "chat-render", "memory-set"].includes(operation)) {
    findings.push(...validateInteraction(input.interaction));
  }
  if (operation === "interaction-answer") {
    findings.push(...validateAnswerValue(input.answer, "input.answer"));
    findings.push(...validateDateTime(input.answeredAt, "input.answeredAt"));
    if (typeof input.actorId !== "string" || !input.actorId.trim() || typeof input.auditId !== "string" || !input.auditId.trim() || typeof input.remembered !== "boolean") findings.push(finding("ANSWER_INPUT", "input", "actorId, auditId, and remembered must have valid types"));
  }
  if (operation === "chat-render" && input.locale !== undefined && !CHAT_LOCALES.has(input.locale)) {
    findings.push(finding("CHAT_LOCALE", "input.locale", "locale must be zh-CN, en-US, or ru-RU"));
  }
  if (operation === "memory-set") {
    findings.push(...validateAnswerValue(input.answer, "input.answer"));
    findings.push(...validateDateTime(input.storedAt, "input.storedAt"));
    findings.push(...validateEntryArray(input.entries, "memory", "input.entries"));
    if (typeof input.actorId !== "string" || !input.actorId.trim()) findings.push(finding("MEMORY_ACTOR", "input.actorId", "actorId must be a non-empty string"));
  }
  if (operation === "memory-list" || operation === "memory-clear") findings.push(...validateEntryArray(input.entries, "memory", "input.entries"));
  if (operation === "memory-clear" && (typeof input.memoryKey !== "string" || !input.memoryKey.trim())) findings.push(finding("MEMORY_CLEAR_KEY", "input.memoryKey", "memoryKey must be a non-empty string"));
  if (operation === "batch-request") {
    if (!Array.isArray(input.interactions) || input.interactions.length === 0) findings.push(finding("BATCH_INTERACTIONS", "input.interactions", "interactions must be a non-empty array"));
    else findings.push(...input.interactions.flatMap(validateInteraction));
  }
  if (operation === "audit-query") {
    findings.push(...validateEntryArray(input.entries, "audit", "input.entries"));
    for (const key of ["requestId", "actorId"]) {
      if (input[key] !== undefined && typeof input[key] !== "string") findings.push(finding("AUDIT_FILTER", `input.${key}`, `${key} must be a string`));
    }
  }
  return findings;
}
function chatCopy(locale) {
  if (locale === undefined || locale === "zh-CN") {
    return { risk: "风险：", input: "请输入答案。", choice: "请输入选项编号。" };
  }
  if (locale === "en-US") {
    return { risk: "Risk: ", input: "Enter your answer.", choice: "Enter the option number." };
  }
  if (locale === "ru-RU") {
    return { risk: "Риск: ", input: "Введите ответ.", choice: "Введите номер варианта." };
  }
  throw new Error(`Unsupported chat locale: ${String(locale)}`);
}
function renderChat(interaction, locale) {
  const copy = chatCopy(locale);
  const risk = interaction.risk === "high" ? `\n${copy.risk}${interaction.riskDescription}` : "";
  if (interaction.type === "input") return `${interaction.question}${risk}\n${copy.input}`;
  const options = interaction.options.map((option, index) => `${index + 1}. ${option.label}${option.hint ? ` — ${option.hint}` : ""}`);
  return `${interaction.question}${risk}\n${options.join("\n")}\n${copy.choice}`;
}
function normalizeAnswer(interaction, answer) {
  const values = Array.isArray(answer) ? answer.map(text).filter(Boolean) : [text(answer)].filter(Boolean);
  if (interaction.type === "input") return values.length === 1 ? values[0] : null;
  const allowed = new Set(interaction.options.map((option) => option.id));
  if (values.length === 0 || values.some((value) => !allowed.has(value))) return null;
  if (interaction.type !== "multi" && values.length !== 1) return null;
  return interaction.type === "multi" ? [...new Set(values)] : values[0];
}
function answerInteraction(input) {
  const findings = validateInteraction(input.interaction);
  const answer = findings.length ? null : normalizeAnswer(input.interaction, input.answer);
  if (answer === null) findings.push(finding("INTERACTION_ANSWER", "input.answer", "answer must match the interaction type and options"));
  if (!text(input.actorId) || !text(input.auditId) || !Number.isFinite(Date.parse(text(input.answeredAt)))) findings.push(finding("ANSWER_AUDIT", "input", "actorId, auditId, and a valid answeredAt are required"));
  if (input.remembered === true && (input.interaction?.risk !== "low"
    || input.interaction?.rememberable !== true || !text(input.interaction?.memoryKey))) {
    findings.push(finding("ANSWER_MEMORY_POLICY", "input.remembered",
      "remembered=true requires a low-risk rememberable interaction with a non-empty memoryKey"));
  }
  if (findings.length) return { findings };
  return {
    callbackRequest: { operation: input.interaction.callback.operation,
      payload: { ...input.interaction.callback.payload, requestId: input.interaction.requestId, answer } },
    auditEntry: { schemaVersion: AUDIT_SCHEMA, auditId: text(input.auditId),
      requestId: input.interaction.requestId, actorId: text(input.actorId), question: input.interaction.question,
      answer, remembered: input.remembered === true, risk: input.interaction.risk, answeredAt: text(input.answeredAt) },
  };
}
function memorySet(input) {
  const findings = validateInteraction(input.interaction);
  if (input.interaction?.risk !== "low" || input.interaction?.rememberable !== true || !text(input.interaction?.memoryKey)) findings.push(finding("MEMORY_POLICY", "input.interaction", "only low-risk rememberable interactions with memoryKey may be stored"));
  const answer = findings.length ? null : normalizeAnswer(input.interaction, input.answer);
  if (answer === null) findings.push(finding("MEMORY_ANSWER", "input.answer", "stored answer must be valid"));
  if (!Array.isArray(input.entries) || !text(input.actorId) || !Number.isFinite(Date.parse(text(input.storedAt)))) findings.push(finding("MEMORY_INPUT", "input", "entries, actorId, and storedAt are required"));
  if (findings.length) return { findings };
  const entry = { schemaVersion: MEMORY_SCHEMA, memoryKey: input.interaction.memoryKey, answer,
    storedAt: text(input.storedAt), actorId: text(input.actorId) };
  const entries = input.entries.filter((item) => item?.memoryKey !== entry.memoryKey);
  return { entries: [...entries, entry], entry };
}
function batchRequests(interactions) {
  const findings = interactions.flatMap((interaction) => validateInteraction(interaction));
  if (findings.length) return { findings };
  const batches = [];
  let lowRisk = [];
  const flush = () => { if (lowRisk.length) { batches.push({ mode: "combined", interactions: lowRisk }); lowRisk = []; } };
  for (const interaction of interactions) {
    if (interaction.risk === "high") { flush(); batches.push({ mode: "single", interactions: [interaction] }); }
    else { lowRisk.push(interaction); if (lowRisk.length === 3) flush(); }
  }
  flush();
  return { batches };
}
function validateRequest(request) {
  const keys = ["schemaVersion", "requestId", "operation", "input"];
  const findings = validateExactObject(request, keys, keys, "request");
  if (!isObject(request)) return findings;
  if (request.schemaVersion !== REQUEST_SCHEMA) findings.push(finding("REQUEST_SCHEMA", "request.schemaVersion", `Expected ${REQUEST_SCHEMA}`));
  if (typeof request.requestId !== "string" || !request.requestId.trim()) findings.push(finding("REQUEST_ID", "request.requestId", "requestId must be a non-empty string"));
  if (!OPERATIONS.includes(request.operation)) findings.push(finding("REQUEST_OPERATION", "request.operation", "operation is not supported"));
  if (!isObject(request.input)) findings.push(finding("REQUEST_INPUT", "request.input", "input must be an object"));
  return findings;
}

async function run(request) {
  const requestFindings = validateRequest(request);
  const failureRequestId = typeof request?.requestId === "string" && request.requestId.trim()
    ? request.requestId : "unknown";
  if (requestFindings.length) return blocked(failureRequestId, requestFindings);
  const { requestId, operation, input } = request;
  const inputFindings = validateOperationInput(operation, input);
  if (inputFindings.length) return blocked(requestId, inputFindings);
  if (operation === "capabilities" || operation === "help") {
    const status = { implementedPure: [...OPERATIONS], localNotifierRequired: ["ide-native", "os-native"], planned: ["fatigue-detection", "mobile-forwarding"] };
    const payload = { operationSchemas: SCHEMAS, nextStep: { operation: "interaction-request", instruction: "Create a valid interaction." } };
    return operation === "capabilities" ? ok(requestId, { capabilities: { stateless: true, operationStatus: status,
      interactionSchema: INTERACTION_SCHEMA }, skill: { name: "confirm-protocol", version: COMPILER_VERSION }, ...payload })
      : ok(requestId, { help: { operations: OPERATIONS, operationStatus: status }, ...payload });
  }
  if (operation === "interaction-request") {
    const findings = validateInteraction(input.interaction);
    return findings.length ? blocked(requestId, findings) : ok(requestId, { interaction: input.interaction,
      chatFallback: renderChat(input.interaction), nextStep: { operation: "interaction-answer", instruction: "Render once and return the structured answer." } });
  }
  if (operation === "interaction-answer") {
    const result = answerInteraction(input);
    return result.findings ? blocked(requestId, result.findings) : ok(requestId, { ...result,
      nextStep: { operation: null, instruction: "Send callbackRequest to the declared callback owner." } });
  }
  if (operation === "chat-render") {
    const findings = validateInteraction(input.interaction);
    return findings.length ? blocked(requestId, findings)
      : ok(requestId, { text: renderChat(input.interaction, input.locale) });
  }
  if (operation === "memory-set") {
    const result = memorySet(input);
    return result.findings ? blocked(requestId, result.findings) : ok(requestId, result);
  }
  if (operation === "memory-list") return ok(requestId, { entries: input.entries });
  if (operation === "memory-clear") {
    const entries = input.entries.filter((entry) => entry?.memoryKey !== input.memoryKey);
    return ok(requestId, { entries, removed: input.entries.length - entries.length });
  }
  if (operation === "batch-request") {
    const result = batchRequests(input.interactions);
    return result.findings ? blocked(requestId, result.findings) : ok(requestId, { ...result,
      nextStep: { operation: "interaction-answer", instruction: "Render each batch; high-risk requests remain isolated." } });
  }
  const entries = input.entries.filter((entry) => (!text(input.requestId) || entry?.requestId === input.requestId)
    && (!text(input.actorId) || entry?.actorId === input.actorId));
  return ok(requestId, { entries });
}

export { run, OPERATIONS, SCHEMAS, INTERACTION_SCHEMA, MEMORY_SCHEMA, AUDIT_SCHEMA,
  validateInteraction, renderChat, normalizeAnswer, answerInteraction, memorySet, batchRequests };
