import { chromium } from "playwright";
import fs from "node:fs";
import { startControlPlaneServer } from "./control-plane-server.ts";
import { localBin, spawnManaged, stopManaged, waitForHttp } from "../shared/process.ts";

const UI_PORT = Number(process.env.UI_PORT ?? 5175);
const CONTROL_PORT = Number(process.env.CONTROL_PORT ?? 8791);
const origin = `http://127.0.0.1:${UI_PORT}`;
const controlOrigin = `http://127.0.0.1:${CONTROL_PORT}`;

const control = await startControlPlaneServer(CONTROL_PORT);
const vite = spawnManaged(
  localBin("vite"),
  ["--host", "127.0.0.1", "--port", String(UI_PORT), "--strictPort"],
  { env: { ...process.env, CONTROL_ORIGIN: controlOrigin } },
);
vite.stdout?.on("data", (chunk) => process.stdout.write(chunk));
vite.stderr?.on("data", (chunk) => process.stderr.write(chunk));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
try {
  await waitForHttp(`${controlOrigin}/api/health`);
  await waitForHttp(origin);
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.getByTestId("nav-control").waitFor();
  await page.locator("select").selectOption("uday-excerpt");
  await page.getByTestId("run-all-agents").click();
  let latest: { status: string; error?: string } | undefined;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const payload = (await fetch(`${controlOrigin}/api/runs`).then((response) => response.json())) as {
      runs: Array<{ status: string; error?: string }>;
    };
    latest = payload.runs[0];
    if (latest?.status === "fail") {
      throw new Error(latest.error ?? "Control-plane run failed.");
    }
    if (latest?.status === "ok") break;
    await page.waitForTimeout(400);
  }
  if (latest?.status !== "ok") {
    throw new Error("Control-plane run did not reach ok.");
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("gate-INGEST").filter({ hasText: "ok" }).waitFor({ timeout: 15_000 });
  await page.getByTestId("gate-GIT_COMMIT").filter({ hasText: "ok" }).waitFor({ timeout: 15_000 });
  fs.mkdirSync("public/assets/course/ui-uday-excerpt", { recursive: true });
  await page.screenshot({
    path: "public/assets/course/ui-uday-excerpt/control-room-proof.png",
    fullPage: true,
  });

  await page.getByTestId("nav-lesson").click();
  await page.getByTestId("lesson-step").first().waitFor({ timeout: 15_000 });
  console.log("control-room-ui: all agent gates reached ok and lesson preview rendered");
} finally {
  await browser.close();
  stopManaged(vite);
  await control.close();
}
