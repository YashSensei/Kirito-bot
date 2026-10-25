import type { BaseEvent, RunAgentInput } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import { serve } from "bun";
import OpenAI from "openai";
import * as failproofai from "@failproofai/sdk";
import { hasManagedAgentToken } from "../../shared/agent-authorisation";
import { listenPort } from "../../shared/listen-port";
import {
  apiKeyOrPlaceholder,
  botSettings,
  keyIsRequired,
  requiresResponsesApi,
} from "../../shared/model-providers";
import { toProviderMessages } from "./history";

/**
 * The built-in Bot is an AG-UI HTTP service registered the same way as any customer-provided Bot.
 *
 * It publishes no tools of its own. Every callable tool arrives in `input.tools`, forwarded by the
 * runtime from the surface registration.
 *
 * The loop runs on the client. When this emits a tool call it ends the run; the surface executes the
 * tool, appends the result, and starts a new run with the fuller conversation. That keeps the tool
 * running where its effects are visible to the person watching.
 */

const resolvedPort = listenPort(process.env.PORT, 4200);
if (!resolvedPort.ok) {
  console.error(resolvedPort.reason);
  process.exit(1);
}
const PORT = resolvedPort.port;

// Keep Failproof traces with this checkout by default. A deployment can override
// the location with FAILPROOFAI_HOME without changing the agent code.
const FAILPROOF_HOME =
  process.env.FAILPROOFAI_HOME?.trim() ||
  `${import.meta.dir}/../../../.failproofai`;
failproofai.configure({
  // The TypeScript SDK appends `events` to baseDir. Keep that directory under
  // the Failproof home layout so the local daemon/dashboard can discover it at
  // `<FAILPROOFAI_HOME>/custom-agents/events`.
  baseDir: `${FAILPROOF_HOME}/custom-agents`,
  environment: process.env.AGENTEYE_ENVIRONMENT?.trim() || "openbot",
});

const MANAGED_AGENT_TOKEN = process.env.MANAGED_AGENT_TOKEN?.trim();
if (!MANAGED_AGENT_TOKEN) {
  console.error(
    "MANAGED_AGENT_TOKEN is not set. This process holds a model credential and will not start without a token for OpenBot's server.",
  );
  process.exit(1);
}
/**
 * Which model drives the Bot.
 *
 * This Bot speaks one provider's API by hand, so the provider is this file's and only the model is
 * configurable. What the default is, and which file every language in the box reads it from, is
 * `shared/model-providers.json`: this Bot's `bots.agent-bot` row, under `BOT_MODEL` when a
 * deployment sets one. The provider is pinned to `openai` rather than read from the environment —
 * this file has never read `BOT_PROVIDER`, and a Bot that answers on chat completions by hand
 * cannot start answering somewhere else because a variable changed.
 *
 * `gpt-5.5` works through `/v1/chat/completions`, which is the API this file uses.
 *
 * `gpt-5.6-*` models require the Responses API for tool use and cannot be used by this
 * chat-completions streaming loop.
 */
const MODEL = botSettings("agent-bot", process.env, "openai").model;
/*
 * Refuse a model this file cannot use, rather than discover it one tool call at a time — the
 * failure `requiresResponsesApi` names, asked as a question about this Bot rather than about the
 * model. The provider answers with an error, this Bot ends the run, and the person sees no reply
 * and no reason. Silence is the worst failure available here, and it is what a single mistaken
 * `BOT_MODEL` produced: every tool-using turn stopped dead while the Bot looked healthy.
 *
 * Startup is where a deployment can act on it, which is the same posture as the token check above.
 */
if (requiresResponsesApi(MODEL)) {
  console.error(
    `BOT_MODEL=${MODEL} cannot be used by this Bot. It speaks /v1/chat/completions directly, and ` +
      "that endpoint refuses function tools for this model, so every tool call would fail with no " +
      "reply. Use gpt-5.5, or the framework Bot on port 4201, which speaks the Responses API.",
  );
  process.exit(1);
}

/**
 * Where that model is answered from.
 *
 * Unset, this is OpenAI. Set, it is any endpoint speaking the same `/v1/chat/completions` API: a
 * gateway in front of several providers, a proxy, or a model on hardware you control. Which is the
 * point of writing against that API by hand rather than against one company's URL.
 *
 * `BOT_MODEL` is sent verbatim, because an endpoint names its own catalogue.
 */
