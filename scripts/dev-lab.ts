import { spawn } from "node:child_process";
import { startControlPlaneServer } from "./control-plane-server.ts";

const control = await startControlPlaneServer(Number(process.env.CONTROL_PORT ?? 8787));
console.log(`Agent API ${control.origin}`);
const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", process.env.UI_PORT ?? "5173"], {
  stdio: "inherit",
});

const shutdown = async (): Promise<void> => {
  vite.kill("SIGTERM");
  await control.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
