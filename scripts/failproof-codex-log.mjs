import * as failproofai from "@failproofai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.FAILPROOFAI_HOME?.trim() || path.join(root, ".failproofai");
const sessionsRoot = process.env.CODEX_SESSIONS_ROOT?.trim() || path.join(process.env.USERPROFILE || "", ".codex", "sessions");
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(full);
  }
}
await walk(sessionsRoot);
const withMtime = await Promise.all(files.map(async (file) => ({ file, mtimeMs: (await fs.stat(file)).mtimeMs })));
withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs);
const selected = withMtime.slice(0, Number(process.env.CODEX_SESSION_LIMIT || 3)).map(({ file }) => file);
failproofai.configure({ baseDir: path.join(home, "custom-agents"), environment: "codex-build" });
const sessionId = "codex-build-history-" + Date.now();
const agentId = "codex-agent";
const emit = (fn, fields = {}) => fn({ sessionId, agentId, fw_source: "codex-session-import", ...fields });
emit(failproofai.event.agentStart, { goal: "Record the Codex build history for the hackathon project", fw_files: selected.length });
let ordinal = 0;
for (const file of selected) {
  const lines = (await fs.readFile(file, "utf8")).split(/\r?\n/).filter(Boolean);
  const meta = lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).find((item) => item?.type === "session_meta");
  const fileId = path.basename(file, ".jsonl");
  emit(failproofai.event.toolUse, { toolName: "codex_session", toolCallId: "session-" + fileId, input: { file: fileId, cwd: meta?.payload?.cwd || root, entries: lines.length }, fw_use_case: "AI-assisted build evidence" });
  emit(failproofai.event.toolResult, { toolName: "codex_session", toolCallId: "session-" + fileId, output: "Local Codex session indexed without copying prompt or secret contents." });
  for (const line of lines) {
    let item; try { item = JSON.parse(line); } catch { continue; }
    if (item.type !== "function_call" && item.type !== "function_call_output" && item.type !== "tool_call") continue;
    const id = "codex-action-" + (++ordinal);
    emit(failproofai.event.toolUse, { toolName: "codex_tool", toolCallId: id, input: { eventType: item.type, sessionFile: fileId }, fw_use_case: "Codex implementation step" });
    emit(failproofai.event.toolResult, { toolName: "codex_tool", toolCallId: id, output: "Action recorded; content intentionally summarized for local evidence." });
  }
}
emit(failproofai.event.agentEnd, { outcome: "success", summary: "Codex session metadata and action counts indexed into the local Failproof spool." });
await failproofai.flush();
console.log(JSON.stringify({ sessionId, sessions: selected.map((file) => path.basename(file)), environment: "codex-build" }, null, 2));
