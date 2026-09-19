import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditStep } from "../agents/auditor.ts";
import { buildLearningDag } from "../agents/knowledge-graph.ts";
import { CollaborationBasin } from "../shared/basin.ts";
import { DEFAULT_CAPTURE_PLAN } from "../shared/capture-plan.ts";
import kb from "../knowledge/aws-docs-kb.json";

describe("knowledge graph", () => {
  it("builds an acyclic Bloom-tagged DAG from the lab source", () => {
    const source = `
      Students will create a private Amazon S3 bucket, lock public access, place a sample
      workload in private subnets, and reach the bucket through a gateway VPC endpoint.
      IAM policies must follow least privilege. Verification uses CloudWatch.
    `;
    const { objectives, skipGates } = buildLearningDag(source);
    expect(objectives.length).toBeGreaterThanOrEqual(4);
    expect(skipGates[0]?.passThreshold).toBe(3);
    expect(objectives.some((objective) => objective.bloom === "evaluate")).toBe(true);
  });
});

describe("wiki-rag auditor", () => {
  it("passes the default capture plan and rejects access-key creation", () => {
    const documents = kb.documents;
    for (const step of DEFAULT_CAPTURE_PLAN) {
      const finding = auditStep(step, documents);
      expect(finding.passed, finding.hallucinationFlags.join(",")).toBe(true);
      expect(finding.score).toBeGreaterThanOrEqual(70);
    }
    const bad = auditStep(
      {
        ...DEFAULT_CAPTURE_PLAN[0],
        cliFallback: "aws iam create-access-key --user-name student",
      },
      documents,
    );
    expect(bad.passed).toBe(false);
  });
});

describe("collaboration basin", () => {
  it("records gated agent messages", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "basin-"));
    const file = path.join(dir, "run.json");
    writeFileSync(
      file,
      JSON.stringify({
        runId: "t",
        moduleId: "t",
        sourcePath: "",
        gates: { INGEST: "ok" },
        messages: [],
      }),
    );
    const basin = CollaborationBasin.fromFile(file);
    basin.post(
      {
        from: "a",
        to: "b",
        gate: "GRAPH_AND_PRUNE",
        status: "ok",
        summary: "graph ready",
      },
      "ok",
    );
    expect(basin.read().gates.GRAPH_AND_PRUNE).toBe("ok");
  });
});
