import fs from "node:fs";
import path from "node:path";
import { AWS_SERVICES } from "./curriculum.ts";
import type { BloomLevel, LearnerTrack, LearningObjective, TechnicalTriplet } from "./types.ts";

const KEEP_HEADING =
  /learning objective|prerequisite|core concept|hands-on|lab |code example|cli|terraform|security|configuration|service overview|what is /i;
const DROP_HEADING = /interview|cheat sheet|further learning|certification practice/i;

export function collectSourceFiles(sourcePath: string, chapters?: string[]): string[] {
  const absolute = path.resolve(sourcePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Source not found: ${absolute}`);
  }
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    return [absolute];
  }

  const entries = fs.readdirSync(absolute);
  const chaptersFilter = chapters?.map((item) => item.replace(/^Chapter_/i, "").padStart(2, "0"));
  const markdown = entries
    .filter((name) => name.endsWith(".md"))
    .filter((name) => {
      if (!chaptersFilter?.length) {
        return /^Chapter_\d+/i.test(name) || name === "AWS_Services_Summary.md";
      }
      const match = name.match(/Chapter_(\d+)/i);
      if (!match) return false;
      return chaptersFilter.includes(match[1].padStart(2, "0"));
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!markdown.length) {
    throw new Error(`No chapter markdown found in ${absolute}`);
  }
  return markdown.map((name) => path.join(absolute, name));
}

export function pruneChapter(markdown: string, maxChars = 24_000): string {
  const parts = markdown.split(/^## /m);
  const title = parts[0] ?? "";
  const kept = [title.trim()];
  for (const part of parts.slice(1)) {
    const heading = part.split("\n", 1)[0] ?? "";
    if (DROP_HEADING.test(heading)) continue;
    if (KEEP_HEADING.test(heading) || kept.length < 4) {
      kept.push(`## ${part.trim()}`);
    }
  }
  let text = kept.join("\n\n");
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
  }
  return text;
}

export function bloomFromVerb(verb: string): BloomLevel {
  const key = verb.toLowerCase();
  if (/explain|describe|identify|list/.test(key)) return "understand";
  if (/create|configure|implement|write|build|run/.test(key)) return "apply";
  if (/troubleshoot|compare|analyze/.test(key)) return "analyze";
  if (/evaluate|verify|audit/.test(key)) return "evaluate";
  if (/design|architect|create a production/.test(key)) return "create";
  return "apply";
}

export function trackFromBloom(bloom: BloomLevel): LearnerTrack {
  if (bloom === "understand" || bloom === "remember") return "beginner";
  if (bloom === "apply" || bloom === "analyze") return "intermediate";
  return "advanced";
}

export function extractTitle(text: string): string {
  const chapter = text.match(/^#\s+Chapter\s+\d+\s+[—-]\s+(.+)$/m);
  if (chapter?.[1]) return chapter[1].trim();
  const heading = text.match(/^#\s+(?!SOURCE)(.+)$/m);
  return heading?.[1]?.trim() || "AWS Academy Module";
}

export function extractObjectives(text: string): LearningObjective[] {
  const section = text.match(/##[^\n]*Learning Objectives[\s\S]*?(?=\n##\s|\n#[^#]|$)/i)?.[0] ?? text;
  const lines = [...section.matchAll(/^\s*\d+\.\s+\*?\*?([A-Za-z]+)\*?\*?\s+(.+)$/gm)];
  const objectives: LearningObjective[] = [];
  let previousId: string | undefined;
  for (const [index, match] of lines.entries()) {
    const verb = match[1];
    const rest = match[2].replace(/\*+/g, "").trim();
    const bloom = bloomFromVerb(verb);
    const services = AWS_SERVICES.filter((service) =>
      new RegExp(`\\b${service.replace(" ", "\\s+")}\\b`, "i").test(`${verb} ${rest}`),
    );
    const inferred =
      services.length > 0
        ? services
        : AWS_SERVICES.filter((service) => new RegExp(`\\b${service}\\b`, "i").test(text)).slice(0, 2);
    const id = `lo-${index + 1}-${verb.toLowerCase()}`;
    objectives.push({
      id,
      title: `${verb} ${rest}`.replace(/\s+/g, " ").trim(),
      bloom,
      services: inferred.length ? inferred : ["IAM"],
      prerequisites: previousId ? [previousId] : [],
      track: trackFromBloom(bloom),
      triplets: inferred.map((target) => ({
        subject: "Learner",
        action: verb.toLowerCase(),
        target,
      })),
    });
    previousId = id;
  }
  return objectives;
}

export function extractSafeCli(text: string): string[] {
  const fromFences = [...text.matchAll(/```(?:bash|sh|shell|cli)?\n([\s\S]*?)```/gi)].flatMap((block) =>
    block[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^aws\s+/.test(line)),
  );
  const fromLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^aws\s+[a-z0-9-]+/i.test(line));
  const unique = new Map<string, string>();
  for (const command of [...fromFences, ...fromLines]) {
    const normalized = command.replace(/\s+/g, " ").trim();
    if (!normalized.startsWith("aws ")) continue;
    unique.set(normalized, normalized);
  }
  return [...unique.values()];
}

export function extractLabNarratives(text: string): Array<{ title: string; steps: string[] }> {
  const labs: Array<{ title: string; steps: string[] }> = [];
  const labBlocks = [...text.matchAll(/###\s+(Lab[^:\n]*:?[^\n]*)\n([\s\S]*?)(?=\n### |\n## |$)/gi)];
  for (const block of labBlocks) {
    const steps = [...block[2].matchAll(/^\s*\d+\.\s+(.+)$/gm)].map((item) => item[1].trim());
    labs.push({ title: block[1].trim(), steps });
  }
  return labs;
}

export function extractTriplets(text: string): TechnicalTriplet[] {
  const unique = new Map<string, TechnicalTriplet>();
  for (const service of AWS_SERVICES) {
    if (!new RegExp(`\\b${service.replace(" ", "\\s+")}\\b`, "i").test(text)) continue;
    const actionMatch = text.match(
      /\b(create|attach|enable|restrict|verify|run|update|grant|allow|configure|deploy)\b/i,
    );
    const triplet = {
      subject: "Learner",
      action: (actionMatch?.[1] ?? "configure").toLowerCase(),
      target: service,
    };
    unique.set(`${triplet.action}->${triplet.target}`, triplet);
  }
  return [...unique.values()];
}
