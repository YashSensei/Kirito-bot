import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLizardComputerProvider } from "../src/computer/lizard";
import { createComputerGateway } from "../src/computer/gateway";
import { callTool } from "../src/plugins/parallel-rest";
import type { AuditStore } from "../src/audit";
const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});
async function fixture(failCreate = false, host = "computer.onlizard.com") {
  const dir = await mkdtemp(join(tmpdir(), "kirito-test-"));
  dirs.push(dir);
  let state = "running",
    creates = 0,
    pauses = 0,
    resumes = 0;
  const requests: string[] = [];
  const fetchImpl = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    const path = new URL(String(url)).pathname;
    requests.push(path);
    if (path === "/health") return Response.json({ status: "ok" });
    expect(new Headers(init?.headers).get("X-API-Key")).toBe("test-lizard");
    if (path === "/api/sandboxes") {
      creates++;
      if (failCreate) throw new Error("uncertain");
      return Response.json({ sandboxId: "test-vm" });
    }
    if (path.endsWith("/pause")) {
      pauses++;
      state = "paused";
      return Response.json({});
    }
    if (path.endsWith("/resume")) {
      resumes++;
      state = "running";
      return Response.json({});
    }
    if (path.endsWith("/expose/4100"))
      return Response.json({ hostname: host, accessToken: "test-private" });
    return Response.json({ status: state });
  }) as typeof fetch;
  const options = {
    apiKey: "test-lizard",
    projectId: "project",
    snapshotId: "snapshot",
    token: "computer",
    stateFile: join(dir, "bindings.json"),
    fetchImpl,
  };
  return {
    provider: createLizardComputerProvider(options),
    options,
    requests,
    counts: () => ({ creates, pauses, resumes }),
  };
}
describe("Lizard lifecycle", () => {
  test("passive status and header control do not create a VM", async () => {
    const f = await fixture();
    const gateway = createComputerGateway({
      provider: f.provider,
      policy: () => ({ mode: "enforce", allow: [], deny: [] }),
      auditStore: {} as AuditStore,
    });
    expect((await f.provider.status("bot")).state).toBe("absent");
    expect((await gateway.control("bot")).holder).toBe("bot");
    expect(f.requests).toEqual([]);
  });
  test("concurrent wakes create once, persist identity, and resume the same VM", async () => {
    const f = await fixture();
    const urls = await Promise.all([
      f.provider.locate("bot"),
      f.provider.locate("bot"),
    ]);
    expect(urls[0]).toBe(urls[1]);
    expect(f.counts().creates).toBe(1);
    expect(urls[0]).not.toContain("test-private");
    expect(f.provider.transportHeaders!(urls[0])).toEqual({
      "X-Lizard-Access-Token": "test-private",
    });
    const first = await f.provider.sessionOf!("bot");
    await f.provider.stop("bot");
    expect(await f.provider.locateIfRunning!("bot")).toBeUndefined();
    expect((await f.provider.status("bot")).state).toBe("absent");
    const restored = createLizardComputerProvider(f.options);
    await restored.locate("bot");
    expect(f.counts()).toEqual({ creates: 1, pauses: 1, resumes: 1 });
    expect(await restored.sessionOf!("bot")).not.toBe(first);
    expect(await readFile(f.options.stateFile, "utf8")).not.toContain(
      "test-private",
    );
  });
  test("uncertain creation cannot silently create a duplicate", async () => {
    const f = await fixture(true);
    await expect(f.provider.locate("bot")).rejects.toThrow("could not confirm");
    await expect(
      createLizardComputerProvider(f.options).locate("bot"),
    ).rejects.toThrow("not confirmed");
    expect(f.counts().creates).toBe(1);
  });
  test("private credentials are never sent to a foreign expose host", async () => {
    const f = await fixture(false, "attacker.example");
    await expect(f.provider.locate("bot")).rejects.toThrow("invalid private");
    expect(f.requests).not.toContain("/health");
  });
  test("idle sleep preserves the VM and activity postpones sleep", async () => {
    const f = await fixture();
    await f.provider.locate("bot");
    f.provider.touch!("bot");
    await f.provider.suspendIdle!(60_000);
    expect(f.counts().pauses).toBe(0);
    await f.provider.suspendIdle!(0);
    expect(f.counts().pauses).toBe(1);
    expect(f.counts().creates).toBe(1);
  });
});
describe("Parallel transport", () => {
  const connection = { url: "https://api.parallel.ai", token: "test-parallel" };
  test("search uses the current API shape, authentication, and local result limit", async () => {
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.parallel.ai/v1/search");
      expect(new Headers(init?.headers).get("x-api-key")).toBe("test-parallel");
      expect(JSON.parse(String(init?.body))).toEqual({
        search_queries: ["query"],
      });
      expect(init?.redirect).toBe("error");
      return Response.json({ results: [{ title: "one" }, { title: "two" }] });
    }) as typeof fetch;
    const result = await callTool(
      connection,
      "web_search",
      { search_queries: ["query"], max_results: 1 },
      fake,
    );
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text).results).toHaveLength(1);
  });
  test("invalid endpoint or arguments cause no request", async () => {
    const fake = (() => {
      throw new Error("must not fetch");
    }) as typeof fetch;
    expect(
      (await callTool({ ...connection, url: "bad" }, "web_search", {}, fake))
        .isError,
    ).toBe(true);
    expect((await callTool(connection, "web_search", {}, fake)).isError).toBe(
      true,
    );
  });
  test("provider errors do not expose credentials or response bodies", async () => {
    const fake = (async () =>
      new Response("test-parallel secret detail", {
        status: 401,
      })) as typeof fetch;
    const result = await callTool(
      connection,
      "web_search",
      { objective: "query" },
      fake,
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("credential rejected");
    expect(result.text).not.toContain("test-parallel");
  });
});
