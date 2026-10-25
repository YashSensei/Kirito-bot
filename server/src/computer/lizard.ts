import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ComputerLocation, ComputerProvider } from "./provider";
import type { ComputerStatus } from "./schema";

export type LizardOptions = {
  apiKey: string;
  projectId: string;
  snapshotId: string;
  token: string;
  apiUrl?: string;
  stateFile: string;
  fetchImpl?: typeof fetch;
  readyTimeoutMs?: number;
};

type Sandbox = { sandboxId?: string; id?: string; status?: string };
type Binding = {
  id?: string;
  pending?: boolean;
  session: string;
  startedAt: string;
  lastUsed?: number;
};
type Endpoint = { url: string; token: string };

/** Miles' Lizard lifecycle, adapted to the source backend's ComputerProvider contract. */
export function createLizardComputerProvider(
  options: LizardOptions,
): ComputerProvider {
  const base = new URL(options.apiUrl ?? "https://lizard.build");
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error(
      "Lizard requires an HTTPS API origin without credentials or query parameters.",
    );
  for (const [name, value] of Object.entries({
    projectId: options.projectId,
    snapshotId: options.snapshotId,
  }))
    if (!/^[\w-]{1,160}$/.test(value))
      throw new Error(`Invalid Lizard ${name}.`);
  if (!options.apiKey.trim() || !options.token.trim())
    throw new Error("Lizard and computer credentials are required.");
  const doFetch = options.fetchImpl ?? fetch;
  const endpoints = new Map<string, Endpoint>();
  const desktops = new Map<
    string,
    { url: string; headers: Record<string, string> }
  >();
  const locks = new Map<string, Promise<unknown>>();
  const statuses = new Map<string, { at: number; info: Sandbox | undefined }>();
  let bindings: Record<string, Binding>;
  let saving: Promise<void> = Promise.resolve();
  const loaded = readFile(options.stateFile, "utf8")
    .then((raw) => {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Invalid Lizard state file.");
      bindings = Object.assign(Object.create(null), parsed);
    })
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
      bindings = Object.create(null);
    });
  const save = () => {
    const next = saving.then(async () => {
      await mkdir(dirname(options.stateFile), { recursive: true, mode: 0o700 });
      const temporary = `${options.stateFile}.tmp`;
      await writeFile(temporary, JSON.stringify(bindings), { mode: 0o600 });
      await rename(temporary, options.stateFile);
    });
    saving = next.catch(() => {});
    return next;
  };
  async function locked<T>(
    botId: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = locks.get(botId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    locks.set(botId, next);
    try {
      return await next;
    } finally {
      if (locks.get(botId) === next) locks.delete(botId);
    }
  }
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    missingOkay = false,
  ): Promise<any> {
    let response: Response;
    try {
      response = await doFetch(`${base.href.replace(/\/$/, "")}${path}`, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        headers: {
          "X-API-Key": options.apiKey,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error(
        "Lizard could not confirm the request. Check its status before repeating an action.",
      );
    }
    if (missingOkay && response.status === 404) return undefined;
    if (!response.ok) {
      const detail =
        (
          {
            401: "credential rejected",
            402: "billing required",
            403: "project access denied",
            404: "computer or snapshot missing",
            409: "computer is changing state",
            429: "capacity or rate limit reached",
          } as Record<number, string>
        )[response.status] ?? "service unavailable";
      throw new Error(`Lizard: ${detail} (HTTP ${response.status}).`);
    }
    if (response.status === 204) return {};
    const raw = await response.text();
    if (raw.length > 8 * 1024 * 1024)
      throw new Error("Lizard response exceeded the size limit.");
    return raw ? JSON.parse(raw) : {};
  }
  const path = (id: string) => {
    if (!/^[\w-]{1,160}$/.test(id))
      throw new Error("Invalid saved Lizard computer identity.");
    return `/api/sandboxes/${id}`;
  };
  const inspect = async (id: string): Promise<Sandbox | undefined> => {
    const cached = statuses.get(id);
    if (cached && Date.now() - cached.at < 2500) return cached.info;
    const info = await request(path(id), "GET", undefined, true);
    statuses.set(id, { at: Date.now(), info });
    return info;
  };
  async function waitFor(id: string, state: string): Promise<void> {
    const deadline = Date.now() + (options.readyTimeoutMs ?? 120_000);
    do {
      const info = await inspect(id);
      if (info?.status === state) return;
      if (!info || ["failed", "stopped", "deleted"].includes(info.status ?? ""))
        throw new Error(
          "The saved Lizard computer is unavailable; reset it explicitly to create a new one.",
        );
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    } while (Date.now() < deadline);
    throw new Error(
      `Lizard has not reached ${state}; its saved identity was retained.`,
    );
  }
  // A fresh private endpoint is checked once; hot actions reuse its recent health result.
  const healthyAt = new WeakMap<Endpoint, number>();
  async function expose(botId: string, id: string): Promise<Endpoint> {
    const value = await request(`${path(id)}/expose/4100`, "POST", {});
    const host = value.hostname;
    if (
      typeof host !== "string" ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.onlizard\.com$/i.test(host) ||
      !value.accessToken
    )
      throw new Error("Lizard returned an invalid private computer endpoint.");
    const endpoint = {
      url: `https://${host}`,
      token: String(value.accessToken),
    };
    endpoints.set(botId, endpoint);
    return endpoint;
  }
  return {
    name: "lizard",
    isolation: "per-bot",
    async desktopEndpoint(botId) {
      await this.locate(botId);
      const cached = desktops.get(botId);
      if (cached) return cached;
      const value = await request(
        `${path(bindings[botId].id!)}/expose/6082`,
        "POST",
        {},
      );
      if (
        typeof value.hostname !== "string" ||
        !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.onlizard\.com$/i.test(value.hostname) ||
        typeof value.accessToken !== "string" ||
        !value.accessToken
      )
        throw new Error("Lizard returned an invalid desktop endpoint.");
      const endpoint = {
        url: `wss://${value.hostname}`,
        headers: { "X-Lizard-Access-Token": value.accessToken },
      };
      desktops.set(botId, endpoint);
      return endpoint;
    },
    touch(botId) {
      if (bindings?.[botId]) bindings[botId].lastUsed = Date.now();
    },
    async locateIfRunning(botId) {
      await loaded;
      const id = bindings[botId]?.id;
      if (!id || (await inspect(id))?.status !== "running") return undefined;
      return (endpoints.get(botId) ?? (await expose(botId, id))).url;
    },
    async suspendIdle(idleAfterMs) {
      await loaded;
      for (const [botId, binding] of Object.entries(bindings)) {
        if (!binding.id || locks.has(botId)) continue;
        await locked(botId, async () => {
          if (
            Date.now() -
              (binding.lastUsed ?? new Date(binding.startedAt).getTime()) <
            idleAfterMs
          )
            return;
          if ((await inspect(binding.id!))?.status !== "running") return;
          await request(`${path(binding.id!)}/pause`, "POST", {});
          endpoints.delete(botId);
          desktops.delete(botId);
          statuses.delete(binding.id!);
        });
      }
    },
    transportHeaders(url): Record<string, string> {
      const endpoint = [...endpoints.values()].find(
        (item) => item.url === url.replace(/\/$/, ""),
      );
      return endpoint ? { "X-Lizard-Access-Token": endpoint.token } : {};
    },
    async locate(botId) {
      return locked(botId, async () => {
        await loaded;
        let binding = bindings[botId];
        if (binding?.pending)
          throw new Error(
            "A previous Lizard creation was not confirmed. Reconcile the computer in Lizard before retrying; Kirito-bot will not create a duplicate.",
          );
        if (!binding) {
          binding = {
            pending: true,
            session: crypto.randomUUID(),
            startedAt: new Date().toISOString(),
          };
          bindings[botId] = binding;
          await save();
          const result: Sandbox = await request("/api/sandboxes", "POST", {
            snapshotId: options.snapshotId,
            projectId: options.projectId,
            timeoutMs: 0,
            metadata: { kritovas_bot: botId },
          });
          const id = result.sandboxId ?? result.id;
          if (!id)
            throw new Error("Lizard did not confirm a computer identity.");
          path(id);
          binding.id = id;
          binding.pending = false;
          await save();
        }
        const id = binding.id!;
        binding.lastUsed = Date.now();
        let info = await inspect(id);
        if (info?.status === "pausing") {
          await waitFor(id, "paused");
          info = await inspect(id);
        }
        if (info?.status === "paused") {
          await request(`${path(id)}/resume`, "POST", {});
          statuses.delete(id);
          binding.session = crypto.randomUUID();
          await save();
          endpoints.delete(botId);
          desktops.delete(botId);
        }
        await waitFor(id, "running");
        const endpoint = endpoints.get(botId) ?? (await expose(botId, id));
        if (Date.now() - (healthyAt.get(endpoint) ?? 0) < 15_000)
          return endpoint.url;
        // The prepared snapshot contains the ORIGINAL agent-computer service, started per VM.
        const health = await doFetch(`${endpoint.url}/health`, {
          headers: {
            "X-Lizard-Access-Token": endpoint.token,
            "x-openbot-computer-token": options.token,
          },
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        }).catch(() => undefined);
        if (!health?.ok) {
          const result = await request(`${path(id)}/exec`, "POST", {
            cmd: ["/usr/local/bin/kritovas-computer-start"],
            user: "root",
            envs: { COMPUTER_TOKEN: options.token },
            timeoutMs: 15_000,
          });
          if (result.exitCode !== 0)
            throw new Error(
              "The Lizard snapshot needs the Kirito-bot computer service. Run computer:build:lizard first.",
            );
          const ready = await doFetch(`${endpoint.url}/health`, {
            headers: { "X-Lizard-Access-Token": endpoint.token },
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
          });
          if (!ready.ok)
            throw new Error("The Lizard computer service is not ready.");
        }
        healthyAt.set(endpoint, Date.now());
        return endpoint.url;
      });
    },
    async status(botId): Promise<ComputerStatus> {
      await loaded;
      const binding = bindings[botId];
      if (!binding) return { botId, state: "absent" };
      if (!binding.id)
        return {
          botId,
          state: "unreachable",
          reason: "Lizard creation is awaiting reconciliation.",
        };
      try {
        const info = await inspect(binding.id);
        return {
          botId,
          state:
            info?.status === "running"
              ? "ready"
              : info?.status === "paused"
                ? "absent"
                : info &&
                    [
                      "creating",
                      "starting",
                      "resuming",
                      "pausing",
                      "pending",
                    ].includes(info.status ?? "")
                  ? "starting"
                  : "unreachable",
        };
      } catch (error) {
        return {
          botId,
          state: "unreachable",
          reason: (error as Error).message,
        };
      }
    },
    async stop(botId) {
      return locked(botId, async () => {
        await loaded;
        const id = bindings[botId]?.id;
        if (!id) return { wasRunning: false };
        const info = await inspect(id);
        if (!info || ["paused", "pausing"].includes(info.status ?? ""))
          return { wasRunning: false };
        await request(`${path(id)}/pause`, "POST", {});
        statuses.delete(id);
        endpoints.delete(botId);
        desktops.delete(botId);
        return { wasRunning: true };
      });
    },
    async reset(botId) {
      return locked(botId, async () => {
        await loaded;
        const binding = bindings[botId];
        if (!binding) return { cleared: false };
        if (binding.pending)
          throw new Error(
            "Reconcile the unconfirmed Lizard creation before resetting it.",
          );
        await request(path(binding.id!), "DELETE", undefined, true);
        statuses.delete(binding.id!);
        delete bindings[botId];
        endpoints.delete(botId);
        await save();
        return { cleared: true };
      });
    },
    async list(): Promise<ComputerLocation[]> {
      await loaded;
      return Promise.all(
        Object.entries(bindings).map(async ([botId, binding]) => {
          const info = binding.id ? await inspect(binding.id) : undefined;
          const running = info?.status === "running";
          const endpoint =
            running && binding.id
              ? (endpoints.get(botId) ?? (await expose(botId, binding.id)))
              : undefined;
          return {
            botId,
            status: running ? "running" : "stopped",
            startedAt: binding.startedAt,
            ...(endpoint ? { url: endpoint.url } : {}),
          };
        }),
      );
    },
    async sessionOf(botId) {
      await loaded;
      return bindings[botId]?.session;
    },
  };
}
