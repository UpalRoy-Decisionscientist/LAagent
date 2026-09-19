import type { PipelineGate } from "./types.ts";

const SEQUENCE: PipelineGate[] = [
  "INGEST",
  "GRAPH_AND_PRUNE",
  "PLAYWRIGHT_CAPTURE",
  "RAG_AUDIT",
  "REACT_COMPOSE",
  "GIT_COMMIT",
];

export interface PipelinePreset {
  id: string;
  label: string;
  description: string;
  sourcePath: string;
  moduleId: string;
  chapters?: string[];
  kind: "pipeline" | "console-login" | "tf-cloud-agents";
}

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    id: "uday-excerpt",
    label: "Uday excerpt (fast test)",
    description: "Short IAM/Lambda fixture for exercising every agent quickly.",
    sourcePath: "tests/fixtures/uday-excerpt.md",
    moduleId: "ui-uday-excerpt",
    kind: "pipeline",
  },
  {
    id: "s3-vpc",
    label: "S3 private VPC lab",
    description: "Bundled AWS Academy private S3 + VPC endpoint lab.",
    sourcePath: "materials/s3-vpc-lab.md",
    moduleId: "s3-vpc-private-access",
    kind: "pipeline",
  },
  {
    id: "uday-chapters",
    label: "Uday_AWS IAM · S3 · Lambda",
    description: "Ingest Uday GitHub chapters 01, 02, 08 when the clone is available.",
    sourcePath: "https://github.com/DeeptiShuklaProject/Uday_AWS",
    moduleId: "uday-aws-iam-s3-lambda",
    chapters: ["01", "02", "08"],
    kind: "pipeline",
  },
  {
    id: "console-login",
    label: "Uday Lambda IAM login",
    description: "Playwright signs in as IAM user and runs Module 08 Lab 1.",
    sourcePath: "console-login",
    moduleId: "uday-lambda-console-login",
    kind: "console-login",
  },
  {
    id: "tf-cloud-agents",
    label: "HCP Terraform AWS agents",
    description: "Prepare the aws-ia ECS Fargate Terraform Cloud agent stack (IAM task role, no console password).",
    sourcePath: "tf-cloud-agents",
    moduleId: "tf-cloud-agents",
    kind: "tf-cloud-agents",
  },
];

export function gatesThrough(gate: PipelineGate): PipelineGate[] {
  const index = SEQUENCE.indexOf(gate);
  return SEQUENCE.slice(0, index + 1);
}

export const AGENT_CARDS: Array<{ gate: PipelineGate; name: string; mission: string }> = [
  { gate: "INGEST", name: "Source Ingestion", mission: "Parse Markdown/DOCX and prune token bloat." },
  { gate: "GRAPH_AND_PRUNE", name: "Knowledge Graph", mission: "Build Bloom DAG, skip gates, capture plan." },
  { gate: "PLAYWRIGHT_CAPTURE", name: "Playwright Runner", mission: "Login/console replica, 2x WebP snapshots." },
  { gate: "RAG_AUDIT", name: "Wiki-RAG Auditor", mission: "Score steps against AWS documentation." },
  { gate: "REACT_COMPOSE", name: "Course Composer", mission: "Write the lesson manifest and React module." },
  { gate: "GIT_COMMIT", name: "Git Release", mission: "Prepare conventional curriculum commit." },
];
