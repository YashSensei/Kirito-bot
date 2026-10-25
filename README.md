# Kirito-bot

The original Kirito-bot backend with Miles' dark interface, animated characters, and Lizard desktop integration. Bots use the configured OpenAI model. Create a bot from the sidebar **+**, choose its name, role, Public/Private visibility, character, color, and instructions.

## Run on this Mac

```sh
cd /Users/priyanshu/Development/kritovas
bun start
```

Open http://127.0.0.1:3010. The API listens on port 3001. Start Docker first if the database is stopped; `bun run setup:database` starts the existing local database and applies migrations.

The local setup is stored in ignored `.local/runtime.json` (permissions 0600). It contains the configured OpenAI, Lizard, Parallel.ai, Composio, database, and computer credentials. CopilotKit's existing Intelligence runtime remains part of the source backend and uses the signed-in project's configuration. No keys are committed. Keep the host's Azure and voice settings separate from this app's local setup.

## Computer and tools

- Open a bot's Computer sidebar and click its sleeping character to wake its persistent Lizard VM. The private noVNC relay streams the full desktop. **Take control** enables keyboard/mouse; **Return control** hands it back. **Expand** fits the desktop to the window.
- Sleep pauses the VM without deleting files. Idle computers pause after ten minutes; tools wake them as needed. The original browser, file, shell, and approval tools remain available.
- Parallel.ai research runs through the original grants, credential vault, and audit harness. The default bot and newly created local bots receive the configured research tools once; later revocations are retained.
- Composio is enabled. Use **Connections** to authorize individual app accounts, then assign capabilities to bots. Enabling Composio does not automatically authorize personal accounts.
- **Name & appearance** edits existing bots. Creation includes all 13 Miles character shapes and 11 colors.

`bun run computer:build:lizard` prepares a clean Lizard snapshot with the original computer service. `bun scripts/sync-kritovas-computer.ts` updates that service and prepares future desktops. Local VM identities are retained in `.local/lizard-computers.json`.

## Verification

```sh
bun run --cwd server typecheck
bun run --cwd app typecheck
bun test server/tests/rfb.test.ts server/tests/kritovas-integrations.test.ts server/tests/computer-gateway.test.ts server/tests/computer-provider.test.ts server/tests/agent-routes.test.ts
bun run --cwd app build
```

The desktop relay enforces control ownership on the server, including key release on return/disconnect. Upstream VM URLs and credentials stay on the server. Existing source deployment documentation and technical `OPENBOT_*` compatibility settings remain applicable.

## Sources

Based on [YashSensei/Kirito-bot](https://github.com/YashSensei/Kirito-bot). Miles character assets, appearance choices, motion styling, desktop behavior, and RFB filtering were adapted from the user's local `Development/miles` repository. Original notices remain with retained source files.
