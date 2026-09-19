import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { execFileSync } from "node:child_process";
import type { CollaborationBasin } from "../shared/basin.ts";
import { collectSourceFiles, extractTriplets, pruneChapter } from "../shared/extract.ts";

function isGitUrl(value: string): boolean {
  return /^https?:\/\/github\.com\//i.test(value) || value.endsWith(".git");
}

function materializeSource(sourcePath: string): string {
  if (!isGitUrl(sourcePath)) {
    return path.resolve(sourcePath);
  }
  const cache = path.join(process.cwd(), ".cache", "Uday_AWS");
  if (!fs.existsSync(path.join(cache, ".git"))) {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    execFileSync(
      "git",
      ["clone", "--depth", "1", "--filter=blob:none", "--sparse", sourcePath, cache],
      { stdio: "inherit" },
    );
    execFileSync(
      "git",
      [
        "-C",
        cache,
        "sparse-checkout",
        "set",
        "--no-cone",
        "/*.md",
        "/aws-lambda-masterclass/README.md",
        "/aws-lambda-masterclass/js/data/module-01-iam.js",
        "/aws-lambda-masterclass/js/data/module-02-s3.js",
        "/aws-lambda-masterclass/js/data/module-08-lambda.js",
      ],
      { stdio: "inherit" },
    );
  }
  return cache;
}

async function readFileSource(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (ext === ".pdf") {
    return "";
  }
  return fs.readFileSync(filePath, "utf8");
}

export async function runIngestionAgent(
  basin: CollaborationBasin,
  sourcePath: string,
  chapters?: string[],
): Promise<void> {
  const resolved = materializeSource(sourcePath);
  const files = collectSourceFiles(resolved, chapters);
  const chunks: string[] = [];
  for (const file of files) {
    const raw = await readFileSource(file);
    if (!raw.trim()) continue;
    chunks.push(`# SOURCE ${path.basename(file)}\n\n${pruneChapter(raw)}`);
  }
  const combined = chunks.join("\n\n---\n\n").replace(/\u00a0/g, " ").trim();
  if (!combined) {
    throw new Error("Ingestion produced empty text.");
  }
  const triplets = extractTriplets(combined);
  basin.update((state) => {
    state.sourcePath = resolved;
    state.rawText = combined;
    state.triplets = triplets;
  });
  basin.post(
    {
      from: "ingestion-kg-sentinel",
      to: "knowledge-graph",
      gate: "INGEST",
      status: triplets.length ? "ok" : "fail",
      summary: `Ingested ${files.length} source file(s) from ${path.basename(resolved)}; ${triplets.length} triplets after prune (${combined.length} chars).`,
      payload: {
        tripletCount: triplets.length,
        chars: combined.length,
        files: files.map((file) => path.basename(file)),
      },
    },
    triplets.length ? "ok" : "fail",
  );
}
