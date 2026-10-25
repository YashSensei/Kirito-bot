import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const root = resolve(import.meta.dir, "..");
export const configPath = resolve(root, ".local/runtime.json");
export async function localConfig(): Promise<Record<string, string>> {
  const value = JSON.parse(await readFile(configPath, "utf8"));
  if (!value || Object.values(value).some((item) => typeof item !== "string"))
    throw new Error(
      "Local runtime configuration must contain string settings.",
    );
  return value;
}
export async function saveLocalConfig(
  value: Record<string, string>,
): Promise<void> {
  await writeFile(configPath, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
}
export async function applyLocalConfig() {
  const settings = await localConfig();
  Object.assign(process.env, settings);
  process.env.INTELLIGENCE_API_KEY ||= process.env.CPK_INTELLIGENCE_API_KEY;
  process.env.INTELLIGENCE_API_URL ||=
    process.env.CPK_INTELLIGENCE_API_URL ||
    "https://api.intelligence.copilotkit.ai";
  process.env.INTELLIGENCE_GATEWAY_WS_URL ||=
    process.env.CPK_INTELLIGENCE_GATEWAY_WS_URL ||
    "wss://realtime.intelligence.copilotkit.ai";
  process.env.KRITOVAS_SETUP_DEFAULTS = "true";
  return settings;
}
