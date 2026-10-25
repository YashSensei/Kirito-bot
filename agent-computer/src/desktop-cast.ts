import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { FrameMessage, Screencast } from "./screencast";

/** Full guest desktop over the source viewer protocol and its existing control gate. */
export async function startDesktopCast(
  onFrame: (frame: FrameMessage) => void,
): Promise<Screencast> {
  const child = spawn(
    "python3",
    ["-u", `${import.meta.dir}/desktop-stream.py`],
    {
      env: { ...process.env, DISPLAY: process.env.COMPUTER_DESKTOP_DISPLAY },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  let stopped = false;
  const lines = createInterface({ input: child.stdout });
  let settle: (error?: Error) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    settle = (error) => (error ? reject(error) : resolve());
  });
  const timeout = setTimeout(
    () => settle(new Error("The desktop did not produce a frame.")),
    10_000,
  );
  lines.on("line", (line) => {
    if (stopped) return;
    try {
      const frame = JSON.parse(line) as FrameMessage;
      if (
        frame.type === "frame" &&
        typeof frame.data === "string" &&
        frame.data.length < 4_000_000
      ) {
        settle();
        onFrame(frame);
      }
    } catch {
      settle(new Error("The desktop stream returned an invalid frame."));
    }
  });
  // Drain diagnostics without echoing guest screen or keystroke contents.
  child.stderr.resume();
  child.once("error", () =>
    settle(new Error("The desktop stream could not start.")),
  );
  child.once("exit", () => {
    if (!stopped) settle(new Error("The desktop stream stopped."));
  });
  try {
    await ready;
  } catch (error) {
    child.kill();
    lines.close();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  return {
    async stop() {
      stopped = true;
      child.stdin.end();
      child.kill("SIGTERM");
      lines.close();
    },
    async send(message) {
      if (stopped || child.exitCode !== null)
        throw new Error("The desktop stream is closed.");
      await new Promise<void>((resolve, reject) =>
        child.stdin.write(`${JSON.stringify(message)}\n`, (error) =>
          error ? reject(error) : resolve(),
        ),
      );
    },
  };
}
