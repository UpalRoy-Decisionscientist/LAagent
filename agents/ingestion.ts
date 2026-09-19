import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import type { CollaborationBasin } from "../shared/basin.ts";
import type { TechnicalTriplet } from "../shared/types.ts";

const AWS_SERVICES = [
  "IAM",
  "VPC",
  "S3",
  "EC2",
  "Lambda",
  "ECS",
  "CloudWatch",
  "CloudTrail",
  "KMS",
  "STS",
];

function stripBoilerplate(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(confidential|draft|internal use only).*$/gim, "")
    .trim();
}

function extractTriplets(text: string): TechnicalTriplet[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const triplets: TechnicalTriplet[] = [];
  for (const sentence of sentences) {
    for (const service of AWS_SERVICES) {
      if (new RegExp(`\\b${service}\\b`, "i").test(sentence)) {
        const actionMatch = sentence.match(
          /\b(create|attach|enable|restrict|verify|run|update|place|lock|grant|allow|confirm)\b/i,
        );
        triplets.push({
          subject: "Learner",
          action: (actionMatch?.[1] ?? "configure").toLowerCase(),
          target: service,
        });
      }
    }
  }
  const unique = new Map<string, TechnicalTriplet>();
  for (const triplet of triplets) {
    unique.set(`${triplet.action}->${triplet.target}`, triplet);
  }
  return [...unique.values()];
}

async function readSource(sourcePath: string): Promise<string> {
  const ext = path.extname(sourcePath).toLowerCase();
  const absolute = path.resolve(sourcePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Source not found: ${absolute}`);
  }
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: absolute });
    return result.value;
  }
  if (ext === ".pdf") {
    throw new Error(
      "PDF ingestion requires an explicit converter. Save as Markdown or DOCX for this pipeline.",
    );
  }
  return fs.readFileSync(absolute, "utf8");
}

export async function runIngestionAgent(
  basin: CollaborationBasin,
  sourcePath: string,
): Promise<void> {
  const raw = stripBoilerplate(await readSource(sourcePath));
  const triplets = extractTriplets(raw);
  basin.update((state) => {
    state.sourcePath = sourcePath;
    state.rawText = raw;
    state.triplets = triplets;
  });
  basin.post(
    {
      from: "ingestion-kg-sentinel",
      to: "knowledge-graph",
      gate: "INGEST",
      status: triplets.length ? "ok" : "fail",
      summary: `Ingested ${path.basename(sourcePath)}; extracted ${triplets.length} dense triplets.`,
      payload: { tripletCount: triplets.length, chars: raw.length },
    },
    triplets.length ? "ok" : "fail",
  );
}
