import fs from "node:fs";
import path from "node:path";
import type { CollaborationBasin } from "../shared/basin.ts";
import { DEFAULT_CAPTURE_PLAN } from "../shared/capture-plan.ts";
import type { VisualAsset } from "../shared/types.ts";
import { AwsConsoleVisualRecorder } from "../scripts/playwright-recorder.ts";

export { DEFAULT_CAPTURE_PLAN };

export async function runPlaywrightAgent(
  basin: CollaborationBasin,
  options: { moduleId: string; mockServerOrigin: string; authStoragePath?: string },
): Promise<void> {
  basin.requireGate("GRAPH_AND_PRUNE");
  assertCaptureLayout();
  const recorder = new AwsConsoleVisualRecorder(options.moduleId);
  await recorder.initialize({
    authStoragePath: options.authStoragePath,
    baseURL: options.mockServerOrigin,
  });

  try {
    const assets: VisualAsset[] = [];
    for (const step of DEFAULT_CAPTURE_PLAN) {
      const captured = await recorder.recordStep({
        stepIndex: step.index,
        slug: step.slug,
        targetSelector: step.selector,
        caption: step.caption,
        actionBeforeCapture: async (page) => {
          await page.goto(step.route, { waitUntil: "networkidle" });
          if (step.highlight) {
            await page.locator(step.highlight).evaluate((el) => {
              el.classList.add("capture-highlight");
            });
          }
        },
      });
      assets.push(captured);
    }
    basin.update((state) => {
      state.capturePlan = DEFAULT_CAPTURE_PLAN;
      state.assets = assets;
    });
    basin.post(
      {
        from: "playwright-runner",
        to: "pedagogical-auditor",
        gate: "PLAYWRIGHT_CAPTURE",
        status: "ok",
        summary: `Captured ${assets.length} Retina 2x walkthrough frames.`,
        payload: { count: assets.length },
      },
      "ok",
    );
  } finally {
    await recorder.close();
  }
}

export function assertCaptureLayout(): void {
  const mockDir = path.join(process.cwd(), "scripts", "mock-console");
  const required = ["iam.html", "vpc.html", "s3.html", "vpce.html", "cli.html", "cloudwatch.html"];
  for (const file of required) {
    if (!fs.existsSync(path.join(mockDir, file))) {
      throw new Error(`Mock AWS console is missing ${file}; capture would produce empty frames.`);
    }
  }
}
