import { z } from "zod";
import { MAX_RESULT_CHARS, type McpCallResult, type McpTool } from "./mcp";

// The REST operations used by Miles, exposed through the original plugin/grant/audit pipeline.
const text = z.string().trim().min(1).max(20_000);
const id = z.string().regex(/^[a-zA-Z0-9_.-]{1,200}$/);
const payload = z.record(z.string(), z.unknown());
const definitions = {
  web_search: {
    path: "/v1/search",
    schema: z
      .object({
        objective: text.optional(),
        search_queries: z.array(text).min(1).max(20).optional(),
        max_results: z.number().int().min(1).max(20).optional(),
      })
      .strict()
      .refine((v) => v.objective || v.search_queries?.length),
    description:
      "Search the public web for current information and cited sources.",
  },
  web_fetch: {
    path: "/v1/extract",
    schema: z
      .object({
        urls: z.array(z.url()).min(1).max(10),
        objective: text.optional(),
      })
      .strict(),
    description: "Extract readable content from public web pages.",
  },
  parallel_image_search: {
    path: "/v1/images/search",
    schema: z.object({ search_queries: z.array(text).min(1).max(10) }).strict(),
    description: "Search for images using Parallel.",
  },
  parallel_entity_search: {
    path: "/v1beta/findall/entity-search",
    schema: payload,
    description:
      "Find entities using the Parallel entity-search API request schema.",
  },
  parallel_findall_create: {
    path: "/v1beta/findall/runs",
    schema: payload,
    description:
      "Start a paid Parallel FindAll research run using its request schema.",
  },
  parallel_findall_status: {
    suffix: "",
    schema: z.object({ findall_id: id }).strict(),
    description: "Read the status of a Parallel FindAll run.",
  },
  parallel_findall_result: {
    suffix: "/result",
    schema: z.object({ findall_id: id }).strict(),
    description: "Read the results of a Parallel FindAll run.",
  },
  parallel_findall_extend: {
    suffix: "/extend",
    schema: z.object({ findall_id: id, payload }).strict(),
    description: "Extend a paid Parallel FindAll research run.",
  },
  parallel_findall_cancel: {
    suffix: "/cancel",
    schema: z.object({ findall_id: id }).strict(),
    description: "Cancel a Parallel FindAll run.",
  },
  parallel_findall_enrich: {
    suffix: "/enrich",
    schema: z.object({ findall_id: id, payload }).strict(),
    description: "Enrich entities in a paid Parallel FindAll run.",
  },
} as const;

export const listNeedsCredential = false;
export async function listTools(): Promise<McpTool[]> {
  return Object.entries(definitions).map(([name, definition]) => ({
    name,
    description: definition.description,
    inputSchema: z.toJSONSchema(definition.schema, { unrepresentable: "any" }),
  }));
}

export async function callTool(
  connection: { url: string; token?: string },
  name: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<McpCallResult> {
  const fail = (message: string): McpCallResult => ({
    text: message,
    isError: true,
    truncated: false,
  });
  if (!connection.token)
    return fail(
      "Connect the Parallel API key in Plugins before using research.",
    );
  if (!Object.hasOwn(definitions, name)) return fail("Unknown Parallel tool.");
  // A catalogue URL is fixed; a caller cannot redirect this deployment's key elsewhere.
  try {
    if (new URL(connection.url).origin !== "https://api.parallel.ai")
      return fail("Invalid Parallel endpoint.");
  } catch {
    return fail("Invalid Parallel endpoint.");
  }
  const definition = definitions[name as keyof typeof definitions];
  const parsed = definition.schema.safeParse(args);
  if (!parsed.success)
    return fail("The Parallel request arguments do not match the tool schema.");
  const data = parsed.data as Record<string, unknown>;
  const isRead = [
    "parallel_findall_status",
    "parallel_findall_result",
  ].includes(name);
  const path =
    "path" in definition
      ? definition.path
      : `/v1beta/findall/runs/${data.findall_id}${definition.suffix}`;
  const body = "path" in definition ? data : (data.payload ?? {});
  // Current Search rejects the older Miles max_results field; cap the returned list locally.
  const { max_results: maxResults, ...searchBody } = data;
  try {
    const response = await fetchImpl(`https://api.parallel.ai${path}`, {
      method: isRead ? "GET" : "POST",
      redirect: "error",
      headers: {
        "x-api-key": connection.token,
        "content-type": "application/json",
      },
      ...(!isRead
        ? { body: JSON.stringify(name === "web_search" ? searchBody : body) }
        : {}),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) {
      // Provider error bodies can echo credentials. Preserve status, never the raw body.
      const reason =
        (
          {
            401: "credential rejected",
            402: "billing or credits required",
            403: "access denied",
            429: "rate limit reached",
            400: "invalid request",
            422: "invalid request",
          } as Record<number, string>
        )[response.status] ?? "service unavailable";
      return fail(`Parallel: ${reason} (HTTP ${response.status}).`);
    }
    if (response.status === 204)
      return {
        text: JSON.stringify({ cancelled: true, findall_id: data.findall_id }),
        isError: false,
        truncated: false,
      };
    const reader = response.body?.getReader();
    if (!reader) return fail("Parallel returned no response.");
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > 8 * 1024 * 1024) {
        await reader.cancel();
        return fail("Parallel response exceeded the size limit.");
      }
      chunks.push(next.value);
    }
    const decoded = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      name === "web_search" &&
      typeof maxResults === "number" &&
      Array.isArray(decoded.results)
    )
      decoded.results = decoded.results.slice(0, maxResults);
    const result = JSON.stringify(decoded);
    const truncated = result.length > MAX_RESULT_CHARS;
    return {
      text: truncated
        ? `${result.slice(0, MAX_RESULT_CHARS)}\n[truncated]`
        : result,
      truncated,
      isError: false,
    };
  } catch {
    return fail(
      "Parallel did not complete the request. Check its status before retrying paid research.",
    );
  }
}
