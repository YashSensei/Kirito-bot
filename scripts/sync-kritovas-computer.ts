import { Sandbox } from "@lizard-build/sdk";
import { readFile } from "node:fs/promises";
import { applyLocalConfig, root, saveLocalConfig } from "./kritovas-config";
const c = await applyLocalConfig();
const archive = `${root}/.local/computer-update.tar.gz`;
if (
  Bun.spawnSync(["tar", "-czf", archive, "agent-computer/src"], { cwd: root })
    .exitCode
)
  throw new Error("Cannot package computer update.");
const installer = await readFile(
  `${root}/images/lizard/install-kritovas.sh`,
  "utf8",
);
const startup = installer.split("<<'START'\n")[1].split("\nSTART")[0];
async function sync(vm: Sandbox, restart: boolean) {
  await vm.fs.write("/tmp/kritovas-update.tar.gz", await readFile(archive));
  await vm.fs.write("/tmp/kritovas-start", startup);
  const r = await vm.process.exec(
    [
      "/bin/bash",
      "-c",
      "tar -xzf /tmp/kritovas-update.tar.gz -C /opt/kritovas && cp /tmp/kritovas-start /usr/local/bin/kritovas-computer-start && chmod 755 /usr/local/bin/kritovas-computer-start && rm /tmp/kritovas-update.tar.gz /tmp/kritovas-start",
    ],
    { user: "root" },
  );
  if (r.exitCode) throw new Error("Computer update failed.");
  {
    const stop = await vm.process.exec(
      [
        "python3",
        "-c",
        "import os,signal; me=os.getpid(); [(os.kill(int(p),signal.SIGTERM)) for p in os.listdir('/proc') if p.isdigit() and int(p)!=me and open('/proc/'+p+'/comm').read().strip()=='bun' and 'kritovas/agent-computer' in os.readlink('/proc/'+p+'/cwd')]",
      ],
      { user: "root" },
    );
    if (stop.exitCode)
      throw new Error("Could not stop the old computer service.");
    if (!restart) return; // Snapshots must not carry a browser service with stale environment.
    const started = await vm.process.exec(
      ["/usr/local/bin/kritovas-computer-start"],
      {
        user: "root",
        envs: { COMPUTER_TOKEN: c.COMPUTER_TOKEN },
        timeoutMs: 20_000,
      },
    );
    if (started.exitCode)
      throw new Error("Updated computer service did not start.");
  }
}
const file = Bun.file(`${root}/.local/lizard-computers.json`);
if (await file.exists()) {
  const bindings = (await file.json()) as Record<string, { id?: string }>;
  for (const binding of Object.values(bindings)) {
    if (!binding.id) continue;
    const vm = await Sandbox.connect(binding.id, { apiKey: c.LIZARD_API_KEY });
    if ((await vm.getInfo()).status === "running") {
      await sync(vm, true);
      console.log("Updated the existing Kritovas desktop.");
    }
  }
}
// Prepare future computers from a clean copy; never snapshot a user's active desktop.
const vm = await Sandbox.restore(c.LIZARD_SNAPSHOT_ID, {
  apiKey: c.LIZARD_API_KEY,
  projectId: c.LIZARD_PROJECT_ID,
  timeoutMs: 600_000,
});
try {
  if ((await vm.getInfo()).status === "paused") {
    await vm.resume();
    await vm.waitForStatus("running");
  }
  await sync(vm, false);
  const snapshot = await vm.snapshot("Kritovas live desktop", {
    scope: "project",
    poolSize: 1,
  });
  if (snapshot.status !== "ready")
    throw new Error("Updated snapshot is not ready.");
  c.LIZARD_SNAPSHOT_ID = snapshot.id;
  await saveLocalConfig(c);
  console.log("Future Kritovas computers now include full desktop streaming.");
} finally {
  await vm.kill();
}
