import { chromium } from "playwright";
import fs from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { startControlPlaneServer } from "./control-plane-server.ts";

const UI_PORT = Number(process.env.UI_PORT ?? 5175);
const CONTROL_PORT = Number(process.env.CONTROL_PORT ?? 8791);
const origin = `http://127.0.0.1:${UI_PORT}`;
const controlOrigin = `http://127.0.0.1:${CONTROL_PORT}`;

async function waitFor(url: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const control = await startControlPlaneServer(CONTROL_PORT);
const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(UI_PORT), "--strictPort"], {
  env: { ...process.env, CONTROL_ORIGIN: controlOrigin },
  stdio: "pipe",
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
try {
  await waitFor(`${controlOrigin}/api/health`);
  await waitFor(origin);
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.getByTestId("nav-control").waitFor();
  await page.locator("select").selectOption("uday-excerpt");
  await page.getByTestId("run-all-agents").click();
  await page.getByTestId("gate-INGEST").filter({ hasText: "ok" }).waitFor({ timeout: 60_000 });
  await page.getByTestId("gate-GIT_COMMIT").filter({ hasText: "ok" }).waitFor({ timeout: 90_000 });
  fs.mkdirSync("public/assets/course/ui-uday-excerpt", { recursive: true });
  await page.screenshot({
    path: "public/assets/course/ui-uday-excerpt/control-room-proof.png",
    fullPage: true,
  });
  console.log("control-room-ui: all agent gates reached ok");
} finally {
  await browser.close();
  vite.kill("SIGKILL");
  try {
    execFileSync("pkill", ["-9", "-f", `vite --host 127.0.0.1 --port ${UI_PORT}`], { stdio: "ignore" });
  } catch {
    /* no leftover vite */
  }
  await control.close();
}
