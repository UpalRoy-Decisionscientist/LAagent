import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function localBin(name: string): string {
  const candidate = path.join(process.cwd(), "node_modules", ".bin", name);
  if (!fs.existsSync(candidate)) {
    throw new Error(`Local binary not found: ${candidate}`);
  }
  return candidate;
}

export function spawnManaged(command: string, args: string[], options: SpawnOptions = {}): ChildProcess {
  return spawn(command, args, {
    ...options,
    detached: true,
    stdio: options.stdio ?? "pipe",
  });
}

export function stopManaged(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already exited */
    }
  }
}

export async function waitForHttp(url: string, timeoutMs = 20_000): Promise<void> {
  const started = Date.now();
  let lastError = "not reached";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}
