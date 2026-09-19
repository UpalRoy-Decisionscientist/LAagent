import type { CollaborationBasin } from "../shared/basin.ts";
import type { DiagnosticChallenge, LearningObjective } from "../shared/types.ts";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function buildLearningDag(rawText: string): {
  objectives: LearningObjective[];
  skipGates: DiagnosticChallenge[];
} {
  const skipGate: DiagnosticChallenge = {
    id: "sg-vpc-endpoints",
    prompt:
      "Write a gateway endpoint policy that allows s3:GetObject only when aws:SourceVpce matches the lab endpoint, and explain why a NAT gateway is unnecessary for S3-only private workloads.",
    expectedSignals: ["aws:SourceVpce", "gateway endpoint", "no NAT", "least privilege"],
    passThreshold: 3,
  };

  const objectives: LearningObjective[] = [
    {
      id: "lo-iam-least-privilege",
      title: "Author a least-privilege IAM role for private S3 reads",
      bloom: "apply",
      services: ["IAM", "S3"],
      prerequisites: [],
      track: "beginner",
      triplets: [
        { subject: "Learner", action: "create", target: "IAM" },
        { subject: "IAM role", action: "allow", target: "S3" },
      ],
    },
    {
      id: "lo-vpc-private-subnets",
      title: "Place workloads in multi-AZ private subnets",
      bloom: "apply",
      services: ["VPC"],
      prerequisites: ["lo-iam-least-privilege"],
      track: "beginner",
      triplets: [{ subject: "Learner", action: "create", target: "VPC" }],
    },
    {
      id: "lo-s3-private-bucket",
      title: "Create a private encrypted S3 bucket with Block Public Access",
      bloom: "apply",
      services: ["S3"],
      prerequisites: ["lo-iam-least-privilege"],
      track: "beginner",
      triplets: [
        { subject: "Learner", action: "create", target: "S3" },
        { subject: "Learner", action: "enable", target: "S3" },
      ],
    },
    {
      id: "lo-s3-gateway-endpoint",
      title: "Route private subnet S3 traffic through a gateway VPC endpoint",
      bloom: "analyze",
      services: ["VPC", "S3"],
      prerequisites: ["lo-vpc-private-subnets", "lo-s3-private-bucket"],
      track: "intermediate",
      skipGate,
      triplets: [{ subject: "Learner", action: "create", target: "VPC" }],
    },
    {
      id: "lo-verify-private-path",
      title: "Verify GetObject over the private path with CloudWatch evidence",
      bloom: "evaluate",
      services: ["S3", "CloudWatch"],
      prerequisites: ["lo-s3-gateway-endpoint"],
      track: "advanced",
      triplets: [
        { subject: "Learner", action: "verify", target: "S3" },
        { subject: "Learner", action: "confirm", target: "CloudWatch" },
      ],
    },
  ];

  const mentioned = unique(
    objectives.flatMap((objective) =>
      objective.services.filter((service) =>
        new RegExp(`\\b${service}\\b`, "i").test(rawText),
      ),
    ),
  );
  if (mentioned.length < 2) {
    throw new Error("Source does not mention enough AWS services to build a DAG.");
  }

  return { objectives, skipGates: [skipGate] };
}

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

export function runKnowledgeGraphAgent(basin: CollaborationBasin): void {
  basin.requireGate("INGEST");
  const state = basin.read();
  const { objectives, skipGates } = buildLearningDag(state.rawText ?? "");
  assertAcyclic(objectives);
  basin.update((next) => {
    next.objectives = objectives;
    next.skipGates = skipGates;
  });
  basin.post(
    {
      from: "knowledge-graph",
      to: "playwright-runner",
      gate: "GRAPH_AND_PRUNE",
      status: "ok",
      summary: `Built ${objectives.length} Bloom-tagged learning objectives with ${skipGates.length} skip gate(s).`,
      payload: {
        objectiveIds: objectives.map((objective) => objective.id),
        skipGates,
      },
    },
    "ok",
  );
}
