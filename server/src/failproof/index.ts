import * as failproofai from "@failproofai/sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configuredHome =
  process.env.FAILPROOFAI_HOME?.trim() ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../.failproofai");

failproofai.configure({
  baseDir: configuredHome + "/custom-agents",
  environment: process.env.AGENTEYE_ENVIRONMENT?.trim() || "openbot",
});

export { failproofai };

export function failproofSessionId(input: {
  threadId?: string | null;
  runId?: string | null;
  fallback?: string;
}) {
  return input.threadId || input.runId || input.fallback || "openbot-" + Date.now();
}

export function safeText(value: unknown, limit = 4000) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text || "").slice(0, limit);
}

export function recordToolResult(options: {
  toolName: string;
  toolCallId: string;
  output?: unknown;
  error?: unknown;
  sessionId?: string;
  agentId?: string;
}) {
  failproofai.event.toolResult({
    toolName: options.toolName,
    toolCallId: options.toolCallId,
    output: options.output === undefined ? undefined : safeText(options.output),
    error: options.error ? safeText(options.error, 2000) : undefined,
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    ...(options.agentId ? { agentId: options.agentId } : {}),
  });
}

export function recordToolUse(options: {
  toolName: string;
  toolCallId: string;
  input?: Record<string, unknown>;
  sessionId?: string;
  agentId?: string;
}) {
  failproofai.event.toolUse({
    toolName: options.toolName,
    toolCallId: options.toolCallId,
    input: options.input,
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    ...(options.agentId ? { agentId: options.agentId } : {}),
  });
}

export function recordError(options: {
  errorType: string;
  message: string;
  sessionId?: string;
  agentId?: string;
  fw_area?: string;
}) {
  failproofai.event.error({
    errorType: options.errorType,
    message: safeText(options.message, 2000),
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    ...(options.agentId ? { agentId: options.agentId } : {}),
    ...(options.fw_area ? { fw_area: options.fw_area } : {}),
  });
}

export function recordPolicyDecision(options: {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  allowed: boolean;
  rule?: string | null;
  reason?: string;
  botId?: string;
}) {
  const hookId = "policy-" + options.toolCallId;
  failproofai.event.hookTriggered({
    hookName: "openbot-policy",
    hookId,
    triggerEvent: "PreToolUse",
    input: {
      toolName: options.toolName,
      allowed: options.allowed,
      rule: options.rule || undefined,
      botId: options.botId,
    },
    sessionId: options.sessionId,
    agentId: "openbot-agent",
  });
  failproofai.event.hookCompleted({
    hookName: "openbot-policy",
    hookId,
    outcome: options.allowed ? "allow" : "deny",
    output: options.reason || options.rule || (options.allowed ? "allowed" : "blocked"),
    sessionId: options.sessionId,
    agentId: "openbot-agent",
  });
}

export function recordHumanWait(options: {
  sessionId: string;
  inputId: string;
  prompt: string;
  reason?: string;
}) {
  failproofai.event.humanWait({
    inputId: options.inputId,
    prompt: safeText(options.prompt, 2000),
    reason: options.reason,
    sessionId: options.sessionId,
    agentId: "openbot-agent",
  });
}

export function recordHumanInput(options: {
  sessionId: string;
  inputId: string;
  response?: string;
}) {
  failproofai.event.humanInput({
    inputId: options.inputId,
    response: options.response ? safeText(options.response, 1000) : undefined,
    sessionId: options.sessionId,
    agentId: "openbot-agent",
  });
}
