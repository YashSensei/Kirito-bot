import { applyLocalConfig, root, saveLocalConfig } from "./kritovas-config";

const config = await applyLocalConfig();
const command = process.argv[2] ?? "dev";
async function run(cmd: string[], cwd = root) {
  const child = Bun.spawn(cmd, {
    cwd,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await child.exited;
  if (code) throw new Error(`${cmd[0]} failed (${code}).`);
}
if (command === "database") {
  const password = config.KRITOVAS_DATABASE_PASSWORD ?? crypto.randomUUID();
  config.KRITOVAS_DATABASE_PASSWORD = password;
  config.DATABASE_URL = `postgres://kritovas:${password}@127.0.0.1:5544/kritovas`;
  await saveLocalConfig(config);
  Object.assign(process.env, config, { POSTGRES_PASSWORD: password });
  const exists =
    Bun.spawnSync(["docker", "container", "inspect", "kritovas-postgres"], {
      stdout: "ignore",
      stderr: "ignore",
    }).exitCode === 0;
  if (exists) await run(["docker", "start", "kritovas-postgres"]);
  else
    await run([
      "docker",
      "run",
      "-d",
      "--name",
      "kritovas-postgres",
      "--restart",
      "unless-stopped",
      "-p",
      "127.0.0.1:5544:5432",
      "-e",
      "POSTGRES_USER=kritovas",
      "-e",
      "POSTGRES_DB=kritovas",
      "-e",
      "POSTGRES_PASSWORD",
      "-v",
      "kritovas-pgvector:/var/lib/postgresql/data",
      "pgvector/pgvector:pg17",
    ]);
  for (let attempt = 0; attempt < 30; attempt++) {
    const check = Bun.spawnSync(
      ["docker", "exec", "kritovas-postgres", "pg_isready", "-U", "kritovas"],
      { stdout: "ignore", stderr: "ignore" },
    );
    if (check.exitCode === 0) break;
    await Bun.sleep(1_000);
  }
  await run(["bun", "scripts/migrate.ts"], `${root}/server`);
} else if (command === "snapshot") {
  await import("./prepare-kritovas-lizard");
} else if (command === "server") {
  process.chdir(`${root}/server`);
  await import("../server/src/index");
} else if (command === "cull") {
  await import("../server/scripts/cull-idle-computers");
} else if (command === "dev") {
  const missing = [
    "DATABASE_URL",
    "INTELLIGENCE_API_URL",
    "INTELLIGENCE_GATEWAY_WS_URL",
    "INTELLIGENCE_API_KEY",
  ].filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error(
      `Missing local settings: ${missing.join(", ")}. Run setup before starting Kirito-bot.`,
    );
  await run(["bun", "scripts/generate-app-config.ts"]);
  const children = [
    Bun.spawn(["bun", "scripts/kritovas.ts", "server"], {
      cwd: root,
      env: process.env,
      stdout: "inherit",
      stderr: "inherit",
    }),
    Bun.spawn(
      ["bun", "--bun", "node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
      {
        cwd: `${root}/app`,
        env: process.env,
        stdout: "inherit",
        stderr: "inherit",
      },
    ),
  ];
  const stop = () => {
    for (const child of children) child.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  console.log("Kirito-bot: http://127.0.0.1:3010");
  await Promise.race(children.map((child) => child.exited));
  stop();
} else throw new Error("Use dev, server, database, snapshot, or cull.");
