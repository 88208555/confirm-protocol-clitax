const REQUEST_SCHEMA = "confirm-protocol.skill.request/1.0";
const RESPONSE_SCHEMA = "confirm-protocol.skill.response/1.0";
const INTERACTION_SCHEMA = "confirm.interaction/1.0";
const MEMORY_SCHEMA = "confirm.memory-entry/1.0";
const AUDIT_SCHEMA = "confirm.audit-entry/1.0";
const COMPILER_VERSION = "v7.0.19";
const OPERATIONS = ["capabilities", "help", "interaction-request", "interaction-answer",
  "chat-render", "memory-set", "memory-list", "memory-clear", "batch-request", "audit-query"];
const INTERACTION_TYPES = new Set(["confirm", "choice", "multi", "input"]);
const TIMEOUT_ACTIONS = new Set(["wait", "default", "cancel"]);
const RISK_LEVELS = new Set(["low", "high"]);

const stringSchema = (extra = {}) => ({ type: "string", ...extra });
const arraySchema = (items, extra = {}) => ({ type: "array", items, ...extra });
const objectSchema = (properties, required = [], extra = {}) => (
  { type: "object", properties, required, additionalProperties: false, ...extra }
);
const optionSchema = objectSchema({
  id: stringSchema({ minLength: 1 }), label: stringSchema({ minLength: 1 }),
  hint: stringSchema(),
}, ["id", "label"]);
const callbackSchema = objectSchema({
  operation: stringSchema({ minLength: 1 }), payload: objectSchema({}, [], { additionalProperties: true }),
}, ["operation", "payload"]);
const interactionSchema = objectSchema({
  schemaVersion: { const: INTERACTION_SCHEMA }, requestId: stringSchema({ minLength: 1 }),
  type: { enum: [...INTERACTION_TYPES] }, question: stringSchema({ minLength: 1 }),
  options: arraySchema(optionSchema), default: { type: ["string", "array", "null"] },
  timeout: { type: ["integer", "null"], minimum: 1 },
  timeoutAction: { enum: [...TIMEOUT_ACTIONS] }, risk: { enum: [...RISK_LEVELS] },
  riskDescription: stringSchema(), rememberable: { type: "boolean" },
  memoryKey: stringSchema(), callback: callbackSchema,
}, ["schemaVersion", "requestId", "type", "question", "options", "default", "timeout",
  "timeoutAction", "risk", "riskDescription", "rememberable", "memoryKey", "callback"]);
