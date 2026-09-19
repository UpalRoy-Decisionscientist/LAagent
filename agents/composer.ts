import fs from "node:fs";
import path from "node:path";
import type { CollaborationBasin } from "../shared/basin.ts";
import type { CourseManifest, LessonStep } from "../shared/types.ts";

export function composeManifest(basin: CollaborationBasin): CourseManifest {
  const state = basin.read();
  const audits = new Map((state.audits ?? []).map((audit) => [audit.stepIndex, audit]));
  const assets = new Map((state.assets ?? []).map((asset) => [asset.stepIndex, asset]));
  const skipGates = state.skipGates ?? [];

  const steps: LessonStep[] = (state.capturePlan ?? []).map((step) => {
    const audit = audits.get(step.index);
    const asset = assets.get(step.index);
    if (!asset) {
      throw new Error(`Missing visual asset for step ${step.index}`);
    }
    return {
      id: step.index,
      title: step.title,
      description: step.description,
      imageSrc: asset.webpPath,
      imageWidth: asset.width,
      imageHeight: asset.height,
      alt: `${step.caption} Redacted AWS Console snapshot for ${step.title}.`,
      cliFallback: step.cliFallback,
      terraformFallback: step.terraformFallback,
      auditPassed: audit?.passed ?? false,
      academicRigorScore: audit?.score ?? 0,
      citations: audit?.citations ?? [],
    };
  });

  const mean =
    steps.reduce((sum, step) => sum + step.academicRigorScore, 0) / Math.max(steps.length, 1);

  return {
    moduleId: state.moduleId,
    title: state.courseTitle ?? "AWS Academy Module",
    summary:
      state.courseSummary ??
      "Compiled from ingested curriculum sources with audited visual walkthroughs.",
    services: [...new Set(state.objectives?.flatMap((objective) => objective.services) ?? [])],
    tracks: ["beginner", "intermediate", "advanced"],
    objectives: state.objectives ?? [],
    steps,
    skipGates,
    academicRigorScore: Math.round(mean),
    generatedAt: new Date().toISOString(),
  };
}

export function runComposerAgent(basin: CollaborationBasin): void {
  basin.requireGate("RAG_AUDIT");
  const manifest = composeManifest(basin);
  const outDir = path.join(process.cwd(), "content", "modules");
  fs.mkdirSync(outDir, { recursive: true });
  const manifestPath = path.join(outDir, `${manifest.moduleId}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const generatedDir = path.join(process.cwd(), "src", "generated");
  fs.mkdirSync(generatedDir, { recursive: true });
  const generatedJson = path.join(generatedDir, "activeModule.json");
  fs.writeFileSync(generatedJson, JSON.stringify(manifest, null, 2));
  const generatedPath = path.join(generatedDir, "activeModule.ts");
  fs.writeFileSync(
    generatedPath,
    `import type { CourseManifest } from "../../shared/types.ts";\nimport manifest from "./activeModule.json";\n\nexport const activeModule = manifest as CourseManifest;\n`,
  );

  basin.update((state) => {
    state.manifest = manifest;
    state.composedFiles = [manifestPath, generatedPath];
  });
  basin.post(
    {
      from: "course-composer",
      to: "git-release",
      gate: "REACT_COMPOSE",
      status: "ok",
      summary: `Wrote lesson manifest with ${manifest.steps.length} audited visual steps (rigor ${manifest.academicRigorScore}).`,
      payload: { manifestPath },
    },
    "ok",
  );
}
