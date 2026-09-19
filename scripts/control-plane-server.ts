import http from "node:http";
import { randomUUID } from "node:crypto";
import type { PipelineGate } from "../shared/types.ts";
import { PIPELINE_SEQUENCE } from "../shared/basin.ts";
import { PIPELINE_PRESETS, AGENT_CARDS } from "../shared/presets.ts";
import { runOrchestrator } from "../agents/orchestrator.ts";
import { startMockConsoleServer } from "./mock-console/server.ts";
import { runUdayAwsConsoleLoginE2e } from "./uday-aws-console-login-e2e.ts";
import { runTfCloudAgents } from "../agents/aws-tf-cloud-agents.ts";

export interface ControlRun {
  id: string;
  status: "queued" | "running" | "ok" | "fail";
  presetId?: string;
  sourcePath: string;
  moduleId: string;
  chapters?: string[];
  gates: PipelineGate[];
  createdAt: string;
  events: Array<{ at: string; gate?: PipelineGate; status: string; summary: string }>;
  result?: Record<string, unknown>;
  error?: string;
}

const runs = new Map<string, ControlRun>();
let busy = false;

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export async function executeControlRun(run: ControlRun): Promise<void> {
  run.status = "running";
  const preset = PIPELINE_PRESETS.find((item) => item.id === run.presetId);
  if (preset?.kind === "console-login" || run.sourcePath === "console-login") {
    run.events.push({
      at: new Date().toISOString(),
      gate: "PLAYWRIGHT_CAPTURE",
      status: "running",
      summary: "IAM login + Uday Lambda lab",
    });
    const report = await runUdayAwsConsoleLoginE2e();
    run.result = report;
    run.status = "ok";
    run.events.push({
      at: new Date().toISOString(),
      gate: "PLAYWRIGHT_CAPTURE",
      status: "ok",
      summary: "Console login lab captured screenshots.",
    });
    return;
  }
  if (preset?.kind === "tf-cloud-agents" || run.sourcePath === "tf-cloud-agents") {
    run.events.push({
      at: new Date().toISOString(),
      gate: "PLAYWRIGHT_CAPTURE",
      status: "running",
      summary: "Prepare HCP Terraform AWS agents",
    });
    const report = runTfCloudAgents();
    run.result = report as unknown as Record<string, unknown>;
    run.status = "ok";
    run.events.push({
      at: new Date().toISOString(),
      gate: "PLAYWRIGHT_CAPTURE",
      status: "ok",
      summary: `Terraform Cloud agents ${report.mode} (${report.identity.source} identity).`,
    });
    return;
  }

  const needsCapture = run.gates.includes("PLAYWRIGHT_CAPTURE");
  const server = needsCapture ? await startMockConsoleServer(0) : null;
  try {
    const basin = await runOrchestrator({
      sourcePath: run.sourcePath,
      moduleId: run.moduleId,
      chapters: run.chapters,
      mockServerOrigin: server?.origin ?? "http://127.0.0.1:9",
      setPlan: server?.setPlan,
      gates: run.gates,
      onProgress: (event) => {
        run.events.push({
          at: new Date().toISOString(),
          gate: event.gate,
          status: event.status,
          summary: event.summary,
        });
      },
    });
    const state = basin.read();
    run.result = {
      basin: basin.path(),
      title: state.manifest?.title ?? state.courseTitle,
      gates: state.gates,
      rigor: state.manifest?.academicRigorScore,
      steps: state.manifest?.steps,
      assets: state.assets,
      services: state.manifest?.services,
      messages: state.messages,
    };
    const failed = Object.entries(state.gates).filter(
      ([gate, status]) => run.gates.includes(gate as PipelineGate) && status === "fail",
    );
    if (failed.length) {
      run.status = "fail";
      run.error = `Gates failed: ${failed.map(([gate]) => gate).join(", ")}`;
      throw new Error(run.error);
    }
    run.status = "ok";
  } finally {
    await server?.close();
  }
}

export async function startControlPlaneServer(
  port = Number(process.env.CONTROL_PORT ?? 8787),
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      res.end();
      return;
    }
    try {
      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, { ok: true, busy });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/aws-access") {
        json(res, 200, runTfCloudAgents());
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/presets") {
        json(res, 200, { presets: PIPELINE_PRESETS, agents: AGENT_CARDS, sequence: PIPELINE_SEQUENCE });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/runs") {
        json(res, 200, { runs: [...runs.values()].reverse() });
        return;
      }
      const runMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (req.method === "GET" && runMatch) {
        const run = runs.get(runMatch[1]);
        if (!run) {
          json(res, 404, { error: "Run not found" });
          return;
        }
        json(res, 200, run);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/runs") {
        if (busy) {
          json(res, 409, { error: "A pipeline run is already in progress." });
          return;
        }
        const payload = JSON.parse((await readBody(req)) || "{}") as {
          presetId?: string;
          sourcePath?: string;
          moduleId?: string;
          chapters?: string[];
          gates?: PipelineGate[];
        };
        const preset = PIPELINE_PRESETS.find((item) => item.id === payload.presetId);
        const run: ControlRun = {
          id: randomUUID(),
          status: "queued",
          presetId: payload.presetId,
          sourcePath: payload.sourcePath || preset?.sourcePath || "materials/s3-vpc-lab.md",
          moduleId: payload.moduleId || preset?.moduleId || "control-room-run",
          chapters: payload.chapters ?? preset?.chapters,
          gates: payload.gates?.length ? payload.gates : [...PIPELINE_SEQUENCE],
          createdAt: new Date().toISOString(),
          events: [],
        };
        runs.set(run.id, run);
        busy = true;
        void executeControlRun(run)
          .catch((error: Error) => {
            run.status = "fail";
            run.error = error.message;
            run.events.push({ at: new Date().toISOString(), status: "fail", summary: error.message });
          })
          .finally(() => {
            busy = false;
          });
        json(res, 202, run);
        return;
      }
      json(res, 404, { error: "Not found" });
    } catch (error) {
      json(res, 500, { error: (error as Error).message });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    origin: `http://127.0.0.1:${actualPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const isDirect = process.argv[1]?.endsWith("control-plane-server.ts");
if (isDirect) {
  const port = Number(process.env.CONTROL_PORT ?? 8787);
  startControlPlaneServer(port).then((server) => {
    console.log(`Agent control plane at ${server.origin}`);
  });
}
