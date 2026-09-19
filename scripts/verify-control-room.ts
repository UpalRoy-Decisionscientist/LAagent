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
  await page.getByTestId("gate-INGEST").filter({ hasText: "ok" }).waitFor({ timeout: 60_000 });
  try {
    await page.getByTestId("gate-GIT_COMMIT").filter({ hasText: "ok" }).waitFor({ timeout: 90_000 });
  } catch (error) {
    const log = await page.locator("ol").innerText();
    throw new Error(`Pipeline did not finish: ${(error as Error).message}\n${log}`);
  }
  if (await page.getByTestId("gate-INGEST").filter({ hasText: "fail" }).count()) {
    throw new Error("Ingest gate failed in the control room.");
  }
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
