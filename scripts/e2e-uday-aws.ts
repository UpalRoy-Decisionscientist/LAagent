import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { runOrchestrator } from "../agents/orchestrator.ts";
import { startMockConsoleServer } from "./mock-console/server.ts";

const SOURCE =
  process.env.UDAY_AWS_PATH ??
  (fs.existsSync("/tmp/Uday_AWS/Chapter_01_AWS_IAM.md")
    ? "/tmp/Uday_AWS"
    : (process.env.UDAY_AWS_URL ?? "https://github.com/DeeptiShuklaProject/Uday_AWS"));
const MODULE_ID = "uday-aws-iam-s3-lambda";
const CHAPTERS = (process.env.UDAY_CHAPTERS ?? "01,02,03,04,05,08").split(",");
const PORT = Number(process.env.E2E_PORT ?? "4180");

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const server = await startMockConsoleServer(PORT);
try {
  const basin = await runOrchestrator({
    sourcePath: SOURCE,
    moduleId: MODULE_ID,
    mockServerOrigin: server.origin,
    chapters: CHAPTERS,
    setPlan: server.setPlan,
  });
  const state = basin.read();
  const failed = Object.entries(state.gates).filter(([, status]) => status !== "ok");
  if (failed.length) {
    throw new Error(`Gates failed: ${JSON.stringify(failed)}`);
  }
  if (!state.manifest || state.manifest.steps.length < 4) {
    throw new Error("Composer did not emit enough visual steps.");
  }
  if (state.messages.length < 6) {
    throw new Error("Not every agent posted to the basin.");
  }

  const report = {
    source: state.sourcePath,
    title: state.manifest.title,
    gates: state.gates,
    agents: state.messages.map((message) => ({
      gate: message.gate,
      from: message.from,
      status: message.status,
      summary: message.summary,
    })),
    rigor: state.manifest.academicRigorScore,
    steps: state.manifest.steps.map((step) => ({
      title: step.title,
      imageSrc: step.imageSrc,
      auditPassed: step.auditPassed,
      score: step.academicRigorScore,
    })),
    services: state.manifest.services,
    objectives: state.manifest.objectives.map((objective) => objective.title),
  };

  const reportDir = path.join(process.cwd(), "content", "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "uday-aws-e2e.json"), JSON.stringify(report, null, 2));

  execFileSync("npm", ["run", "build"], { stdio: "inherit" });

  const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "4174"], {
    stdio: "pipe",
  });
  await wait(1500);
  const verify = spawn("npx", ["tsx", "scripts/verify-lesson-ui.ts"], {
    env: {
      ...process.env,
      PREVIEW_URL: "http://127.0.0.1:4174",
      MIN_STEPS: String(state.manifest.steps.length),
      UI_PROOF: `public/assets/course/${MODULE_ID}/ui-desktop-proof.png`,
    },
    stdio: "inherit",
  });
  const code: number = await new Promise((resolve) => {
    verify.on("close", (value) => resolve(value ?? 1));
  });
  preview.kill("SIGTERM");
  await wait(200);
  try {
    preview.kill("SIGKILL");
  } catch {
    /* already exited */
  }
  if (code !== 0) {
    throw new Error("UI verification failed for Uday AWS module.");
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  try {
    execFileSync("pkill", ["-f", "vite preview --host 127.0.0.1 --port 4174"], { stdio: "ignore" });
  } catch {
    /* no leftover preview */
  }
  await server.close();
}