const BASE_URL = process.env.OPENAI_BASE_URL?.trim() || undefined;

/**
 * The key that model is answered with, checked at startup rather than on the first conversation.
 *
 * Without the check the Bot starts, answers the healthcheck, and then fails every run, so the
 * compose healthcheck reports a Bot that cannot answer as healthy. The LangGraph Bot already
 * refuses to start without its provider's key, and this file already refuses without its token
 * above; the model key was the one configuration that escaped the same posture. A missing key
 * should fail in front of whoever is deploying, not in front of whoever is asking.
 */
const API_KEY = process.env.OPENAI_API_KEY?.trim();
/*
 * UNLESS AN ENDPOINT WAS NAMED, in which case the endpoint is the model and the key belongs to it.
 *
 * Ollama, vLLM, LM Studio and llama.cpp all serve this API with no key at all, and the setup window
 * offers exactly those by name. Requiring one here refused the whole keyless half of that feature:
 * the person filled in an address, the app raised this Bot, and it exited on startup with
 * "OPENAI_API_KEY is not set" about a key their endpoint does not have. The two ends of one feature
 * disagreeing.
 *
 * The check still holds for plain OpenAI, which is the case it was written for.
 */
if (!API_KEY && keyIsRequired("openai", BASE_URL)) {
  console.error(
    "OPENAI_API_KEY is not set, and no OPENAI_BASE_URL names an endpoint that needs no key. This Bot cannot answer without a model.",
  );
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKeyOrPlaceholder(API_KEY),
  baseURL: BASE_URL,
});

// AG-UI sends the complete conversation on each turn. Remember tool result ids
// so a previous result is not emitted again when the next model turn starts.
const recordedToolResults = new Set<string>();

// Failproof is local evidence, not a transcript store. Keep event metadata useful for
// debugging while excluding prompts, tool results, credentials, and page content.
function messageSummary(messages: RunAgentInput["messages"] | undefined) {
  return (messages ?? []).map((message) => ({
    role: message.role,
    toolCallId: typeof message.toolCallId === "string" ? message.toolCallId : undefined,
    contentChars: typeof message.content === "string" ? message.content.length : undefined,
  }));
}

/** Every tool comes from the caller. This service publishes none of its own, on purpose. */
function toProviderTools(input: RunAgentInput) {
  if (!input.tools?.length) return undefined;
  return input.tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as Record<string, unknown>,
    },
  }));
}

