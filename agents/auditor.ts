import fs from "node:fs";
import path from "node:path";
import type { CollaborationBasin } from "../shared/basin.ts";
import type { AuditFinding, CaptureStep } from "../shared/types.ts";

interface KbDocument {
  id: string;
  service: string;
  title: string;
  url: string;
  pillars: string[];
  text: string;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9:]+/)
    .filter((token) => token.length > 1);
}

function bm25(
  query: string,
  documents: KbDocument[],
  k1 = 1.5,
  b = 0.75,
): Array<{ document: KbDocument; score: number }> {
  const queryTokens = tokenize(query);
  const docs = documents.map((document) => ({
    document,
    tokens: tokenize(`${document.title} ${document.text}`),
  }));
  const avgdl = docs.reduce((sum, doc) => sum + doc.tokens.length, 0) / docs.length;
  const df = new Map<string, number>();
  for (const token of new Set(queryTokens)) {
    df.set(token, docs.filter((doc) => doc.tokens.includes(token)).length);
  }
  return docs
    .map((doc) => {
      const tf = new Map<string, number>();
      for (const token of doc.tokens) {
        tf.set(token, (tf.get(token) ?? 0) + 1);
      }
      let score = 0;
      for (const token of queryTokens) {
        const freq = tf.get(token) ?? 0;
        const n = df.get(token) ?? 0;
        const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
        const denom = freq + k1 * (1 - b + b * (doc.tokens.length / avgdl));
        score += idf * ((freq * (k1 + 1)) / denom);
      }
      return { document: doc.document, score };
    })
    .sort((a, b) => b.score - a.score);
}

const FORBIDDEN_CLI = [
  /aws\s+iam\s+create-access-key/i,
  /AdministratorAccess/,
  /AKIA[0-9A-Z]{16}/,
  /aws_secret_access_key/i,
];

export function auditStep(step: CaptureStep, documents: KbDocument[]): AuditFinding {
  const ranked = bm25(`${step.title} ${step.description} ${step.cliFallback ?? ""}`, documents);
  const top = ranked.slice(0, 3).filter((entry) => entry.score > 0);
  const notes: string[] = [];
  const hallucinationFlags: string[] = [];

  for (const pattern of FORBIDDEN_CLI) {
    if (step.cliFallback && pattern.test(step.cliFallback)) {
      hallucinationFlags.push(`Unsafe CLI pattern: ${pattern}`);
    }
  }
  if (step.cliFallback?.includes("0.0.0.0/0") && /s3|iam/i.test(step.title)) {
    hallucinationFlags.push("Over-broad network or resource scope in CLI.");
  }
  if (!step.wellArchitectedPillars.length) {
    notes.push("Step is missing Well-Architected pillar tags.");
  }
  if (!top.length) {
    notes.push("No supporting AWS documentation snippet ranked above zero.");
  } else {
    notes.push(`Aligned with ${top[0].document.title}.`);
  }

  const coverage = Math.min(45, 18 + top.length * 9 + Math.min(12, top[0]?.score ?? 0));
  const safety = hallucinationFlags.length ? 0 : 35;
  const pedagogy = step.description.length > 80 && step.cliFallback ? 20 : 8;
  const score = Math.round(Math.min(100, coverage + safety + pedagogy));

  return {
    stepIndex: step.index,
    score,
    passed: score >= 70 && hallucinationFlags.length === 0,
    notes,
    citations: top.map((entry) => entry.document.url),
    hallucinationFlags,
  };
}

export function runAuditorAgent(basin: CollaborationBasin): void {
  basin.requireGate("PLAYWRIGHT_CAPTURE");
  const kbPath = path.join(process.cwd(), "knowledge", "aws-docs-kb.json");
  const documents = (JSON.parse(fs.readFileSync(kbPath, "utf8")) as { documents: KbDocument[] })
    .documents;
  const state = basin.read();
  const plan = state.capturePlan ?? [];
  const audits = plan.map((step) => auditStep(step, documents));
  const failed = audits.filter((audit) => !audit.passed);
  basin.update((next) => {
    next.audits = audits;
  });
  basin.post(
    {
      from: "pedagogical-auditor",
      to: "course-composer",
      gate: "RAG_AUDIT",
      status: failed.length ? "fail" : "ok",
      summary: failed.length
        ? `${failed.length} step(s) failed Wiki-RAG / rigor checks.`
        : `All ${audits.length} steps passed BM25 Wiki-RAG and safety scans.`,
      payload: {
        meanScore: Math.round(
          audits.reduce((sum, audit) => sum + audit.score, 0) / Math.max(audits.length, 1),
        ),
      },
    },
    failed.length ? "fail" : "ok",
  );
}
