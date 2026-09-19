import { CollaborationBasin, PIPELINE_SEQUENCE } from "../shared/basin.ts";
import type { PipelineGate } from "../shared/types.ts";
import { runAuditorAgent } from "./auditor.ts";
import { runComposerAgent } from "./composer.ts";
import { runGitReleaseAgent } from "./git-release.ts";
import { runIngestionAgent } from "./ingestion.ts";
import { runKnowledgeGraphAgent } from "./knowledge-graph.ts";
import { runPlaywrightAgent } from "./playwright-runner.ts";

export interface OrchestratorOptions {
  sourcePath: string;
  moduleId: string;
  mockServerOrigin: string;
  authStoragePath?: string;
  commit?: boolean;
  chapters?: string[];
  setPlan?: (plan: import("../shared/types.ts").CaptureStep[]) => void;
  gates?: PipelineGate[];
  onProgress?: (event: {
    gate: PipelineGate;
    status: "running" | "ok" | "warn" | "fail";
    summary: string;
  }) => void;
}

export async function runOrchestrator(options: OrchestratorOptions): Promise<CollaborationBasin> {
  const basin = CollaborationBasin.create(options.moduleId);
  const wanted = new Set(options.gates ?? PIPELINE_SEQUENCE);
  const progress = options.onProgress ?? (() => undefined);

  const runGate = async (gate: PipelineGate, work: () => Promise<void> | void): Promise<void> => {
    if (!wanted.has(gate)) return;
    progress({ gate, status: "running", summary: `Starting ${gate}` });
    process.stdout.write(`[${PIPELINE_SEQUENCE.join("] -> [")}]\ncurrent: ${gate}\n`);
    try {
      await work();
      const status = basin.read().gates[gate] ?? "ok";
      const last = basin.read().messages.filter((message) => message.gate === gate).at(-1);
      progress({
        gate,
        status: status === "pending" ? "ok" : status,
        summary: last?.summary ?? `${gate} complete`,
      });
    } catch (error) {
      basin.post(
        {
          from: "orchestrator",
          to: "control-plane",
          gate,
          status: "fail",
          summary: (error as Error).message,
        },
        "fail",
      );
      progress({ gate, status: "fail", summary: (error as Error).message });
      throw error;
    }
  };

  await runGate("INGEST", () => runIngestionAgent(basin, options.sourcePath, options.chapters));
  await runGate("GRAPH_AND_PRUNE", () => runKnowledgeGraphAgent(basin));
  await runGate("PLAYWRIGHT_CAPTURE", () =>
    runPlaywrightAgent(basin, {
      moduleId: options.moduleId,
      mockServerOrigin: options.mockServerOrigin,
      authStoragePath: options.authStoragePath,
      setPlan: options.setPlan,
    }),
  );
  await runGate("RAG_AUDIT", () => runAuditorAgent(basin));
  await runGate("REACT_COMPOSE", () => runComposerAgent(basin));
  await runGate("GIT_COMMIT", () => {
    runGitReleaseAgent(basin, { commit: options.commit });
  });

  return basin;
}