async function runAgent(input: RunAgentInput): Promise<Response> {
  const encoder = new EventEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const utf8 = new TextEncoder();
      const send = (event: BaseEvent) =>
        controller.enqueue(utf8.encode(encoder.encodeSSE(event)));
      // AG-UI creates a new run for each tool round; the thread is the stable
      // session identity that lets Failproof join those rounds into one trace.
      const sessionId = input.threadId || input.runId;
      const userMessages = (input.messages ?? []).filter(
        (message) => message.role === "user",
      );
      const goal = userMessages.length
        ? `Complete the OpenBot run (${userMessages.length} user message${userMessages.length === 1 ? "" : "s"}, ${messageSummary(input.messages).reduce((total, message) => total + (message.contentChars ?? 0), 0)} characters).`
        : "Complete the OpenBot run.";
      const span = failproofai.agent.open("openbot-agent", {
        sessionId,
        goal,
      });
      const requestId = input.runId;
      let modelClosed = false;

      send({
        type: "RUN_STARTED",
        threadId: input.threadId,
        runId: input.runId,
      } as BaseEvent);

      try {
        // A tool result arrives on the next AG-UI run because OpenBot executes
        // tools at the surface where their effects are visible. Close that
        // cross-run leaf before recording the next model request.
        for (const message of input.messages ?? []) {
          if (message.role !== "tool") continue;
          const toolCallId = message.toolCallId;
          const toolName = "tool";
          if (
            typeof toolCallId === "string" &&
            !recordedToolResults.has(toolCallId)
          ) {
            recordedToolResults.add(toolCallId);
            failproofai.event.toolResult({
              toolName,
              toolCallId,
              output: {
                contentChars:
                  typeof message.content === "string"
                    ? message.content.length
                    : undefined,
              },
            });
          }
        }
        failproofai.event.modelRequest({
          model: MODEL,
          requestId,
          messages: messageSummary(input.messages),
          toolCount: input.tools?.length ?? 0,
        });
        const completion = await openai.chat.completions.create({
          model: MODEL,
          messages: toProviderMessages(input),
          tools: toProviderTools(input),
          stream: true,
          stream_options: { include_usage: true },
        });

        const messageId = `msg_${input.runId}`;
        let textOpen = false;
        // Providers stream a tool call's arguments in fragments across many chunks, keyed only by
        // index. Buffering per index is what turns that back into one call the surface can run.
        const toolCalls = new Map<
          number,
          { id: string; name: string; args: string }
        >();
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;
        let stopReason: string | undefined;

        for await (const chunk of completion) {
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
          }
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;
          if (chunk.choices[0]?.finish_reason) {
            stopReason = chunk.choices[0].finish_reason;
          }

          if (delta.content) {
            if (!textOpen) {
              send({
                type: "TEXT_MESSAGE_START",
                messageId,
                role: "assistant",
              } as BaseEvent);
              textOpen = true;
            }
            send({
              type: "TEXT_MESSAGE_CONTENT",
              messageId,
              delta: delta.content,
            } as BaseEvent);
          }

          for (const call of delta.tool_calls ?? []) {
            const existing = toolCalls.get(call.index) ?? {
              id: call.id ?? `call_${input.runId}_${call.index}`,
              name: "",
              args: "",
            };
            if (call.id) existing.id = call.id;
            if (call.function?.name) existing.name = call.function.name;
            if (call.function?.arguments)
              existing.args += call.function.arguments;
            toolCalls.set(call.index, existing);
          }
        }

        if (textOpen) {
          send({ type: "TEXT_MESSAGE_END", messageId } as BaseEvent);
        }

        for (const call of toolCalls.values()) {
          let inputArgs: Record<string, unknown> | undefined;
          try {
            const parsed = JSON.parse(call.args || "{}");
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              inputArgs = parsed as Record<string, unknown>;
            }
          } catch {
            // The raw streamed arguments remain in the AG-UI event.
          }
          failproofai.event.toolUse({
            toolName: call.name || "tool",
            toolCallId: call.id,
            input: inputArgs
              ? {
                  keys: Object.keys(inputArgs),
                  argumentChars: call.args.length,
                }
              : { argumentChars: call.args.length },
          });
          send({
            type: "TOOL_CALL_START",
            toolCallId: call.id,
            toolCallName: call.name,
            parentMessageId: messageId,
          } as BaseEvent);
          send({
            type: "TOOL_CALL_ARGS",
            toolCallId: call.id,
            delta: call.args || "{}",
          } as BaseEvent);
          send({ type: "TOOL_CALL_END", toolCallId: call.id } as BaseEvent);
        }
        failproofai.event.modelResponse({
          model: MODEL,
          requestId,
          stopReason: stopReason || (toolCalls.size ? "tool_calls" : "stop"),
          inputTokens,
          outputTokens,
          content: toolCalls.size
            ? [...toolCalls.values()].map(({ id, name }) => ({ id, name }))
            : undefined,
        });
        modelClosed = true;

        send({
          type: "RUN_FINISHED",
          threadId: input.threadId,
          runId: input.runId,
        } as BaseEvent);
      } catch (error) {
        if (!modelClosed) {
          failproofai.event.modelResponse({
            model: MODEL,
            requestId,
            stopReason: "error",
            content: error instanceof Error ? error.message : String(error),
          });
        }
        // Reported as a run error rather than a dropped connection, so the transcript can say what
        // went wrong. A stream that simply ends leaves the surface waiting forever with no reason.
        send({
          type: "RUN_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "The Bot could not answer.",
        } as BaseEvent);
      } finally {
        span.dispose();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": encoder.getContentType(),
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}

serve({
  port: PORT,
  idleTimeout: 120,
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", model: MODEL });
    }

    if (url.pathname === "/ag-ui" && request.method === "POST") {
      if (!hasManagedAgentToken(request, MANAGED_AGENT_TOKEN)) {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
      }
      const input = (await request.json()) as RunAgentInput;
      return runAgent(input);
    }

    return Response.json({ error: "Not found." }, { status: 404 });
  },
});

console.info(`agent-bot listening on http://127.0.0.1:${PORT}/ag-ui`);
