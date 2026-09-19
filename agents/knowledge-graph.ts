import type { CollaborationBasin } from "../shared/basin.ts";
import { buildCapturePlan } from "../shared/build-capture-plan.ts";
import { AWS_SERVICES } from "../shared/curriculum.ts";
import { extractObjectives, extractTitle } from "../shared/extract.ts";
import type { DiagnosticChallenge, LearningObjective } from "../shared/types.ts";

function assertAcyclic(objectives: LearningObjective[]): void {
  const byId = new Map(objectives.map((objective) => [objective.id, objective]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      throw new Error(`Prerequisite cycle detected at ${id}`);
    }
    visiting.add(id);
    for (const parent of byId.get(id)?.prerequisites ?? []) {
      visit(parent);
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const objective of objectives) {
    visit(objective.id);
  }
}

export function buildLearningDag(rawText: string): {
  title: string;
  summary: string;
  objectives: LearningObjective[];
  skipGates: DiagnosticChallenge[];
} {
  const title = extractTitle(rawText);
  const parsed = extractObjectives(rawText);
  const mentioned = AWS_SERVICES.filter((service) =>
    new RegExp(`\\b${service.replace(" ", "\\s+")}\\b`, "i").test(rawText),
  );
  if (mentioned.length < 2 && parsed.length < 2) {
    throw new Error("Source does not mention enough AWS services to build a DAG.");
  }

  const fallback = mentioned.slice(0, 6).map((service, index, list) => {
    const bloom =
      index === list.length - 1 ? "evaluate" : index < 2 ? "apply" : "analyze";
    return {
      id: `lo-${index + 1}-${service.toLowerCase().replace(/\s+/g, "-")}`,
      title: `Apply ${service} from the ingested curriculum`,
      bloom,
      services: [service],
      prerequisites: index
        ? [`lo-${index}-${list[index - 1].toLowerCase().replace(/\s+/g, "-")}`]
        : [],
      track: bloom === "apply" ? "beginner" : bloom === "analyze" ? "intermediate" : "advanced",
      triplets: [{ subject: "Learner" as const, action: "configure", target: service }],
    } satisfies LearningObjective;
  });

  const objectives = parsed.length >= 2 ? parsed.slice(0, 10) : fallback;

  const skipGate: DiagnosticChallenge = {
    id: "sg-source-curriculum",
    prompt: `Without repeating the beginner labs, explain a production-ready ${mentioned[0] ?? "IAM"} control from this curriculum and name the AWS service it depends on.`,
    expectedSignals: [
      mentioned[0] ?? "IAM",
      "least privilege",
      mentioned[1] ?? "CloudWatch",
      "role",
    ],
    passThreshold: 3,
  };

  if (objectives[2]) {
    objectives[2] = { ...objectives[2], skipGate };
  }

  return {
    title,
    summary: `Curriculum compiled from ${title}. Services: ${mentioned.slice(0, 8).join(", ")}.`,
    objectives,
    skipGates: [skipGate],
  };
}

export function runKnowledgeGraphAgent(basin: CollaborationBasin): void {
  basin.requireGate("INGEST");
  const state = basin.read();
  const graph = buildLearningDag(state.rawText ?? "");
  assertAcyclic(graph.objectives);
  const capturePlan = buildCapturePlan(state.rawText ?? "", graph.objectives);
  basin.update((next) => {
    next.objectives = graph.objectives;
    next.skipGates = graph.skipGates;
    next.capturePlan = capturePlan;
    next.courseTitle = graph.title;
    next.courseSummary = graph.summary;
  });
  basin.post(
    {
      from: "knowledge-graph",
      to: "playwright-runner",
      gate: "GRAPH_AND_PRUNE",
      status: "ok",
      summary: `Built ${graph.objectives.length} Bloom-tagged objectives and ${capturePlan.length} visual steps for ${graph.title}.`,
      payload: {
        objectiveIds: graph.objectives.map((objective) => objective.id),
        skipGates: graph.skipGates,
        stepCount: capturePlan.length,
      },
    },
    "ok",
  );
}
