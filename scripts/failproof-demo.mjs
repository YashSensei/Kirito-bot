import * as failproofai from "@failproofai/sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const home = process.env.FAILPROOFAI_HOME?.trim() || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.failproofai");
failproofai.configure({
  baseDir: home + "/custom-agents",
  environment: process.env.AGENTEYE_ENVIRONMENT?.trim() || "openbot",
});

const sessionId = "codex-build-demo-" + Date.now();
const agentId = "codex-build-agent";
const source = "codex-build-demo";
const emit = (fn, fields = {}) => fn({ sessionId, agentId, fw_source: source, ...fields });

emit(failproofai.event.agentStart, {
  goal: "Build and instrument the remote research workspace",
  fw_phase: "implementation",
});
emit(failproofai.event.modelRequest, {
  model: "codex-build-model",
  requestId: "req-architecture",
  messages: [{ role: "user", content: "Add local observability across agent, tools, policy, and remote computer." }],
  tools: [{ name: "search_web" }, { name: "run_remote_command" }, { name: "browser_navigate" }],
});
emit(failproofai.event.modelResponse, {
  model: "codex-build-model",
  requestId: "req-architecture",
  stopReason: "tool_calls",
  inputTokens: 1840,
  outputTokens: 312,
  content: "Selected observability boundaries and local dashboard plan.",
});

emit(failproofai.event.toolUse, { toolName: "search_web", toolCallId: "demo-search-1", input: { query: "Failproof local SDK event catalog" }, fw_use_case: "web research trace" });
emit(failproofai.event.toolResult, { toolName: "search_web", toolCallId: "demo-search-1", output: "Documentation page fetched and summarized." });
emit(failproofai.event.hookTriggered, { hookName: "openbot-policy", hookId: "demo-policy-1", triggerEvent: "PreToolUse", input: { toolName: "run_remote_command", command: "bun test", policy: "allow-safe-build" } });
emit(failproofai.event.hookCompleted, { hookName: "openbot-policy", hookId: "demo-policy-1", outcome: "allow", output: "Safe build command allowed before execution." });
emit(failproofai.event.toolUse, { toolName: "run_remote_command", toolCallId: "demo-command-1", input: { command: "bun test", workspace: "/workspace/project" }, fw_use_case: "remote VM execution" });
emit(failproofai.event.toolResult, { toolName: "run_remote_command", toolCallId: "demo-command-1", output: "Tests completed: 42 passed." });
emit(failproofai.event.hookTriggered, { hookName: "openbot-policy", hookId: "demo-policy-2", triggerEvent: "PreToolUse", input: { toolName: "run_remote_command", command: "rm -rf /", policy: "block-destructive" } });
emit(failproofai.event.hookCompleted, { hookName: "openbot-policy", hookId: "demo-policy-2", outcome: "deny", output: "Destructive command blocked before execution." });
emit(failproofai.event.error, { errorType: "policy_denied", message: "Blocked unsafe remote command before it reached the VM.", fw_area: "remote-computer" });
emit(failproofai.event.humanWait, { inputId: "demo-human-1", prompt: "The research site requested human verification.", reason: "browser challenge" });
emit(failproofai.event.humanInput, { inputId: "demo-human-1", response: "Human verified the page and returned control to the agent." });
emit(failproofai.event.toolUse, { toolName: "browser_navigate", toolCallId: "demo-browser-1", input: { url: "https://example.com/research", computer: "per-bot-isolated" }, fw_use_case: "browser research" });
emit(failproofai.event.toolResult, { toolName: "browser_navigate", toolCallId: "demo-browser-1", output: "Page opened; snapshot captured for grounded interaction." });
emit(failproofai.event.agentEnd, { outcome: "success", summary: "Demo completed across model, tools, policy, VM, browser, and human handoff.", fw_phase: "implementation" });

await failproofai.flush();
console.log(JSON.stringify({ sessionId, environment: process.env.AGENTEYE_ENVIRONMENT?.trim() || "openbot", source }, null, 2));
