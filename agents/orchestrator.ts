import { CollaborationBasin, PIPELINE_SEQUENCE } from "../shared/basin.ts";
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
}

export async function runOrchestrator(options: OrchestratorOptions): Promise<CollaborationBasin> {
  const basin = CollaborationBasin.create(options.moduleId);
  const log = (gate: string): void => {
    process.stdout.write(`[${PIPELINE_SEQUENCE.join("] -> [")}]\ncurrent: ${gate}\n`);
  };

  log("INGEST");
  await runIngestionAgent(basin, options.sourcePath, options.chapters);

  log("GRAPH_AND_PRUNE");
  runKnowledgeGraphAgent(basin);

  log("PLAYWRIGHT_CAPTURE");
  await runPlaywrightAgent(basin, {
    moduleId: options.moduleId,
    mockServerOrigin: options.mockServerOrigin,
    authStoragePath: options.authStoragePath,
    setPlan: options.setPlan,
  });

  log("RAG_AUDIT");
  runAuditorAgent(basin);

  log("REACT_COMPOSE");
  runComposerAgent(basin);

  log("GIT_COMMIT");
  runGitReleaseAgent(basin, { commit: options.commit });

  return basin;
}