const memorySchema = objectSchema({
  schemaVersion: { const: MEMORY_SCHEMA }, memoryKey: stringSchema({ minLength: 1 }),
  answer: { type: ["string", "array"] }, storedAt: stringSchema({ format: "date-time" }),
  actorId: stringSchema({ minLength: 1 }),
}, ["schemaVersion", "memoryKey", "answer", "storedAt", "actorId"]);
const auditSchema = objectSchema({
  schemaVersion: { const: AUDIT_SCHEMA }, auditId: stringSchema({ minLength: 1 }),
  requestId: stringSchema({ minLength: 1 }), actorId: stringSchema({ minLength: 1 }),
  question: stringSchema({ minLength: 1 }), answer: { type: ["string", "array"] },
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
    answer: { type: ["string", "array"] }, actorId: stringSchema({ minLength: 1 }),
    answeredAt: stringSchema({ format: "date-time" }), remembered: { type: "boolean" },
    auditId: stringSchema({ minLength: 1 }) },
  ["interaction", "answer", "actorId", "answeredAt", "remembered", "auditId"],
  { callbackRequest: callbackSchema, auditEntry: auditSchema, nextStep: nextSchema },
  ["callbackRequest", "auditEntry", "nextStep"]),
  "chat-render": operationSchema({ interaction: interactionSchema }, ["interaction"],
    { text: stringSchema() }, ["text"]),
  "memory-set": operationSchema({ interaction: interactionSchema, answer: { type: ["string", "array"] },
    actorId: stringSchema(), storedAt: stringSchema({ format: "date-time" }), entries: arraySchema(memorySchema) },
  ["interaction", "answer", "actorId", "storedAt", "entries"],
  { entries: arraySchema(memorySchema), entry: memorySchema }, ["entries", "entry"]),
  "memory-list": operationSchema({ entries: arraySchema(memorySchema) }, ["entries"],
    { entries: arraySchema(memorySchema) }, ["entries"]),
  "memory-clear": operationSchema({ entries: arraySchema(memorySchema), memoryKey: stringSchema() },
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
function validateInteraction(value) {
  const findings = [];
  if (!isObject(value) || value.schemaVersion !== INTERACTION_SCHEMA) return [finding("INTERACTION_SCHEMA", "input.interaction", `Expected ${INTERACTION_SCHEMA}`)];
  if (!text(value.requestId) || !INTERACTION_TYPES.has(value.type) || !text(value.question)) findings.push(finding("INTERACTION_REQUIRED", "input.interaction", "requestId, type, and question are required"));
  if (!Array.isArray(value.options)) findings.push(finding("INTERACTION_OPTIONS", "input.interaction.options", "options must be an array"));
  if (!TIMEOUT_ACTIONS.has(value.timeoutAction) || !RISK_LEVELS.has(value.risk)) findings.push(finding("INTERACTION_POLICY", "input.interaction", "timeoutAction and risk must be valid"));
  if (!isObject(value.callback) || !text(value.callback.operation) || !isObject(value.callback.payload)) findings.push(finding("INTERACTION_CALLBACK", "input.interaction.callback", "callback operation and payload are required"));
  const options = Array.isArray(value.options) ? value.options : [];
  const optionIds = options.map((option) => text(option?.id));
  if (new Set(optionIds).size !== optionIds.length || optionIds.some((id) => !id)) findings.push(finding("INTERACTION_OPTION_IDS", "input.interaction.options", "option ids must be unique and non-empty"));
  if (value.type !== "input" && options.length < 2) findings.push(finding("INTERACTION_OPTION_COUNT", "input.interaction.options", "confirm, choice, and multi require at least two options"));
  if (value.risk === "high" && (!text(value.riskDescription) || value.rememberable !== false
    || value.timeoutAction !== "wait")) findings.push(finding("HIGH_RISK_POLICY", "input.interaction", "high risk requires a description, rememberable=false, and timeoutAction=wait"));
  return findings;
}
function renderChat(interaction) {
  const risk = interaction.risk === "high" ? `\n风险：${interaction.riskDescription}` : "";
  if (interaction.type === "input") return `${interaction.question}${risk}\n请输入答案。`;
  const options = interaction.options.map((option, index) => `${index + 1}. ${option.label}${option.hint ? ` — ${option.hint}` : ""}`);
  return `${interaction.question}${risk}\n${options.join("\n")}\n请输入选项编号。`;
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
  if (input.interaction?.risk === "high" && input.remembered === true) findings.push(finding("HIGH_RISK_REMEMBER", "input.remembered", "high risk answers cannot be remembered"));
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
  const findings = [];
  if (!isObject(request) || request.schemaVersion !== REQUEST_SCHEMA) findings.push(finding("REQUEST_SCHEMA", "request.schemaVersion", `Expected ${REQUEST_SCHEMA}`));
  if (!text(request?.requestId) || !OPERATIONS.includes(request?.operation) || !isObject(request?.input)) findings.push(finding("REQUEST_REQUIRED", "request", "requestId, supported operation, and input object are required"));
  return findings;
}

async function run(request) {
  const requestFindings = validateRequest(request);
  if (requestFindings.length) return blocked(request?.requestId ?? "unknown", requestFindings);
  const { requestId, operation, input } = request;
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
    return findings.length ? blocked(requestId, findings) : ok(requestId, { text: renderChat(input.interaction) });
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
