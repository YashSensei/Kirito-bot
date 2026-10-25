# Local Failproof implementation

This checkout runs Failproof locally. No Cloud key is required and no event is sent to Failproof Cloud by this setup.

## Run the demo

From the project folder:

    npm run failproof:demo
    npm run failproof:codex-log
    npm run failproof:dashboard

Open the project evidence dashboard at http://127.0.0.1:8021. The official Failproof local dashboard remains available at http://127.0.0.1:8020.

The evidence dashboard reads .failproofai/custom-agents/events/*.jsonl, shows event counts, filters, sessions, tools, policy decisions, errors, use-case labels, and event payload summaries. It binds to loopback only.

## What is instrumented

### Build activity

- scripts/failproof-demo.mjs emits a repeatable, clearly labeled codex-build-demo session covering model planning, web research, remote command execution, an allow policy, a blocked destructive command, a browser action, a human verification handoff, and completion.
- scripts/failproof-codex-log.mjs reads local Codex session JSONL files from the user profile, records session metadata and action counts into Failproof, and deliberately summarizes content instead of copying prompts, secrets, or full transcripts.
- Build evidence uses the codex-build environment and fw_source=codex-session-import so reviewers can distinguish imported build evidence from application traces.

### Agent runtime

- openbot/agent-bot/src/index.ts emits agent_start/agent_end spans per AG-UI run, model request/response pairs with request IDs and token usage, streamed tool calls, tool results, and provider errors.
- openbot/server/src/failproof/index.ts is the shared server bridge. It keeps the spool under the checkout .failproofai directory and provides safe payload truncation plus helpers for tools, errors, policy hooks, and human handoffs.
- openbot/server/src/index.ts registers a Failproof audit tap after the existing database audit insert. Every audited server action is mirrored into the local Failproof stream. This covers computer/browser actions, VM file and command operations, policy decisions, approvals, handoffs, integrations, lifecycle actions, and refused/failed operations.
- Policy decisions are represented as hook_triggered + hook_completed pairs under openbot-policy, with allow or deny outcomes.
- Human-in-the-loop waits and responses are represented as human_wait + human_input pairs.

## Local data locations

- Failproof event spool: .failproofai/custom-agents/events/
- Official Failproof hook activity: .failproofai/hook-activity/
- Local dashboard configuration/state: .failproofai/
- Codex source sessions: the user profile .codex/sessions/*.jsonl (read by the import script; not copied wholesale)

## Verification

- npm run failproof:demo emits a 17-event demonstration trace.
- npm run failproof:codex-log indexes recent local Codex sessions into a separate environment.
- The project dashboard returned HTTP 200 on 127.0.0.1:8021 and showed the emitted events.
- The modified server typechecks through the new Failproof code; the repository still reports one unrelated pre-existing TypeScript error in server/src/web-bot-auth.ts.

## What to show judges

1. Open http://127.0.0.1:8021 and filter policy to show the allowed and denied decisions.
2. Filter remote VM execution or browser research to show the agent environment actions.
3. Filter human to show the verification handoff.
4. Filter codex or open the codex-build environment to show build evidence.
5. Open http://127.0.0.1:8020 for the standard Failproof local sessions and policy views.
