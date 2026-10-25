import type { CredentialAdminService } from "../credentials";
import type { PluginStore } from "./store";
import { listTools } from "./parallel-rest";

/** One-time setup for this local fork; later grants and revocations remain user-owned. */
export async function installKritovasResearch(
  plugins: PluginStore,
  credentials: CredentialAdminService,
  apiKey: string,
  actorId: string,
): Promise<void> {
  if (
    (await plugins.listServers()).some(
      (server) => server.id === "parallel-miles",
    )
  )
    return;
  const credential = await credentials.create({
    kind: "mcp",
    provider: "parallel-miles",
    keyId: "parallel-api-key",
    metadata: {},
    plaintext: apiKey,
    actorUserId: actorId,
  });
  await plugins.addServer({
    key: "parallel-miles",
    credentialId: credential.id,
    by: actorId,
  });
  for (const tool of await listTools())
    await plugins.grant(
      "mcp",
      `parallel-miles/${tool.name}`,
      "general-assistant",
      actorId,
    );
}

/** Grant installed tools once when a local bot is created; later revocations are retained. */
export async function grantKritovasResearch(plugins: PluginStore, agentId: string, actorId: string) {
  for (const server of await plugins.listServers())
    for (const tool of server.tools)
      await plugins.grant("mcp", tool.ref, agentId, actorId);
}
