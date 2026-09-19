import { runOrchestrator } from "../agents/orchestrator.ts";
import { startMockConsoleServer } from "./mock-console/server.ts";

function arg(name: string, fallback: string): string {
  const prefixed = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (prefixed) return prefixed.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const sourcePath = arg("source", "materials/s3-vpc-lab.md");
const moduleId = arg("module", "s3-vpc-private-access");
const port = Number(arg("port", "4177"));
const chaptersArg = arg("chapters", "");
const chapters = chaptersArg
  ? chaptersArg.split(",").map((item) => item.trim()).filter(Boolean)
  : undefined;
const authStoragePath = process.env.AWS_STORAGE_STATE;

const server = await startMockConsoleServer(port);
try {
  const basin = await runOrchestrator({
    sourcePath,
    moduleId,
    mockServerOrigin: server.origin,
    authStoragePath,
    commit: process.argv.includes("--commit"),
    chapters,
    setPlan: server.setPlan,
  });
  const state = basin.read();
  console.log(
    JSON.stringify(
      {
        basin: basin.path(),
        source: state.sourcePath,
        title: state.manifest?.title,
        gates: state.gates,
        rigor: state.manifest?.academicRigorScore,
        steps: state.manifest?.steps.length,
        services: state.manifest?.services,
        messages: state.messages.map((message) => ({
          gate: message.gate,
          from: message.from,
          status: message.status,
          summary: message.summary,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
