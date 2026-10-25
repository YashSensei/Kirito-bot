import { Sandbox } from "@lizard-build/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { applyLocalConfig, root, saveLocalConfig } from "./kritovas-config";

const config = await applyLocalConfig();
const apiKey = config.LIZARD_API_KEY;
const projectId = config.LIZARD_PROJECT_ID;
const source = config.LIZARD_SOURCE_SNAPSHOT_ID ?? config.LIZARD_SNAPSHOT_ID;
if (!apiKey || !projectId || !source)
  throw new Error("Lizard key, project, and source snapshot are required.");
const archive = `${root}/.local/computer-source.tar.gz`;
const packed = Bun.spawnSync(
  [
    "tar",
    "-czf",
    archive,
    "agent-computer/src",
    "agent-computer/package.json",
    "agent-computer/bun.lock",
    "shared/file-download.ts",
  ],
  { cwd: root },
);
if (packed.exitCode)
  throw new Error("Could not package the original computer service.");

// Restore a disposable copy: the original Miles snapshot and existing computers remain intact.
const vm = await Sandbox.restore(source, {
  apiKey,
  projectId,
  timeoutMs: 1_800_000,
});
await writeFile(
  `${root}/.local/lizard-build.json`,
  JSON.stringify({ sandboxId: vm.sandboxId, source }),
  { mode: 0o600 },
);
console.log(
  "Preparing the original computer service on a copy of the Miles snapshot.",
);
try {
  if ((await vm.getInfo()).status === "paused") {
    await vm.resume();
    await vm.waitForStatus("running");
  }
  await vm.fs.write("/tmp/kritovas-computer.tar.gz", await readFile(archive));
  await vm.fs.write(
    "/tmp/kritovas-install.sh",
    await readFile(`${root}/images/lizard/install-kritovas.sh`),
  );
  const result = await vm.process.exec(
    ["/bin/bash", "/tmp/kritovas-install.sh"],
    { timeoutMs: 600_000 },
  );
  if (result.exitCode !== 0)
    throw new Error(
      `Computer installation failed (exit ${result.exitCode}); inspect the disposable build VM logs.`,
    );
  const snapshot = await vm.snapshot("Kritovas source computer", {
    scope: "project",
    poolSize: 1,
  });
  if (snapshot.status !== "ready")
    throw new Error("The new Lizard snapshot is not ready.");
  config.LIZARD_SOURCE_SNAPSHOT_ID = source;
  config.LIZARD_SNAPSHOT_ID = snapshot.id;
  await saveLocalConfig(config);
  console.log("Kritovas computer snapshot prepared and configured.");
} finally {
  await vm.kill();
  console.log("Removed the disposable snapshot build VM.");
}
